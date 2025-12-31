// pages/api/payments/payment-methods/reorder.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { normalizeUserPaymentMethods } from "@/utils/payments/normalizePaymentMethods";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, householdId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: "Invalid orderedIds array" });
    }

    // Verify all IDs belong to the user
    const userPaymentMethods = await prisma.paymentMethod.findMany({
      where: {
        userId: user.id,
        id: { in: orderedIds },
      },
      select: { id: true },
    });

    if (userPaymentMethods.length !== orderedIds.length) {
      return res.status(403).json({
        error: "Some payment methods do not belong to this user",
      });
    }

    // Update the priority order for each payment method
    // We'll use a transaction to ensure all updates succeed together
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx.paymentMethod.update({
            where: { id },
            data: { priorityOrder: index },
          })
        )
      );

      await normalizeUserPaymentMethods(tx, { userId: user.id });
    });

    // Log activity
    if (user.householdId) {
      await prisma.activity.create({
        data: {
          householdId: user.householdId,
          userId: user.id,
          type: "payment_methods_reordered",
          description: "Payment method priority order updated",
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment method order updated successfully",
    });
  } catch (error) {
    console.error("Error reordering payment methods:", error);
    return res.status(500).json({
      error: "Failed to reorder payment methods",
    });
  }
}
