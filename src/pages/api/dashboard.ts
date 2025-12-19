// pages/api/dashboard.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getSession({ req });
  if (!session?.user?.email)
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        household: {
          include: {
            members: { select: { id: true, name: true, email: true } },
          },
        },
        paymentMethods: { where: { isDefault: true }, take: 1 },
      },
    });

    if (!user?.household) {
      return res.status(404).json({ error: "User not in a household" });
    }

    // --- fetch bills by calling our own API route ---
    const origin =
      process.env.NEXTAUTH_URL ||
      `${(req.headers["x-forwarded-proto"] as string) || "http"}://${
        req.headers.host
      }`;

    const billsRes = await fetch(`${origin}/api/bills`, {
      headers: { cookie: req.headers.cookie || "" },
    });
    if (!billsRes.ok) {
      const msg = await billsRes.text();
      throw new Error(`/api/bills failed: ${billsRes.status} ${msg}`);
    }
    const billsData = await billsRes.json();
    const bills = billsData.bills ?? [];

    // Recent activity (unchanged)
    const dbActivities = await prisma.activity.findMany({
      where: { householdId: user.household.id },
      orderBy: { timestamp: "desc" },
      take: 10,
    });
    const recentActivity = dbActivities.map((activity: any) => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      amount: activity.amount || undefined,
      timestamp: activity.timestamp.toISOString(),
      detail: activity.detail || undefined,
      source: activity.source || undefined,
    }));

    // Totals
    const totalHousehold = bills.reduce(
      (sum: number, bill: any) => sum + (bill.amount || 0),
      0
    );
    const yourShare = bills.reduce(
      (sum: number, bill: any) => sum + (bill.yourShare || 0),
      0
    );

    const hasPaymentMethod = user.paymentMethods.length > 0;

    // Next charge details
    const nextBill =
      bills.find((b: any) => b.status === "Scheduled") ?? bills[0] ?? null;
    const nextChargeDate = nextBill?.scheduledCharge || null;
    const nextChargeAmount = nextBill?.yourShare || null;

    return res.status(200).json({
      household: {
        id: user.household.id,
        name: user.household.name,
        address: user.household.address,
        members: user.household.members.map((m: any) => ({
          id: m.id,
          name: m.name || "",
          email: m.email || "",
        })),
        inviteCode: user.household.inviteCode,
      },
      bills,
      recentActivity,
      totalHousehold,
      yourShare,
      billsScheduled: bills.filter((b: any) => b.status === "Scheduled").length,
      hasPaymentMethod,
      autopayEnabled: user.autopayEnabled,
      nextChargeDate,
      nextChargeAmount,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return res.status(500).json({ error: "Failed to load dashboard data" });
  }
}
