// utils/household/permissions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export type HouseholdAuthContext = {
  user: {
    id: string;
    householdId: string;
    name: string | null;
    email: string;
  };
  household: {
    id: string;
    adminId: string | null;
    name: string;
    inviteCode: string | null;
  };
};

/**
 * Ensures the request comes from a logged-in user who belongs
 * to some household. Returns minimal user + household info.
 */
export async function assertHouseholdMember(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<HouseholdAuthContext> {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    throw new AuthError("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      householdId: true,
      name: true,
      email: true,
    },
  });

  if (!user || !user.householdId) {
    throw new AuthError("User not in a household", 404);
  }

  const household = await prisma.household.findUnique({
    where: { id: user.householdId },
    select: {
      id: true,
      adminId: true,
      name: true,
      inviteCode: true,
    },
  });

  if (!household) {
    throw new AuthError("Household not found", 404);
  }

  return {
    user: {
      id: user.id,
      householdId: user.householdId,
      name: session.user.name || null,
      email: session.user.email,
    },
    household: {
      id: household.id,
      adminId: household.adminId,
      name: household.name,
      inviteCode: household.inviteCode,
    },
  };
}

/**
 * Ensures the request comes from the admin of the household.
 * Builds on top of assertHouseholdMember.
 */
export async function assertHouseholdAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<HouseholdAuthContext> {
  const ctx = await assertHouseholdMember(req, res);

  if (ctx.household.adminId !== ctx.user.id) {
    throw new AuthError("Only household admin can perform this action", 403);
  }

  return ctx;
}
