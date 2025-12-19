// pages/api/bills/[billId]/autopay.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const { billId } = req.query;
  if (typeof billId !== "string") {
    return res.status(400).json({ error: "Invalid billId" });
  }

  try {
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { household: true },
    });
    if (!me?.id || !me.household?.id) {
      return res.status(400).json({ error: "User not in a household" });
    }

    // Ensure bill is in the same household
    const bill = await prisma.bill.findFirst({
      where: { id: billId, householdId: me.household.id },
      select: { id: true },
    });
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    if (req.method === "GET") {
      const participant = await prisma.billParticipant.findUnique({
        where: { billId_userId: { billId, userId: me.id } },
        select: { autopayEnabled: true, paymentMethodId: true },
      });
      return res.status(200).json({
        autopayEnabled: !!participant?.autopayEnabled,
        paymentMethodId: participant?.paymentMethodId ?? null,
      });
    }

    if (req.method === "PATCH") {
      const { enabled, paymentMethodId } = req.body || {};
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Invalid enabled value" });
      }

      // Optional: verify provided paymentMethodId belongs to user
      if (paymentMethodId) {
        const pm = await prisma.paymentMethod.findFirst({
          where: { id: paymentMethodId, userId: me.id },
          select: { id: true },
        });
        if (!pm) {
          return res.status(400).json({ error: "Invalid payment method" });
        }
      }

      // Upsert participant to ensure row exists (should already exist)
      const updated = await prisma.billParticipant.upsert({
        where: { billId_userId: { billId, userId: me.id } },
        update: {
          autopayEnabled: enabled,
          paymentMethodId: paymentMethodId ?? null,
        },
        create: {
          billId,
          userId: me.id,
          shareAmount: 0, // default; actual share should already be set on creation flow
          autopayEnabled: enabled,
          paymentMethodId: paymentMethodId ?? null,
        },
        select: { autopayEnabled: true, paymentMethodId: true },
      });

      return res.status(200).json({
        success: true,
        autopayEnabled: updated.autopayEnabled,
        paymentMethodId: updated.paymentMethodId ?? null,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error updating bill autopay:", err);
    return res.status(500).json({ error: "Failed to update autopay" });
  }
}
