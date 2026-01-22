// pages/protected/bills/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useMemo, useState } from "react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PaymentLedgerDrawer } from "@/components/bills/PaymentLedgerDrawer";
import { PaymentMethodModal } from "@/components/bills/PaymentMethodModal";
import { PaymentConfirmationModal } from "@/components/bills/PaymentConfirmationModal";
import ScanGmailUploadButton from "@/components/bills/ScanGmailUploadButton";
import { PayWithStripeModal } from "@/components/bills/PayWithStripeModal";

import { PaymentConfirmationBanner } from "@/components/bills/PaymentConfirmationBanner";

import {
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { BillStatus } from "@prisma/client";

import type { Bill } from "@/interfaces/bills";
import type { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";
import { PaymentAttemptRow } from "@/interfaces/payments";
import { BatchedBillsTable } from "@/components/bills/BatchedBillsTable";

import { useBillsStore } from "@/hooks/bills/useBillsStore";
import { usePendingApprovals } from "@/hooks/bills/usePendingApprovals";
import { useBillsSummary } from "@/hooks/bills/useBillsSummary";
import { usePayFlow } from "@/hooks/bills/usePayFlow";
import { useAutopayToggle } from "@/hooks/bills/useAutopayToggle";

interface BillsPageProps {
  bills: Bill[];
  householdMembers: HouseholdMember[];
  currentUserId: string;
  attempts: PaymentAttemptRow[];
}

export default function BillsPage({
  bills: initialBills,
  householdMembers,
  currentUserId,
  attempts,
}: BillsPageProps) {
  // -------------------------
  // page UI state
  // -------------------------
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BillStatus>("all");
  const [sortBy, setSortBy] = useState<"due-date" | "amount" | "biller">(
    "due-date",
  );

  // delete modal
  const [deleteBillModalOpen, setDeleteBillModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);

  // -------------------------
  // shared store
  // -------------------------
  const { bills, setBills, patchBill, removeBill, upsertBills } =
    useBillsStore(initialBills);

  // -------------------------
  // pending approvals (banner)
  // -------------------------
  const { pendingApprovals, approve, reject } = usePendingApprovals({
    bills,
    currentUserId,
    setBills,
  });

  // -------------------------
  // summary metrics
  // -------------------------
  const {
    pendingBills,
    totalDueThisMonth,
    autopayCount,
    unpaidBills,
    nextDueBill,
  } = useBillsSummary(bills);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  // -------------------------
  // filter/sort
  // -------------------------
  const filteredBills = useMemo(() => {
    let list = [...bills];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((bill) =>
        (bill.biller || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((bill) => bill.myStatus === statusFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "due-date") {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "amount") {
        return (b.yourShare || 0) - (a.yourShare || 0);
      }
      return (a.biller || "").localeCompare(b.biller || "");
    });

    return list;
  }, [bills, searchQuery, statusFilter, sortBy]);

  // -------------------------
  // autopay toggles (bill-level)
  // -------------------------
  const { toggleAutopay } = useAutopayToggle({ bills, patchBill });

  // -------------------------
  // pay flow (modals + venmo/stripe/confirm)
  // -------------------------
  const payFlow = usePayFlow({
    bills,
    householdMembers,
    currentUserId,
    patchBill,
  });

  // -------------------------
  // history grouping
  // -------------------------
  const succeededAttempts = useMemo(
    () => (attempts || []).filter((a) => a.status === "SUCCEEDED" && a.bill),
    [attempts],
  );

  const groupedHistory = useMemo(() => {
    const map = new Map<string, PaymentAttemptRow[]>();

    for (const a of succeededAttempts) {
      const dateStr = a.processedAt || a.createdAt;
      const d = new Date(dateStr);

      const monthKey = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(a);
    }

    for (const [key, arr] of map.entries()) {
      arr.sort(
        (x, y) =>
          new Date(y.processedAt || y.createdAt).getTime() -
          new Date(x.processedAt || x.createdAt).getTime(),
      );
      map.set(key, arr);
    }

    return Array.from(map.entries()).sort((a, b) => {
      const da = new Date(a[1][0].processedAt || a[1][0].createdAt).getTime();
      const db = new Date(b[1][0].processedAt || b[1][0].createdAt).getTime();
      return db - da;
    });
  }, [succeededAttempts]);

  // -------------------------
  // delete
  // -------------------------
  const handleDeleteBillClick = (bill: Bill, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBillToDelete(bill);
    setDeleteBillModalOpen(true);
  };

  const handleDeleteBillConfirm = async () => {
    if (!billToDelete) return;
    const toDelete = billToDelete;

    // optimistic remove
    removeBill(toDelete.id);
    setDeleteBillModalOpen(false);
    setBillToDelete(null);

    try {
      const res = await fetch(`/api/bills/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete bill");
      }
    } catch (e) {
      // rollback
      setBills((prev) => [...prev, toDelete]);
      throw e;
    }
  };

  return (
    <DashboardLayout>
      {/* Payment Confirmation Banner */}
      <div className="mb-4 sm:mb-7">
        <PaymentConfirmationBanner
          pendingPayments={pendingApprovals}
          currentRole={pendingApprovals.length > 0 ? "admin" : "member"}
          onConfirmPayment={approve}
          onDisputePayment={reject}
        />
      </div>

      {/* Header */}
      <div className="mb-4 sm:mb-4">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-xl sm:text-lg"
            style={{
              fontWeight: 600,
              color: "#111827",
              fontFamily: "Inter, sans-serif",
              lineHeight: "24px",
            }}
          >
            Bills
          </h1>

          <button
            onClick={() => setHistoryDrawerOpen(true)}
            className="hover:underline"
            style={{
              color: "#008a4b",
              fontWeight: 600,
              fontSize: 13,
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
            }}
          >
            View History
          </button>
        </div>
      </div>

      {/* Search + Filters + Scan - Mobile Responsive */}
      <div className="mb-4 sm:mb-5">
        {/* Mobile: Stack vertically */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search bar - full width on mobile */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search bills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border-gray-300"
              style={{
                paddingLeft: 36,
                height: 44, // CHANGED: from 36 for better mobile touch
                fontSize: 14, // CHANGED: from 13 for readability
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E7EB",
              }}
            />
          </div>

          {/* Filters row - responsive layout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
            >
              <SelectTrigger
                className="flex-1 sm:flex-initial"
                style={{
                  width: "auto",
                  minWidth: 120,
                  height: 44, // CHANGED: from 36
                  fontSize: 14, // CHANGED: from 13
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E5E7EB",
                }}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value={BillStatus.PENDING}>Unpaid</SelectItem>
                <SelectItem value={BillStatus.PENDING_APPROVAL}>
                  Pending Approval
                </SelectItem>
                <SelectItem value={BillStatus.SCHEDULED}>Scheduled</SelectItem>
                <SelectItem value={BillStatus.PAID}>Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger
                className="flex-1 sm:flex-initial"
                style={{
                  width: "auto",
                  minWidth: 120,
                  height: 44, // CHANGED: from 36
                  fontSize: 14, // CHANGED: from 13
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E5E7EB",
                }}
              >
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due-date">Due Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="biller">Biller</SelectItem>
              </SelectContent>
            </Select>

            <ScanGmailUploadButton
              householdMemberCount={householdMembers.length || 1}
              onBillsImported={(imported: Bill[]) => upsertBills(imported)}
              className="rounded-lg cursor-pointer flex-shrink-0"
              style={{
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: "#008a4b",
                height: 44, // CHANGED: from 36
                paddingLeft: 14,
                paddingRight: 14,
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary bar - Mobile Responsive Grid */}
      <Card
        className="border bg-white mb-4 sm:mb-4"
        style={{
          borderColor: "#E5E7EB",
          borderRadius: 8,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          padding: "16px",
        }}
      >
        {/* Desktop: Horizontal layout */}
        <div className="hidden sm:flex items-center justify-center gap-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <DollarSign
                className="flex-shrink-0"
                style={{
                  width: 14,
                  height: 14,
                  color: "#008a4b",
                  strokeWidth: 2.5,
                }}
              />
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                  lineHeight: "20px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                ${totalDueThisMonth.toFixed(2)}
              </p>
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#6B7280",
                lineHeight: "16px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Total Due
            </p>
          </div>

          <div style={{ width: 1, height: 32, backgroundColor: "#E5E7EB" }} />

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock
                className="flex-shrink-0"
                style={{
                  width: 14,
                  height: 14,
                  color: "#008a4b",
                  strokeWidth: 2.5,
                }}
              />
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                  lineHeight: "20px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {nextDueBill ? formatDate(nextDueBill.dueDate) : "—"}
              </p>
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#6B7280",
                lineHeight: "16px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Next Due
            </p>
          </div>

          <div style={{ width: 1, height: 32, backgroundColor: "#E5E7EB" }} />

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <CheckCircle2
                className="flex-shrink-0"
                style={{
                  width: 14,
                  height: 14,
                  color: "#008a4b",
                  strokeWidth: 2.5,
                }}
              />
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                  lineHeight: "20px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {autopayCount} of {bills.length}
              </p>
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#6B7280",
                lineHeight: "16px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              On Autopay
            </p>
          </div>

          <div style={{ width: 1, height: 32, backgroundColor: "#E5E7EB" }} />

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-1">
              {unpaidBills === 0 ? (
                <CheckCircle2
                  className="flex-shrink-0"
                  style={{
                    width: 16,
                    height: 16,
                    color: "#008a4b",
                    strokeWidth: 2.5,
                  }}
                />
              ) : (
                <AlertCircle
                  className="flex-shrink-0"
                  style={{
                    width: 16,
                    height: 16,
                    color: "#DC2626",
                    strokeWidth: 2.5,
                  }}
                />
              )}
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#111827",
                  lineHeight: "20px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {unpaidBills}
              </p>
            </div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "#6B7280",
                lineHeight: "16px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {unpaidBills === 0 ? "All Paid Up" : "Unpaid"}
            </p>
          </div>
        </div>

        {/* Mobile: 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 sm:hidden">
          <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign
                className="flex-shrink-0 w-4 h-4"
                style={{ color: "#008a4b" }}
              />
              <p className="text-base font-semibold text-gray-900">
                ${totalDueThisMonth.toFixed(2)}
              </p>
            </div>
            <p className="text-xs font-medium text-gray-600">Total Due</p>
          </div>

          <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock
                className="flex-shrink-0 w-4 h-4"
                style={{ color: "#008a4b" }}
              />
              <p className="text-base font-semibold text-gray-900">
                {nextDueBill ? formatDate(nextDueBill.dueDate) : "—"}
              </p>
            </div>
            <p className="text-xs font-medium text-gray-600">Next Due</p>
          </div>

          <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2
                className="flex-shrink-0 w-4 h-4"
                style={{ color: "#008a4b" }}
              />
              <p className="text-base font-semibold text-gray-900">
                {autopayCount} of {bills.length}
              </p>
            </div>
            <p className="text-xs font-medium text-gray-600">On Autopay</p>
          </div>

          <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              {unpaidBills === 0 ? (
                <CheckCircle2
                  className="flex-shrink-0 w-4 h-4"
                  style={{ color: "#008a4b" }}
                />
              ) : (
                <AlertCircle
                  className="flex-shrink-0 w-4 h-4"
                  style={{ color: "#DC2626" }}
                />
              )}
              <p className="text-base font-semibold text-gray-900">
                {unpaidBills}
              </p>
            </div>
            <p className="text-xs font-medium text-gray-600">
              {unpaidBills === 0 ? "All Paid Up" : "Unpaid"}
            </p>
          </div>
        </div>
      </Card>

      {/* Tab toggle - Mobile responsive */}
      <div className="flex items-center justify-end mb-4">
        <div
          className="flex items-center gap-1 sm:gap-2 rounded-lg p-1"
          style={{ backgroundColor: "#E5E7EB" }}
        >
          <button
            onClick={() => setActiveTab("active")}
            className="px-3 sm:px-4 py-2 rounded-md transition-all"
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              backgroundColor:
                activeTab === "active" ? "#FFFFFF" : "transparent",
              color: activeTab === "active" ? "#111827" : "#6B7280",
              boxShadow:
                activeTab === "active" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              minHeight: "40px",
            }}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className="px-3 sm:px-4 py-2 rounded-md transition-all"
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              backgroundColor:
                activeTab === "history" ? "#FFFFFF" : "transparent",
              color: activeTab === "history" ? "#111827" : "#6B7280",
              boxShadow:
                activeTab === "history" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              minHeight: "40px",
            }}
          >
            History
          </button>
        </div>
      </div>

      {/* Active tab */}
      {activeTab === "active" &&
        (filteredBills.length === 0 ? (
          <Card
            className="rounded-lg border bg-white p-8 sm:p-16 text-center"
            style={{
              borderColor: "#E5E7EB",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="text-5xl sm:text-6xl">🎉</div>
              <h3
                className="text-xl sm:text-2xl text-gray-900"
                style={{ fontWeight: 600 }}
              >
                All bills are up to date!
              </h3>
              <p className="text-sm text-gray-600 max-w-md">
                We&apos;ll notify you when new bills are imported.
              </p>
            </div>
          </Card>
        ) : (
          <BatchedBillsTable
            title="This Month's Bills"
            bills={filteredBills}
            householdMembers={householdMembers}
            currentUserId={currentUserId}
            onPayBill={(bill, e) => payFlow.startPayFlow(bill, e)}
            onPayGroup={(groupPayload, e) => {
              payFlow.startGroupPay(groupPayload, e);
            }}
            onToggleAutopay={(billId) => toggleAutopay(billId)}
            onDeleteBill={(bill, e) => handleDeleteBillClick(bill, e)}
          />
        ))}

      {/* History tab - Mobile responsive */}
      {activeTab === "history" && (
        <div className="space-y-4 sm:space-y-6">
          {groupedHistory.map(([month, list]) => (
            <div key={month}>
              <div
                className="sticky top-0 z-10 px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg"
                style={{
                  backgroundColor: "#F9FAFB",
                  borderBottom: "2px solid #E5E7EB",
                }}
              >
                <h3
                  className="text-sm sm:text-base"
                  style={{
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {month}
                </h3>
              </div>

              <Card
                className="rounded-t-none rounded-b-xl border border-[#D1D5DB] bg-white overflow-hidden"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
              >
                <div className="divide-y divide-[#E5E7EB]">
                  {list.map((a) => {
                    const paidDate = new Date(
                      a.processedAt || a.createdAt,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={a.id}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
                      >
                        {/* Bill info */}
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <div
                            className="text-sm sm:text-base truncate"
                            style={{
                              fontWeight: 500,
                              color: "#111827",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {a.bill?.biller || "Bill"}
                          </div>
                          <div
                            className="text-xs sm:text-sm"
                            style={{
                              color: "#6B7280",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            Paid {paidDate} • {a.provider?.toUpperCase()}
                          </div>
                        </div>

                        {/* Amount and payer - row on mobile */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                          <div className="text-left sm:text-right">
                            <div
                              className="text-base sm:text-lg"
                              style={{
                                fontWeight: 600,
                                color: "#111827",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              ${Number(a.amount || 0).toFixed(2)}
                            </div>
                            <div
                              className="text-xs"
                              style={{
                                color: "#6B7280",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {a.payer?.name || "Unknown payer"}
                            </div>
                          </div>

                          {/* Status badge */}
                          <div
                            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md flex-shrink-0"
                            style={{ backgroundColor: "#ECFDF5" }}
                          >
                            <CheckCircle2
                              className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                              style={{ color: "#16A34A" }}
                            />
                            <span
                              className="text-xs"
                              style={{
                                fontWeight: 600,
                                color: "#16A34A",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              Paid
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      <PaymentLedgerDrawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
      />

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
          biller={payFlow.selectedBillForPayment.biller}
          amountDisplay={payFlow.selectedBillForPayment.yourShare.toFixed(2)}
          recipientName={payFlow.selectedBillForPayment.recipientName}
          paymentType={payFlow.stripePaymentType}
          onSucceeded={payFlow.onStripeSucceeded}
        />
      )}

      {/* Delete confirm - Mobile responsive */}
      <Dialog open={deleteBillModalOpen} onOpenChange={setDeleteBillModalOpen}>
        <DialogContent className="sm:max-w-[425px] mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle
              className="text-base sm:text-lg"
              style={{ fontWeight: 600, color: "#111827" }}
            >
              Delete Bill?
            </DialogTitle>
            <DialogDescription
              className="text-sm"
              style={{ color: "#6B7280", marginTop: 8 }}
            >
              Are you sure you want to delete this bill? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter
            className="flex-col sm:flex-row gap-2 sm:gap-0"
            style={{ marginTop: 24 }}
          >
            <Button
              variant="outline"
              onClick={() => setDeleteBillModalOpen(false)}
              className="rounded-lg w-full sm:w-auto"
              style={{ fontSize: 14, fontWeight: 600, minHeight: "44px" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteBillConfirm}
              className="rounded-lg bg-red-600 hover:bg-red-700 w-full sm:w-auto"
              style={{ fontSize: 14, fontWeight: 600, minHeight: "44px" }}
            >
              Confirm & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

    const billsResponse = await fetch(`${baseUrl}/api/bills`, {
      headers: { Cookie: context.req.headers.cookie || "" },
    });
    if (!billsResponse.ok) throw new Error("Failed to fetch bills");
    const { bills } = await billsResponse.json();

    const householdResponse = await fetch(`${baseUrl}/api/household/data`, {
      headers: { Cookie: context.req.headers.cookie || "" },
    });
    const householdData = await householdResponse.json();

    const isoDaysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString();
    };

    const attemptsRes = await fetch(
      `${baseUrl}/api/payments/payment-attempts?from=${encodeURIComponent(
        isoDaysAgo(180),
      )}&limit=500`,
      { headers: { Cookie: context.req.headers.cookie || "" } },
    );
    const attemptsJson = attemptsRes.ok
      ? await attemptsRes.json()
      : { attempts: [] };

    return {
      props: {
        bills: bills || [],
        householdMembers: householdData.household?.members || [],
        currentUserId: householdData.currentUserId || "",
        attempts: attemptsJson?.attempts || [],
      },
    };
  } catch (error) {
    console.error("Error loading bills:", error);
    return {
      redirect: { destination: "/protected/dashboard", permanent: false },
    };
  }
};
