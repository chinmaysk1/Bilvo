// pages/api/household/members/[memberId].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { assertHouseholdAdmin, AuthError } from "@/utils/household/permissions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { memberId } = req.query as { memberId: string };

  try {
    const { user, household } = await assertHouseholdAdmin(req, res);

    if (memberId === user.id) {
      return res.status(400).json({
        error:
          "Admin cannot remove themselves. Transfer admin first or delete the household.",
      });
    }

    await prisma.user.updateMany({
      where: {
        id: memberId,
        householdId: household.id,
      },
      data: {
        householdId: null,
      },
    });

    return res.status(204).end();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error removing member:", err);
    return res.status(500).json({ error: "Failed to remove member" });
  }
}
