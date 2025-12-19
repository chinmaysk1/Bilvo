// pages/api/user/autopay.ts
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../auth/[...nextauth]";
import { getServerSession } from "next-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { autopayEnabled: true },
      });

      return res
        .status(200)
        .json({ autopayEnabled: user?.autopayEnabled || false });
    }

    if (req.method === "POST") {
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Invalid enabled value" });
      }

      const user = await prisma.user.update({
        where: { email: session.user.email },
        data: { autopayEnabled: enabled },
        select: { id: true, autopayEnabled: true },
      });

      return res
        .status(200)
        .json({ success: true, autopayEnabled: user.autopayEnabled });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error updating autopay:", error);
    return res.status(500).json({ error: "Failed to update autopay setting" });
  }
}
