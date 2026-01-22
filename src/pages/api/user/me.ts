// pages/api/user/me.ts
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // -----------------------
  // GET: fetch user profile
  // -----------------------
  if (req.method === "GET") {
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          householdId: true,
          autopayEnabled: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ error: "Failed to fetch user data" });
    }
  }

  // -----------------------
  // PATCH: update profile
  // -----------------------
  if (req.method === "PATCH") {
    try {
      const { name, phone } = req.body as {
        name?: string;
        phone?: string | null;
      };

      // basic validation
      if (name !== undefined && typeof name !== "string") {
        return res.status(400).json({ error: "Invalid name" });
      }
      if (phone !== undefined && phone !== null && typeof phone !== "string") {
        return res.status(400).json({ error: "Invalid phone" });
      }

      const updated = await prisma.user.update({
        where: { email: session.user.email },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          householdId: true,
        },
      });

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ error: "Failed to update user" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
