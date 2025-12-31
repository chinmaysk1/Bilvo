// scripts/utility-link-worker.mjs
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { chromium } from "playwright";
import CryptoUtils from "../utils/common/crypto.ts";
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

const PGE_LOGIN_URL = "https://www.pge.com/myaccount/";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(...args) {
  console.log(`[utility-worker ${WORKER_ID}]`, ...args);
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

  await prisma.utilityLinkJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      lastError: msg,
      finishedAt: new Date(),
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

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        return { status: "SUCCESS", note: "No balance due" };
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

    const currentUrl = page.url();

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

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

      // Parse "Current Charges Due By 1/15/2026" to get the date
      const dueDateMatch = dueDateText.match(
        /Due By\s+(\d{1,2}\/\d{1,2}\/\d{4})/
      );
      if (!dueDateMatch) {
        throw new Error("Could not extract due date from bill");
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
        await updateJobProgress(
          job.id,
          "SUCCESS",
          "No balance due - account linked successfully"
        );
        await markJobSuccess(job);
        return { status: "SUCCESS", note: "No balance due" };
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
    } catch (scrapeError) {
      log("Scraping/Saving Error:", scrapeError.message);
      throw scrapeError;
    }

    return { status: "SUCCESS" };
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

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    const accountClean = acctMatch?.[1]?.trim();

    // Balance + due date
    const balanceWrap = page.locator('[data-testid="balance-with-due-date"]');
    await balanceWrap.waitFor({ state: "visible", timeout: 20000 });

    const rawAmount = await balanceWrap
      .locator("span.text-4xl")
      .first()
      .textContent();
    const rawDue = await page
      .locator('[data-testid="balance-due-date"] span.font-extrabold')
      .first()
      .textContent();

    const amountClean = parseFloat((rawAmount || "").replace(/[$,\s]/g, ""));
    const dueStr = (rawDue || "").trim(); // "01/12/2026"

    // Safer date parsing than new Date("01/12/2026") (locale ambiguity):
    const [mm, dd, yyyy] = dueStr.split("/").map((v) => parseInt(v, 10));
    const dateClean = new Date(yyyy, (mm || 1) - 1, dd || 1);

    if (!accountClean || !Number.isFinite(amountClean) || !dueStr) {
      throw new Error(
        `Data extraction failed. Acct: "${accountClean}", Amt: "${rawAmount}", Due: "${rawDue}", aria: "${aria}"`
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
      return { status: "SUCCESS", note: "No balance due" };
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

    if (
      job.provider?.toLowerCase().includes("san luis obispo") ||
      job.provider?.toLowerCase().includes("slo")
    ) {
      const result = await runSloWaterLink(job);

      await markJobSuccess(job);
      log("Job SUCCESS", job.id);
      return;
    }

    if (job.provider?.toLowerCase().includes("socalgas")) {
      const result = await runSoCalGasLink(job);
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
