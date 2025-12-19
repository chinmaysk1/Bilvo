// pages/api/household/delete.ts
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

  try {
    const { household } = await assertHouseholdAdmin(req, res);

    await prisma.user.updateMany({
      where: { householdId: household.id },
      data: { householdId: null },
    });

    await prisma.household.delete({
      where: { id: household.id },
    });

    return res.status(204).end();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error deleting household:", err);
    return res.status(500).json({ error: "Failed to delete household" });
  }
}
