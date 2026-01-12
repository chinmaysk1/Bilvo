import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      stripeConnectedAccountId: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.stripeConnectedAccountId) {
    return res
      .status(200)
      .json({ stripeConnectedAccountId: user.stripeConnectedAccountId });
  }

  // Create Stripe Express account
  const acct = await stripe.accounts.create({
    type: "express",
    email: user.email ?? undefined,
    // You can add business_profile / capabilities later; keep minimal now.
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeConnectedAccountId: acct.id,
      stripeConnectChargesEnabled: acct.charges_enabled,
      stripeConnectPayoutsEnabled: acct.payouts_enabled,
      stripeConnectDetailsSubmitted: acct.details_submitted,
    },
  });

  return res.status(200).json({ stripeConnectedAccountId: acct.id });
}
