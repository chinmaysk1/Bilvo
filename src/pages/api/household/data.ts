// pages/api/household/data.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import {
  assertHouseholdAdmin,
  assertHouseholdMember,
  AuthError,
} from "@/utils/household/permissions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const { user } = await assertHouseholdMember(req, res);

      const household = await prisma.household.findUnique({
        where: { id: user.householdId },
        select: {
          id: true,
          name: true,
          address: true,
          createdAt: true,
          adminId: true,
          members: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }

      return res.status(200).json({
        household,
        currentUserId: user.id,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error("Error fetching household:", err);
      return res.status(500).json({ error: "Failed to fetch household data" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { household } = await assertHouseholdAdmin(req, res);

      const { name, address } = req.body as {
        name?: string;
        address?: string;
      };

      const updated = await prisma.household.update({
        where: { id: household.id },
        data: {
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
        },
      });

      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error("Error updating household:", err);
      return res.status(500).json({ error: "Failed to update household" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
