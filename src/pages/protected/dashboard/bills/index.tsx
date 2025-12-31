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
import { PayBillModal } from "@/components/bills/PayBillModal";
import ScanGmailUploadButton from "@/components/bills/ScanGmailUploadButton";

import { toast } from "sonner";
import { motion } from "framer-motion";

import {
  StatusBadge,
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

export default function BillsPage({
  bills: initialBills,
  householdMembers,
  currentUserId,
}: BillsPageProps) {
  const router = useRouter();

  const [bills, setBills] = useState(initialBills);
  const [autopayStates, setAutopayStates] = useState<Record<string, boolean>>(
    initialBills.reduce(
      (acc, bill) => ({ ...acc, [bill.id]: !!bill.myAutopayEnabled }),
      {}
    )
  );

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const [payBillModalOpen, setPayBillModalOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] =
    useState<any>(null);

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "PENDING" | "SCHEDULED" | "PAID"
  >("all");
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

  const pendingBills = useMemo(
    () => bills.filter((b) => b.status !== BillStatus.PAID),
    [bills]
  );

  const totalDueThisMonth = useMemo(
    () => pendingBills.reduce((acc, b) => acc + (b.yourShare || 0), 0),
    [pendingBills]
  );

  const autopayCount = useMemo(
    () => Object.values(autopayStates).filter(Boolean).length,
    [autopayStates]
  );

  // "Unpaid" in your app maps to BillStatus.PENDING (from your existing page)
  const unpaidBills = useMemo(
    () => bills.filter((b) => b.status !== BillStatus.PAID).length,
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
      list = list.filter((bill) => bill.status === statusFilter);
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

    const previous = autopayStates[billId] ?? false;
    const next = !previous;

    // optimistic UI
    setAutopayStates((prev) => ({ ...prev, [billId]: next }));

    try {
      const res = await fetch(`/api/bills/${billId}/autopay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next,
          // NOTE: you currently pass null unless you support choosing PM in UI.
          paymentMethodId: bill.myPaymentMethodId ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update autopay");
      }

      const data = await res.json();

      setAutopayStates((prev) => ({
        ...prev,
        [billId]: !!data.autopayEnabled,
      }));

      if (next) {
        toast.success("Autopay enabled", {
          description:
            bill.status === BillStatus.PENDING
              ? `This bill will be paid automatically on ${new Date(
                  bill.dueDate
                ).toLocaleDateString()}.`
              : "Future bills will be paid automatically.",
        });
      } else {
        toast.info("Autopay disabled", {
          description: "Manual payment required for this bill.",
        });
      }
    } catch (err) {
      console.error("Failed to update autopay", err);
      setAutopayStates((prev) => ({ ...prev, [billId]: previous }));
      toast.error("Failed to update autopay", {
        description: "Please try again.",
      });
    }
  };

  const openPayModal = (bill: Bill, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const { icon, iconColor, iconBg } = getBillerIcon(bill.billerType);
    setSelectedBillForPayment({
      id: bill.id,
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
    });
    setPayBillModalOpen(true);
  };

  const handlePaymentSubmit = (
    billId: string,
    amount: number,
    paymentMethodId: string
  ) => {
    // keep your existing “simulate then mark PAID” behavior
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId ? { ...b, status: BillStatus.SCHEDULED } : b
      )
    );

    setTimeout(() => {
      setBills((prev) =>
        prev.map((b) =>
          b.id === billId ? { ...b, status: BillStatus.PAID } : b
        )
      );
      toast.success("Payment cleared", {
        description: "Your payment has been successfully processed.",
      });
    }, 5000);
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

  return (
    <DashboardLayout>
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

              setAutopayStates((prev) => {
                const next = { ...prev };
                for (const b of imported) next[b.id] = !!b.myAutopayEnabled;
                return next;
              });
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
                  {/* IMPORTANT: header is "Autopay" and centered */}
                  <th className="px-6 py-3 text-center">
                    <span style={thStyle}>Autopay</span>
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

                  const isOverdue =
                    bill.status === BillStatus.PENDING &&
                    isBillOverdue(bill.dueDate);

                  // Show pay for pending OR scheduled (Figma style), not just hover
                  const showPay =
                    bill.status === BillStatus.PENDING ||
                    bill.status === BillStatus.SCHEDULED;

                  // If you want stricter permission later, wire it here.
                  const canDeleteBill = true;

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
                        setHoveredRowId(bill.id);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                        setHoveredRowId(null);
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
                          key={`status-${bill.id}-${bill.status}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          <StatusBadge
                            status={bill.status as BillStatus}
                            contextData={{
                              dueDate: formatDate(bill.dueDate),
                              autopayDate: autopayStates[bill.id]
                                ? formatDate(bill.dueDate)
                                : undefined,
                              isOverdue,
                            }}
                            onClick={() => {
                              if (bill.status === BillStatus.PENDING)
                                openPayModal(bill);
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
                                  onClick={(e) => openPayModal(bill, e)}
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
                              checked={!!autopayStates[bill.id]}
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

      <PayBillModal
        open={payBillModalOpen}
        onOpenChange={setPayBillModalOpen}
        bill={selectedBillForPayment}
        onPaymentSubmit={handlePaymentSubmit}
      />

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
        currentUserId: householdData.user?.id || "",
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
