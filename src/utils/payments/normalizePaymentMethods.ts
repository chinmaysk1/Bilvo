import type { Prisma, PaymentMethodStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function normalizeUserPaymentMethods(
  tx: Tx,
  params: {
    userId: string;
    provider?: string; // default "stripe"
    status?: PaymentMethodStatus; // default ACTIVE
  }
) {
  const { userId, provider = "stripe", status = "ACTIVE" } = params;

  const methods = await tx.paymentMethod.findMany({
    where: { userId, provider, status },
    orderBy: { priorityOrder: "asc" },
  });

  if (methods.length === 0) {
    return { methods, primaryId: null as string | null };
  }

  // Normalize order and derive isDefault from priorityOrder
  await Promise.all(
    methods.map((m, idx) =>
      tx.paymentMethod.update({
        where: { id: m.id },
        data: {
          priorityOrder: idx,
          isDefault: idx === 0, // ✅ primary = priorityOrder 0
        },
      })
    )
  );

  return { methods, primaryId: methods[0].id };
}
