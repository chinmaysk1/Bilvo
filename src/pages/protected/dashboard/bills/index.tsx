import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
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
import { BilvoHeader } from "@/components/dashboard/BilvoHeader";
import { BilvoSidebar } from "@/components/dashboard/BilvoSidebar";
import { BillsSummaryCards } from "@/components/bills/BillsSummaryCards";
import {
  StatusBadge,
  isBillOverdue,
} from "@/components/bills/BillStatusConfig";
import { SplitBadge } from "@/components/bills/SplitBadge";
import { PaymentLedgerDrawer } from "@/components/bills/PaymentLedgerDrawer";
import { PayBillModal } from "@/components/bills/PayBillModal";
import {
  Zap,
  Droplets,
  Flame,
  Wifi,
  Recycle,
  Upload,
  Search,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import ScanGmailUploadButton from "@/components/bills/ScanGmailUploadButton";
import { BillStatus } from "@prisma/client";
import { Bill } from "@/interfaces/bills";
import { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";

interface BillsPageProps {
  bills: Bill[];
  householdMembers: HouseholdMember[];
  currentUserId: string;
}

const getBillerIcon = (billerType: string) => {
  const type = billerType.toLowerCase();
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
    bills.reduce(
      (acc, bill) => ({ ...acc, [bill.id]: bill.myAutopayEnabled }),
      {}
    )
  );
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [payBillModalOpen, setPayBillModalOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] =
    useState<any>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due-date");

  // Calculate summary stats
  const pendingBills = bills.filter((b) => b.status !== BillStatus.PAID);
  const totalDueThisMonth = pendingBills.reduce(
    (acc, b) => acc + b.yourShare,
    0
  );
  const autopayCount = Object.values(autopayStates).filter(Boolean).length;
  const unpaidBills = bills.filter(
    (b) => b.status === BillStatus.PENDING
  ).length;

  // Find next due date
  const nextDueBill = pendingBills.sort((a, b) => {
    const dateA = new Date(a.dueDate);
    const dateB = new Date(b.dueDate);
    return dateA.getTime() - dateB.getTime();
  })[0];

  // Filter and sort bills
  let filteredBills = [...bills];

  if (searchQuery) {
    filteredBills = filteredBills.filter((bill) =>
      bill.biller.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (statusFilter !== "all") {
    filteredBills = filteredBills.filter(
      (bill) => bill.status === statusFilter
    );
  }

  // Sort bills
  filteredBills.sort((a, b) => {
    if (sortBy === "due-date") {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else if (sortBy === "amount") {
      return b.yourShare - a.yourShare;
    } else if (sortBy === "biller") {
      return a.biller.localeCompare(b.biller);
    }
    return 0;
  });

  const toggleAutopay = async (billId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

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
          // If you eventually support choosing a PM UI-side, pass it instead
          paymentMethodId: bill.myPaymentMethodId ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update autopay");
      }

      const data = await res.json();

      // Sync with backend response in case it corrected anything
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
      // rollback
      setAutopayStates((prev) => ({ ...prev, [billId]: previous }));
      toast.error("Failed to update autopay", {
        description: "Please try again.",
      });
    }
  };

  const handlePayBillClick = (bill: any, e?: React.MouseEvent) => {
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
    setBills((prevBills) =>
      prevBills.map((bill) =>
        bill.id === billId ? { ...bill, status: BillStatus.SCHEDULED } : bill
      )
    );

    // Simulate payment processing
    setTimeout(() => {
      setBills((prevBills) =>
        prevBills.map((bill) =>
          bill.id === billId ? { ...bill, status: BillStatus.PAID } : bill
        )
      );
      toast.success("Payment cleared", {
        description: "Your payment has been successfully processed.",
      });
    }, 5000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Get owner info for a bill
  const getBillOwner = (bill: Bill) => {
    const owner = householdMembers.find((m) => m.id === bill.ownerUserId);
    if (!owner) return { name: "Unknown", initials: "UK", color: "#6B7280" };

    const isYou = owner.id === currentUserId;
    const initials =
      owner.name &&
      owner?.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    const colorIndex = householdMembers.findIndex((m) => m.id === owner.id);
    const color = avatarColors[colorIndex % avatarColors.length];

    return {
      name: isYou ? `${owner.name} (You)` : owner.name,
      initials,
      color,
    };
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F9FAFB" }}>
      <BilvoSidebar />

      <div className="lg:pr-[180px]">
        <BilvoHeader
          onLogout={() => signOut({ callbackUrl: "/login" })}
          onLogoClick={() => router.push("/protected/dashboard")}
        />

        <main
          className="max-w-[1400px] mx-auto px-8 py-6"
          style={{ backgroundColor: "#F9FAFB" }}
        >
          {/* Header Section */}
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

          {/* Search, Filter and Upload Bar */}
          <div style={{ marginBottom: "20px" }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
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
                onBillsImported={(importedBills: Bill[]) => {
                  if (!importedBills || importedBills.length === 0) return;

                  // Merge new bills into existing table
                  setBills((prev) => [...prev, ...importedBills]);

                  // Initialize autopay state for imported bills
                  setAutopayStates((prev) => {
                    const next = { ...prev };
                    for (const b of importedBills) {
                      // make sure imported bills include myAutopayEnabled
                      next[b.id] = b.myAutopayEnabled ?? false;
                    }
                    return next;
                  });
                }}
                className="rounded-lg"
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

          {/* Summary Cards */}
          <div style={{ marginBottom: "20px" }}>
            <BillsSummaryCards
              totalDue={totalDueThisMonth}
              nextDueBill={
                nextDueBill
                  ? {
                      dueDate: formatDate(nextDueBill.dueDate),
                      biller: nextDueBill.biller,
                    }
                  : undefined
              }
              autopayCount={autopayCount}
              totalBills={bills.length}
              overdueBills={unpaidBills}
            />
          </div>

          {/* Bills Table */}
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
                <h3
                  className="text-2xl text-gray-900"
                  style={{ fontWeight: 600 }}
                >
                  All bills are up to date!
                </h3>
                <p className="text-sm text-gray-600 max-w-md">
                  We'll notify you when new bills are imported.
                </p>
              </div>
            </Card>
          ) : (
            <Card
              className="rounded-lg border bg-white overflow-hidden"
              style={{
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                borderColor: "#E5E7EB",
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead
                    className="bg-gray-50 border-b"
                    style={{ borderColor: "#E5E7EB" }}
                  >
                    <tr style={{ height: "48px" }}>
                      <th className="px-6 py-3 text-left">
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Biller
                        </span>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Your Share
                        </span>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Due Date
                        </span>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Status
                        </span>
                      </th>
                      <th className="px-6 py-3 text-center">
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Autopay
                        </span>
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
                      const showPayButton =
                        hoveredRowId === bill.id &&
                        bill.status === BillStatus.PENDING;

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
                          className="border-b transition-all duration-200 cursor-pointer"
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
                        >
                          <td
                            className="px-6"
                            style={{
                              paddingTop: "14px",
                              paddingBottom: "14px",
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="flex items-center justify-center rounded-full flex-shrink-0"
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  backgroundColor: iconBg,
                                }}
                              >
                                <Icon
                                  className="flex-shrink-0"
                                  style={{
                                    width: "12px",
                                    height: "12px",
                                    color: iconColor,
                                  }}
                                  strokeWidth={2}
                                />
                              </div>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Avatar
                                        className="flex-shrink-0"
                                        style={{
                                          width: "16px",
                                          height: "16px",
                                        }}
                                      >
                                        <AvatarFallback
                                          style={{
                                            backgroundColor: owner.color,
                                            color: "white",
                                            fontSize: "8px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {owner.initials}
                                        </AvatarFallback>
                                      </Avatar>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p style={{ fontSize: "12px" }}>
                                      Managed by{" "}
                                      {owner.name &&
                                        owner.name.replace(" (You)", "")}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <div>
                                <div
                                  style={{
                                    fontSize: "16px",
                                    fontWeight: 600,
                                    color: "#111827",
                                    lineHeight: "20px",
                                    fontFamily: "Inter, sans-serif",
                                    marginBottom: "2px",
                                  }}
                                >
                                  {bill.biller}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    style={{
                                      fontSize: "13px",
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
                                    isEqual={true}
                                    variant="compact"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td
                            className="px-6"
                            style={{
                              paddingTop: "14px",
                              paddingBottom: "14px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "16px",
                                fontWeight: 600,
                                color: "#111827",
                                lineHeight: "24px",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              ${bill.yourShare.toFixed(2)}
                            </span>
                          </td>
                          <td
                            className="px-6"
                            style={{
                              paddingTop: "14px",
                              paddingBottom: "14px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "16px",
                                fontWeight: 500,
                                color: "#6B7280",
                                lineHeight: "24px",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {formatDate(bill.dueDate)}
                            </span>
                          </td>
                          <td
                            className="px-6"
                            style={{
                              paddingTop: "14px",
                              paddingBottom: "14px",
                            }}
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
                                  isOverdue: isOverdue,
                                }}
                                onClick={() =>
                                  bill.status === BillStatus.PENDING
                                    ? handlePayBillClick(bill)
                                    : undefined
                                }
                              />
                            </motion.div>
                          </td>
                          <td
                            className="px-6 relative"
                            style={{
                              paddingTop: "14px",
                              paddingBottom: "14px",
                            }}
                          >
                            <div className="flex items-center justify-center gap-2">
                              {showPayButton && (
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -10 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Button
                                    size="sm"
                                    onClick={(e) => handlePayBillClick(bill, e)}
                                    className="h-7 px-3 gap-1.5"
                                    style={{
                                      backgroundColor: "#00B948",
                                      borderRadius: "8px",
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      fontFamily: "Inter, sans-serif",
                                    }}
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    Pay
                                  </Button>
                                </motion.div>
                              )}

                              <Switch
                                checked={autopayStates[bill.id]}
                                onCheckedChange={() => toggleAutopay(bill.id)}
                                className="data-[state=checked]:bg-[#00B948]"
                              />
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
        </main>
      </div>

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
    </div>
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

    // Fetch bills
    const billsResponse = await fetch(`${baseUrl}/api/bills`, {
      headers: {
        Cookie: context.req.headers.cookie || "",
      },
    });

    if (!billsResponse.ok) {
      throw new Error("Failed to fetch bills");
    }

    const { bills } = await billsResponse.json();

    // Fetch household data
    const householdResponse = await fetch(`${baseUrl}/api/household/data`, {
      headers: {
        Cookie: context.req.headers.cookie || "",
      },
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
