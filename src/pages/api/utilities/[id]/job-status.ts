// pages/api/utilities/[id]/job-status.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { assertHouseholdMember } from "@/utils/household/permissions";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query; // utilityAccountId

  // Ensure the user belongs to the household owning this utility
  const { household } = await assertHouseholdMember(req, res);
  const utility = await prisma.utilityAccount.findUnique({
    where: { id: id as string },
  });

  if (!utility || utility.householdId !== household.id) {
    return res.status(404).json({ error: "Access denied" });
  }

  if (req.method === "GET") {
    const job = await prisma.utilityLinkJob.findFirst({
      where: { utilityAccountId: id as string },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        lastError: true,
        startedAt: true,
        finishedAt: true,
        updatedAt: true,
        lockedAt: true,
        lockedBy: true,
      },
    });

    return res.status(200).json({
      status: job?.status ?? "IDLE",
      jobId: job?.id ?? null,
      lastError: job?.lastError ?? null,
      startedAt: job?.startedAt ?? null,
      finishedAt: job?.finishedAt ?? null,
      updatedAt: job?.updatedAt ?? null,
    });
  }

  if (req.method === "POST") {
    const { code } = req.body;

    // Update only the most recent job that is actually waiting for a code
    await prisma.utilityLinkJob.updateMany({
      where: {
        utilityAccountId: id as string,
        status: "NEEDS_2FA",
      },
      data: {
        twoFactorCode: code,
        // We leave the status as NEEDS_2FA or change to RUNNING.
        // The worker is already inside waitForTwoFactorCode() watching the 'twoFactorCode' field.
      },
    });
    return res.status(200).json({ success: true });
  }
}
