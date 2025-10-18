// pages/api/household/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // ✅ Server-side session for Pages API
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthorized" });

    const { address, name, roommates } = req.body;
    if (!address || !name)
      return res.status(400).json({ error: "Address and name are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    let inviteCode = generateInviteCode();
    while (await prisma.household.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode();
    }

    const household = await prisma.$transaction(async (tx: any) => {
      const newHousehold = await tx.household.create({
        data: { name, address, inviteCode, creatorId: user.id },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { householdId: newHousehold.id, hasCompletedOnboarding: true },
      });
      return newHousehold;
    });

    if (Array.isArray(roommates) && roommates.length) {
      console.log("Invites to send:", {
        householdId: household.id,
        inviteCode: household.inviteCode,
        roommates,
      });
    }

    return res.status(201).json({
      success: true,
      household: {
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
      },
    });
  } catch (err) {
    console.error("Error creating household:", err);
    return res.status(500).json({ error: "Failed to create household" });
  }
}
