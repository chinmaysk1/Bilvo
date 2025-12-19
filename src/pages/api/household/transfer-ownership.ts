// pages/api/household/transfer-ownership.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { assertHouseholdAdmin, AuthError } from "@/utils/household/permissions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { household } = await assertHouseholdAdmin(req, res);

    const { newOwnerId } = req.body as { newOwnerId: string };

    const newOwner = await prisma.user.findFirst({
      where: {
        id: newOwnerId,
        householdId: household.id,
      },
      select: { id: true },
    });

    if (!newOwner) {
      return res.status(400).json({
        error: "New owner must be a member of this household",
      });
    }

    await prisma.household.update({
      where: { id: household.id },
      data: {
        adminId: newOwnerId,
      },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error transferring ownership:", err);
    return res
      .status(500)
      .json({ error: "Failed to transfer household ownership" });
  }
}
