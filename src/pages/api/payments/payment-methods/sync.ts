// pages/api/payments/payment-methods/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]";
import { stripe } from "@/lib/stripe";
import type { Prisma } from "@prisma/client";
import { PaymentMethodStatus } from "@prisma/client";
import { normalizeUserPaymentMethods } from "@/utils/payments/normalizePaymentMethods";
import { ensureStripeCustomerId } from "@/utils/payments/ensureStripeCustomerId";

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
      select: { id: true, email: true, name: true, householdId: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const customerId = await ensureStripeCustomerId({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Fetch Stripe card payment methods attached to the customer
    const stripePMs = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    if (stripePMs.data.length === 0) {
      return res.status(200).json({ success: true, syncedCount: 0 });
    }

    // Existing Stripe PMs in OUR DB (for stable ordering)
    const existing = await prisma.paymentMethod.findMany({
      where: { userId: user.id, provider: "stripe" },
      select: {
        id: true,
        providerPaymentMethodId: true,
        priorityOrder: true,
        isDefault: true,
        status: true,
      },
      orderBy: { priorityOrder: "asc" },
    });

    const existingByProviderId = new Map(
      existing.map((pm) => [pm.providerPaymentMethodId, pm])
    );

    const existingDefault = existing.find(
      (pm) => pm.isDefault && pm.status === PaymentMethodStatus.ACTIVE
    );

    // Next priority index for brand new methods
    const maxPriority = existing.reduce(
      (max, pm) => Math.max(max, pm.priorityOrder),
      -1
    );
    let nextPriority = maxPriority + 1;

    // Build upsert args (Option A)
    const upsertArgs: Prisma.PaymentMethodUpsertArgs[] = [];

    for (const pm of stripePMs.data) {
      const card = pm.card;
      if (!card) continue;

      const existingRow = existingByProviderId.get(pm.id);
      const desiredPriority = existingRow?.priorityOrder ?? nextPriority++;

      upsertArgs.push({
        where: { providerPaymentMethodId: pm.id },
        update: {
          userId: user.id,
          provider: "stripe",
          type: "card",
          brand: card.brand ?? null,
          last4: card.last4 ?? "0000",
          expMonth: card.exp_month ?? null,
          expYear: card.exp_year ?? null,
          status: PaymentMethodStatus.ACTIVE,
          // keep existing isDefault for now; we enforce invariants after
          priorityOrder: desiredPriority,
        },
        create: {
          userId: user.id,
          provider: "stripe",
          providerPaymentMethodId: pm.id,
          type: "card",
          brand: card.brand ?? null,
          last4: card.last4 ?? "0000",
          expMonth: card.exp_month ?? null,
          expYear: card.exp_year ?? null,
          status: PaymentMethodStatus.ACTIVE,
          isDefault: false,
          priorityOrder: desiredPriority,
        },
      });
    }

    const syncedRows = await prisma.$transaction(async (tx) => {
      // 1) Upsert everything we found on Stripe
      const rows = await Promise.all(
        upsertArgs.map((args) => tx.paymentMethod.upsert(args))
      );

      // 2) normalize
      await normalizeUserPaymentMethods(tx, { userId: user.id });

      return rows;
    });

    // Optional activity logging
    if (user.householdId && syncedRows.length > 0) {
      const newestDefault = await prisma.paymentMethod.findFirst({
        where: {
          userId: user.id,
          isDefault: true,
          status: PaymentMethodStatus.ACTIVE,
        },
        select: { brand: true, last4: true },
      });

      if (newestDefault) {
        await prisma.activity.create({
          data: {
            householdId: user.householdId,
            userId: user.id,
            type: "payment_method_synced",
            description: "Payment method synced from Stripe",
            detail: `${newestDefault.brand || "Card"} ending in ${
              newestDefault.last4
            }`,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      syncedCount: syncedRows.length,
    });
  } catch (error: any) {
    console.error("Error syncing payment methods:", error);
    return res.status(500).json({
      error: error?.message ?? "Failed to sync payment methods",
    });
  }
}
