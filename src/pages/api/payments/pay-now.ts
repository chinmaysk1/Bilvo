// pages/api/payments/pay-now.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentAttemptStatus } from "@prisma/client";
import { ensureStripeCustomerId } from "@/utils/payments/ensureStripeCustomerId";
import { dollarsToCents } from "@/utils/payments/dollarsToCents";
import { calcProcessingFeeCents } from "@/utils/payments/calcProcessingFeeCents";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const { billParticipantId } = req.body as { billParticipantId?: string };
  if (!billParticipantId)
    return res.status(400).json({ error: "billParticipantId is required" });

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Load participant + bill and verify ownership
    const participant = await prisma.billParticipant.findFirst({
      where: { id: billParticipantId, userId: user.id },
      select: {
        id: true,
        userId: true,
        shareAmount: true,
        bill: {
          select: {
            id: true,
            householdId: true,
            dueDate: true,
            biller: true,
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

    if (!participant) {
      return res.status(404).json({ error: "Bill participant not found" });
    }

    const shareCents = dollarsToCents(participant.shareAmount);
    if (shareCents <= 0) {
      return res.status(400).json({ error: "Invalid amount to charge" });
    }

    const feeCents = calcProcessingFeeCents(shareCents);
    const totalCents = shareCents + feeCents;

    const owner = participant.bill.owner;

    // prevents weird edge cases
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

    // Optional safety: block duplicate processing attempts for same participant+bill "now"
    // (You’ll make this stricter in autopay phase with scheduledFor uniqueness rules)
    const existingProcessing = await prisma.paymentAttempt.findFirst({
      where: {
        billParticipantId: participant.id,
        status: {
          in: [PaymentAttemptStatus.SCHEDULED, PaymentAttemptStatus.PROCESSING],
        },
      },
      select: { id: true },
    });
    if (existingProcessing) {
      return res
        .status(409)
        .json({ error: "A payment is already in progress for this bill." });
    }

    const customerId = await ensureStripeCustomerId({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // 1) Create PaymentAttempt first (PROCESSING)
    const attempt = await prisma.paymentAttempt.create({
      data: {
        billId: participant.bill.id,
        billParticipantId: participant.id,
        userId: user.id,
        amountCents: shareCents,
        feeCents,
        totalCents,
        currency: "usd",
        provider: "stripe",
        status: PaymentAttemptStatus.PROCESSING,
        scheduledFor: new Date(),
      },
    });

    // 2) Create Stripe PaymentIntent (on-session)
    // Using Payment Element: don't set payment_method; confirm client-side.
    let pi;
    try {
      pi = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: "usd",
        customer: customerId,
        automatic_payment_methods: { enabled: true },

        transfer_group: `attempt_${attempt.id}`,

        metadata: {
          paymentAttemptId: attempt.id,
          billId: participant.bill.id,
          billParticipantId: participant.id,
          userId: user.id,
          ownerUserId: owner.id,
          destinationAccountId: owner.stripeConnectedAccountId,
          shareCents: String(shareCents),
          feeCents: String(feeCents),
          totalCents: String(totalCents),
        },
      });
    } catch (e: any) {
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          failureCode: e?.code ?? "stripe_create_failed",
          failureMessage: e?.message ?? "Failed to create PaymentIntent",
        },
      });
      throw e;
    }

    // 3) Attach providerIntentId
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { providerIntentId: pi.id },
    });

    return res.status(200).json({
      clientSecret: pi.client_secret,
      paymentAttemptId: attempt.id,
      shareCents,
      feeCents,
      totalCents,
    });
  } catch (err: any) {
    console.error("Pay now error:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to start payment" });
  }
}
