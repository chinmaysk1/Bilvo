// pages/api/bills/scan-gmail.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { BillSource } from "@prisma/client";

// -------- helpers --------
function decodeB64Url(s: string) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(norm, "base64").toString("utf8");
}

// prefer text/plain, then text/html; recurse for nested multiparts
function extractBody(part?: any): string {
  if (!part) return "";
  const mime = part.mimeType || "";

  if ((mime.startsWith("text/") || mime === "text") && part.body?.data) {
    return decodeB64Url(part.body.data);
  }

  // direct children preference
  if (part.parts?.length) {
    const plain = part.parts.find((p: any) =>
      p.mimeType?.startsWith("text/plain"),
    );
    if (plain?.body?.data) return decodeB64Url(plain.body.data);

    const html = part.parts.find((p: any) =>
      p.mimeType?.startsWith("text/html"),
    );
    if (html?.body?.data) {
      // naive html->text fallback (good enough for heuristics)
      return decodeB64Url(html.body.data).replace(/<[^>]+>/g, " ");
    }

    // recurse
    for (const p of part.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  return "";
}

// -------- your constants --------
const BILL_KEYWORDS = [
  "invoice",
  "bill",
  "payment due",
  "amount due",
  "statement",
  "receipt",
  "electricity",
  "water",
  "gas",
  "internet",
  "utility",
  "waste management",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email)
      return res.status(401).json({ error: "Unauthorized" });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const householdResponse = await fetch(`${baseUrl}/api/household/data`, {
      headers: { Cookie: req.headers.cookie || "" },
    });
    if (!householdResponse.ok)
      return res.status(404).json({ error: "Household not found" });

    const householdData = await householdResponse.json();
    const memberCount = householdData.household?.members?.length || 1;
    const householdId = householdData.household?.id;
    if (!householdId)
      return res.status(400).json({ error: "User not in a household" });

    const googleAccountResponse = await fetch(
      `${baseUrl}/api/user/google-account`,
      {
        headers: { Cookie: req.headers.cookie || "" },
      },
    );
    if (!googleAccountResponse.ok) {
      const errorData = await googleAccountResponse.json();
      return res.status(400).json({
        error: errorData.error || "No Gmail access token found.",
      });
    }

    const { googleAccount } = await googleAccountResponse.json();
    if (!googleAccount?.access_token)
      return res.status(400).json({
        error: "No Gmail access token found. Please re-connect Google.",
      });

    // --- Gmail client + refresh ---
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: googleAccount.access_token,
      refresh_token: googleAccount.refresh_token,
    });
    // ensures fresh token if expired
    await oauth2Client.getAccessToken();

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // --- Query ---
    const keywords = BILL_KEYWORDS.map((k) => `"${k}"`).join(" OR ");
    const query = [
      `newer_than:90d`,
      `(${keywords})`,
      `(has:attachment OR subject:amount OR subject:due OR subject:statement)`,
    ].join(" ");

    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
    });
    const estimate = list.data.resultSizeEstimate ?? 0;
    const ids = list.data.messages?.map((m) => m.id) || [];
    console.log("[gmail] estimate:", estimate, "ids:", ids.slice(0, 10));

    const potentialBills: any[] = [];

    if (ids.length === 0) {
      return res.status(200).json({
        success: true,
        potentialBills: [],
        debug: { query, estimate },
      });
    }

    // --- Fetch & parse each message (DON'T SAVE TO DATABASE) ---
    for (const id of ids.slice(0, 20)) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: id!,
          format: "full",
        });
        const payload = msg.data.payload;
        const headers = payload?.headers || [];
        const get = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name)?.value || "";

        const subject = get("subject");
        const from = get("from");
        const snippet = msg.data.snippet || "";
        const textForParse = [subject, from, snippet].join("\n");

        const dateHeader = get("date");
        const body = extractBody(payload);

        console.log("[gmail] parsed:", {
          id,
          subject,
          from,
          preview: body.slice(0, 120),
        });

        const billInfo = parseBillFromEmail(
          textForParse,
          body,
          from,
          dateHeader,
        );

        console.log("[gmail] billInfo result:", {
          id,
          billInfo,
          hasAmount: billInfo?.amount !== null,
        });

        if (!billInfo) continue;

        // Check if already exists
        const exists = await prisma.bill.findFirst({
          where: { householdId, source: BillSource.GMAIL, externalId: id! },
          select: { id: true },
        });

        if (exists) {
          console.log("[gmail] bill already exists:", id);
          continue;
        }

        // Add to potential bills array (NOT SAVING TO DATABASE YET)
        const billAmount = billInfo.amount ?? 0; // Use 0 if null for statement-ready bills
        potentialBills.push({
          id: id!,
          biller: billInfo.biller,
          billerType: billInfo.billerType,
          amount: billAmount,
          dueDate: billInfo.dueDate.toISOString(),
          subject,
          from,
          yourShare: billAmount / memberCount,
        });

        console.log("[gmail] added to potentialBills:", {
          biller: billInfo.biller,
          amount: billAmount,
        });
      } catch (e) {
        console.error("[gmail] get/parse failed:", id, e);
      }
    }

    console.log("[gmail] final potentialBills count:", potentialBills.length);

    return res.status(200).json({
      success: true,
      potentialBills,
      debug: { query, estimate, processed: ids.slice(0, 20).length },
    });
  } catch (error) {
    console.error("Error scanning Gmail:", error);
    if (error instanceof Error) {
      if (error.message.includes("Gmail API has not been used")) {
        return res.status(403).json({
          error:
            "Gmail API is not enabled. Please enable it in Google Cloud Console and try again in a few minutes.",
          details: error.message,
        });
      }
      if (error.message.includes("invalid_grant")) {
        return res.status(401).json({
          error: "Gmail access expired.",
        });
      }
      if (error.message.includes("insufficient")) {
        return res.status(403).json({
          error:
            "Insufficient Gmail permissions. Please re-connect Google with Gmail access.",
        });
      }
    }
    return res.status(500).json({
      error: "Failed to scan Gmail",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ---------- parser ----------
function isStatementReady(subject: string, from: string) {
  const s = (subject || "").toLowerCase();
  const f = (from || "").toLowerCase();
  const isPge = f.includes("pge.com") || s.includes("pg&e");
  const isBecu = f.includes("becu.org") || s.includes("becu");
  const isMerchantTransact =
    f.includes("merchanttransact.com") || s.includes("water and sewer");
  const ready =
    /statement is ready|is ready to view|statement available|your bill.*ready/i.test(
      s,
    );
  return ready && (isPge || isBecu || isMerchantTransact);
}

const KEYWORDED_AMOUNT_RE =
  /\b(?:total|amount|due|balance|bill|payment)\s*(?:is|of|due)?\s*[:\-]?\s*(?:usd\s*)?\$?\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)\b/i;

const GENERIC_CURRENCY_RE =
  /\b(?:usd\s*)?\$?\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)\b/;

function extractAmountFlexible(text: string): number | null {
  const m1 = text.match(KEYWORDED_AMOUNT_RE);
  if (m1) {
    const n = Number(m1[1].replace(/[,\s]/g, ""));
    return isFinite(n) ? n : null;
  }
  const m2 = text.match(GENERIC_CURRENCY_RE);
  if (m2) {
    const n = Number(m2[1].replace(/[,\s]/g, ""));
    // guard against nonsense like "$1" codes
    if (isFinite(n) && n >= 5 && n <= 20000) return n;
  }
  return null;
}

function parseBillFromEmail(
  subject: string,
  body: string,
  from: string,
  dateHeader?: string,
): {
  biller: string;
  billerType: string;
  amount: number | null;
  dueDate: Date;
} | null {
  const textForParse = `${subject}\n${from}\n${body}`;

  // biller
  const billerMatch = from.match(/(?:from\s+)?([^<]+)/i);
  let biller = (billerMatch ? billerMatch[1] : "Unknown Biller")
    .replace(/\s*<.*>/, "")
    .replace(/via.*$/i, "")
    .trim();

  const billerType = categorizeBiller(textForParse);

  // amount (flexible)
  const amount = extractAmountFlexible(textForParse);

  // due date
  const DUE_RE =
    /\b(?:due|pay(?:ment)?\s*by|payment\s*due|due\s*date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|[A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{4})?)\b/i;
  const dm = textForParse.match(DUE_RE);
  const emailDate = dateHeader ? new Date(dateHeader) : new Date();
  const fallbackBase = isNaN(+emailDate) ? new Date() : emailDate;
  let dueDate = dm ? new Date(dm[1]) : new Date(fallbackBase.getTime());
  if (isNaN(+dueDate)) dueDate = new Date(fallbackBase.getTime());
  if (!dm) dueDate.setDate(dueDate.getDate() + 30); // default +30d

  // Allow "statement ready" vendors to pass without amount
  if (amount == null && !isStatementReady(subject, from)) {
    return null; // keep dropping unrelated messages
  }

  return { biller, billerType, amount, dueDate };
}

function categorizeBiller(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("internet") || lower.includes("broadband"))
    return "Internet";
  if (lower.includes("water") || lower.includes("sewer")) return "Water";
  if (
    lower.includes("electric") ||
    lower.includes("power") ||
    lower.includes("energy")
  )
    return "Electricity";
  if (lower.includes("gas") && !lower.includes("gasoline")) return "Gas";
  if (
    lower.includes("waste") ||
    lower.includes("trash") ||
    lower.includes("garbage")
  )
    return "Waste";
  if (lower.includes("rent") || lower.includes("lease")) return "Rent";
  if (lower.includes("insurance")) return "Insurance";
  return "Utility";
}
