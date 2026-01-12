// pages/api/payments/payment-attempts/[id]/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getSession({ req });
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  const id = req.query.id as string;
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      failureCode: true,
      failureMessage: true,
      processedAt: true,
    },
  });
  if (!attempt) return res.status(404).json({ error: "Not found" });

  const currentUserId = session?.user?.id;

  if (!currentUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (attempt.userId !== currentUserId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json({
    id: attempt.id,
    status: attempt.status,
    failureCode: attempt.failureCode,
    failureMessage: attempt.failureMessage,
    processedAt: attempt.processedAt,
  });
}
