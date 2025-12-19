// pages/api/utilities/[id]/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import {
  assertHouseholdMember,
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

    if (req.method === "PATCH") {
      return await handlePatchUtility(req, res);
    }

    if (req.method === "DELETE") {
      return await handleDeleteUtility(req, res);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error in /api/utilities/[id]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePatchUtility(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid utility id" });
  }

  const { user, household } = await assertHouseholdMember(req, res);

  const utility = await prisma.utilityAccount.findUnique({
    where: { id },
  });

  if (!utility || utility.householdId !== household.id) {
    return res.status(404).json({ error: "Utility account not found" });
  }

  const isAdmin = household.adminId === user.id;
  const isOwner = utility.ownerUserId === user.id;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const {
    action = "update",
    accountHolderName,
    email,
    accountNumber,
    ownerUserId,
  }: {
    action?: "update" | "unlink";
    accountHolderName?: string | null;
    email?: string | null;
    accountNumber?: string | null;
    ownerUserId?: string | null;
  } = req.body || {};

  // ---------- UNLINK FLOW ----------
  if (action === "unlink") {
    const updated = await prisma.utilityAccount.update({
      where: { id },
      data: {
        isLinked: false,
        encryptedPassword: null,
        passwordIv: null,
        externalAccountId: null,
        // you can also clear loginEmail/accountNumber here if desired
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
      id: updated.id,
      householdId: updated.householdId,
      ownerUserId: updated.ownerUserId,
      type: updated.type,
      provider: updated.provider,
      providerWebsite: updated.providerWebsite,
      accountHolderName: updated.accountHolderName,
      email: updated.loginEmail,
      accountNumber: updated.accountNumber,
      isLinked: updated.isLinked,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      owner: updated.owner
        ? {
            id: updated.owner.id,
            name: updated.owner.name,
            email: updated.owner.email,
          }
        : null,
    };

    return res.status(200).json(result);
  }

  // ---------- UPDATE METADATA FLOW ----------
  const data: any = {};

  if ("accountHolderName" in req.body) {
    data.accountHolderName = accountHolderName ?? null;
  }

  if ("email" in req.body) {
    // email in UI -> loginEmail in DB
    data.loginEmail = email ?? null;
  }

  if ("accountNumber" in req.body) {
    data.accountNumber = accountNumber ?? null;
  }

  if ("ownerUserId" in req.body) {
    // Only admin can change the owner
    if (!isAdmin) {
      return res
        .status(403)
        .json({ error: "Only household admin can change utility owner" });
    }

    if (ownerUserId) {
      data.owner = { connect: { id: ownerUserId } };
      data.ownerUserId = ownerUserId;
    } else {
      data.owner = { disconnect: true };
      data.ownerUserId = null;
    }
  }

  const updated = await prisma.utilityAccount.update({
    where: { id },
    data,
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
    id: updated.id,
    householdId: updated.householdId,
    ownerUserId: updated.ownerUserId,
    type: updated.type,
    provider: updated.provider,
    providerWebsite: updated.providerWebsite,
    accountHolderName: updated.accountHolderName,
    email: updated.loginEmail,
    accountNumber: updated.accountNumber,
    isLinked: updated.isLinked,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    owner: updated.owner
      ? {
          id: updated.owner.id,
          name: updated.owner.name,
          email: updated.owner.email,
        }
      : null,
  };

  return res.status(200).json(result);
}

async function handleDeleteUtility(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid utility id" });
  }

  const { user, household } = await assertHouseholdMember(req, res);

  const utility = await prisma.utilityAccount.findUnique({
    where: { id },
  });

  if (!utility || utility.householdId !== household.id) {
    return res.status(404).json({ error: "Utility account not found" });
  }

  const isAdmin = household.adminId === user.id;
  const isOwner = utility.ownerUserId === user.id;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.utilityAccount.delete({
    where: { id },
  });

  return res.status(204).end();
}
