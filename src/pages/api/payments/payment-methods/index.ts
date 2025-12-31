// pages/api/payments/payment-methods/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]";
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
        orderBy: [{ priorityOrder: "asc" }, { createdAt: "desc" }],
      });

      return res.status(200).json({ paymentMethods });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling payment method:", error);
    return res.status(500).json({ error: "Failed to handle payment method" });
  }
}
