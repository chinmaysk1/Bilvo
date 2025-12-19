// pages/api/payment-methods/[id]/set-default.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

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

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid payment method ID" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify payment method belongs to user
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      prisma.paymentMethod.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      }),
      prisma.paymentMethod.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return res
      .status(500)
      .json({ error: "Failed to set default payment method" });
  }
}
