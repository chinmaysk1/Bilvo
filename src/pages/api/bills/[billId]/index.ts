// pages/api/bills/[id].ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid bill ID" });
  }

  try {
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { household: true },
    });

    if (!me?.household?.id) {
      return res.status(400).json({ error: "User not in a household" });
    }

    const householdId = me.household.id;

    const bill = await prisma.bill.findFirst({
      where: { id, householdId },
      include: {
        participants: true,
        owner: true,
        createdBy: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        bill: {
          ...bill,
          dueDate: bill.dueDate.toISOString(),
          scheduledCharge: bill.scheduledCharge
            ? bill.scheduledCharge.toISOString()
            : null,
        },
      });
    }

    if (req.method === "DELETE") {
      await prisma.bill.delete({ where: { id } });
      return res.status(200).json({ success: true });
    }

    if (req.method === "PATCH") {
      const { status, amount, dueDate, ownerUserId } = req.body || {};

      const updateData: any = {};
      let amountChanged = false;
      let ownerChanged = false;

      if (status) updateData.status = status;

      if (amount != null) {
        const amt = parseFloat(amount);
        if (Number.isNaN(amt) || amt < 0) {
          return res.status(400).json({ error: "Invalid amount" });
        }
        updateData.amount = amt;
        amountChanged = amt !== (bill.amount ?? 0);
      }

      if (dueDate) {
        const d = new Date(dueDate);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "Invalid dueDate" });
        }
        updateData.dueDate = d;
      }

      if (ownerUserId && ownerUserId !== bill.ownerUserId) {
        const exists = await prisma.user.findFirst({
          where: { id: ownerUserId, householdId },
          select: { id: true },
        });
        if (!exists) {
          return res
            .status(400)
            .json({ error: "New owner must be in the same household" });
        }
        updateData.ownerUserId = ownerUserId;
        ownerChanged = true;
      }

      const updated = await prisma.bill.update({
        where: { id },
        data: updateData,
        include: { participants: true },
      });

      // ✅ Recompute equal split for ALL participants when amount/owner changes
      if (amountChanged || ownerChanged) {
        const amt = updated.amount ?? 0;

        const participants = await prisma.billParticipant.findMany({
          where: { billId: id },
          select: { userId: true },
        });

        const divisor = Math.max(participants.length, 1);
        const split = amt / divisor;

        await prisma.billParticipant.updateMany({
          where: { billId: id },
          data: { shareAmount: split },
        });
      }

      const result = await prisma.bill.findUnique({
        where: { id },
        include: {
          participants: true,
          owner: true,
          createdBy: true,
        },
      });

      return res.status(200).json({
        success: true,
        bill: {
          ...result!,
          dueDate: result!.dueDate.toISOString(),
          scheduledCharge: result!.scheduledCharge
            ? result!.scheduledCharge.toISOString()
            : null,
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling bill:", error);
    return res.status(500).json({ error: "Failed to handle bill" });
  }
}
