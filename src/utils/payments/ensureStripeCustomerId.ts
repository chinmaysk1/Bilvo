import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function ensureStripeCustomerId(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const { userId, email, name } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
