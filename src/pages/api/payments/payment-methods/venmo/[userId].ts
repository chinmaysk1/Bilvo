// pages/api/payments/payment-methods/venmo/[userId].ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userId } = req.query;
  if (typeof userId !== "string") {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, householdId: true },
  });

  if (!me) return res.status(404).json({ error: "User not found" });
  if (!me.householdId) return res.status(400).json({ error: "No household" });

  // Only allow fetching wallet info for users in the same household
  const target = await prisma.user.findFirst({
    where: { id: userId, householdId: me.householdId },
    select: { id: true, venmoHandle: true, name: true },
  });

  if (!target) {
    return res.status(404).json({ error: "User not found in household" });
  }

  return res.status(200).json({
    userId: target.id,
    name: target.name,
    venmoHandle: target.venmoHandle, // may be null
  });
}
