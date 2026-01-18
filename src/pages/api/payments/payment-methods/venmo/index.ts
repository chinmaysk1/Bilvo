// pages/api/payments/payment-methods/venmo.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../../auth/[...nextauth]";

function normalizeVenmoHandle(input: string | null | undefined) {
  const raw = (input || "").trim();
  if (!raw) return null;

  // Allow user to type "@name" or "name"
  const withoutAt = raw.startsWith("@") ? raw.slice(1) : raw;

  // Keep it permissive: letters, numbers, underscore, dash, dot
  const cleaned = withoutAt.replace(/[^\w.-]/g, "");

  if (!cleaned) return null;
  return `@${cleaned}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, householdId: true, venmoHandle: true },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  if (req.method === "GET") {
    return res.status(200).json({ venmoHandle: user.venmoHandle });
  }

  if (req.method === "PATCH") {
    const { venmoHandle } = req.body || {};
    const normalized =
      typeof venmoHandle === "string"
        ? normalizeVenmoHandle(venmoHandle)
        : null;

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { venmoHandle: normalized },
        select: { venmoHandle: true },
      });

      // Optional activity log
      if (user.householdId) {
        await prisma.activity.create({
          data: {
            householdId: user.householdId,
            userId: user.id,
            type: "wallet_updated",
            description: "Payment receiving settings updated",
            detail: normalized ? `Venmo Saved: ${normalized}` : "Venmo removed",
            source: "payments",
          },
        });
      }

      return res.status(200).json({ venmoHandle: updated.venmoHandle });
    } catch (e) {
      console.error("Error saving Venmo handle:", e);
      return res.status(500).json({ error: "Failed to save Venmo handle" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
