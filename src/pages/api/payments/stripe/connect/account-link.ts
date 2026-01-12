import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

function getAppUrl() {
  const url = process.env.NEXTAUTH_URL;
  if (!url) throw new Error("NEXT_AUTH_URL is not set");
  return url.replace(/\/$/, "");
}

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
    select: { id: true, stripeConnectedAccountId: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.stripeConnectedAccountId) {
    return res
      .status(400)
      .json({ error: "No connected account. Call ensure-account first." });
  }

  const appUrl = getAppUrl();
  const destination = "/protected/dashboard/utilities";
  const returnUrl = `${appUrl}/${destination}`;
  const refreshUrl = `${appUrl}/connect/refresh`;

  const link = await stripe.accountLinks.create({
    account: user.stripeConnectedAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return res.status(200).json({ url: link.url });
}
