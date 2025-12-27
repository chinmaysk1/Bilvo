// scripts/utility-link-worker.mjs
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { decryptPassword } from "../utils/common/crypto";

const prisma = new PrismaClient();

// --- config ---
const WORKER_ID = process.env.WORKER_ID || crypto.randomUUID();
const POLL_MS = Number(process.env.UTILITY_WORKER_POLL_MS || 2000);
const LOCK_STALE_SECONDS = Number(
  process.env.UTILITY_WORKER_LOCK_STALE_SECONDS || 10 * 60
); // 10 min
const HEADLESS = true;
const DEBUG = true;

const PGE_LOGIN_URL = "https://www.pge.com/myaccount/";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(...args) {
  console.log(`[utility-worker ${WORKER_ID}]`, ...args);
}

async function claimOnePendingJob() {
  // Atomically:
  // - pick oldest PENDING job
  // - ignore stale locks
  // - lock row with SKIP LOCKED
  // - set RUNNING + lock fields + attempts++
  //
  // IMPORTANT: Prisma doesn't expose SKIP LOCKED nicely, so we use raw SQL.
  const rows = await prisma.$queryRawUnsafe(
    `
    WITH cte AS (
      SELECT id
      FROM "UtilityLinkJob"
      WHERE status = 'PENDING'
        AND (
            "lockedAt" IS NULL OR
            "lockedAt" < (NOW() - make_interval(secs => $1))
        )
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "UtilityLinkJob" j
    SET
      status = 'RUNNING',
      "lockedAt" = NOW(),
      "lockedBy" = $2,
      "startedAt" = COALESCE(j."startedAt", NOW()),
      attempts = j.attempts + 1,
      "updatedAt" = NOW()
    FROM cte
    WHERE j.id = cte.id
    RETURNING j.*;
  `,
    LOCK_STALE_SECONDS,
    WORKER_ID
  );

  return rows?.[0] ?? null;
}

async function markJob(jobId, status, lastError = null) {
  return prisma.utilityLinkJob.update({
    where: { id: jobId },
    data: {
      status,
      lastError,
      finishedAt: status === "RUNNING" ? null : new Date(),
      lockedAt: status === "RUNNING" ? new Date() : null,
      lockedBy: status === "RUNNING" ? WORKER_ID : null,
    },
  });
}

async function markJobFailed(job, errMsg) {
  if (!job?.id) return;

  const msg = errMsg?.slice(0, 2000) || "Unknown error";

  // If max attempts reached -> FAILED, else back to PENDING (retry)
  const latest = await prisma.utilityLinkJob.findUnique({
    where: { id: job.id },
    select: { attempts: true, maxAttempts: true },
  });

  const reachedMax =
    latest?.attempts != null &&
    latest?.maxAttempts != null &&
    latest.attempts >= latest.maxAttempts;

  await prisma.utilityLinkJob.update({
    where: { id: job.id },
    data: {
      status: reachedMax ? "FAILED" : "PENDING",
      lastError: msg,
      finishedAt: reachedMax ? new Date() : null,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function markJobNeeds2FA(job, note) {
  await prisma.utilityLinkJob.update({
    where: { id: job.id },
    data: {
      status: "NEEDS_2FA",
      lastError: (note || "2FA required").slice(0, 2000),
      finishedAt: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function waitForTwoFactorCode(jobId, timeoutMs = 180000) {
  // 3 minute timeout
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await prisma.utilityLinkJob.findUnique({
      where: { id: jobId },
      select: { twoFactorCode: true, status: true },
    });

    // If the user cancelled or the job was marked failed elsewhere
    if (job?.status === "FAILED") return null;

    // If the code has arrived
    if (job?.twoFactorCode) return job.twoFactorCode;

    await sleep(3000); // Poll DB every 3 seconds
  }
  throw new Error("Timed out waiting for 2FA code from user.");
}

async function markJobSuccess(job) {
  await prisma.$transaction(async (tx) => {
    await tx.utilityLinkJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        lastError: null,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });

    await tx.utilityAccount.update({
      where: { id: job.utilityAccountId },
      data: {
        isLinked: true,
      },
    });
  });
}

/**
 * Helper to clean and save the bill data to the database.
 * Mimics the logic in your /api/bills/index.ts
 */
async function saveScrapedBill(
  prisma,
  { amount, dueDate, accountNumber, utilityAccountId, householdId, ownerUserId }
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check if this specific bill already exists (idempotency)
    // We use a combination of account number and due date as a pseudo-externalId
    const externalId = `pge-${accountNumber}-${dueDate.getTime()}`;
    const existing = await tx.bill.findFirst({
      where: { householdId, externalId },
    });

    if (existing) return existing;

    // 2. Create the Bill
    const scheduledChargeDate = new Date(dueDate);
    scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

    const bill = await tx.bill.create({
      data: {
        householdId,
        ownerUserId,
        createdByUserId: ownerUserId, // System/Worker acted as owner
        source: "UTILITY",
        externalId,
        utilityAccountId,
        biller: "Pacific Gas & Electric",
        billerType: "Electricity/Gas",
        amount,
        dueDate,
        scheduledCharge: scheduledChargeDate,
        status: "SCHEDULED",
      },
    });

    // 3. Create Participants (Equal Split)
    const members = await tx.user.findMany({
      where: { householdId },
    });

    const divisor = Math.max(members.length, 1);
    const split = amount / divisor;

    await tx.billParticipant.createMany({
      data: members.map((m) => ({
        billId: bill.id,
        userId: m.id,
        shareAmount: split,
        autopayEnabled: false,
      })),
    });

    // 4. Activity Log
    await tx.activity.create({
      data: {
        householdId,
        userId: ownerUserId,
        type: "bill_uploaded",
        description: "Latest bill automatically synced from PG&E",
        detail: `PG&E - $${amount.toFixed(2)}`,
        amount,
        source: "UTILITY",
      },
    });

    return bill;
  });
}

// ---- Playwright PG&E runner ----
async function runPgeLink(job) {
  const utility = await prisma.utilityAccount.findUnique({
    where: { id: job.utilityAccountId },
    select: {
      id: true,
      loginEmail: true,
      encryptedPassword: true,
      passwordIv: true,
    },
  });

  if (!utility) throw new Error("Utility account not found");

  const password = decryptPassword(
    utility.encryptedPassword,
    utility.passwordIv
  );

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const currentUrl = page.url();

  try {
    page.setDefaultTimeout(45_000);

    if (DEBUG) log("Navigating to", PGE_LOGIN_URL);
    await page.goto(PGE_LOGIN_URL, { waitUntil: "networkidle" });

    // --- 1. LOGIN PHASE ---
    const userSelector = 'input[name="username"]';
    const passSelector = 'input[name="password"]';
    const loginBtnSelector = "button.PrimarySignInButton";

    await page.waitForSelector(userSelector, { state: "visible" });
    await page.fill(userSelector, utility.loginEmail);
    await page.fill(passSelector, password);

    if (DEBUG) log("Fields filled, clicking Sign In...");

    await Promise.all([
      // We don't use waitForNavigation because PG&E might stay on the same URL for MFA
      page.click(loginBtnSelector),
      page.waitForLoadState("networkidle"),
    ]);

    // --- 2. 2FA DETECTION & EXECUTION ---
    if (DEBUG) log("Waiting for transition (MFA or Dashboard)...");

    // We "race" to see which one shows up first
    const mfaSelector = ".mfaFieldset";
    const dashboardUrlPart = "dashboard";

    // This helper waits for either the MFA box to appear OR the URL to change to dashboard
    const detectionResult = await Promise.race([
      page
        .waitForSelector(mfaSelector, { state: "visible", timeout: 15000 })
        .then(() => "MFA"),
      page
        .waitForFunction(() => window.location.href.includes("dashboard"), {
          timeout: 15000,
        })
        .then(() => "DASHBOARD"),
      page
        .waitForSelector("text=Verify your identity", { timeout: 15000 })
        .then(() => "MFA"),
    ]).catch((e) => {
      if (DEBUG)
        log(
          "Neither MFA nor Dashboard detected within 15s. Proceeding to fallback check."
        );
      return "UNKNOWN";
    });

    if (detectionResult === "MFA") {
      if (DEBUG) log("2FA detected via selector. Selecting SMS Text option...");

      // Ensure the button is actually clickable (sometimes obscured by a loading spinner)
      const smsButton = page.locator('button:has-text("SMS Text")');
      await smsButton.waitFor({ state: "visible" });

      // Force click in case there's a transparent overlay
      await smsButton.click({ force: true });

      if (DEBUG) log("SMS Button clicked. Waiting for code input field...");

      // Wait for the OTP field to appear before signaling the UI
      const otpInput = page.locator(".otpfield_input");
      await otpInput.waitFor({ state: "visible", timeout: 10000 });

      // Signal UI and wait for code
      await markJobNeeds2FA(job, "Please enter the 6-digit code sent via SMS.");
      const userProvidedCode = await waitForTwoFactorCode(job.id);

      if (!userProvidedCode)
        throw new Error("2FA entry was cancelled or timed out.");

      if (DEBUG) log("Code received. Filling input...");
      await otpInput.fill(userProvidedCode);

      // PG&E Confirm button is often disabled until the input event fires properly
      await otpInput.dispatchEvent("change");

      const confirmButton = page.locator(
        '.mfaFieldset button.PrimaryButton:has-text("Confirm")'
      );
      await confirmButton.click();

      if (DEBUG) log("Waiting for Dashboard components to render...");
      await page.locator(".CurrBalance span").first().waitFor({
        state: "visible",
        timeout: 45000, // Dashboard can be slow
      });

      if (DEBUG) log("Dashboard reached.");
    } else if (detectionResult === "DASHBOARD") {
      if (DEBUG) log("Direct login success: Landed on Dashboard without 2FA.");
    }

    try {
      // 1. SELECTORS: Use the specific PG&E component tags
      const cardSelector = ".dashboardCurrentBalanceCardCache-component";
      const accountSelectorTag = "c-my-acct_-l-w-c_-account-selector";

      // This targets the specific 'part' Salesforce uses to render the active selection text
      const accountValueSelector =
        'button[part="input-button"] [part="input-button-value"]';

      // 2. WAIT for the components
      // Wait for the main card and the account selector component to be in the DOM
      await Promise.all([
        page.waitForSelector(cardSelector, {
          state: "visible",
          timeout: 30000,
        }),
        page.waitForSelector(accountSelectorTag, {
          state: "visible",
          timeout: 30000,
        }),
      ]);

      // 3. EXTRACT
      const balanceCard = page.locator(cardSelector);
      const accountComponent = page.locator(accountSelectorTag);

      // Get raw values using narrowed locators
      // We use .first() on the balance/date because the card might contain hidden mobile vs desktop views
      const rawAmount = await balanceCard
        .locator(".CurrBalance")
        .first()
        .textContent();
      const rawDate = await balanceCard
        .locator(".DueDateValue")
        .first()
        .textContent();

      // Drill down specifically into the account component's active button value
      const rawAccount = await accountComponent
        .locator(accountValueSelector)
        .textContent();

      // 4. CLEAN DATA
      const amountClean = parseFloat(rawAmount.replace(/[$,\s]/g, ""));
      const dateClean = new Date(rawDate.trim());
      const accountClean = rawAccount.trim();

      // VALIDATION: Ensure we didn't get empty strings
      if (!accountClean || accountClean === "" || isNaN(amountClean)) {
        throw new Error(
          `Data extraction failed. Acct: "${accountClean}", Amt: "${rawAmount}"`
        );
      }

      if (DEBUG) {
        log(
          `Scraped: $${amountClean} | Due: ${dateClean.toLocaleDateString()} | Acct: ${accountClean}`
        );
      }

      if (amountClean <= 0)
        return { status: "SUCCESS", note: "No balance due" };

      // 5. SYNC TO DATABASE
      // We need householdId and ownerUserId from the job/utility record
      const fullUtility = await prisma.utilityAccount.findUnique({
        where: { id: job.utilityAccountId },
      });

      await saveScrapedBill(prisma, {
        amount: amountClean,
        dueDate: dateClean,
        accountNumber: accountClean,
        utilityAccountId: fullUtility.id,
        householdId: fullUtility.householdId,
        ownerUserId: fullUtility.ownerUserId || job.createdByUserId,
      });

      if (DEBUG) log("Bill saved and participants created successfully.");
    } catch (scrapeError) {
      log("Scraping/Saving Error:", scrapeError.message);
      throw scrapeError;
    }

    // Error detection if still on a login/error page
    const errorMsg = await page
      .locator("#inputuser-1")
      .textContent()
      .catch(() => null);
    if (errorMsg?.includes("Error:")) {
      throw new Error(`PG&E Login Error: ${errorMsg.trim()}`);
    }

    if (!currentUrl.includes("login")) {
      return { status: "SUCCESS" };
    }

    throw new Error(
      "Failed to determine login result. Current URL: " + currentUrl
    );
  } catch (e) {
    if (DEBUG) {
      const path = `error-snapshot-${job.id}.png`;
      await page.screenshot({ path });
      log(`Saved error screenshot to ${path}`);
    }
    throw e;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function processJob(job) {
  try {
    if (DEBUG) log("Processing job", job.id, "provider:", job.provider);

    if (job.provider?.toLowerCase().includes("pacific gas")) {
      const result = await runPgeLink(job);

      if (result.status === "NEEDS_2FA") {
        await markJobNeeds2FA(job, result.note);
        log("Job NEEDS_2FA", job.id);
        return;
      }

      await markJobSuccess(job);
      log("Job SUCCESS", job.id);
      return;
    }

    throw new Error(`Unsupported provider: ${job.provider}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markJobFailed(job, msg);
    log("Job failed", job.id, msg);
  }
}

async function main() {
  log("Starting utility link worker");
  log("poll", POLL_MS, "ms", "| headless:", HEADLESS);

  let keepRunning = true;

  process.on("SIGINT", () => {
    keepRunning = false;
    log("SIGINT received, shutting down...");
  });
  process.on("SIGTERM", () => {
    keepRunning = false;
    log("SIGTERM received, shutting down...");
  });

  while (keepRunning) {
    let job = null;
    try {
      job = await claimOnePendingJob();
    } catch (e) {
      log("claim error:", e?.message || e);
    }

    // If no job found, sleep and try again
    if (!job) {
      await sleep(POLL_MS);
      continue;
    }

    // Double check job has an ID before processing
    if (job && job.id) {
      try {
        await processJob(job);
      } catch (e) {
        log(`Critical failure on job ${job.id}:`, e.message);
        // Attempt one last update to the DB so the job isn't stuck 'RUNNING'
        await markJobFailed(
          job,
          `Worker caught unhandled exception: ${e.message}`
        ).catch(() => {});
      }
    }
  }

  await prisma.$disconnect().catch(() => {});
  log("Worker stopped");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
