// pages/api/payments/stripe/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body
async function buffer(req: NextApiRequest) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("🔔 webhook hit", req.method, req.url);

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature");

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentAttemptId = pi.metadata?.paymentAttemptId;
        if (!paymentAttemptId) break;

        // Load attempt + owner destination from DB (authoritative)
        const attempt = await prisma.paymentAttempt.findUnique({
          where: { id: paymentAttemptId },
          select: {
            id: true,
            amountCents: true,
            currency: true,
            providerTransferId: true,
            bill: {
              select: { owner: { select: { stripeConnectedAccountId: true } } },
            },
          },
        });
        if (!attempt) break;

        const destination = attempt.bill?.owner?.stripeConnectedAccountId;
        if (!destination) break;

        // Create transfer exactly once
        if (!attempt.providerTransferId) {
          const transfer = await stripe.transfers.create(
            {
              amount: attempt.amountCents,
              currency: attempt.currency,
              destination,
              transfer_group: `attempt_${attempt.id}`,
              metadata: {
                paymentAttemptId: attempt.id,
                paymentIntentId: pi.id,
              },
            },
            { idempotencyKey: `transfer_${attempt.id}` }
          );

          await prisma.paymentAttempt.update({
            where: { id: attempt.id },
            data: { providerTransferId: transfer.id },
          });
        }

        // Mark succeeded (use updateMany to avoid non-unique where issues)
        await prisma.paymentAttempt.updateMany({
          where: { id: paymentAttemptId },
          data: {
            status: "SUCCEEDED",
            processedAt: new Date(),
            failureCode: null,
            failureMessage: null,
          },
        });

        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentAttemptId = pi.metadata?.paymentAttemptId;

        if (!paymentAttemptId) break;

        const lastErr = pi.last_payment_error;
        await prisma.paymentAttempt.update({
          where: { id: paymentAttemptId },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            failureCode: lastErr?.code ?? null,
            failureMessage: lastErr?.message ?? null,
          },
        });

        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentAttemptId = pi.metadata?.paymentAttemptId;

        if (!paymentAttemptId) break;

        await prisma.paymentAttempt.update({
          where: { id: paymentAttemptId },
          data: {
            status: "CANCELED",
            processedAt: new Date(),
          },
        });

        break;
      }

      case "account.updated": {
        const acct = event.data.object as Stripe.Account;

        // Find the user by connected account id
        const user = await prisma.user.findFirst({
          where: { stripeConnectedAccountId: acct.id },
          select: { id: true, stripeConnectOnboardingCompletedAt: true },
        });

        if (!user) break;

        const nowEnabled = acct.charges_enabled && acct.payouts_enabled;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeConnectChargesEnabled: acct.charges_enabled,
            stripeConnectPayoutsEnabled: acct.payouts_enabled,
            stripeConnectDetailsSubmitted: acct.details_submitted,
            stripeConnectOnboardingCompletedAt:
              nowEnabled && !user.stripeConnectOnboardingCompletedAt
                ? new Date()
                : undefined,
          },
        });

        break;
      }

      default:
        // ignore other events for now
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Stripe expects 2xx if you successfully processed; if you return 500 it will retry
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
