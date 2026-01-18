// scripts/utility-link-worker.mjs
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import path from "node:path";
import CryptoUtils from "../utils/common/crypto.ts";
import { raw } from "@prisma/client/runtime/library";
const { decryptPassword } = CryptoUtils;

// Immediate safety check
if (typeof decryptPassword !== "function") {
  throw new Error(
    `decryptPassword is still not a function. Type is: ${typeof decryptPassword}`
  );
}

const prisma = new PrismaClient();

// --- config ---
const WORKER_ID = process.env.WORKER_ID || crypto.randomUUID();
const POLL_MS = Number(process.env.UTILITY_WORKER_POLL_MS || 2000);
const LOCK_STALE_SECONDS = Number(
  process.env.UTILITY_WORKER_LOCK_STALE_SECONDS || 10 * 60
); // 10 min
const HEADLESS = false;
const DEBUG = true;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(...args) {
  console.log(`[utility-worker ${WORKER_ID}]`, ...args);
}

async function humanType(page, locator, text) {
  // If you pass a locator, use locator methods.
  // If you pass a string, use page methods.
  if (typeof locator.click === "function") {
    await locator.click();
    for (const char of text) {
      await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
    }
  } else {
    // Fallback for string selectors
    await page.click(locator);
    for (const char of text) {
      await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
    }
  }
}

// =====================================================
// Fix pattern: “try-get” helpers + only NoBill on missing bill widgets
// =====================================================

async function tryText(locator, timeoutMs = 8000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: timeoutMs });
    const t = await locator.first().textContent();
    const trimmed = (t || "").trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

async function tryAttr(locator, name, timeoutMs = 8000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: timeoutMs });
    const v = await locator.first().getAttribute(name);
    const trimmed = (v || "").trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

// =====================================================
// ENHANCED STATUS TRACKING
// =====================================================

async function updateJobProgress(jobId, phase, message = null) {
  const validPhases = ["PENDING", "RUNNING", "NEEDS_2FA", "SUCCESS", "FAILED"];

  if (!validPhases.includes(phase)) {
    log(`Warning: Invalid phase "${phase}". Using "RUNNING".`);
    phase = "RUNNING";
  }

  try {
    await prisma.utilityLinkJob.update({
      where: { id: jobId },
      data: {
        status: phase,
        lastError:
          phase === "FAILED" ? message : `[PROGRESS] ${message || phase}`,
        lockedAt: ["SUCCESS", "FAILED"].includes(phase) ? null : new Date(),
        lockedBy: ["SUCCESS", "FAILED"].includes(phase) ? null : WORKER_ID,
        finishedAt: ["SUCCESS", "FAILED"].includes(phase) ? new Date() : null,
      },
    });

    if (DEBUG) log(`Job ${jobId} → ${phase}${message ? `: ${message}` : ""}`);
  } catch (err) {
    log(`Failed to update job progress:`, err.message);
  }
}

async function claimOnePendingJob() {
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

  await prisma.$transaction(async (tx) => {
    // Update job status
    await tx.utilityLinkJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: msg,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });

    // Check if utility was already linked before this job
    const utility = await tx.utilityAccount.findUnique({
      where: { id: job.utilityAccountId },
      select: { isLinked: true },
    });

    // Only unlink if this was an initial link attempt (not a re-sync)
    // If already linked, keep it linked - this was just a re-sync failure
    if (utility && !utility.isLinked) {
      await tx.utilityAccount.update({
        where: { id: job.utilityAccountId },
        data: {
          isLinked: false,
        },
      });
    }
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
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await prisma.utilityLinkJob.findUnique({
      where: { id: jobId },
      select: { twoFactorCode: true, status: true },
    });

    if (job?.status === "FAILED") return null;
    if (job?.twoFactorCode) return job.twoFactorCode;

    await sleep(3000);
  }
  throw new Error("Timed out waiting for 2FA code from user.");
}

async function markJobSuccess(job) {
  await prisma.$transaction(async (tx) => {
    await tx.utilityLinkJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        lastError: "[PROGRESS] Complete",
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

async function markJobSuccessNoBill(
  job,
  note = "No bill available in current cycle"
) {
  await prisma.$transaction(async (tx) => {
    await tx.utilityLinkJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        lastError: `[PROGRESS] ${note}`,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });

    // Mark as linked even if no bill found (credentials are valid)
    await tx.utilityAccount.update({
      where: { id: job.utilityAccountId },
      data: {
        isLinked: true,
      },
    });
  });
}

async function saveScrapedBill(
  prisma,
  { amount, dueDate, accountNumber, utilityAccountId, householdId, ownerUserId }
) {
  return await prisma.$transaction(async (tx) => {
    const externalId = `pge-${accountNumber}-${dueDate.getTime()}`;
    const existing = await tx.bill.findFirst({
      where: { householdId, externalId },
    });

    if (existing) return existing;

    const scheduledChargeDate = new Date(dueDate);
    scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

    const bill = await tx.bill.create({
      data: {
        householdId,
        ownerUserId,
        createdByUserId: ownerUserId,
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

// =====================================================
// ENHANCED PG&E RUNNER WITH STATUS UPDATES
// =====================================================

async function runPgeLink(job) {
  const PGE_LOGIN_URL = "https://www.pge.com/myaccount/";

  // Step 1: Fetch utility account
  await updateJobProgress(job.id, "RUNNING", "Initializing secure session");

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

  // Step 2: Launch browser
  await updateJobProgress(job.id, "RUNNING", "Starting secure browser");

  chromium.use(stealth());
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    hasTouch: false,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });

  // Avoid certain extra headers that bots often send
  await context.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(45_000);

    // Step 3: Navigate to login
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Navigating to PG&E login portal"
    );

    if (DEBUG) log("Navigating to", PGE_LOGIN_URL);
    await page.goto(PGE_LOGIN_URL, { waitUntil: "networkidle" });

    // Step 4: Fill login form
    await updateJobProgress(job.id, "RUNNING", "Submitting login credentials");

    const userSelector = 'input[name="username"]';
    const passSelector = 'input[name="password"]';
    const loginBtnSelector = "button.PrimarySignInButton";

    await page.waitForSelector(userSelector, { state: "visible" });
    await page.fill(userSelector, utility.loginEmail);
    await page.fill(passSelector, password);

    if (DEBUG) log("Fields filled, clicking Sign In...");

    await Promise.all([
      page.click(loginBtnSelector),
      page.waitForLoadState("networkidle"),
    ]);

    // Step 5: Handle 2FA or proceed
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Checking authentication status"
    );

    if (DEBUG) log("Waiting for transition (MFA or Dashboard)...");

    const mfaSelector = ".mfaFieldset";
    const dashboardUrlPart = "dashboard";

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
      // Step 6: Handle 2FA
      await updateJobProgress(
        job.id,
        "RUNNING",
        "Two-factor authentication required"
      );

      if (DEBUG) log("2FA detected via selector. Selecting SMS Text option...");

      const smsButton = page.locator('button:has-text("SMS Text")');
      await smsButton.waitFor({ state: "visible" });
      await smsButton.click({ force: true });

      if (DEBUG) log("SMS Button clicked. Waiting for code input field...");

      const otpInput = page.locator(".otpfield_input");
      await otpInput.waitFor({ state: "visible", timeout: 10000 });

      // Signal UI and wait for code
      await markJobNeeds2FA(job, "Please enter the 6-digit code sent via SMS.");
      const userProvidedCode = await waitForTwoFactorCode(job.id);

      if (!userProvidedCode)
        throw new Error("2FA entry was cancelled or timed out.");

      // Step 7: Submit 2FA code
      await updateJobProgress(job.id, "RUNNING", "Verifying security code");

      if (DEBUG) log("Code received. Filling input...");

      await otpInput.click();
      await otpInput.focus();
      await page.keyboard.type(userProvidedCode, { delay: 100 });

      await otpInput.dispatchEvent("input");
      await otpInput.dispatchEvent("change");
      await otpInput.dispatchEvent("blur");

      if (DEBUG) log("Waiting for button to enable...");

      const confirmButton = page.locator(
        '.mfaFieldset button.PrimaryButton:has-text("Confirm")'
      );
      await confirmButton.waitFor({ state: "visible" });
      await page.waitForFunction(
        (btn) => !btn.disabled,
        await confirmButton.elementHandle()
      );

      if (DEBUG) log("Confirming...");

      await Promise.all([
        confirmButton.click({ force: true }),
        page.waitForURL(
          (url) =>
            url.href.includes("dashboard") ||
            url.href.includes("/s/") ||
            url.href.includes("myaccount"),
          { timeout: 30000 }
        ),
      ]);

      if (DEBUG) log("Landed on Dashboard!");
    } else if (detectionResult === "DASHBOARD") {
      if (DEBUG) log("Direct login success: Landed on Dashboard without 2FA.");
    }

    // Step 8: Access granted
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Successfully authenticated - accessing dashboard"
    );

    // Step 9: Extract bill data
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Extracting current bill information"
    );

    try {
      const cardSelector = ".dashboardCurrentBalanceCardCache-component";
      const accountSelectorTag = "c-my-acct_-l-w-c_-account-selector";
      const accountValueSelector =
        'button[part="input-button"] [part="input-button-value"]';

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

      const balanceCard = page.locator(cardSelector);
      const accountComponent = page.locator(accountSelectorTag);

      const rawAmount = await balanceCard
        .locator(".CurrBalance")
        .first()
        .textContent();
      const rawDate = await balanceCard
        .locator(".DueDateValue")
        .first()
        .textContent();
      const rawAccount = await accountComponent
        .locator(accountValueSelector)
        .textContent();

      // If any critical data is missing, bill isn't ready yet
      if (!rawAmount || !rawDate || !rawAccount) {
        await markJobSuccessNoBill(
          job,
          "Account linked - bill data not yet available"
        );
        return { status: "SUCCESS", note: "Bill not ready", finalized: true };
      }

      const amountClean = parseFloat(rawAmount.replace(/[$,\s]/g, ""));
      const dateClean = new Date(rawDate.trim());
      const accountClean = rawAccount.trim();

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

      if (amountClean <= 0) {
        await updateJobProgress(
          job.id,
          "SUCCESS",
          "No balance due - account linked successfully"
        );
        await markJobSuccess(job);
        return { status: "SUCCESS", note: "No balance due", finalized: true };
      }

      // Step 10: Save to database
      await updateJobProgress(
        job.id,
        "RUNNING",
        "Syncing bill to your account"
      );

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

      // Step 11: Complete
      await updateJobProgress(job.id, "SUCCESS", "Bill synced successfully");
      return { status: "SUCCESS" };
    } catch (scrapeError) {
      log("Scraping/Saving Error:", scrapeError.message);
      throw scrapeError;
    }
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

// =====================================================
// SLO WATER RUNNER
// =====================================================

async function runSloWaterLink(job) {
  const SLO_LOGIN_URL = "https://slocity.merchanttransact.com/Login";

  // Step 1: Fetch utility account
  await updateJobProgress(job.id, "RUNNING", "Initializing secure session");

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

  // Step 2: Launch browser
  await updateJobProgress(job.id, "RUNNING", "Starting secure browser");

  chromium.use(stealth());
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    hasTouch: false,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });

  // Avoid certain extra headers that bots often send
  await context.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(45_000);

    // Step 3: Navigate to login
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Navigating to SLO Water login portal"
    );

    if (DEBUG) log("Navigating to", SLO_LOGIN_URL);
    await page.goto(SLO_LOGIN_URL, { waitUntil: "networkidle" });

    // Step 4: Fill login form
    await updateJobProgress(job.id, "RUNNING", "Submitting login credentials");

    const userSelector = 'input[name="Username"]';
    const passSelector = 'input[name="Password"]';
    const loginBtnSelector = 'button[type="submit"][data-cy="login"]';

    await page.waitForSelector(userSelector, { state: "visible" });

    if (DEBUG) log("Filling username field...");
    await page.fill(userSelector, utility.loginEmail);

    if (DEBUG) log("Filling password field...");
    await page.fill(passSelector, password);

    if (DEBUG) log("Fields filled, clicking Log In...");

    // Click login
    await page.click(loginBtnSelector);

    // Wait for either an error banner OR a successful URL
    const result = await Promise.race([
      page
        .waitForSelector('.alert.alert-danger[data-cy="error-message"]', {
          state: "visible",
          timeout: 12000,
        })
        .then(() => "ERROR"),
      page
        .waitForURL((url) => url.href.includes("/secure/home"), {
          timeout: 12000,
        })
        .then(() => "HOME"),
    ]).catch(() => "UNKNOWN");

    if (result === "ERROR") {
      throw new Error("Login failed: Invalid email or password");
    }

    if (result !== "HOME") {
      // fallback: check current URL quickly
      const currentUrl = page.url();
      if (!currentUrl.includes("/secure/home")) {
        throw new Error(
          `Login failed or timed out. Current URL: ${currentUrl}`
        );
      }
    }

    if (DEBUG) log("Login successful - on home page");

    // Step 6: Navigate to My Bill page
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Successfully authenticated - accessing bill details"
    );

    if (DEBUG) log("Clicking 'View My Bill' button...");

    const viewBillButton = page.locator(
      'a.cp-button.cp-button-raised.cp-button-outlined[href="/secure/MyBill"]'
    );
    await viewBillButton.waitFor({ state: "visible" });
    await viewBillButton.click();

    await page.waitForURL((url) => url.href.includes("/secure/MyBill"), {
      timeout: 15000,
    });

    if (DEBUG) log("Landed on My Bill page");

    // Step 7: Extract bill data
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Extracting current bill information"
    );

    try {
      // Wait for the bill details to load
      await page.waitForSelector("table#total", {
        state: "visible",
        timeout: 30000,
      });

      // Extract total amount due
      const amountElement = page.locator("table#total strong.h3");
      const rawAmount = await amountElement.textContent();

      // Extract account number
      const accountNumberElement = page.locator(
        '#accountInfoCollapse .col-auto:has(.cp-text-caption:text("Account Number"))'
      );
      const accountText = await accountNumberElement.textContent();
      const accountClean = accountText.replace(/Account Number/g, "").trim();

      // Extract due date from bill summary table
      const dueDateRow = page.locator(
        'table#bill-summary-totals-table tbody tr:has-text("Current Charges Due By")'
      );
      const dueDateText = await dueDateRow.textContent();

      // If any critical data is missing, bill isn't ready yet
      if (!rawAmount || !dueDateText || !accountClean) {
        await markJobSuccessNoBill(
          job,
          "Account linked - bill data not yet available"
        );
        return { status: "SUCCESS", note: "Bill not ready", finalized: true };
      }

      // Parse "Current Charges Due By 1/15/2026" to get the date
      const dueDateMatch = dueDateText.match(
        /Due By\s+(\d{1,2}\/\d{1,2}\/\d{4})/
      );
      if (!dueDateMatch) {
        await markJobSuccessNoBill(
          job,
          "Account linked - bill data not yet available"
        );
        return { status: "SUCCESS", note: "Bill not ready", finalized: true };
      }
      const dueDateString = dueDateMatch[1];

      // Clean and parse amount (strip $ and asterisk)
      const amountClean = parseFloat(rawAmount.replace(/[$,\s*]/g, ""));

      // Parse date (MM/DD/YYYY format)
      const dateClean = new Date(dueDateString);

      // Validation
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

      if (amountClean <= 0) {
        await markJobSuccessNoBill(job, "No balance due");
        return { status: "SUCCESS", note: "No balance due", finalized: true };
      }

      // Step 8: Save to database
      await updateJobProgress(
        job.id,
        "RUNNING",
        "Syncing bill to your account"
      );

      const fullUtility = await prisma.utilityAccount.findUnique({
        where: { id: job.utilityAccountId },
      });

      // Use SLO-specific external ID and biller
      await prisma.$transaction(async (tx) => {
        const externalId = `slo-${accountClean}-${dateClean.getTime()}`;
        const existing = await tx.bill.findFirst({
          where: { householdId: fullUtility.householdId, externalId },
        });

        if (existing) return existing;

        const scheduledChargeDate = new Date(dateClean);
        scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

        const bill = await tx.bill.create({
          data: {
            householdId: fullUtility.householdId,
            ownerUserId: fullUtility.ownerUserId || job.createdByUserId,
            createdByUserId: fullUtility.ownerUserId || job.createdByUserId,
            source: "UTILITY",
            externalId,
            utilityAccountId: fullUtility.id,
            biller: "City of San Luis Obispo",
            billerType: "Water/Sewer",
            amount: amountClean,
            dueDate: dateClean,
            scheduledCharge: scheduledChargeDate,
            status: "SCHEDULED",
          },
        });

        const members = await tx.user.findMany({
          where: { householdId: fullUtility.householdId },
        });

        const divisor = Math.max(members.length, 1);
        const split = amountClean / divisor;

        await tx.billParticipant.createMany({
          data: members.map((m) => ({
            billId: bill.id,
            userId: m.id,
            shareAmount: split,
            autopayEnabled: false,
          })),
        });

        await tx.activity.create({
          data: {
            householdId: fullUtility.householdId,
            userId: fullUtility.ownerUserId || job.createdByUserId,
            type: "bill_uploaded",
            description: "Latest bill automatically synced from SLO Water",
            detail: `SLO Water - $${amountClean.toFixed(2)}`,
            amount: amountClean,
            source: "UTILITY",
          },
        });

        return bill;
      });

      if (DEBUG) log("Bill saved and participants created successfully.");

      // Step 9: Complete
      await updateJobProgress(job.id, "SUCCESS", "Bill synced successfully");
      return { status: "SUCCESS" };
    } catch (scrapeError) {
      log("Scraping/Saving Error:", scrapeError.message);
      throw scrapeError;
    }
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

// =====================================================
// SOCALGAS RUNNER (NO 2FA)
// =====================================================

async function runSoCalGasLink(job) {
  const SCG_LOGIN_URL = "https://myaccount.socalgas.com/ui/login";
  const SCG_HOME_URL_PART = "/ui/home";

  // Step 1: Fetch utility account
  await updateJobProgress(job.id, "RUNNING", "Initializing secure session");

  const utility = await prisma.utilityAccount.findUnique({
    where: { id: job.utilityAccountId },
    select: {
      id: true,
      loginEmail: true,
      encryptedPassword: true,
      passwordIv: true,
      householdId: true,
      ownerUserId: true,
    },
  });

  if (!utility) throw new Error("Utility account not found");

  const password = decryptPassword(
    utility.encryptedPassword,
    utility.passwordIv
  );

  // Step 2: Launch browser
  await updateJobProgress(job.id, "RUNNING", "Starting secure browser");

  chromium.use(stealth());
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    hasTouch: false,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });

  // Avoid certain extra headers that bots often send
  await context.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(45_000);

    // Step 3: Navigate to login
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Navigating to SoCalGas login portal"
    );
    if (DEBUG) log("Navigating to", SCG_LOGIN_URL);

    // For SPA-ish apps, domcontentloaded is typically faster/more reliable than networkidle
    await page.goto(SCG_LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Step 4: Fill login form
    await updateJobProgress(job.id, "RUNNING", "Submitting login credentials");

    // These are web components; Playwright can usually pierce open shadow DOM.
    const emailInput = page.locator('scg-text-field[input-id="email"] input');
    const passInput = page.locator('scg-text-field[input-id="password"] input');
    const loginBtn = page.locator('scg-button[data-testid="login-button"]');

    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(utility.loginEmail);

    await passInput.waitFor({ state: "visible", timeout: 15000 });
    await passInput.fill(password);

    if (DEBUG) log("Fields filled, clicking Log In...");

    // Click login and wait for success signal (URL or a stable element on home)
    await page.click('scg-button[data-testid="login-button"]');

    await updateJobProgress(
      job.id,
      "RUNNING",
      "Checking authentication status"
    );

    const homeHeader = page.locator('h2.page-description[aria-label*="Acct#"]');

    const outcome = await Promise.race([
      page
        .waitForURL((url) => url.href.includes(SCG_HOME_URL_PART), {
          timeout: 20000,
        })
        .then(() => "HOME"),
      homeHeader
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => "HOME"),
    ]).catch(() => "UNKNOWN");

    if (outcome !== "HOME") {
      const currentUrl = page.url();
      throw new Error(`Login failed or timed out. Current URL: ${currentUrl}`);
    }

    if (DEBUG) log("Login successful - on home page");

    // Step 5: Access granted
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Successfully authenticated - accessing bill details"
    );

    // Step 6: Extract bill data
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Extracting current bill information"
    );

    // Account number: aria-label="Residential Acct# 03871620021"
    await homeHeader.waitFor({ state: "visible", timeout: 15000 });
    const aria = await homeHeader.getAttribute("aria-label");
    const acctMatch = aria?.match(/Acct#\s*([0-9]+)/i);
    const accountClean = acctMatch?.[1]?.trim() || null;

    // Balance + due date
    const balanceWrap = page.locator('[data-testid="balance-with-due-date"]');
    await balanceWrap.waitFor({ state: "visible", timeout: 20000 });

    // IMPORTANT: use tryText so missing pieces become null instead of throwing
    const rawAmount = await tryText(balanceWrap.locator("span.text-4xl"), 8000);

    // Try multiple due selectors in case the UI changed slightly
    const rawDue =
      (await tryText(
        page.locator('[data-testid="balance-due-date"] span.font-extrabold'),
        8000
      )) ||
      (await tryText(page.locator('[data-testid="balance-due-date"]'), 8000)) ||
      null;

    // ---- Decide: NoBill vs Hard Fail ----
    // If we can prove login succeeded (homeHeader visible) AND we have an account number,
    // but the bill fields aren't present, treat as "no bill yet".
    if (!accountClean) {
      throw new Error(
        `SoCalGas scrape failed: could not extract account number (aria="${aria}")`
      );
    }

    if (!rawAmount || !rawDue) {
      await updateJobProgress(
        job.id,
        "SUCCESS",
        "No bill available yet (missing amount/due widgets)"
      );
      await markJobSuccessNoBill(
        job,
        "Account linked - bill data not yet available"
      );
      return { status: "SUCCESS", note: "Bill not ready", finalized: true };
    }

    const amountClean = parseFloat((rawAmount || "").replace(/[$,\s]/g, ""));
    const dueStr = (rawDue || "").trim();

    // Some accounts show extra words; keep only date-like pattern if possible
    const m = dueStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const datePart = m ? m[1] : dueStr;

    // Safer date parsing than new Date("01/12/2026") (locale ambiguity):
    const [mm, dd, yyyy] = String(datePart)
      .split("/")
      .map((v) => parseInt(v, 10));
    const dateClean = new Date(yyyy, (mm || 1) - 1, dd || 1);

    if (!Number.isFinite(amountClean) || Number.isNaN(dateClean.getTime())) {
      // If the widgets exist but parsing fails, that’s likely a real bug
      throw new Error(
        `SoCalGas parse failed: amount="${rawAmount}" due="${rawDue}"`
      );
    }

    if (DEBUG) {
      log(
        `Scraped: $${amountClean} | Due: ${dateClean.toLocaleDateString()} | Acct: ${accountClean}`
      );
    }

    if (amountClean <= 0) {
      await markJobSuccessNoBill(job, "No balance due");
      return { status: "SUCCESS", note: "No balance due", finalized: true };
    }

    // Step 7: Save to database
    await updateJobProgress(job.id, "RUNNING", "Syncing bill to your account");

    // Use SoCalGas-specific external ID and biller
    await prisma.$transaction(async (tx) => {
      const externalId = `socalgas-${accountClean}-${dateClean.getTime()}`;

      const existing = await tx.bill.findFirst({
        where: { householdId: utility.householdId, externalId },
      });
      if (existing) return existing;

      const scheduledChargeDate = new Date(dateClean);
      scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

      const ownerUserId = utility.ownerUserId || job.createdByUserId;

      const bill = await tx.bill.create({
        data: {
          householdId: utility.householdId,
          ownerUserId,
          createdByUserId: ownerUserId,
          source: "UTILITY",
          externalId,
          utilityAccountId: utility.id,
          biller: "SoCalGas",
          billerType: "Gas",
          amount: amountClean,
          dueDate: dateClean,
          scheduledCharge: scheduledChargeDate,
          status: "SCHEDULED",
        },
      });

      const members = await tx.user.findMany({
        where: { householdId: utility.householdId },
      });
      const divisor = Math.max(members.length, 1);
      const split = amountClean / divisor;

      await tx.billParticipant.createMany({
        data: members.map((m) => ({
          billId: bill.id,
          userId: m.id,
          shareAmount: split,
          autopayEnabled: false,
        })),
      });

      await tx.activity.create({
        data: {
          householdId: utility.householdId,
          userId: ownerUserId,
          type: "bill_uploaded",
          description: "Latest bill automatically synced from SoCalGas",
          detail: `SoCalGas - $${amountClean.toFixed(2)}`,
          amount: amountClean,
          source: "UTILITY",
        },
      });

      return bill;
    });

    if (DEBUG) log("Bill saved and participants created successfully.");

    // Step 8: Complete
    await updateJobProgress(job.id, "SUCCESS", "Bill synced successfully");
    return { status: "SUCCESS" };
  } catch (e) {
    if (DEBUG) {
      const path = `error-snapshot-${job.id}.png`;
      await page.screenshot({ path, fullPage: true });
      log(`Saved error screenshot to ${path}`);
    }
    throw e;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// =====================================================
// SAN LUIS GARBAGE (WCI MyAccount) RUNNER
// =====================================================

async function runSanLuisGarbageLink(job) {
  const WCI_DASHBOARD_URL_PART = "/dashboard";
  const WCI_LOGIN_URL = "https://myaccount.wcicustomer.com/district/4110";

  // Step 1: Fetch utility account
  await updateJobProgress(job.id, "RUNNING", "Initializing secure session");

  const utility = await prisma.utilityAccount.findUnique({
    where: { id: job.utilityAccountId },
    select: {
      id: true,
      loginEmail: true,
      encryptedPassword: true,
      passwordIv: true,
      householdId: true,
      ownerUserId: true,
      accountNumber: true, // optional - you might already store it
    },
  });

  if (!utility) throw new Error("Utility account not found");
  if (!utility.loginEmail) throw new Error("Missing login email (User ID)");

  const password = decryptPassword(
    utility.encryptedPassword,
    utility.passwordIv
  );

  // Step 2: Launch browser
  await updateJobProgress(job.id, "RUNNING", "Starting secure browser");

  chromium.use(stealth());
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    hasTouch: false,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });

  // Avoid certain extra headers that bots often send
  await context.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(45_000);

    // Step 3: Navigate to login
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Navigating to San Luis Garbage login portal"
    );

    if (DEBUG) log("Navigating to", WCI_LOGIN_URL);
    // SPA-ish Angular; domcontentloaded tends to be more reliable than networkidle
    await page.goto(WCI_LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Step 4: Fill login form
    await updateJobProgress(job.id, "RUNNING", "Submitting login credentials");

    // From your HTML:
    // <input name="myuserid" ...>
    // password input has type="password" (id mat-input-1 but that can change)
    const userSelector = 'input[name="myuserid"]';
    const passSelector = 'input[type="password"]';
    const loginBtnSelector = "#login-button";

    await page.waitForSelector(userSelector, { state: "visible" });
    await page.fill(userSelector, utility.loginEmail);

    await page.waitForSelector(passSelector, { state: "visible" });
    await page.fill(passSelector, password);

    if (DEBUG) log("Fields filled, clicking Login...");

    await page.click(loginBtnSelector);
    await page.waitForTimeout(500);

    await updateJobProgress(
      job.id,
      "RUNNING",
      "Checking authentication status"
    );

    const loginErrorSelector = ".server-error";

    // Wait for either success nav OR error banner
    const outcome = await Promise.race([
      page
        .waitForURL((url) => url.href.includes(WCI_DASHBOARD_URL_PART), {
          timeout: 25000,
        })
        .then(() => "DASHBOARD"),
      page
        .waitForSelector(loginErrorSelector, {
          state: "visible",
          timeout: 25000,
        })
        .then(() => "ERROR"),
    ]).catch(() => "UNKNOWN");

    if (outcome === "ERROR") {
      const msg =
        (await page
          .locator(loginErrorSelector)
          .first()
          .textContent()
          .catch(() => null)) || "Login failed";
      throw new Error(msg.trim()); // "Login Failed - Invalid User ID/Password"
    }

    if (outcome !== "DASHBOARD") {
      // fallback: URL check
      const currentUrl = page.url();
      if (!currentUrl.includes(WCI_DASHBOARD_URL_PART)) {
        throw new Error(
          `Login failed or timed out. Current URL: ${currentUrl}`
        );
      }
    }
    if (DEBUG) log("Login successful - on dashboard page");

    // Step 5: Access granted
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Successfully authenticated - accessing dashboard"
    );

    // Step 6: Extract bill data
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Extracting current bill information"
    );

    // due date: <span class="wc-green date">Jan 20, 2026</span>
    // amount: <span class="wc-green amount"> $163.12 <span>*</span> ...
    const dueDateSelector = ".current-bill .due .wc-green.date";
    const amountSelector = ".current-bill .payment .left .wc-green.amount";
    // Account number
    const acctSelector = ".account-details .account-number-single";

    await page.waitForSelector(dueDateSelector, {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForSelector(amountSelector, {
      state: "visible",
      timeout: 30000,
    });

    await page.waitForSelector(acctSelector, {
      state: "visible",
      timeout: 30000,
    });

    const rawDue =
      (await page.locator(dueDateSelector).first().textContent()) || "";
    const rawAmount =
      (await page.locator(amountSelector).first().textContent()) || "";
    const rawAcct = await page.locator(acctSelector).first().textContent();

    const dueStr = rawDue.trim(); // "Jan 20, 2026"
    const amountClean = parseFloat(rawAmount.replace(/[$,\s*]/g, "")); // "$163.12 *" -> 163.12

    const accountClean = (rawAcct || "").trim();

    // If any critical data is missing, bill isn't ready yet
    if (!rawAmount || !dueStr || !accountClean) {
      await markJobSuccessNoBill(
        job,
        "Account linked - bill data not yet available"
      );
      return { status: "SUCCESS", note: "Bill not ready", finalized: true };
    }

    if (DEBUG) log(`Acct scraped: ${accountClean}`);

    // Safer date parse: "Jan 20, 2026" is unambiguous in en-US
    const dateClean = new Date(dueStr);

    if (
      !dueStr ||
      !Number.isFinite(amountClean) ||
      Number.isNaN(dateClean.getTime())
    ) {
      throw new Error(
        `Data extraction failed. Due: "${rawDue}", Amt: "${rawAmount}"`
      );
    }

    if (DEBUG) {
      log(`Scraped: $${amountClean} | Due: ${dateClean.toLocaleDateString()}`);
    }

    if (amountClean <= 0) {
      await markJobSuccessNoBill(job, "No balance due");
      return { status: "SUCCESS", note: "No balance due", finalized: true };
    }

    // Step 7: Save to database
    await updateJobProgress(job.id, "RUNNING", "Syncing bill to your account");

    await prisma.$transaction(async (tx) => {
      const externalId = `sanluisgarbage-${accountClean}-${dateClean.getTime()}`;

      await tx.utilityAccount.update({
        where: { id: utility.id },
        data: {
          accountNumber: accountClean,
        },
      });

      const existing = await tx.bill.findFirst({
        where: { householdId: utility.householdId, externalId },
      });
      if (existing) return existing;

      const scheduledChargeDate = new Date(dateClean);
      scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

      const ownerUserId = utility.ownerUserId || job.createdByUserId;

      const bill = await tx.bill.create({
        data: {
          householdId: utility.householdId,
          ownerUserId,
          createdByUserId: ownerUserId,
          source: "UTILITY",
          externalId,
          utilityAccountId: utility.id,
          biller: "San Luis Garbage",
          billerType: "Waste",
          amount: amountClean,
          dueDate: dateClean,
          scheduledCharge: scheduledChargeDate,
          status: "SCHEDULED",
        },
      });

      const members = await tx.user.findMany({
        where: { householdId: utility.householdId },
      });

      const divisor = Math.max(members.length, 1);
      const split = amountClean / divisor;

      await tx.billParticipant.createMany({
        data: members.map((m) => ({
          billId: bill.id,
          userId: m.id,
          shareAmount: split,
          autopayEnabled: false,
        })),
      });

      await tx.activity.create({
        data: {
          householdId: utility.householdId,
          userId: ownerUserId,
          type: "bill_uploaded",
          description: "Latest bill automatically synced from San Luis Garbage",
          detail: `San Luis Garbage - $${amountClean.toFixed(2)}`,
          amount: amountClean,
          source: "UTILITY",
        },
      });

      return bill;
    });

    if (DEBUG) log("Bill saved and participants created successfully.");

    // Step 8: Complete
    await updateJobProgress(job.id, "SUCCESS", "Bill synced successfully");
    return { status: "SUCCESS" };
  } catch (e) {
    if (DEBUG) {
      const path = `error-snapshot-${job.id}.png`;
      await page.screenshot({ path, fullPage: true });
      log(`Saved error screenshot to ${path}`);
    }
    throw e;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// =====================================================
// ATT RUNNER
// =====================================================
const ATT_LOGIN_URL = "https://www.att.com/acctmgmt/signin";

const ATT_OVERVIEW_URL = "https://www.att.com/acctmgmt/overview";
const ATT_BILLING_URL = "https://www.att.com/acctmgmt/billing/mybillingcenter";

function parseMoney(text) {
  const n = parseFloat(String(text || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * AT&T bill activity shows periods like: "Nov 26 - Dec 25"
 * Your note says: use the LAST date in that range as due date (Dec 25).
 *
 * We must infer a year. We assume:
 * - end date is closest upcoming/past relative to "now"
 * - if end month < start month => range crosses year boundary
 */
function parseAttBillRangeEndDate(rangeText, now = new Date()) {
  // Example: "Nov 26 - Dec 25"
  const m = String(rangeText || "").match(
    /^\s*([A-Za-z]{3})\s+(\d{1,2})\s*-\s*([A-Za-z]{3})\s+(\d{1,2})\s*$/
  );
  if (!m) return null;

  const startMon = m[1];
  const startDay = parseInt(m[2], 10);
  const endMon = m[3];
  const endDay = parseInt(m[4], 10);

  const monthIndex = (mon) => {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const i = months.indexOf(mon.toLowerCase());
    return i >= 0 ? i : null;
  };

  const startMonthIdx = monthIndex(startMon);
  const endMonthIdx = monthIndex(endMon) + 1; // Due 1 month after period ends
  if (startMonthIdx == null || endMonthIdx == null) return null;

  let year = now.getFullYear();

  // If range crosses year boundary (e.g., Dec -> Jan), end is in next year
  if (endMonthIdx < startMonthIdx) year += 1;

  // Construct end date
  const end = new Date(year, endMonthIdx, endDay);

  // If we inferred a year that's way off (e.g., end is > ~10 months in future),
  // shift back one year. This protects odd cases around Jan.
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 320) {
    end.setFullYear(end.getFullYear() - 1);
  }

  return end;
}

async function runAttLink(job) {
  await updateJobProgress(job.id, "RUNNING", "Initializing secure session");

  const utility = await prisma.utilityAccount.findUnique({
    where: { id: job.utilityAccountId },
    select: {
      id: true,
      loginEmail: true, // AT&T "User ID" can be email
      encryptedPassword: true,
      passwordIv: true,
      householdId: true,
      ownerUserId: true,
    },
  });

  if (!utility) throw new Error("Utility account not found");
  if (!utility.loginEmail) throw new Error("Missing login email (User ID)");

  const password = decryptPassword(
    utility.encryptedPassword,
    utility.passwordIv
  );

  await updateJobProgress(job.id, "RUNNING", "Starting secure browser");

  chromium.use(stealth());
  const browser = await chromium.launch({ headless: HEADLESS });
  // Use a unique directory per utility account or household
  const userDataDir = path.join(process.cwd(), ".att-sessions", utility.id);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    hasTouch: false,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });

  // Avoid certain extra headers that bots often send
  await context.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  const page = await context.newPage();

  // Register a handler for the Verint feedback modal
  // This will trigger automatically whenever the locator becomes visible
  await page.addLocatorHandler(
    page.locator("div.uws-modal.browseInvite"),
    async (modal) => {
      if (DEBUG) log("Feedback popup detected. Dismissing...");

      // Target the "No, thanks" button specifically
      const declineBtn = modal.locator(".uws-invite__button-decline");

      // Sometimes the close 'X' button is more reliable if the footer is slow to hydrate
      const closeBtn = modal.locator("button.uws-modal__close");

      try {
        if (await declineBtn.isVisible()) {
          await declineBtn.click();
        } else {
          await closeBtn.click();
        }
        if (DEBUG) log("Feedback popup dismissed successfully.");
      } catch (e) {
        log("Failed to dismiss popup, it might have closed itself:", e.message);
      }
    }
  );

  try {
    page.setDefaultTimeout(45_000);

    // 1) Go to AT&T sign-in
    await updateJobProgress(job.id, "RUNNING", "Navigating to AT&T sign-in");
    if (DEBUG) log("Navigating to", ATT_LOGIN_URL);

    // domcontentloaded is usually more stable on these auth flows
    await page.goto(ATT_LOGIN_URL, { waitUntil: "domcontentloaded" });

    // 2) Step 1: User ID
    await updateJobProgress(job.id, "RUNNING", "Entering AT&T User ID");

    const userIdInput = page.locator('input#userID[name="userID"]');
    const continueBtn = page.locator("button#continueFromUserLogin");

    await userIdInput.waitFor({ state: "visible", timeout: 20000 });
    await humanType(page, userIdInput, utility.loginEmail);

    // click continue -> should transition to password view
    await Promise.all([
      continueBtn.click(),
      // allow SPA transition; don't rely on networkidle
      page.waitForTimeout(750),
    ]);

    // 3) Step 2: Password
    await updateJobProgress(job.id, "RUNNING", "Entering AT&T password");

    const passwordInput = page.locator('input#password[name="password"]');
    const signInBtn = page.locator("button#signin");

    await passwordInput.waitFor({ state: "visible", timeout: 20000 });
    await humanType(page, passwordInput, password);

    if (DEBUG) log("AT&T password filled, clicking Sign in...");

    await Promise.all([signInBtn.click(), page.waitForTimeout(1000)]);

    // 4) Detect outcomes: success vs MFA vs login error
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Checking authentication status"
    );

    const outcome = await Promise.race([
      page
        .waitForURL((url) => url.href.includes("/acctmgmt/overview"), {
          timeout: 25000,
        })
        .then(() => "OVERVIEW"),
      page
        .waitForURL((url) => url.href.includes("/acctmgmt/"), {
          timeout: 25000,
        })
        .then(() => "ACCOUNT"),
      // common error container in your snippet:
      page
        .locator("#appErrorAbove")
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => "ERROR"),
      // fallback: if password field stays visible, likely bad login
      passwordInput
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => "STILL_ON_PASSWORD"),
    ]).catch(() => "UNKNOWN");

    if (outcome === "ERROR" || outcome === "STILL_ON_PASSWORD") {
      const errText =
        (await page
          .locator("#appErrorAbove")
          .textContent()
          .catch(() => null)) ||
        (await page
          .locator("#passwordInlineErrorText")
          .textContent()
          .catch(() => null)) ||
        "Login failed (check credentials)";
      throw new Error(`AT&T login failed: ${String(errText).trim()}`);
    }

    // If we didn't land clearly, try forcing overview.
    if (DEBUG) log("Auth outcome:", outcome, "current URL:", page.url());
    if (!page.url().includes("/acctmgmt/")) {
      // Many auth flows redirect; give it a moment then try again.
      await page.waitForTimeout(1500);
    }

    // Optional: handle MFA (AT&T sometimes triggers verify step)
    // Since you already have a generic "NEEDS_2FA" pipeline, we can add basic detection:
    const mfaDetected = await page
      .locator('input[type="tel"], input[autocomplete="one-time-code"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (mfaDetected) {
      await updateJobProgress(
        job.id,
        "RUNNING",
        "Two-factor authentication required"
      );
      await markJobNeeds2FA(
        job,
        "AT&T requires a verification code. Please enter it."
      );

      const code = await waitForTwoFactorCode(job.id);
      if (!code) throw new Error("2FA entry was cancelled or timed out.");

      const otp = page
        .locator('input[autocomplete="one-time-code"], input[type="tel"]')
        .first();
      await otp.fill(code);

      // Try common submit buttons
      const verifyBtn = page
        .locator(
          'button:has-text("Continue"), button:has-text("Verify"), button[type="submit"]'
        )
        .first();
      await Promise.all([
        verifyBtn.click().catch(() => {}),
        page.waitForTimeout(1500),
      ]);
    }

    // --- Step 4.5 & 5: Unified Navigation to Billing ---
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Navigating to AT&T billing center"
    );

    // 1. Ensure we are actually on the dashboard before trying to use the navbar
    await page.waitForURL((url) => url.href.includes("/acctmgmt/overview"), {
      timeout: 30000,
    });

    // 2. Human Dwell: Let the SSO tokens hydrate
    if (DEBUG) log("Dashboard reached. Dwelling 5s for session stability...");
    await page.waitForTimeout(5000);

    // 3. Try clicking the Navbar link first (most "human" way)
    const navLink = page.locator('a[aria-label="Billing Icon"]');
    await navLink.scrollIntoViewIfNeeded();
    await page.mouse.move(Math.random() * 200, Math.random() * 200);
    await navLink.click();

    // 4. Recovery logic: If the click fails or redirects to home, force the direct URL
    try {
      await Promise.race([
        page.waitForSelector('[data-testid="billandpay_BalanceCard"]', {
          state: "visible",
          timeout: 20000,
        }),
        page
          .waitForURL(
            (url) => url.href.endsWith(".com/") || url.href.includes("login"),
            { timeout: 20000 }
          )
          .then(() => {
            throw new Error("KICKED_TO_HOME");
          }),
      ]);
    } catch (err) {
      if (err.message === "KICKED_TO_HOME" || err.name === "TimeoutError") {
        log("Redirected or timed out. Attempting Direct Recovery Jump...");
        await page.goto(ATT_BILLING_URL, { waitUntil: "networkidle" });
      } else {
        throw err;
      }
    }

    // --- Step 6: Scrape: amount + account # + due date ---
    await updateJobProgress(
      job.id,
      "RUNNING",
      "Extracting current bill information"
    );

    const balanceCard = page
      .locator('[data-testid="billandpay_BalanceCard"]')
      .first();

    // Final wait for content - if the survey popup appears here,
    // the addLocatorHandler we registered earlier will catch it.
    await balanceCard.waitFor({ state: "visible", timeout: 30000 });

    // Amount: your HTML includes <div class="hidden-spoken">$80.30</div>
    const rawAmount =
      (await balanceCard
        .locator(".hidden-spoken")
        .first()
        .textContent()
        .catch(() => null)) ||
      (await balanceCard
        .locator('div[aria-label="pass due amount"]')
        .textContent()
        .catch(() => null)) ||
      "";

    const amountClean = parseMoney(rawAmount);
    if (!Number.isFinite(amountClean)) {
      throw new Error(
        `AT&T scrape failed: could not parse amount from "${rawAmount}"`
      );
    }

    // Account #: within the balance card header: "Account # 339854937"
    const headerAcctText =
      (await balanceCard
        .locator('span:has-text("Account #")')
        .first()
        .textContent()
        .catch(() => null)) || "";

    const acctMatch = headerAcctText.match(/Account\s*#\s*([0-9]+)/i);
    const accountClean = acctMatch?.[1]?.trim();

    // Due date per your note: from the *first* Bill activity period range, take the end date.
    // Grab first "Bill activity" range text like "Nov 26 - Dec 25"
    const activityCard = page
      .locator('[data-test-id^="bill_activity_card_"]')
      .first();
    const rangeLabel = activityCard.locator(
      ".type-base.font-regular.rte-styles"
    );

    // Wait for the "Shimmer" to end and text to appear
    let firstRangeText = "";
    for (let i = 0; i < 10; i++) {
      const text = await rangeLabel.textContent().catch(() => "");
      if (text && text.includes("-")) {
        // "Nov 26 - Dec 25" contains a dash
        firstRangeText = text.trim();
        break;
      }
      if (DEBUG) log("Waiting for date range hydration...");
      await page.waitForTimeout(500);
    }

    const dueDate = parseAttBillRangeEndDate(firstRangeText, new Date());

    // If any critical data is missing, bill isn't ready yet
    if (!amountClean || !dueDate || !accountClean) {
      await markJobSuccessNoBill(
        job,
        "Account linked - bill data not yet available"
      );
      return { status: "SUCCESS", note: "Bill not ready", finalized: true };
    }

    if (DEBUG) {
      log(
        `AT&T scraped: $${amountClean} | Due (range end): ${dueDate.toLocaleDateString()} | Acct: ${accountClean}`
      );
    }

    if (amountClean <= 0) {
      await markJobSuccessNoBill(job, "No balance due");
      return { status: "SUCCESS", note: "No balance due", finalized: true };
    }

    // 7) Save bill
    await updateJobProgress(job.id, "RUNNING", "Syncing bill to your account");

    await prisma.$transaction(async (tx) => {
      const externalId = `att-${accountClean}-${dueDate.getTime()}`;

      const existing = await tx.bill.findFirst({
        where: { householdId: utility.householdId, externalId },
      });
      if (existing) return existing;

      const scheduledChargeDate = new Date(dueDate);
      scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

      const ownerUserId = utility.ownerUserId || job.createdByUserId;

      const bill = await tx.bill.create({
        data: {
          householdId: utility.householdId,
          ownerUserId,
          createdByUserId: ownerUserId,
          source: "UTILITY",
          externalId,
          utilityAccountId: utility.id,
          biller: "AT&T",
          billerType: "Telecom/Internet",
          amount: amountClean,
          dueDate,
          scheduledCharge: scheduledChargeDate,
          status: "SCHEDULED",
        },
      });

      const members = await tx.user.findMany({
        where: { householdId: utility.householdId },
      });

      const divisor = Math.max(members.length, 1);
      const split = amountClean / divisor;

      await tx.billParticipant.createMany({
        data: members.map((m) => ({
          billId: bill.id,
          userId: m.id,
          shareAmount: split,
          autopayEnabled: false,
        })),
      });

      await tx.activity.create({
        data: {
          householdId: utility.householdId,
          userId: ownerUserId,
          type: "bill_uploaded",
          description: "Latest bill automatically synced from AT&T",
          detail: `AT&T - $${amountClean.toFixed(2)}`,
          amount: amountClean,
          source: "UTILITY",
        },
      });

      return bill;
    });

    await updateJobProgress(job.id, "SUCCESS", "Bill synced successfully");
    return { status: "SUCCESS" };
  } catch (e) {
    if (DEBUG) {
      const path = `error-snapshot-${job.id}.png`;
      await page.screenshot({ path, fullPage: true });
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

      if (result?.status === "NEEDS_2FA") {
        await markJobNeeds2FA(job, result.note);
        log("Job NEEDS_2FA", job.id);
        return;
      }

      // If runner already finalized (NoBill / NoBalance / etc), don't overwrite.
      if (result?.finalized) {
        log("Job SUCCESS (finalized in runner)", job.id);
        return;
      }

      await markJobSuccess(job);
      log("Job SUCCESS", job.id);
      return;
    }

    if (
      job.provider?.toLowerCase().includes("san luis obispo") ||
      job.provider?.toLowerCase().includes("slo")
    ) {
      const result = await runSloWaterLink(job);

      // If runner already finalized, don't overwrite.
      if (result?.finalized) {
        log("Job SUCCESS (finalized in runner)", job.id);
        return;
      }

      await markJobSuccess(job);
      log("Job SUCCESS", job.id);
      return;
    }

    if (job.provider?.toLowerCase().includes("socalgas")) {
      const result = await runSoCalGasLink(job);

      // If runner already finalized (NoBill / NoBalance / etc), don't overwrite.
      if (result?.finalized) {
        log("Job SUCCESS (finalized in runner)", job.id);
        return;
      }

      await markJobSuccess(job);
      log("Job SUCCESS", job.id);
      return;
    }

    if (
      job.provider?.toLowerCase().includes("san luis garbage") ||
      job.provider?.toLowerCase().includes("wcicustomer")
    ) {
      const result = await runSanLuisGarbageLink(job);

      // If runner already finalized, don't overwrite.
      if (result?.finalized) {
        log("Job SUCCESS (finalized in runner)", job.id);
        return;
      }

      await markJobSuccess(job);
      log("Job SUCCESS", job.id);
      return;
    }

    if (
      job.provider?.toLowerCase().includes("at&t") ||
      job.provider?.toLowerCase().includes("att")
    ) {
      const result = await runAttLink(job);

      if (result?.status === "NEEDS_2FA") {
        await markJobNeeds2FA(job, result.note);
        log("Job NEEDS_2FA", job.id);
        return;
      }

      // If runner already finalized, don't overwrite.
      if (result?.finalized) {
        log("Job SUCCESS (finalized in runner)", job.id);
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

    if (!job) {
      await sleep(POLL_MS);
      continue;
    }

    if (job && job.id) {
      try {
        await processJob(job);
      } catch (e) {
        log(`Critical failure on job ${job.id}:`, e.message);
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
