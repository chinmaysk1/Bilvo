import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { stripe } from "@/lib/stripe";
import { ensureStripeCustomerId } from "@/utils/payments/ensureStripeCustomerId";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getSession({ req });
  const userId = (session as any)?.user?.id;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const customerId = await ensureStripeCustomerId(userId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return res.status(200).json({ clientSecret: setupIntent.client_secret });
  } catch (e: any) {
    console.error(e);
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to create SetupIntent" });
  }
}
