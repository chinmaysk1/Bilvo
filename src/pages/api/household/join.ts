// pages/api/household/join.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

type Data =
  | { error: string }
  | {
      success: true;
      message: string;
      household: {
        id: string;
        name: string;
        address: string;
        memberCount: number;
      };
      user: {
        id: string;
        email: string | null;
        hasCompletedOnboarding: boolean;
      };
      // hint to client to refresh JWT (so middleware sees updated onboarding flag)
      shouldUpdateSession?: boolean;
    }
  | {
      valid: true;
      household: { name: string; address: string; memberCount: number };
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === "POST") return postJoin(req, res);
  if (req.method === "GET") return getVerify(req, res);

  res.setHeader("Allow", ["POST", "GET"]);
  return res.status(405).end("Method Not Allowed");
}

async function postJoin(req: NextApiRequest, res: NextApiResponse<Data>) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;

    if (!email) return res.status(401).json({ error: "Unauthorized" });

    const { inviteCode } = req.body as { inviteCode?: string };
    if (!inviteCode)
      return res.status(400).json({ error: "Invite code is required" });

    const normalizedCode = inviteCode.toUpperCase().trim();
    if (normalizedCode.length !== 6) {
      return res
        .status(400)
        .json({ error: "Invite code must be 6 characters" });
    }

    // Find household
    const household = await prisma.household.findUnique({
      where: { inviteCode: normalizedCode },
      include: {
        members: { select: { id: true, name: true, email: true } },
      },
    });
    if (!household) {
      return res
        .status(404)
        .json({ error: "Invalid invite code. Please check and try again." });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Already in a household?
    if (user.householdId) {
      if (user.householdId === household.id) {
        return res
          .status(400)
          .json({ error: "You're already a member of this household" });
      }
      return res.status(400).json({
        error:
          "You're already in a household. Please leave your current household first.",
      });
    }

    // Join + mark onboarding complete
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        householdId: household.id,
        hasCompletedOnboarding: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Successfully joined household!",
      household: {
        id: household.id,
        name: household.name,
        address: household.address,
        memberCount: household.members.length + 1, // includes the new member
      },
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
      },
      shouldUpdateSession: true,
    });
  } catch (error) {
    console.error("Error joining household:", error);
    return res
      .status(500)
      .json({ error: "Failed to join household. Please try again." });
  }
}

async function getVerify(req: NextApiRequest, res: NextApiResponse<Data>) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthorized" });

    const codeParam = req.query.code;
    const inviteCode = Array.isArray(codeParam) ? codeParam[0] : codeParam;
    if (!inviteCode)
      return res.status(400).json({ error: "Invite code is required" });

    const normalizedCode = inviteCode.toUpperCase().trim();

    const household = await prisma.household.findUnique({
      where: { inviteCode: normalizedCode },
      select: {
        id: true,
        name: true,
        address: true,
        _count: { select: { members: true } },
      },
    });

    if (!household)
      return res.status(404).json({ error: "Invalid invite code" });

    return res.status(200).json({
      valid: true,
      household: {
        name: household.name,
        address: household.address,
        memberCount: household._count.members,
      },
    });
  } catch (error) {
    console.error("Error verifying invite code:", error);
    return res.status(500).json({ error: "Failed to verify invite code" });
  }
}
