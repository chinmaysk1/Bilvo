// pages/protected/dashboard/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useMemo } from "react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import BilvoSummaryCards from "@/components/dashboard/BilvoSummaryCards";
import RecentActivity from "@/components/dashboard/RecentActivity";

import { AlertCircle } from "lucide-react";
import { ActionBanner } from "@/components/common/ActionBanner";

import { PaymentConfirmationBanner } from "@/components/bills/PaymentConfirmationBanner";

import { BillStatus } from "@prisma/client";
import type { Bill } from "@/interfaces/bills";
import type { Activity } from "@/interfaces/activity";
import type { Household } from "@/interfaces/household";
import type { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";

import { BatchedBillsTable } from "@/components/bills/BatchedBillsTable";
import { PaymentMethodModal } from "@/components/bills/PaymentMethodModal";
import { PaymentConfirmationModal } from "@/components/bills/PaymentConfirmationModal";
import { PayWithStripeModal } from "@/components/bills/PayWithStripeModal";

import { useBillsStore } from "@/hooks/bills/useBillsStore";
import { usePendingApprovals } from "@/hooks/bills/usePendingApprovals";
import { useBillsSummary } from "@/hooks/bills/useBillsSummary";
import { usePayFlow } from "@/hooks/bills/usePayFlow";
import { useAutopayToggle } from "@/hooks/bills/useAutopayToggle";

interface DashboardProps {
  household: Household;
  householdMembers: HouseholdMember[];
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
  householdMembers,
  bills: initialBills,
  recentActivity,
  hasPaymentMethod,
  currentUserId,
}: DashboardProps) {
  // -------------------------
  // shared store
  // -------------------------
  const { bills, setBills, patchBill, upsertBills } =
    useBillsStore(initialBills);

  // -------------------------
  // banner approvals
  // -------------------------
  const { pendingApprovals, approve, reject } = usePendingApprovals({
    bills,
    currentUserId,
    setBills,
  });

  // -------------------------
  // summary metrics
  // -------------------------
  const { pendingBills } = useBillsSummary(bills);

  const computedTotalHousehold = useMemo(
    () => bills.reduce((sum, b) => sum + (b.amount || 0), 0),
    [bills],
  );
  const computedYourShare = useMemo(
    () => bills.reduce((sum, b) => sum + (b.yourShare || 0), 0),
    [bills],
  );

  // -------------------------
  // autopay toggles (for expanded bill rows)
  // -------------------------
  const { toggleAutopay } = useAutopayToggle({ bills, patchBill });

  // -------------------------
  // pay flow (modals + handlers)
  // -------------------------
  const payFlow = usePayFlow({
    bills,
    householdMembers,
    currentUserId,
    patchBill,
  });

  console.log("PAY FLOW: ", payFlow);

  return (
    <DashboardLayout>
      {/* Payment Confirmation Banner */}
      <div className="mb-4">
        <PaymentConfirmationBanner
          pendingPayments={pendingApprovals}
          currentRole={pendingApprovals.length > 0 ? "admin" : "member"}
          onConfirmPayment={approve}
          onDisputePayment={reject}
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
          bills={bills}
          totalHousehold={computedTotalHousehold}
          yourShare={computedYourShare}
        />
      </div>

      {/* Active Bills using shared BatchedBillsTable */}
      <div className="mb-6">
        <BatchedBillsTable
          title="This Month’s Bills"
          bills={bills}
          householdMembers={householdMembers}
          currentUserId={currentUserId}
          onPayBill={(bill, e) => payFlow.startPayFlow(bill, e)}
          onPayGroup={(groupPayload, e) => {
            payFlow.startGroupPay(groupPayload, e);
          }}
          onToggleAutopay={(billId) => toggleAutopay(billId)}
          hideDelete
        />
      </div>

      {/* Recent Activity */}
      <div className="mb-6">
        <RecentActivity activities={recentActivity} />
      </div>

      {/* Pay flow modals */}
      {payFlow.selectedBillForPayment && (
        <PaymentMethodModal
          open={payFlow.paymentMethodModalOpen}
          onOpenChange={payFlow.setPaymentMethodModalOpen}
          billName={payFlow.selectedBillForPayment.biller}
          amount={payFlow.selectedBillForPayment.yourShare.toFixed(2)}
          onVenmoClick={payFlow.handleVenmoClick}
          onZelleClick={payFlow.handleZelleClick}
          onAutoPayClick={payFlow.handleAutoPayClick}
          onBankAccountClick={payFlow.handleBankAccountClick}
          onCreditCardClick={payFlow.handleCreditCardClick}
          bankLabel="Pay with Bank Account"
          cardLabel="Pay with Credit Card"
        />
      )}

      {payFlow.selectedBillForPayment && (
        <PaymentConfirmationModal
          open={payFlow.paymentConfirmationOpen}
          onOpenChange={payFlow.setPaymentConfirmationOpen}
          amount={payFlow.selectedBillForPayment.yourShare.toFixed(2)}
          recipientName={payFlow.selectedBillForPayment.recipientName}
          onConfirm={payFlow.handlePaymentConfirmed}
          onCancel={payFlow.handlePaymentCancelled}
        />
      )}

      {payFlow.selectedPaymentMethod && payFlow.selectedBillForPayment && (
        <PayWithStripeModal
          open={payFlow.stripePayOpen}
          onOpenChange={payFlow.setStripePayOpen}
          billParticipantId={payFlow.stripeBillParticipantId}
          groupBillParticipantIds={payFlow.stripeGroupBillParticipantIds}
          biller={payFlow.selectedBillForPayment.biller}
          amountDisplay={payFlow.selectedBillForPayment.yourShare.toFixed(2)}
          recipientName={payFlow.selectedBillForPayment.recipientName}
          paymentType={payFlow.stripePaymentType}
          onSucceeded={payFlow.onStripeSucceeded}
        />
      )}
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
    const cookie = context.req.headers.cookie || "";

    // 1) household (includes currentUserId)
    const householdRes = await fetch(`${baseUrl}/api/household/data`, {
      headers: { Cookie: cookie },
    });
    if (!householdRes.ok) throw new Error("Failed to fetch household");
    const householdJson = await householdRes.json();

    const household = householdJson?.household || null;
    const householdMembers = householdJson?.household?.members || [];
    const currentUserId = householdJson?.currentUserId || "";

    if (!household || !currentUserId) {
      return {
        redirect: { destination: "/onboarding", permanent: false },
      };
    }

    // 2) bills
    const billsRes = await fetch(`${baseUrl}/api/bills`, {
      headers: { Cookie: cookie },
    });
    if (!billsRes.ok) throw new Error("Failed to fetch bills");
    const billsJson = await billsRes.json();
    const bills: Bill[] = billsJson?.bills || [];
    console.log(bills);

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
      // ignore
    }

    // compute summary values
    const totalHousehold = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const yourShare = bills.reduce((sum, b) => sum + (b.yourShare || 0), 0);

    return {
      props: {
        household,
        householdMembers,
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
      redirect: { destination: "/error", permanent: false },
    };
  }
};
