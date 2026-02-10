// pages/api/payments/pay-now-group.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentAttemptStatus } from "@prisma/client";
import { ensureStripeCustomerId } from "@/utils/payments/ensureStripeCustomerId";
import { calcProcessingFeeCents } from "@/utils/payments/calcProcessingFeeCents";
import crypto from "node:crypto";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const { billParticipantIds } = req.body as { billParticipantIds?: string[] };
  if (!Array.isArray(billParticipantIds) || billParticipantIds.length === 0) {
    return res.status(400).json({ error: "billParticipantIds is required" });
  }

  // de-dupe
  const uniqueIds = Array.from(new Set(billParticipantIds)).filter(Boolean);
  if (uniqueIds.length === 0)
    return res.status(400).json({ error: "billParticipantIds is required" });

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Load participants (must belong to payer)
    const participants = await prisma.billParticipant.findMany({
      where: { id: { in: uniqueIds }, userId: user.id },
      select: {
        id: true,
        userId: true,
        shareAmount: true,
        bill: {
          select: {
            id: true,
            ownerUserId: true,
            owner: {
              select: {
                id: true,
                stripeConnectedAccountId: true,
                stripeConnectChargesEnabled: true,
                stripeConnectPayoutsEnabled: true,
              },
            },
          },
        },
      },
    });

    if (participants.length !== uniqueIds.length) {
      return res
        .status(404)
        .json({ error: "One or more bill participants not found" });
    }

    // Validate single owner/destination (group pay is per-owner)
    const owner = participants[0]?.bill?.owner;
    if (!owner?.stripeConnectedAccountId) {
      return res
        .status(409)
        .json({ error: "Bill owner is not ready to receive payments yet." });
    }
    if (
      owner.stripeConnectChargesEnabled !== true ||
      owner.stripeConnectPayoutsEnabled !== true
    ) {
      return res
        .status(409)
        .json({ error: "Bill owner has not completed Stripe onboarding yet." });
    }

    const destination = owner.stripeConnectedAccountId;
    for (const p of participants) {
      const o = p.bill.owner;
      if (
        !o?.stripeConnectedAccountId ||
        o.stripeConnectedAccountId !== destination
      ) {
        return res
          .status(400)
          .json({ error: "Group pay must target a single recipient/owner." });
      }
    }

    // Compute amounts
    const sharesCents = participants.map((p) => {
      const cents = Math.round(Number(p.shareAmount) * 100);
      return Math.max(cents, 0);
    });
    const sumShareCents = sharesCents.reduce((a, b) => a + b, 0);
    if (sumShareCents <= 0)
      return res.status(400).json({ error: "Invalid amount to charge" });

    // Fee is computed on the whole charge (best for “single payment” UX)
    const feeCents = calcProcessingFeeCents(sumShareCents);
    const totalChargeCents = sumShareCents + feeCents;

    // prevent duplicates: block any processing attempts for any of these participants
    const existingProcessing = await prisma.paymentAttempt.findFirst({
      where: {
        billParticipantId: { in: uniqueIds },
        status: {
          in: [PaymentAttemptStatus.SCHEDULED, PaymentAttemptStatus.PROCESSING],
        },
      },
      select: { id: true },
    });
    if (existingProcessing) {
      return res.status(409).json({
        error: "A payment is already in progress for one of these bills.",
      });
    }

    const customerId = await ensureStripeCustomerId({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const groupKey = crypto.randomUUID();

    // Create N attempts in PROCESSING (one per billParticipant) for the SHARE ONLY (not fee)
    const attempts = await prisma.$transaction(async (tx) => {
      const created = [];
      for (let i = 0; i < participants.length; i++) {
        const part = participants[i];
        const shareCents = sharesCents[i];

        const isLeader = i === 0;

        const attemptFeeCents = isLeader ? feeCents : 0; // <-- use GROUP fee once
        const attemptTotalCents = shareCents + attemptFeeCents; // <-- totals now sum to PI

        const a = await tx.paymentAttempt.create({
          data: {
            billId: part.bill.id,
            billParticipantId: part.id,
            userId: user.id,
            amountCents: shareCents,
            feeCents: attemptFeeCents,
            totalCents: attemptTotalCents,
            currency: "usd",
            provider: "stripe",
            status: PaymentAttemptStatus.PROCESSING,
            scheduledFor: new Date(),
            groupKey,
          },
          select: { id: true },
        });
        created.push(a);
      }
      return created;
    });

    const leaderAttemptId = attempts[0].id;

    // Create ONE PaymentIntent for total (share sum + fee)
    let pi;
    try {
      pi = await stripe.paymentIntents.create({
        amount: totalChargeCents,
        currency: "usd",
        customer: customerId,
        automatic_payment_methods: { enabled: true },

        transfer_group: `group_${groupKey}`,

        metadata: {
          groupKey,
          leaderPaymentAttemptId: leaderAttemptId,
          payerUserId: user.id,
          ownerUserId: owner.id,
          destinationAccountId: destination,
          sumShareCents: String(sumShareCents),
          feeCents: String(feeCents),
          // optional debugging:
          attemptIds: attempts.map((a) => a.id).join(","),
        },
      });
    } catch (e: any) {
      // mark all attempts failed
      await prisma.paymentAttempt.updateMany({
        where: { groupKey },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          failureCode: e?.code ?? "stripe_create_failed",
          failureMessage: e?.message ?? "Failed to create PaymentIntent",
        },
      });
      throw e;
    }

    // Attach providerIntentId to all attempts
    await prisma.paymentAttempt.update({
      where: { id: leaderAttemptId },
      data: { providerIntentId: pi.id },
    });

    return res.status(200).json({
      clientSecret: pi.client_secret,
      groupKey,
      paymentAttemptId: leaderAttemptId,
      sumShareCents,
      feeCents,
      totalChargeCents,
    });
  } catch (err: any) {
    console.error("Pay now group error:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to start group payment" });
  }
}
