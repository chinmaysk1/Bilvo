// pages/api/payments/payment-attempts/[id]/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../../auth/[...nextauth]";
import { PaymentAttemptStatus } from "@prisma/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = req.query.id as string;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid id" });
  }

  // ---------------------------------------------------------
  // GET: payer can view their own attempt status (existing behavior)
  // ---------------------------------------------------------
  if (req.method === "GET") {
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        failureCode: true,
        failureMessage: true,
        processedAt: true,
      },
    });
    if (!attempt) return res.status(404).json({ error: "Not found" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me?.id) return res.status(401).json({ error: "Unauthorized" });

    if (attempt.userId !== me.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({
      id: attempt.id,
      status: attempt.status,
      failureCode: attempt.failureCode,
      failureMessage: attempt.failureMessage,
      processedAt: attempt.processedAt,
    });
  }

  // ---------------------------------------------------------
  // PATCH: bill owner can approve/reject venmo attempts
  // ---------------------------------------------------------
  if (req.method === "PATCH") {
    const { action } = req.body || {};
    if (action !== "approve" && action !== "reject") {
      return res
        .status(400)
        .json({ error: 'Invalid action. Use "approve" or "reject".' });
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, householdId: true },
    });
    if (!me?.id || !me.householdId) {
      return res.status(400).json({ error: "User not in a household" });
    }

    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id },
      select: {
        id: true,
        provider: true,
        status: true,
        billId: true,
        userId: true, // payer
        bill: {
          select: {
            id: true,
            householdId: true,
            ownerUserId: true,
          },
        },
      },
    });

    if (!attempt || !attempt.bill) {
      return res.status(404).json({ error: "Payment attempt not found" });
    }

    // Must be same household
    if (attempt.bill.householdId !== me.householdId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Must be bill owner
    if (attempt.bill.ownerUserId !== me.id) {
      return res
        .status(403)
        .json({ error: "Only the bill owner can approve payments" });
    }

    // Only venmo + only PROCESSING can be approved/rejected
    if (attempt.provider !== "venmo") {
      return res
        .status(400)
        .json({ error: "Only Venmo attempts can be approved here" });
    }
    if (attempt.status !== PaymentAttemptStatus.PROCESSING) {
      return res
        .status(400)
        .json({ error: "Only PROCESSING attempts can be approved/rejected" });
    }

    const nextStatus =
      action === "approve"
        ? PaymentAttemptStatus.SUCCEEDED
        : PaymentAttemptStatus.FAILED;

    const updated = await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: nextStatus,
        processedAt: new Date(),
        failureCode: action === "reject" ? "owner_rejected" : null,
        failureMessage: action === "reject" ? "Rejected by bill owner" : null,
      },
      select: { id: true, status: true, processedAt: true },
    });

    // Optional activity log
    await prisma.activity.create({
      data: {
        householdId: me.householdId,
        userId: me.id,
        type:
          action === "approve"
            ? "venmo_payment_approved"
            : "venmo_payment_rejected",
        description:
          action === "approve"
            ? "Venmo payment approved"
            : "Venmo payment rejected",
        detail: `Attempt ${updated.id}`,
        source: "UTILITY", // or "PAYMENTS" if you have that
      },
    });

    return res.status(200).json({ success: true, attempt: updated });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
