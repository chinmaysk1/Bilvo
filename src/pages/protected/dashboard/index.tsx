// pages/protected/dashboard/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import BilvoSummaryCards from "@/components/dashboard/BilvoSummaryCards";
import ActiveBillsTable from "@/components/dashboard/ActiveBillsTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Bill } from "@/interfaces/bills";
import { Activity } from "@/interfaces/activity";
import { Household } from "@/interfaces/household";
import { ActionBanner } from "@/components/common/ActionBanner";

import {
  PaymentConfirmationBanner,
  PendingPayment,
} from "@/components/bills/PaymentConfirmationBanner";
import { formatMonthDay } from "@/utils/common/formatMonthYear";

interface DashboardProps {
  household: Household;
  bills: Bill[];
  recentActivity: Activity[];
  totalHousehold: number;
  yourShare: number;
  billsScheduled: number;
  hasPaymentMethod: boolean;
  autopayEnabled: boolean;
  nextChargeDate: string | null;
  nextChargeAmount: number | null;
  currentUserId: string;
}

export default function DashboardPage({
  household,
  bills,
  recentActivity,
  totalHousehold,
  yourShare,
  hasPaymentMethod,
  currentUserId,
}: DashboardProps) {
  const [dashboardBills, setDashboardBills] = useState<Bill[]>(bills);

  const computedTotalHousehold = dashboardBills.reduce(
    (sum, bill) => sum + (bill.amount || 0),
    0
  );
  const computedYourShare = dashboardBills.reduce(
    (sum, bill) => sum + (bill.yourShare || 0),
    0
  );

  const pendingApprovals = useMemo(() => {
    const initialsFor = (name: string) =>
      name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";

    const list: PendingPayment[] = [];

    for (const b of dashboardBills as any[]) {
      if (b.ownerUserId !== currentUserId) continue;

      const approvals = (b.pendingVenmoApprovals || []) as any[];
      for (const a of approvals) {
        const payerName = a.payerName || "Unknown";
        list.push({
          id: a.id,
          billName: a.billName || b.biller,
          amount: Number(a.amount || 0),
          payerName,
          payerInitials: initialsFor(payerName),
          paymentMethod: a.paymentMethod, // "venmo" | "zelle"
          dueDate: a.dueDate,
          submittedDate: formatMonthDay(a.submittedDate),
        });
      }
    }

    return list;
  }, [dashboardBills, currentUserId]);

  return (
    <DashboardLayout>
      {/* ✅ Payment Confirmation Banner */}
      <div className="mb-4">
        <PaymentConfirmationBanner
          pendingPayments={pendingApprovals}
          currentRole={pendingApprovals.length > 0 ? "admin" : "member"}
          onConfirmPayment={async (paymentId) => {
            const res = await fetch(
              `/api/payments/payment-attempts/${paymentId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
              }
            );
            if (!res.ok) throw new Error("Failed to approve");

            // Update UI without full reload: remove that approval
            setDashboardBills((prev: any[]) =>
              prev.map((bill: any) => {
                if (
                  !bill.pendingVenmoApprovals?.some(
                    (a: any) => a.id === paymentId
                  )
                )
                  return bill;
                return {
                  ...bill,
                  pendingVenmoApprovals: bill.pendingVenmoApprovals.filter(
                    (a: any) => a.id !== paymentId
                  ),
                };
              })
            );
          }}
          onDisputePayment={async (paymentId) => {
            const res = await fetch(
              `/api/payments/payment-attempts/${paymentId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject" }),
              }
            );
            if (!res.ok) throw new Error("Failed to deny");

            setDashboardBills((prev: any[]) =>
              prev.map((bill: any) => {
                if (
                  !bill.pendingVenmoApprovals?.some(
                    (a: any) => a.id === paymentId
                  )
                )
                  return bill;
                return {
                  ...bill,
                  pendingVenmoApprovals: bill.pendingVenmoApprovals.filter(
                    (a: any) => a.id !== paymentId
                  ),
                };
              })
            );
          }}
        />
      </div>

      {/* Action Banner */}
      <ActionBanner
        show={!hasPaymentMethod}
        variant="danger"
        Icon={AlertCircle}
        actionLabel="Add Payment Method"
        href="/protected/dashboard/payments"
      >
        add a payment method to enable autopay.
      </ActionBanner>

      {/* Summary Cards */}
      <div className="mb-6">
        <BilvoSummaryCards
          household={household}
          bills={dashboardBills}
          totalHousehold={computedTotalHousehold}
          yourShare={computedYourShare}
        />
      </div>

      {/* Active Bills */}
      <div className="mb-6">
        <ActiveBillsTable
          bills={dashboardBills}
          hasPaymentMethod={hasPaymentMethod}
          household={household}
          onBillsImported={(importedBills) => {
            setDashboardBills((prev) => [...prev, ...importedBills]);
          }}
        />
      </div>

      {/* Recent Activity */}
      <div className="mb-6">
        <RecentActivity activities={recentActivity} />
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const cookie = context.req.headers.cookie || "";

    // 1) household (includes currentUserId)
    const householdRes = await fetch(`${baseUrl}/api/household/data`, {
      headers: { Cookie: cookie },
    });
    if (!householdRes.ok) throw new Error("Failed to fetch household");
    const householdJson = await householdRes.json();

    const household = householdJson?.household || null;
    const currentUserId = householdJson?.currentUserId || "";

    if (!household || !currentUserId) {
      return {
        redirect: {
          destination: "/onboarding",
          permanent: false,
        },
      };
    }

    // 2) bills (includes pendingVenmoApprovals for bills you own)
    const billsRes = await fetch(`${baseUrl}/api/bills`, {
      headers: { Cookie: cookie },
    });
    if (!billsRes.ok) throw new Error("Failed to fetch bills");
    const billsJson = await billsRes.json();
    const bills: Bill[] = billsJson?.bills || [];

    // 3) recent activities
    const activityRes = await fetch(`${baseUrl}/api/activities`, {
      headers: { Cookie: cookie },
    });
    const recentActivity: Activity[] = activityRes.ok
      ? (await activityRes.json())?.activities || []
      : [];

    // 4) hasPaymentMethod
    let hasPaymentMethod = true;
    try {
      const pmRes = await fetch(`${baseUrl}/api/payments/payment-methods`, {
        headers: { Cookie: cookie },
      });
      if (pmRes.ok) {
        const pmJson = await pmRes.json();
        hasPaymentMethod = (pmJson?.paymentMethods || []).length > 0;
      }
    } catch {
      // ignore — keep default
    }

    // compute summary values (same as you do client-side)
    const totalHousehold = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const yourShare = bills.reduce((sum, b) => sum + (b.yourShare || 0), 0);

    return {
      props: {
        household,
        bills,
        recentActivity,
        totalHousehold,
        yourShare,
        billsScheduled: 0,
        hasPaymentMethod,
        autopayEnabled: false,
        nextChargeDate: null,
        nextChargeAmount: null,
        currentUserId,
      },
    };
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return {
      redirect: {
        destination: "/error",
        permanent: false,
      },
    };
  }
};
