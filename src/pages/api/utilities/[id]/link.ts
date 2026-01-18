import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import {
  assertHouseholdMember,
  AuthError,
} from "@/utils/household/permissions";
import { encryptPassword } from "@/utils/common/crypto";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid utility id" });
    }

    const { user, household } = await assertHouseholdMember(req, res);

    const utility = await prisma.utilityAccount.findUnique({ where: { id } });
    if (!utility || utility.householdId !== household.id) {
      return res.status(404).json({ error: "Utility account not found" });
    }

    // only owner or admin may link
    const isAdmin = household.adminId === user.id;
    const isOwner = utility.ownerUserId === user.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { loginEmail, password, accountHolderName } = req.body;

    // Check if this is a re-sync (no password provided, but existing encrypted password exists)
    const isResync = !password && !!utility.encryptedPassword;

    if (!loginEmail) {
      return res.status(400).json({ error: "loginEmail required" });
    }

    // For new links (no existing encrypted password), password is required
    if (!isResync && !password) {
      return res
        .status(400)
        .json({ error: "loginEmail and password required" });
    }

    const { jobCreated } = await prisma.$transaction(async (tx) => {
      // 1) Save credentials to utility account
      const updateData: any = {
        loginEmail,
        accountHolderName: accountHolderName ?? null,
        isLinked: false, // stays false until worker succeeds
      };

      // Only update password if provided (new link, not re-sync)
      if (!isResync) {
        const enc = encryptPassword(password);
        updateData.encryptedPassword = enc.encrypted;
        updateData.passwordIv = enc.iv;
      }

      await tx.utilityAccount.update({
        where: { id },
        data: updateData,
      });

      // 2) Prevent duplicate "in-flight" jobs
      const existing = await tx.utilityLinkJob.findFirst({
        where: {
          utilityAccountId: id,
          status: { in: ["PENDING", "RUNNING", "NEEDS_2FA"] },
        },
        select: { id: true, status: true },
      });

      if (existing) {
        return { jobCreated: false };
      }

      // 3) Enqueue job
      await tx.utilityLinkJob.create({
        data: {
          utilityAccountId: id,
          householdId: household.id,
          createdByUserId: user.id,
          provider: utility.provider,
          status: "PENDING",
          // attempts defaults to 0
          maxAttempts: 3,
        },
      });

      return { jobCreated: true };
    });

    return res.status(200).json({
      success: true,
      message: jobCreated
        ? isResync
          ? "Re-sync job created successfully."
          : "Credentials saved. Link attempt will proceed."
        : "Credentials saved. A link attempt is already in progress.",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Link API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
