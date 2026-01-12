// pages/api/utilities/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import {
  assertHouseholdMember,
  assertHouseholdAdmin,
  AuthError,
} from "@/utils/household/permissions";
import { UtilityAccountResponse } from "@/interfaces/utilities";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === "GET") {
      return await handleGetUtilities(req, res);
    }

    if (req.method === "POST") {
      return await handleCreateUtility(req, res);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error in /api/utilities:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGetUtilities(req: NextApiRequest, res: NextApiResponse) {
  const { household } = await assertHouseholdMember(req, res);

  const utilityAccounts = await prisma.utilityAccount.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "asc" },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const result: UtilityAccountResponse[] = utilityAccounts.map((u: any) => ({
    id: u.id,
    householdId: u.householdId,
    ownerUserId: u.ownerUserId,
    type: u.type,
    provider: u.provider,
    providerWebsite: u.providerWebsite,
    accountHolderName: u.accountHolderName,
    email: u.loginEmail,
    accountNumber: u.accountNumber,
    isLinked: u.isLinked,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    owner: u.owner
      ? {
          id: u.owner.id,
          name: u.owner.name,
          email: u.owner.email,
        }
      : null,
  }));

  return res.status(200).json({ utilityAccounts: result });
}

async function handleCreateUtility(req: NextApiRequest, res: NextApiResponse) {
  const { user, household } = await assertHouseholdMember(req, res);

  const {
    type,
    provider,
    providerWebsite,
    accountNumber,
    accountHolderName,
    email,
  }: {
    type: string; // "Electricity", "Water", etc
    provider: string; // "Pacific Gas & Electric"
    providerWebsite?: string;
    accountNumber?: string;
    accountHolderName?: string;
    email?: string; // login email
  } = req.body || {};

  if (!type || !provider) {
    return res.status(400).json({ error: "type and provider are required" });
  }

  const created = await prisma.utilityAccount.create({
    data: {
      householdId: household.id,
      ownerUserId: user.id,
      type,
      provider,
      providerWebsite: providerWebsite ?? null,
      accountNumber: accountNumber ?? null,
      accountHolderName: accountHolderName ?? null,
      loginEmail: email ?? null,
      // isLinked stays default false
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const result: UtilityAccountResponse = {
    id: created.id,
    householdId: created.householdId,
    ownerUserId: created.ownerUserId,
    type: created.type,
    provider: created.provider,
    providerWebsite: created.providerWebsite,
    accountHolderName: created.accountHolderName,
    email: created.loginEmail,
    accountNumber: created.accountNumber,
    isLinked: created.isLinked,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    owner: created.owner
      ? {
          id: created.owner.id,
          name: created.owner.name,
          email: created.owner.email,
        }
      : null,
  };

  return res.status(201).json(result);
}
