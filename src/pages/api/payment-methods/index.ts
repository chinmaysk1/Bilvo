// pages/api/payment-methods/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../auth/[...nextauth]";
import { getServerSession } from "next-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    if (req.method === "GET") {
      const paymentMethods = await prisma.paymentMethod.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({ paymentMethods });
    }

    if (req.method === "POST") {
      const { type, last4, brand } = req.body;

      if (!type || !last4) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // If this is the first payment method, make it default
      const existingMethods = await prisma.paymentMethod.count({
        where: { userId: user.id },
      });

      const isDefault = existingMethods === 0;

      const paymentMethod = await prisma.paymentMethod.create({
        data: {
          userId: user.id,
          type,
          last4,
          brand,
          isDefault,
        },
      });

      // Create activity log
      if (user.householdId) {
        await prisma.activity.create({
          data: {
            householdId: user.householdId,
            userId: user.id,
            type: "payment_method_added",
            description: "Payment method added",
            detail: `${brand || type} ending in ${last4}`,
          },
        });
      }

      return res.status(201).json({ success: true, paymentMethod });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling payment method:", error);
    return res.status(500).json({ error: "Failed to handle payment method" });
  }
}
