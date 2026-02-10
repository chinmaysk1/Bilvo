// pages/api/payments/payment-attempts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]";
import { PaymentAttemptStatus } from "@prisma/client";

function parseLimit(v: any, fallback = 100) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(250, Math.floor(n)));
}

function parseDate(v: any): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // -----------------------
  // GET /api/payments/payment-attempts
  // Household-scoped history for Insights / ledger
  // -----------------------
  if (req.method === "GET") {
    try {
      const me = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, householdId: true },
      });

      if (!me?.id || !me.householdId) {
        return res.status(400).json({ error: "User not in a household" });
      }

      const {
        status,
        provider,
        from, // ISO date
        to, // ISO date
        limit,
        cursor, // attempt id for pagination
        scope, // "household" | "me"
      } = req.query;

      const take = parseLimit(limit, 100);

      const fromDate = parseDate(from);
      const toDate = parseDate(to);

      // Only allow known status/provides if passed (avoid accidental typos)
      const statusFilter =
        typeof status === "string" &&
        (Object.values(PaymentAttemptStatus) as string[]).includes(status)
          ? (status as PaymentAttemptStatus)
          : null;

      const providerFilter =
        typeof provider === "string" && provider.length <= 20 ? provider : null;

      // Household gate: ensure attempt's bill is in my household.
      // We join through bill.householdId for enforcement.
      const where: any = {
        bill: { householdId: me.householdId },
      };

      if (statusFilter) where.status = statusFilter;
      if (providerFilter) where.provider = providerFilter;

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = fromDate;
        if (toDate) where.createdAt.lte = toDate;
      }

      // Optional scope=me: only attempts created by me (payer)
      if (scope === "me") {
        where.userId = me.id;
      }

      const attempts = await prisma.paymentAttempt.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        ...(typeof cursor === "string" && cursor
          ? { skip: 1, cursor: { id: cursor } }
          : {}),
        select: {
          id: true,
          status: true,
          provider: true,
          amountCents: true,
          currency: true,
          createdAt: true,
          processedAt: true,
          failureCode: true,
          failureMessage: true,

          // payer
          user: { select: { id: true, name: true, email: true } },

          // bill context
          bill: {
            select: {
              id: true,
              biller: true,
              billerType: true,
              dueDate: true,
              ownerUserId: true,
              owner: { select: { id: true, name: true, email: true } },
            },
          },

          // participant context (useful for per-user insights)
          participant: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      const nextCursor =
        attempts.length === take ? attempts[attempts.length - 1].id : null;

      // Shape dates into ISO strings for client
      const shaped = attempts.map((a) => ({
        id: a.id,
        status: a.status,
        provider: a.provider,
        amount: (a.amountCents ?? 0) / 100,
        amountCents: a.amountCents,
        currency: a.currency,
        createdAt: a.createdAt.toISOString(),
        processedAt: a.processedAt ? a.processedAt.toISOString() : null,
        failureCode: a.failureCode,
        failureMessage: a.failureMessage,
        payer: {
          id: a.user?.id || null,
          name: a.user?.name || "Unknown",
          email: a.user?.email || null,
        },
        bill: a.bill
          ? {
              id: a.bill.id,
              biller: a.bill.biller,
              billerType: a.bill.billerType,
              dueDate: a.bill.dueDate?.toISOString(),
              owner: a.bill.owner
                ? {
                    id: a.bill.owner.id,
                    name: a.bill.owner.name || "Unknown",
                    email: a.bill.owner.email || null,
                  }
                : null,
            }
          : null,
        billParticipantId: a.participant?.id || null,
      }));

      return res.status(200).json({
        attempts: shaped,
        nextCursor,
      });
    } catch (e) {
      console.error("GET /api/payments/payment-attempts failed:", e);
      return res.status(500).json({ error: "Failed to load payment attempts" });
    }
  }

  // -----------------------
  // POST /api/payments/payment-attempts
  // -----------------------
  if (req.method === "POST") {
    const { billId, provider } = req.body || {};
    if (typeof billId !== "string" || !billId) {
      return res.status(400).json({ error: "Missing billId" });
    }
    if (provider !== "venmo") {
      return res.status(400).json({ error: "Unsupported provider" });
    }

    try {
      const me = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, householdId: true },
      });
      if (!me?.id || !me.householdId) {
        return res.status(400).json({ error: "User not in a household" });
      }

      const bill = await prisma.bill.findFirst({
        where: { id: billId, householdId: me.householdId },
        select: {
          id: true,
          dueDate: true,
          ownerUserId: true,
          participants: {
            select: { id: true, userId: true, shareAmount: true },
          },
        },
      });

      if (!bill) return res.status(404).json({ error: "Bill not found" });

      // Match your UI rule: owners cannot pay their own bills
      if (bill.ownerUserId === me.id) {
        return res
          .status(400)
          .json({ error: "Owners cannot pay their own bills" });
      }

      const myPart = bill.participants.find((p) => p.userId === me.id);
      if (!myPart) {
        return res
          .status(400)
          .json({ error: "Not a participant on this bill" });
      }

      const amountCents = Math.round((myPart.shareAmount || 0) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return res.status(400).json({ error: "Invalid share amount" });
      }

      // Idempotent: if they already recorded Venmo for this bill, reuse latest PROCESSING
      const existing = await prisma.paymentAttempt.findFirst({
        where: {
          billId: bill.id,
          billParticipantId: myPart.id,
          userId: me.id,
          provider: "venmo",
          status: PaymentAttemptStatus.PROCESSING,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      });

      if (existing) {
        return res
          .status(200)
          .json({ success: true, paymentAttemptId: existing.id, reused: true });
      }

      const attempt = await prisma.paymentAttempt.create({
        data: {
          billId: bill.id,
          billParticipantId: myPart.id,
          userId: me.id,
          amountCents,
          feeCents: 0,
          totalCents: amountCents,
          currency: "usd",
          provider: "venmo",
          status: PaymentAttemptStatus.PROCESSING, // “Pending Approval”
          scheduledFor: bill.dueDate,
        },
        select: { id: true, status: true },
      });

      return res
        .status(201)
        .json({ success: true, paymentAttemptId: attempt.id, reused: false });
    } catch (e) {
      console.error("POST /api/payments/payment-attempts failed:", e);
      return res
        .status(500)
        .json({ error: "Failed to record payment attempt" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
