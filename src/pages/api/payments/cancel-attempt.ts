// pages/api/payments/cancel-attempt.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentAttemptStatus } from "@prisma/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const { paymentAttemptId } = req.body as { paymentAttemptId?: string };
  if (!paymentAttemptId)
    return res.status(400).json({ error: "paymentAttemptId is required" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const attempt = await prisma.paymentAttempt.findFirst({
    where: { id: paymentAttemptId, userId: user.id },
    select: { id: true, status: true, providerIntentId: true },
  });
  if (!attempt) return res.status(404).json({ error: "Not found" });

  // Only cancel if it's still in-flight
  const inFlight =
    attempt.status === PaymentAttemptStatus.SCHEDULED ||
    attempt.status === PaymentAttemptStatus.PROCESSING;

  if (!inFlight) {
    return res.status(200).json({ success: true, alreadyFinal: true });
  }

  // Cancel on Stripe (this will trigger webhook -> canceled)
  if (attempt.providerIntentId) {
    try {
      await stripe.paymentIntents.cancel(attempt.providerIntentId);
    } catch (e) {
      // If PI is already canceled/confirmed, don't fail hard
      console.warn("PI cancel warning:", e);
    }
  }

  // Also mark locally as canceled immediately (snappy UI)
  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: PaymentAttemptStatus.CANCELED },
  });

  return res.status(200).json({ success: true });
}
