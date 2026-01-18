// pages/protected/bills/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

import { toast } from "sonner";
import { motion } from "framer-motion";

import {
  StatusBadge,
  determineMyStatus,
  isBillOverdue,
} from "@/components/bills/BillStatusConfig";
import { SplitBadge } from "@/components/bills/SplitBadge";

import {
  Zap,
  Droplets,
  Flame,
  Wifi,
  Recycle,
  Search,
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";

import { BillStatus } from "@prisma/client";
import type { Bill } from "@/interfaces/bills";
import type { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";
import { PayWithStripeModal } from "@/components/bills/PayWithStripeModal";
import {
  PaymentConfirmationBanner,
  PendingPayment,
} from "@/components/bills/PaymentConfirmationBanner";
import { formatMonthDay } from "@/utils/common/formatMonthYear";

interface BillsPageProps {
  bills: Bill[];
  householdMembers: HouseholdMember[];
  currentUserId: string;
}

const thStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6B7280",
  textTransform: "uppercase",
  fontWeight: 600,
  letterSpacing: "0.05em",
  fontFamily: "Inter, sans-serif",
};

const getBillerIcon = (billerType: string) => {
  const type = (billerType || "").toLowerCase();
  if (type.includes("internet")) {
    return { icon: Wifi, iconColor: "#8B5CF6", iconBg: "#EDE9FE" };
  } else if (type.includes("gas")) {
    return { icon: Flame, iconColor: "#EF4444", iconBg: "#FEE2E2" };
  } else if (type.includes("water")) {
    return { icon: Droplets, iconColor: "#3B82F6", iconBg: "#DBEAFE" };
  } else if (type.includes("electric")) {
    return { icon: Zap, iconColor: "#F59E0B", iconBg: "#FEF3C7" };
  } else if (type.includes("waste")) {
    return { icon: Recycle, iconColor: "#10B981", iconBg: "#D1FAE5" };
  }
  return { icon: Wifi, iconColor: "#6B7280", iconBg: "#F3F4F6" };
};

// Avatar colors for household members
const avatarColors = ["#F2C94C", "#00B948", "#BB6BD9", "#3B82F6", "#EF4444"];

function buildVenmoPayUrl(params: {
  handle: string;
  amount: number;
  note: string;
}) {
  const handle = (params.handle || "").trim().replace(/^@/, "");
  const amount = Number(params.amount);

  const qs = new URLSearchParams({
    txn: "pay",
    amount: amount.toFixed(2),
    note: params.note || "",
  });

  return `https://venmo.com/${encodeURIComponent(handle)}?${qs.toString()}`;
}

export default function BillsPage({
  bills: initialBills,
  householdMembers,
  currentUserId,
}: BillsPageProps) {
  const router = useRouter();

  const [bills, setBills] = useState(initialBills);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [stripePayOpen, setStripePayOpen] = useState(false);

  const [selectedBillForPayment, setSelectedBillForPayment] =
    useState<any>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "venmo" | "zelle" | "bank" | "card" | null
  >(null);
  const [stripePaymentType, setStripePaymentType] = useState<"card" | "bank">(
    "card"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BillStatus>("all");
  const [sortBy, setSortBy] = useState<"due-date" | "amount" | "biller">(
    "due-date"
  );

  // Delete modal
  const [deleteBillModalOpen, setDeleteBillModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

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

    for (const b of bills as any[]) {
      if (b.ownerUserId !== currentUserId) continue;

      const approvals = (b.pendingVenmoApprovals || []) as PendingPayment[];
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
    console.log("pendingApprovals list", list);
    return list;
  }, [bills, currentUserId]);

  const pendingBills = useMemo(
    () => bills.filter((b) => b.myStatus !== BillStatus.PAID),
    [bills]
  );

  const totalDueThisMonth = useMemo(
    () => pendingBills.reduce((acc, b) => acc + (b.yourShare || 0), 0),
    [pendingBills]
  );

  const autopayCount = useMemo(
    () => bills.filter((b) => !!b.myAutopayEnabled).length,
    [bills]
  );

  const unpaidBills = useMemo(
    () => bills.filter((b) => b.myStatus !== BillStatus.PAID).length,
    [bills]
  );

  const nextDueBill = useMemo(() => {
    const copy = [...pendingBills];
    copy.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    return copy[0];
  }, [pendingBills]);

  // Owner tooltip/initials
  const getBillOwner = (bill: Bill) => {
    const owner = householdMembers.find((m) => m.id === bill.ownerUserId);
    if (!owner) return { name: "Unknown", initials: "UK", color: "#6B7280" };

    const isYou = owner.id === currentUserId;
    const initials =
      owner.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";

    const colorIndex = householdMembers.findIndex((m) => m.id === owner.id);
    const color = avatarColors[colorIndex % avatarColors.length];

    return {
      name: isYou ? `${owner.name} (You)` : owner.name,
      initials,
      color,
    };
  };

  const filteredBills = useMemo(() => {
    let list = [...bills];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((bill) => bill.biller.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      list = list.filter((bill) => bill.myStatus === statusFilter);
    }

    // Sort bills
    list.sort((a, b) => {
      if (sortBy === "due-date") {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === "amount") {
        return (b.yourShare || 0) - (a.yourShare || 0);
      } else if (sortBy === "biller") {
        return a.biller.localeCompare(b.biller);
      }
      return 0;
    });

    return list;
  }, [bills, searchQuery, statusFilter, sortBy]);

  const toggleAutopay = async (billId: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    const previousAutopay = !!bill.myAutopayEnabled;
    const nextAutopay = !previousAutopay;

    const previousMyStatus = bill.myStatus;

    // ---------- optimistic ----------
    const optimisticMyStatus = determineMyStatus({
      myPart: {
        id: bill.myBillParticipantId!,
        autopayEnabled: nextAutopay,
      },
      hasSucceededAttempt: bill.myHasPaid,
      hasFailedAttempt: bill.myStatus === BillStatus.FAILED,
    });

    patchBill(billId, {
      myAutopayEnabled: nextAutopay,
      myStatus: optimisticMyStatus,
    });

    try {
      const res = await fetch(`/api/bills/${billId}/autopay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextAutopay,
          paymentMethodId: bill.myPaymentMethodId ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update autopay");
      }

      const data = await res.json();

      // ---------- confirm from server ----------
      const confirmedAutopay = !!data.autopayEnabled;

      const confirmedMyStatus = determineMyStatus({
        myPart: {
          id: bill.myBillParticipantId!,
          autopayEnabled: confirmedAutopay,
        },
        hasSucceededAttempt: bill.myHasPaid,
        hasFailedAttempt: bill.myStatus === BillStatus.FAILED,
      });

      patchBill(billId, {
        myAutopayEnabled: confirmedAutopay,
        myStatus: confirmedMyStatus,
      });

      toast.success(confirmedAutopay ? "Autopay enabled" : "Autopay disabled", {
        description: confirmedAutopay
          ? `This bill will be paid automatically on ${new Date(
              bill.dueDate
            ).toLocaleDateString()}.`
          : "Manual payment required for this bill.",
      });
    } catch (err) {
      console.error("Failed to update autopay", err);

      // ---------- rollback ----------
      patchBill(billId, {
        myAutopayEnabled: previousAutopay,
        myStatus: previousMyStatus,
      });

      toast.error("Failed to update autopay", {
        description: "Please try again.",
      });
    }
  };

  const startPayFlow = (bill: Bill, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (getIsOwner(bill)) {
      toast.info("You can’t pay bills you manage.", {
        description: "Only other household members can pay their share.",
      });
      return;
    }

    const { icon, iconColor, iconBg } = getBillerIcon(bill.billerType);
    const owner = getBillOwner(bill);

    setSelectedBillForPayment({
      id: bill.id,
      ownerUserId: bill.ownerUserId,
      biller: bill.biller,
      category: bill.billerType,
      yourShare: bill.yourShare,
      dueDate: new Date(bill.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      icon,
      iconColor,
      iconBg,
      recipientName: owner.name,
    });

    setPaymentMethodModalOpen(true);
  };

  const handleDeleteBillClick = (bill: Bill, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBillToDelete(bill);
    setDeleteBillModalOpen(true);
  };

  const handleDeleteBillConfirm = async () => {
    if (!billToDelete) return;

    const billId = billToDelete.id;

    // Optimistic update
    setBills((prev) => prev.filter((b) => b.id !== billId));
    setDeleteBillModalOpen(false);
    setBillToDelete(null);

    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete bill");
      }

      toast.success("Bill deleted", {
        description: "The bill has been successfully removed.",
      });
    } catch (e) {
      console.error("Failed to delete bill", e);

      // Roll back optimistic update
      setBills((prev) => [...prev, billToDelete]);

      toast.error("Failed to delete bill", {
        description: "Please try again.",
      });
    }
  };

  const handleVenmoClick = async () => {
    setPaymentMethodModalOpen(false);

    const bill = selectedBillForPayment;
    if (!bill?.ownerUserId || !bill?.yourShare) {
      toast.error("Missing bill details for Venmo.");
      return;
    }

    try {
      // Fetch owner wallet settings (household-gated)
      const res = await fetch(
        `/api/payments/payment-methods/venmo/${bill.ownerUserId}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load Venmo handle");
      }

      const data = await res.json();
      const handle: string | null = data?.venmoHandle || null;

      if (!handle) {
        toast.error("Venmo not set up", {
          description: `${bill.recipientName} hasn’t added a Venmo handle yet.`,
        });
        return;
      }

      const note = `Bilvo • ${bill.biller} • ${bill.dueDate}`;
      const url = buildVenmoPayUrl({
        handle,
        amount: Number(bill.yourShare),
        note,
      });

      // Open Venmo (web)
      window.open(url, "_blank", "noopener,noreferrer");

      // Continue your existing flow: ask “did you send it?”
      setSelectedPaymentMethod("venmo");
      setPaymentConfirmationOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Couldn’t open Venmo", {
        description: e?.message || "Please try again.",
      });
    }
  };

  const handleZelleClick = () => {
    setPaymentMethodModalOpen(false);
    setSelectedPaymentMethod("zelle");
    setPaymentConfirmationOpen(true);
  };

  const handleAutoPayClick = () => {
    setPaymentMethodModalOpen(false);
    toast.success("Autopay setup coming soon!");
  };

  const handleBankAccountClick = () => {
    setPaymentMethodModalOpen(false);
    setSelectedPaymentMethod("bank");
    setStripePaymentType("bank");
    setStripePayOpen(true);
  };

  const handleCreditCardClick = () => {
    setPaymentMethodModalOpen(false);
    setSelectedPaymentMethod("card");
    setStripePaymentType("card");
    setStripePayOpen(true);
  };

  const handlePaymentConfirmed = async () => {
    setPaymentConfirmationOpen(false);

    if (!selectedBillForPayment?.id) return;

    try {
      // Persist for Venmo so it survives reload:
      if (selectedPaymentMethod === "venmo") {
        const res = await fetch("/api/payments/payment-attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billId: selectedBillForPayment.id,
            provider: "venmo",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to record Venmo payment");
        }
      }

      // Optimistic UI update (still good UX)
      patchBill(selectedBillForPayment.id, {
        myStatus: BillStatus.PENDING_APPROVAL,
      });

      toast.success("Payment recorded!", {
        description: "Thanks — we’ll mark it paid once it clears.",
        duration: 4000,
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn’t record payment", {
        description: "Please try again.",
      });
    } finally {
      setSelectedBillForPayment(null);
      setSelectedPaymentMethod(null);
    }
  };

  const markMyPaidOptimistic = (billId: string) => {
    setBills((prev) =>
      prev.map((b: any) => (b.id === billId ? { ...b, myHasPaid: true } : b))
    );
  };

  const handlePaymentCancelled = () => {
    setPaymentConfirmationOpen(false);
    toast.info("Payment cancelled", {
      description: "No worries, you can try again later.",
    });
    setSelectedPaymentMethod(null);
    // keep bill selected or clear it:
    setSelectedBillForPayment(null);
  };

  const getIsOwner = (bill: Bill) => {
    return bill.ownerUserId === currentUserId;
  };

  const patchBill = (billId: string, patch: Partial<Bill>) => {
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? ({ ...b, ...patch } as Bill) : b))
    );
  };

  return (
    <DashboardLayout>
      <div className="mb-7">
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

            // Update UI without full reload: remove that approval and mark paid for payer
            setBills((prev: any[]) =>
              prev.map((bill: Bill) => {
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

            setBills((prev: any[]) =>
              prev.map((bill) => {
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

      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex items-baseline justify-between">
          <h1
            style={{
              fontSize: "18px",
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
              color: "#00B948",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            View History
          </button>
        </div>
      </div>

      {/* Search + Filters + Scan */}
      <div style={{ marginBottom: "20px" }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search bills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border-gray-300"
              style={{
                paddingLeft: "36px",
                height: "36px",
                fontSize: "13px",
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E7EB",
              }}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as any)}
          >
            <SelectTrigger
              style={{
                width: "140px",
                height: "36px",
                fontSize: "13px",
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E7EB",
              }}
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={BillStatus.PENDING}>Pending</SelectItem>
              <SelectItem value={BillStatus.SCHEDULED}>Scheduled</SelectItem>
              <SelectItem value={BillStatus.PAID}>Paid</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger
              style={{
                width: "140px",
                height: "36px",
                fontSize: "13px",
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
            onBillsImported={(imported: Bill[]) => {
              if (!imported || imported.length === 0) return;

              setBills((prev) => [...prev, ...imported]);
            }}
            className="rounded-lg cursor-pointer"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              backgroundColor: "#00B948",
              height: "36px",
              paddingLeft: "14px",
              paddingRight: "14px",
            }}
          />
        </div>
      </div>

      {/* Figma compact summary bar */}
      <Card
        className="border bg-white"
        style={{
          borderColor: "#E5E7EB",
          borderRadius: "8px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          marginBottom: "16px",
          paddingTop: "16px",
          paddingBottom: "16px",
          paddingLeft: "24px",
          paddingRight: "24px",
        }}
      >
        <div className="flex items-center justify-center gap-10">
          {/* Total Due */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <DollarSign
                className="flex-shrink-0"
                style={{
                  width: "14px",
                  height: "14px",
                  color: "#00B948",
                  strokeWidth: 2.5,
                }}
              />
              <p
                style={{
                  fontSize: "15px",
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
                fontSize: "11px",
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

          {/* Next Due */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock
                className="flex-shrink-0"
                style={{
                  width: "14px",
                  height: "14px",
                  color: "#00B948",
                  strokeWidth: 2.5,
                }}
              />
              <p
                style={{
                  fontSize: "15px",
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
                fontSize: "11px",
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

          {/* On Autopay */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <CheckCircle2
                className="flex-shrink-0"
                style={{
                  width: "14px",
                  height: "14px",
                  color: "#00B948",
                  strokeWidth: 2.5,
                }}
              />
              <p
                style={{
                  fontSize: "15px",
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
                fontSize: "11px",
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

          {/* Unpaid */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-1">
              {unpaidBills === 0 ? (
                <CheckCircle2
                  className="flex-shrink-0"
                  style={{
                    width: "16px",
                    height: "16px",
                    color: "#00B948",
                    strokeWidth: 2.5,
                  }}
                />
              ) : (
                <AlertCircle
                  className="flex-shrink-0"
                  style={{
                    width: "16px",
                    height: "16px",
                    color: "#DC2626",
                    strokeWidth: 2.5,
                  }}
                />
              )}
              <p
                style={{
                  fontSize: "16px",
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
                fontSize: "12px",
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
      </Card>

      {/* Bills table / empty */}
      {filteredBills.length === 0 ? (
        <Card
          className="rounded-lg border bg-white p-16 text-center"
          style={{
            borderColor: "#E5E7EB",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-2xl text-gray-900" style={{ fontWeight: 600 }}>
              All bills are up to date!
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              We&apos;ll notify you when new bills are imported.
            </p>
          </div>
        </Card>
      ) : (
        <Card
          className="rounded-lg border bg-white"
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            borderColor: "#E5E7EB",
            borderRadius: "8px",
          }}
        >
          <div>
            <table className="w-full">
              <thead
                className="bg-gray-50 border-b"
                style={{ borderColor: "#E5E7EB" }}
              >
                <tr style={{ height: "48px" }}>
                  <th className="px-6 py-3 text-left">
                    <span style={thStyle}>Biller</span>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <span style={thStyle}>Your Share</span>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <span style={thStyle}>Due Date</span>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <span style={thStyle}>Status</span>
                  </th>
                  <th className="px-6 py-3 text-center">
                    <span style={thStyle}>Autopay</span>
                  </th>
                  <th className="px-6 py-3 text-center">
                    <span style={thStyle}></span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredBills.map((bill, index) => {
                  const {
                    icon: Icon,
                    iconColor,
                    iconBg,
                  } = getBillerIcon(bill.billerType);

                  const owner = getBillOwner(bill);

                  const canPayThisBill = !getIsOwner(bill);

                  const isOverdue =
                    bill.myStatus === BillStatus.PENDING &&
                    isBillOverdue(bill.dueDate);

                  // Show pay for pending OR scheduled AND not bill owner
                  const showPay =
                    (bill.myStatus === BillStatus.PENDING ||
                      bill.myStatus === BillStatus.SCHEDULED ||
                      bill.myStatus === BillStatus.FAILED) &&
                    canPayThisBill &&
                    !bill.myHasPaid;

                  const canDeleteBill = !canPayThisBill;

                  return (
                    <motion.tr
                      key={bill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.05,
                        ease: "easeOut",
                      }}
                      className="border-b transition-all duration-200"
                      style={{
                        borderColor: "#E5E7EB",
                        backgroundColor: "#FFFFFF",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#F9FAFB";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                      }}
                      onClick={() => {
                        // Optional: row click to details later
                        // router.push(`/protected/bills/${bill.id}`)
                      }}
                    >
                      {/* BILLER */}
                      <td
                        className="px-6"
                        style={{ paddingTop: 14, paddingBottom: 14 }}
                      >
                        <div className="flex items-center gap-2.5">
                          {/* Icon circle */}
                          <div
                            className="flex items-center justify-center rounded-full flex-shrink-0"
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: iconBg,
                            }}
                          >
                            <Icon
                              className="flex-shrink-0"
                              style={{
                                width: 12,
                                height: 12,
                                color: iconColor,
                              }}
                              strokeWidth={2}
                            />
                          </div>

                          {/* Owner avatar */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Avatar
                                    className="flex-shrink-0"
                                    style={{ width: 16, height: 16 }}
                                  >
                                    <AvatarFallback
                                      style={{
                                        backgroundColor: owner.color,
                                        color: "white",
                                        fontSize: 8,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {owner.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p style={{ fontSize: 12 }}>
                                  Managed by {owner.name?.replace(" (You)", "")}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <div>
                            <div
                              style={{
                                fontSize: 16,
                                fontWeight: 600,
                                color: "#111827",
                                lineHeight: "20px",
                                fontFamily: "Inter, sans-serif",
                                marginBottom: 2,
                              }}
                            >
                              {bill.biller}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                style={{
                                  fontSize: 13,
                                  color: "#6B7280",
                                  lineHeight: "18px",
                                  fontFamily: "Inter, sans-serif",
                                }}
                              >
                                {bill.billerType}
                              </span>

                              <SplitBadge
                                label={`Equal 1/${bill.participants.length} each`}
                                tooltip={`Equal Split (1/${bill.participants.length} each) — All members contribute evenly.`}
                                isEqual
                                variant="compact"
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* YOUR SHARE */}
                      <td
                        className="px-6"
                        style={{ paddingTop: 14, paddingBottom: 14 }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#111827",
                            lineHeight: "24px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          ${bill.yourShare.toFixed(2)}
                        </span>
                      </td>

                      {/* DUE DATE */}
                      <td
                        className="px-6"
                        style={{ paddingTop: 14, paddingBottom: 14 }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 500,
                            color: "#6B7280",
                            lineHeight: "24px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {formatDate(bill.dueDate)}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td
                        className="px-6"
                        style={{ paddingTop: 14, paddingBottom: 14 }}
                      >
                        <motion.div
                          key={`status-${bill.id}-${bill.myStatus}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          <StatusBadge
                            status={bill.myStatus as BillStatus}
                            contextData={{
                              dueDate: formatDate(bill.dueDate),
                              autopayDate: bill.myAutopayEnabled
                                ? formatDate(bill.dueDate)
                                : undefined,
                              isOverdue,
                              billOwnerName: getBillOwner(bill).name,
                            }}
                          />
                        </motion.div>
                      </td>

                      {/* AUTOPAY (centered actions) */}
                      <td
                        className="px-6"
                        style={{ paddingTop: 14, paddingBottom: 14 }}
                      >
                        <div
                          className="flex items-center justify-center gap-2"
                          style={{ minWidth: 240 }}
                        >
                          {/* Pay slot */}
                          <div
                            style={{
                              width: 80,
                              display: "flex",
                              justifyContent: "flex-end",
                            }}
                          >
                            {showPay && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Button
                                  size="sm"
                                  onClick={(e) => startPayFlow(bill, e)}
                                  className="max-h-7 px-3 gap-1.5 cursor-pointer"
                                  style={{
                                    backgroundColor: "#00B948",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: "Inter, sans-serif",
                                  }}
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Pay
                                </Button>
                              </motion.div>
                            )}
                          </div>

                          {/* Toggle slot */}
                          <div
                            style={{
                              width: 44,
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <Switch
                              checked={!!bill.myAutopayEnabled}
                              onCheckedChange={() => toggleAutopay(bill.id)}
                              className="data-[state=checked]:bg-[#00B948]"
                            />
                          </div>
                        </div>
                      </td>

                      <td
                        className="px-6"
                        style={{ paddingTop: 14, paddingBottom: 14 }}
                      >
                        {/* Delete slot */}
                        <div
                          style={{
                            width: 32,
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          {canDeleteBill && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleDeleteBillClick(bill, e)}
                              className="h-7 px-2 hover:bg-red-50 text-red-600 hover:text-red-700"
                              style={{ fontSize: 13, fontWeight: 500 }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Drawer + Modals */}
      <PaymentLedgerDrawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
      />

      {selectedBillForPayment && (
        <PaymentMethodModal
          open={paymentMethodModalOpen}
          onOpenChange={(open) => {
            setPaymentMethodModalOpen(open);
            if (!open) setSelectedPaymentMethod(null);
          }}
          billName={selectedBillForPayment.biller}
          amount={selectedBillForPayment.yourShare.toFixed(2)}
          onVenmoClick={handleVenmoClick}
          onZelleClick={handleZelleClick}
          onAutoPayClick={handleAutoPayClick}
          onBankAccountClick={handleBankAccountClick}
          onCreditCardClick={handleCreditCardClick}
          bankLabel="Pay with Bank Account"
          cardLabel="Pay with Credit Card"
        />
      )}

      {selectedBillForPayment && (
        <PaymentConfirmationModal
          open={paymentConfirmationOpen}
          onOpenChange={setPaymentConfirmationOpen}
          amount={selectedBillForPayment.yourShare.toFixed(2)}
          recipientName={selectedBillForPayment.recipientName}
          onConfirm={handlePaymentConfirmed}
          onCancel={handlePaymentCancelled}
        />
      )}

      {selectedPaymentMethod && selectedBillForPayment && (
        <PayWithStripeModal
          open={stripePayOpen}
          onOpenChange={setStripePayOpen}
          billParticipantId={
            bills.find((b) => b.id === selectedBillForPayment.id)
              ?.myBillParticipantId ?? null
          }
          biller={selectedBillForPayment.biller}
          amountDisplay={selectedBillForPayment.yourShare.toFixed(2)}
          recipientName={selectedBillForPayment.recipientName}
          paymentType={stripePaymentType}
          onSucceeded={() => {
            patchBill(selectedBillForPayment.id, {
              myHasPaid: true,
              myStatus: BillStatus.PAID, // or PAID if you immediately clear
            });
            setSelectedBillForPayment(null);
            setSelectedPaymentMethod(null);
          }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={deleteBillModalOpen} onOpenChange={setDeleteBillModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle
              style={{ fontSize: 18, fontWeight: 600, color: "#111827" }}
            >
              Delete Bill?
            </DialogTitle>
            <DialogDescription
              style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}
            >
              Are you sure you want to delete this bill? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter style={{ marginTop: 24 }}>
            <Button
              variant="outline"
              onClick={() => setDeleteBillModalOpen(false)}
              className="rounded-lg"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteBillConfirm}
              className="rounded-lg bg-red-600 hover:bg-red-700"
              style={{ fontSize: 14, fontWeight: 600 }}
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
      redirect: {
        destination: "/login",
        permanent: false,
      },
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

    return {
      props: {
        bills: bills || [],
        householdMembers: householdData.household?.members || [],
        currentUserId: householdData.currentUserId || "",
      },
    };
  } catch (error) {
    console.error("Error loading bills:", error);
    return {
      redirect: {
        destination: "/protected/dashboard",
        permanent: false,
      },
    };
  }
};
