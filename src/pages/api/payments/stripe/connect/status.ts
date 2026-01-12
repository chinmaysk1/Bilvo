import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, stripeConnectedAccountId: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.stripeConnectedAccountId) {
    return res.status(200).json({
      hasAccount: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
  }

  const acct = await stripe.accounts.retrieve(user.stripeConnectedAccountId);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeConnectChargesEnabled: acct.charges_enabled,
      stripeConnectPayoutsEnabled: acct.payouts_enabled,
      stripeConnectDetailsSubmitted: acct.details_submitted,
      stripeConnectOnboardingCompletedAt:
        acct.charges_enabled && acct.payouts_enabled ? new Date() : undefined,
    },
  });

  return res.status(200).json({
    hasAccount: true,
    chargesEnabled: acct.charges_enabled,
    payoutsEnabled: acct.payouts_enabled,
    detailsSubmitted: acct.details_submitted,
  });
}
