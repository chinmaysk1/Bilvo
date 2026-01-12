import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      stripeConnectedAccountId: true,
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
    },
  });

  if (!u) return res.status(404).json({ error: "User not found" });

  const hasAccount = Boolean(u.stripeConnectedAccountId);
  const chargesEnabled = u.stripeConnectChargesEnabled === true;
  const payoutsEnabled = u.stripeConnectPayoutsEnabled === true;
  const detailsSubmitted = u.stripeConnectDetailsSubmitted === true;

  return res.status(200).json({
    hasAccount,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    // convenience:
    isReadyToReceive: hasAccount && chargesEnabled && payoutsEnabled,
  });
}
