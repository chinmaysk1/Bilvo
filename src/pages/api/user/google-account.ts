// pages/api/user/google-account.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions); // use server-side session
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { accounts: { where: { provider: "google" }, take: 1 } },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const googleAccount = user.accounts[0];
    if (!googleAccount) {
      return res
        .status(404)
        .json({ error: "No Google account linked", hasGoogleAccount: false });
    }

    return res.status(200).json({
      user: { id: user.id, email: user.email, name: user.name },
      googleAccount: {
        id: googleAccount.id,
        provider: googleAccount.provider,
        has_access_token: !!googleAccount.access_token,
        has_refresh_token: !!googleAccount.refresh_token,
        access_token: googleAccount.access_token,
        refresh_token: googleAccount.refresh_token,
        expires_at: googleAccount.expires_at, // seconds since epoch
      },
    });
  } catch (err) {
    console.error("Error fetching Google account:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch Google account data" });
  }
}
