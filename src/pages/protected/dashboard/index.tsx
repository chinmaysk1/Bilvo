// pages/protected/dashboard/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import BilvoSummaryCards from "@/components/dashboard/BilvoSummaryCards";
import ActiveBillsTable from "@/components/dashboard/ActiveBillsTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { Bill } from "@/interfaces/bills";
import { Activity } from "@/interfaces/activity";
import { Household } from "@/interfaces/household";

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
}

export default function DashboardPage({
  household,
  bills,
  recentActivity,
  totalHousehold,
  yourShare,
  hasPaymentMethod,
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
  return (
    <DashboardLayout>
      {/* Action Banner */}
      {!hasPaymentMethod && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 flex items-start justify-between rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-red-800">
              <span className="font-semibold">Action needed</span> — add a
              payment method to enable autopay.
            </p>
          </div>
          <a
            href="/protected/dashboard/payments"
            className="text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
          >
            Add Payment Method →
          </a>
        </div>
      )}

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
    // Fetch dashboard data from API endpoint
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/dashboard`, {
      headers: {
        Cookie: context.req.headers.cookie || "",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          redirect: {
            destination: "/onboarding",
            permanent: false,
          },
        };
      }
      throw new Error("Failed to fetch dashboard data");
    }

    const data = await response.json();

    return {
      props: data,
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
