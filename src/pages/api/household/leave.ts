// pages/api/household/leave.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  assertHouseholdMember,
  AuthError,
} from "@/utils/household/permissions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user, household } = await assertHouseholdMember(req, res);

    if (household.adminId === user.id) {
      return res.status(400).json({
        error:
          "Admin cannot leave the household. Transfer admin to another member or delete the household.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { householdId: null, hasCompletedOnboarding: false },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error leaving household:", err);
    return res.status(500).json({ error: "Failed to leave household" });
  }
}
