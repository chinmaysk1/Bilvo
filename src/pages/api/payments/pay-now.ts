// pages/api/payments/pay-now.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentAttemptStatus } from "@prisma/client";
import { ensureStripeCustomerId } from "@/utils/payments/ensureStripeCustomerId";
import { dollarsToCents } from "@/utils/payments/dollarsToCents";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
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
          select: { id: true, householdId: true, dueDate: true, biller: true },
        },
      },
    });

    if (!participant) {
      return res.status(404).json({ error: "Bill participant not found" });
    }

    const amountCents = dollarsToCents(participant.shareAmount);
    if (amountCents <= 0) {
      return res.status(400).json({ error: "Invalid amount to charge" });
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
        amountCents,
        currency: "usd",
        provider: "stripe",
        status: PaymentAttemptStatus.PROCESSING,
        scheduledFor: new Date(),
      },
    });

    // 2) Create Stripe PaymentIntent (on-session)
    // Using Payment Element: don't set payment_method; confirm client-side.
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentAttemptId: attempt.id,
        billId: participant.bill.id,
        billParticipantId: participant.id,
        userId: user.id,
      },
    });

    // 3) Attach providerIntentId
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { providerIntentId: pi.id },
    });

    return res.status(200).json({
      clientSecret: pi.client_secret,
      paymentAttemptId: attempt.id,
    });
  } catch (err: any) {
    console.error("Pay now error:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to start payment" });
  }
}
