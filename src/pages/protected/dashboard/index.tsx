// pages/protected/dashboard/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import HouseholdCard from "@/components/dashboard/HouseholdCard";
import AutopayCard from "@/components/dashboard/AutopayCard";
import OverviewCard from "@/components/dashboard/OverviewCard";
import ActiveBillsTable from "@/components/dashboard/ActiveBillsTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { AlertCircle } from "lucide-react";

interface Bill {
  id: string;
  source: string;
  biller: string;
  billerType: string;
  amount: number;
  yourShare: number;
  dueDate: string;
  scheduledCharge: string;
  status: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  amount?: number;
  timestamp: string;
}

interface DashboardProps {
  household: {
    id: string;
    name: string;
    address: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
    }>;
    inviteCode: string;
  };
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
  billsScheduled,
  hasPaymentMethod,
  autopayEnabled,
  nextChargeDate,
  nextChargeAmount,
}: DashboardProps) {
  return (
    <DashboardLayout>
      {/* Action Banner */}
      {!hasPaymentMethod && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-red-800">
              <span className="font-semibold">Action needed</span> — add a
              payment method to enable autopay.
            </p>
          </div>
          <a
            href="/dashboard/payments"
            className="text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
          >
            Add Payment Method →
          </a>
        </div>
      )}

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <HouseholdCard household={household} />
        <AutopayCard
          enabled={autopayEnabled}
          nextChargeDate={nextChargeDate}
          nextChargeAmount={nextChargeAmount}
          hasPaymentMethod={hasPaymentMethod}
        />
        <OverviewCard
          billsScheduled={billsScheduled}
          totalHousehold={totalHousehold}
          yourShare={yourShare}
        />
      </div>

      {/* Active Bills */}
      <ActiveBillsTable bills={bills} />

      {/* Recent Activity */}
      <RecentActivity activities={recentActivity} />
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
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        household: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!user?.household) {
      return {
        redirect: {
          destination: "/onboarding",
          permanent: false,
        },
      };
    }

    // TODO: Fetch real bills from database
    // For now, using mock data
    const bills = [
      {
        id: "1",
        source: "Gmail",
        biller: "Internet",
        billerType: "internet",
        amount: 38.0,
        yourShare: 12.67,
        dueDate: "2025-10-15",
        scheduledCharge: "2025-10-12",
        status: "Scheduled",
      },
      {
        id: "2",
        source: "Gmail",
        biller: "Gas",
        billerType: "gas",
        amount: 142.5,
        yourShare: 47.5,
        dueDate: "2025-10-17",
        scheduledCharge: "2025-10-14",
        status: "Scheduled",
      },
      {
        id: "3",
        source: "Gmail",
        biller: "Waste",
        billerType: "waste",
        amount: 42.5,
        yourShare: 14.17,
        dueDate: "2025-10-18",
        scheduledCharge: "2025-10-15",
        status: "Scheduled",
      },
      {
        id: "4",
        source: "Gmail",
        biller: "Electricity",
        billerType: "electricity",
        amount: 79.99,
        yourShare: 26.66,
        dueDate: "2025-10-20",
        scheduledCharge: "2025-10-17",
        status: "Scheduled",
      },
      {
        id: "5",
        source: "Manual",
        biller: "Water",
        billerType: "water",
        amount: 120.0,
        yourShare: 40.0,
        dueDate: "2025-10-22",
        scheduledCharge: "2025-10-19",
        status: "Scheduled",
      },
    ];

    // TODO: Fetch real activity from database
    const recentActivity = [
      {
        id: "1",
        type: "payment_success",
        description: "Autopay charge succeeded",
        amount: 47.5,
        detail: "Gas",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "2",
        type: "bill_uploaded",
        description: "Bill uploaded",
        detail: "Water - $120.00",
        source: "Manual",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "3",
        type: "payment_method_added",
        description: "Payment method added",
        detail: "Visa ending in 4242",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const totalHousehold = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const yourShare = bills.reduce((sum, bill) => sum + bill.yourShare, 0);

    return {
      props: {
        household: {
          id: user.household.id,
          name: user.household.name,
          address: user.household.address,
          members: user.household.members,
          inviteCode: user.household.inviteCode,
        },
        bills,
        recentActivity,
        totalHousehold,
        yourShare,
        billsScheduled: bills.length,
        hasPaymentMethod: false, // TODO: Check if user has payment method
        autopayEnabled: true, // TODO: Check user's autopay setting
        nextChargeDate: "2025-10-12",
        nextChargeAmount: 12.67,
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
