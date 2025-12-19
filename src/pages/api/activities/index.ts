// pages/api/activities/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession({ req });
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { householdId: true },
    });

    if (!user?.householdId) {
      return res.status(400).json({ error: "User not in a household" });
    }

    const { limit } = req.query;
    const takeLimit = limit ? parseInt(limit as string) : 10;

    const activities = await prisma.activity.findMany({
      where: {
        householdId: user.householdId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: takeLimit,
    });

    return res.status(200).json({ activities });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json({ error: "Failed to fetch activities" });
  }
}
