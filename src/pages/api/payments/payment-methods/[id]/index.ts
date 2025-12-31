// pages/api/payments/payment-methods/[id]/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../../auth/[...nextauth]";
import { stripe } from "@/lib/stripe";
import { PaymentMethodStatus } from "@prisma/client";
import { normalizeUserPaymentMethods } from "@/utils/payments/normalizePaymentMethods";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "DELETE") {
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
      select: { id: true, householdId: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify payment method belongs to user
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        userId: true,
        provider: true,
        providerPaymentMethodId: true,
        isDefault: true,
        brand: true,
        last4: true,
        status: true,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    // If it's a Stripe method, detach it in Stripe so sync won't resurrect it.
    if (
      paymentMethod.provider === "stripe" &&
      paymentMethod.providerPaymentMethodId
    ) {
      try {
        await stripe.paymentMethods.detach(
          paymentMethod.providerPaymentMethodId
        );
      } catch (err: any) {
        // If it's already detached / not found, don't block user deletion.
        // In test mode this can happen if you detached elsewhere.
        console.warn(
          "Stripe detach warning:",
          err?.code || err?.message || err
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // You can either hard delete or soft revoke.
      // Hard delete is fine since Stripe is source of truth and we detached above.
      await tx.paymentMethod.delete({ where: { id: paymentMethod.id } });

      // Re-normalize remaining methods:
      await normalizeUserPaymentMethods(tx, { userId: user.id });
    });

    // Optional activity log
    if (user.householdId) {
      await prisma.activity.create({
        data: {
          householdId: user.householdId,
          userId: user.id,
          type: "payment_method_removed",
          description: "Payment method removed",
          detail: `${paymentMethod.brand || "Card"} ending in ${
            paymentMethod.last4
          }`,
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return res.status(500).json({ error: "Failed to delete payment method" });
  }
}
