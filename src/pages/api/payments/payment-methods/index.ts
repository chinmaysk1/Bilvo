// pages/api/payments/payment-methods/index.ts
import { NextApiRequest, NextApiResponse } from "next";
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
        select: {
          id: true,
          provider: true,
          providerPaymentMethodId: true,
          type: true,
          brand: true,
          last4: true,
          expMonth: true,
          expYear: true,
          status: true,
          isDefault: true,
          priorityOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        paymentMethods: paymentMethods.map((pm) => ({
          ...pm,
          createdAt: pm.createdAt.toISOString(),
          updatedAt: pm.updatedAt.toISOString(),
        })),
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling payment method:", error);
    return res.status(500).json({ error: "Failed to handle payment method" });
  }
}
