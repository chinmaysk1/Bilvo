// pages/protected/insights/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";
import {
  Download,
  Lightbulb,
  ArrowRight,
  DollarSign,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Trash2,
  CreditCard,
  Users,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BillStatus } from "@prisma/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

type InsightsPageProps = {
  bills: any[];
  household: {
    id: string;
    adminId: string;
    members: { id: string; name: string | null; email: string | null }[];
    name: string;
  };
  currentUserId: string;
  attempts: PaymentAttemptRow[];
};

type PaymentAttemptRow = {
  id: string;
  status: string;
  provider: string;
  amount: number;
  amountCents?: number | null;
  currency?: string | null;
  createdAt: string;
  processedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  payer: { id: string | null; name: string; email: string | null };
  bill: {
    id: string;
    biller: string;
    billerType: string;
    dueDate: string;
    owner: { id: string; name: string; email: string | null } | null;
  } | null;
  billParticipantId: string | null;
};

type SpendingItem = {
  name: string;
  value: number;
  color: string;
  icon: any;
};

type TrendPoint = { month: string; amount: number };

type RecommendationItem = {
  icon: any;
  iconColor: string;
  iconBg: string;
  text: string;
  impact: string;
  impactType: "positive" | "neutral" | "negative";
};

const categoryFromBillerType = (billerType: string) => {
  const t = (billerType || "").toLowerCase();
  if (t.includes("electric")) return "Electricity";
  if (t.includes("gas")) return "Gas";
  if (t.includes("water")) return "Water";
  if (t.includes("internet") || t.includes("wifi")) return "Internet";
  if (t.includes("waste") || t.includes("trash")) return "Waste";
  return "Other";
};

const categoryMeta = (name: string) => {
  switch (name) {
    case "Electricity":
      return { color: "#F59E0B", icon: Zap };
    case "Gas":
      return { color: "#EF4444", icon: Flame };
    case "Water":
      return { color: "#3B82F6", icon: Droplets };
    case "Internet":
      return { color: "#8B5CF6", icon: Wifi };
    case "Waste":
      return { color: "#6B7280", icon: Trash2 };
    default:
      return { color: "#9CA3AF", icon: DollarSign };
  }
};

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function clamp2(n: number) {
  return Math.round(n * 100) / 100;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * ✅ Fix Recharts SSR crash by rendering charts client-only.
 * Recharts v2 pulls Redux Toolkit internally; in Next SSR it can break depending on bundling.
 */
const InsightsPieChartClient = dynamic(
  () => import("../../../../components/insights/InsightsPieChartClient"),
  { ssr: false },
);

const InsightsLineChartClient = dynamic(
  () => import("../../../../components/insights/InsightsLineChartClient"),
  { ssr: false },
);

export default function InsightsPage({
  bills,
  household,
  currentUserId,
  attempts,
}: InsightsPageProps) {
  const [activePage] = useState<
    "overview" | "bills" | "payments" | "household" | "insights"
  >("insights");

  // v1: treat “admin” as household insights view
  const isAdmin = household?.adminId === currentUserId;

  const currentUserName =
    household.members.find((m) => m.id === currentUserId)?.name || "You";
  const currentUserInitials = currentUserName
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const currentUserColor = isAdmin ? "#F2C94C" : "#00B948";

  const now = new Date();
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);

  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const billsWithDates = useMemo(() => {
    return (bills || []).map((b) => ({
      ...b,
      _due: new Date(b.dueDate),
    }));
  }, [bills]);

  const billsLast30 = useMemo(() => {
    return billsWithDates.filter((b) => b._due >= d30 && b._due <= now);
  }, [billsWithDates, d30, now]);

  const spendingData: SpendingItem[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of billsLast30) {
      const cat = categoryFromBillerType(b.billerType);
      const amt = Number(b.amount ?? 0); // household spend
      map.set(cat, (map.get(cat) || 0) + amt);
    }

    const arr = Array.from(map.entries())
      .map(([name, value]) => {
        const meta = categoryMeta(name);
        return {
          name,
          value: clamp2(value),
          color: meta.color,
          icon: meta.icon,
        };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);

    return arr.length ? arr : [];
  }, [billsLast30]);

  const totalSpend = useMemo(
    () => spendingData.reduce((sum, item) => sum + item.value, 0),
    [spendingData],
  );

  const avgPerRoommate = useMemo(() => {
    const n = Math.max(household.members.length, 1);
    return totalSpend / n;
  }, [totalSpend, household.members.length]);

  const trendData: TrendPoint[] = useMemo(() => {
    const map = new Map<string, number>();
    const points: { key: string; date: Date }[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(sixMonthsAgo.getMonth() + i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      points.push({ key, date: d });
      map.set(key, 0);
    }

    for (const b of billsWithDates) {
      if (b._due < sixMonthsAgo || b._due > now) continue;
      const key = `${b._due.getFullYear()}-${b._due.getMonth()}`;
      map.set(key, (map.get(key) || 0) + Number(b.amount ?? 0));
    }

    return points.map((p) => ({
      month: monthLabel(p.date),
      amount: clamp2(map.get(p.key) || 0),
    }));
  }, [billsWithDates, sixMonthsAgo, now]);

  const monthTotals = useMemo(() => {
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const prev = new Date(now);
    prev.setMonth(prev.getMonth() - 1);
    const prevMonthKey = `${prev.getFullYear()}-${prev.getMonth()}`;

    let thisMonth = 0;
    let prevMonth = 0;

    for (const b of billsWithDates) {
      const key = `${b._due.getFullYear()}-${b._due.getMonth()}`;
      const amt = Number(b.amount ?? 0);
      if (key === thisMonthKey) thisMonth += amt;
      if (key === prevMonthKey) prevMonth += amt;
    }
    return { thisMonth, prevMonth };
  }, [billsWithDates, now]);

  const spendingDeltaPct = useMemo(() => {
    const { thisMonth, prevMonth } = monthTotals;
    if (!prevMonth) return 0;
    return Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
  }, [monthTotals]);

  const topTwo = useMemo(() => spendingData.slice(0, 2), [spendingData]);
  const topTwoPct = useMemo(() => {
    if (!totalSpend) return 0;
    const s = topTwo.reduce((acc, x) => acc + x.value, 0);
    return Math.round((s / totalSpend) * 100);
  }, [topTwo, totalSpend]);

  const topTwoLabel = useMemo(() => {
    if (!topTwo.length) return "—";
    if (topTwo.length === 1) return topTwo[0].name;
    return `${topTwo[0].name} & ${topTwo[1].name}`;
  }, [topTwo]);

  const autopaySuggestedLabel = useMemo(() => {
    const candidates = billsWithDates
      .filter((b) => b.myStatus === BillStatus.PENDING && !b.myAutopayEnabled)
      .sort((a, b) => (b.yourShare || 0) - (a.yourShare || 0));
    return candidates[0]?.biller || "—";
  }, [billsWithDates]);

  const aboveAverageUtilityCosts = useMemo(() => {
    if (!monthTotals.prevMonth) return false;
    return monthTotals.thisMonth > monthTotals.prevMonth * 1.1;
  }, [monthTotals]);

  // ✅ Using your new payment-attempts GET
  const attemptsLast30 = useMemo(() => {
    const start = d30.getTime();
    const end = now.getTime();
    return (attempts || []).filter((a) => {
      const t = new Date(a.createdAt).getTime();
      return t >= start && t <= end;
    });
  }, [attempts, d30, now]);

  const pendingManualApprovalsCount = useMemo(() => {
    if (!isAdmin) return 0;
    // Owner approvals: attempts that belong to bills owned by me and are PROCESSING venmo
    return attemptsLast30.filter(
      (a) =>
        a.provider === "venmo" &&
        a.status === "PROCESSING" &&
        a.bill?.owner?.id === currentUserId,
    ).length;
  }, [attemptsLast30, isAdmin, currentUserId]);

  const splitImbalanceText = useMemo(() => {
    // v1 heuristic: compare each member's "yourShare" total vs how much they've actually paid (SUCCEEDED)
    // Note: bills endpoint gives "yourShare" only for current user, so we can’t compute true “owes” per member from bills alone.
    // With attempts, we can at least show “who has paid the most” in last 30 days.
    const paidByUser = new Map<string, number>();
    for (const a of attemptsLast30) {
      if (a.status !== "SUCCEEDED") continue;
      const payerId = a.payer?.id;
      if (!payerId) continue;
      paidByUser.set(
        payerId,
        (paidByUser.get(payerId) || 0) + Number(a.amount || 0),
      );
    }

    if (!paidByUser.size) return "Not enough payment history yet";
    const sorted = Array.from(paidByUser.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const memberName =
      household.members.find((m) => m.id === top[0])?.name || "Someone";
    return `${memberName} paid $${clamp2(top[1]).toFixed(
      2,
    )} in the last 30 days`;
  }, [attemptsLast30, household.members]);

  const recommendations: RecommendationItem[] = useMemo(() => {
    const recs: RecommendationItem[] = [];

    const firstAutopay = billsWithDates.find(
      (b) => b.myStatus === BillStatus.PENDING && !b.myAutopayEnabled,
    );
    if (firstAutopay) {
      recs.push({
        icon: CreditCard,
        iconColor: "#3B82F6",
        iconBg: "#DBEAFE",
        text: `Enable Autopay for ${firstAutopay.biller}`,
        impact: "Avoids late fees",
        impactType: "positive",
      });
    }

    if (pendingManualApprovalsCount > 0) {
      recs.push({
        icon: AlertCircle,
        iconColor: "#F59E0B",
        iconBg: "#FEF3C7",
        text: `You have ${pendingManualApprovalsCount} Venmo payment${
          pendingManualApprovalsCount === 1 ? "" : "s"
        } awaiting approval`,
        impact: "Approve to reconcile",
        impactType: "neutral",
      });
    }

    if (spendingDeltaPct > 0) {
      recs.push({
        icon: Zap,
        iconColor: "#F59E0B",
        iconBg: "#FEF3C7",
        text: `Household spend is up ${spendingDeltaPct}% vs last month`,
        impact: "Monitor next bills",
        impactType: "neutral",
      });
    } else if (spendingDeltaPct < 0) {
      recs.push({
        icon: Lightbulb,
        iconColor: "#16A34A",
        iconBg: "#ECFDF5",
        text: `Nice — spending is down ${Math.abs(
          spendingDeltaPct,
        )}% vs last month`,
        impact: "Keep it up",
        impactType: "positive",
      });
    }

    recs.push({
      icon: Users,
      iconColor: "#8B5CF6",
      iconBg: "#EDE9FE",
      text: `Payment activity: ${splitImbalanceText}`,
      impact: "Visibility improved",
      impactType: "neutral",
    });

    return recs.slice(0, 5);
  }, [
    billsWithDates,
    spendingDeltaPct,
    pendingManualApprovalsCount,
    splitImbalanceText,
  ]);

  const handleDownloadCsv = () => {
    const rows: string[][] = [
      ["Category", "Amount"],
      ...spendingData.map((x) => [x.name, x.value.toFixed(2)]),
      [],
      ["Month", "Amount"],
      ...trendData.map((t) => [t.month, String(t.amount)]),
      [],
      ["Payments (last 30 days)"],
      ["Status", "Provider", "Amount", "Payer", "Bill", "CreatedAt"],
      ...attemptsLast30.map((a) => [
        a.status,
        a.provider,
        Number(a.amount || 0).toFixed(2),
        a.payer?.name || "Unknown",
        a.bill?.biller || "—",
        a.createdAt,
      ]),
    ];

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `bilvo-insights.csv`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("Downloaded insights CSV");
  };

  return (
    <DashboardLayout>
      <main className="mx-auto px-8 space-y-4">
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "#111827",
            fontFamily: "Inter, sans-serif",
            lineHeight: "24px",
          }}
        >
          Insights
        </h1>
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-lg"
            style={{ fontWeight: 600 }}
            onClick={handleDownloadCsv}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        {/* Summary Card */}
        <Card
          className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-[#1E3A8A]" />
              <h2
                className="text-[16px] text-[#111827]"
                style={{ fontWeight: 600, lineHeight: 1.3 }}
              >
                Household Insights Summary
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-[20px]"
                    style={{
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color:
                        spendingDeltaPct < 0
                          ? "#16A34A"
                          : spendingDeltaPct > 0
                            ? "#DC2626"
                            : "#111827",
                    }}
                  >
                    {spendingDeltaPct === 0
                      ? "0%"
                      : `${Math.abs(spendingDeltaPct)}% ${
                          spendingDeltaPct < 0 ? "↓" : "↑"
                        }`}
                  </span>
                  <span
                    className="text-[14px] text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    Household Spending
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280]">vs last month</p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-[20px] text-[#111827]"
                    style={{ fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {topTwoPct}%
                  </span>
                  <span
                    className="text-[14px] text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    {topTwoLabel}
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280]">
                  top cost categories
                </p>
              </div>

              <div className="col-span-2 border-t border-[#E5E7EB] my-1"></div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <AlertCircle className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                  <span
                    className="text-[14px] text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    {aboveAverageUtilityCosts
                      ? "Above-average Utility Costs"
                      : "Utility Costs Steady"}
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280]">
                  based on your recent trend
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <Zap className="h-4 w-4 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span
                    className="text-[14px] text-[#111827]"
                    style={{ fontWeight: 600 }}
                  >
                    Autopay Suggested: {autopaySuggestedLabel}
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280]">
                  Enable to avoid late fees
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-3 pt-3 border-t border-[#E5E7EB]">
              <button
                className="text-[13px] text-[#16A34A] hover:text-[#15803D] transition-colors flex items-center gap-1"
                style={{ fontWeight: 600 }}
                onClick={() =>
                  toast.success("Detailed recommendations coming soon")
                }
              >
                View full recommendations
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)", height: "260px" }}
          >
            <div className="px-6 py-4 h-full flex flex-col">
              <div className="mb-3">
                <h3
                  className="text-[16px] text-[#111827] mb-0.5"
                  style={{ fontWeight: 600, lineHeight: 1.3 }}
                >
                  Spending by Category
                </h3>
                <p className="text-[14px] text-[#6B7280]">Last 30 Days</p>
              </div>

              {/* ✅ Client-only chart */}
              <InsightsPieChartClient spendingData={spendingData} />

              <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#6B7280]">
                    Total household spend
                  </p>
                  <p
                    className="text-[14px] text-[#111827]"
                    style={{ fontWeight: 700 }}
                  >
                    ${totalSpend.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-[#6B7280]">
                    Average per roommate
                  </p>
                  <p
                    className="text-[14px] text-[#16A34A]"
                    style={{ fontWeight: 700 }}
                  >
                    ${avgPerRoommate.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card
            className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)", height: "260px" }}
          >
            <div className="px-6 py-4 h-full flex flex-col">
              <div className="mb-3">
                <h3
                  className="text-[16px] text-[#111827] mb-0.5"
                  style={{ fontWeight: 600, lineHeight: 1.3 }}
                >
                  Monthly Household Spend
                </h3>
                <p className="text-[14px] text-[#6B7280]">6-Month Trend</p>
              </div>

              {/* ✅ Client-only chart */}
              <InsightsLineChartClient trendData={trendData} />

              <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                <p
                  className="text-[12px] text-[#6B7280]"
                  style={{ lineHeight: 1.5 }}
                >
                  {spendingDeltaPct < 0 ? (
                    <>
                      Spending has{" "}
                      <span style={{ fontWeight: 600, color: "#16A34A" }}>
                        decreased
                      </span>{" "}
                      — great progress.
                    </>
                  ) : spendingDeltaPct > 0 ? (
                    <>
                      Spending has{" "}
                      <span style={{ fontWeight: 600, color: "#DC2626" }}>
                        increased
                      </span>{" "}
                      — keep an eye on next bills.
                    </>
                  ) : (
                    <>Spending is flat vs last month.</>
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recommendations */}
        <Card
          className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-3">
            <h3
              className="text-[16px] text-[#111827] mb-3"
              style={{ fontWeight: 600, lineHeight: 1.3 }}
            >
              Household Recommendations
            </h3>
            <div className="space-y-0">
              {recommendations.map((rec, index) => {
                const Icon = rec.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 py-3 border-b border-[#F3F4F6] last:border-b-0"
                    style={{
                      backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F9FAFB",
                      marginLeft: "-24px",
                      marginRight: "-24px",
                      paddingLeft: "24px",
                      paddingRight: "24px",
                      minHeight: "52px",
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        backgroundColor: rec.iconBg,
                      }}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{ color: rec.iconColor }}
                      />
                    </div>

                    <div className="flex-1">
                      <p
                        className="text-[14px] text-[#111827]"
                        style={{ fontWeight: 500, lineHeight: 1.4 }}
                      >
                        {rec.text}
                      </p>
                    </div>

                    <div
                      className="text-right flex-shrink-0"
                      style={{ minWidth: "140px" }}
                    >
                      <p
                        className="text-[12px]"
                        style={{
                          fontWeight: 600,
                          color:
                            rec.impactType === "positive"
                              ? "#16A34A"
                              : rec.impactType === "negative"
                                ? "#DC2626"
                                : "#6B7280",
                        }}
                      >
                        {rec.impact}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="bg-[#F9FAFB] border-t border-[#E5E7EB] rounded-lg px-4 py-3">
          <p
            className="text-[12px] text-[#6B7280] text-center"
            style={{ lineHeight: 1.5 }}
          >
            Based on the last 30 days,{" "}
            <span style={{ fontWeight: 600 }}>
              {Math.round(
                (billsWithDates.filter((b) => b.myAutopayEnabled).length /
                  Math.max(billsWithDates.length, 1)) *
                  100,
              )}
              % of your bills are automated
            </span>{" "}
            and household spending{" "}
            <span
              style={{
                fontWeight: 600,
                color: spendingDeltaPct < 0 ? "#16A34A" : "#DC2626",
              }}
            >
              {spendingDeltaPct < 0
                ? `decreased by ${Math.abs(spendingDeltaPct)}%`
                : spendingDeltaPct > 0
                  ? `increased by ${spendingDeltaPct}%`
                  : "is flat"}
            </span>{" "}
            vs last month.
          </p>
        </div>
      </main>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.email) {
    return {
      redirect: { destination: "/login", permanent: false },
    };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const billsRes = await fetch(`${baseUrl}/api/bills`, {
      headers: { Cookie: context.req.headers.cookie || "" },
    });
    if (!billsRes.ok) throw new Error("Failed to fetch bills");
    const billsJson = await billsRes.json();

    const householdRes = await fetch(`${baseUrl}/api/household/data`, {
      headers: { Cookie: context.req.headers.cookie || "" },
    });
    if (!householdRes.ok) throw new Error("Failed to fetch household");
    const householdJson = await householdRes.json();

    // ✅ NEW: fetch attempts history from your updated endpoint
    const attemptsRes = await fetch(
      `${baseUrl}/api/payments/payment-attempts?from=${encodeURIComponent(
        isoDaysAgo(30),
      )}&limit=250`,
      {
        headers: { Cookie: context.req.headers.cookie || "" },
      },
    );
    if (!attemptsRes.ok) throw new Error("Failed to fetch payment attempts");
    const attemptsJson = await attemptsRes.json();

    return {
      props: {
        bills: billsJson?.bills || [],
        household: householdJson?.household || null,
        currentUserId: householdJson?.currentUserId || "",
        attempts: attemptsJson?.attempts || [],
      },
    };
  } catch (e) {
    console.error("Error loading insights:", e);
    return {
      redirect: { destination: "/protected/dashboard", permanent: false },
    };
  }
};
