import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusBadge } from "./BillStatusConfig";
import {
  CheckCircle2,
  Upload,
  Mail,
  Download,
  ArrowUpRight,
  Receipt,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Trash2,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { BillStatus } from "@prisma/client";

interface PaymentLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillClick?: (billId: string) => void;
}

const allTransactions = [
  {
    id: "1",
    type: "payment_out",
    title: "Autopay charge succeeded",
    biller: "Pacific Gas & Electric",
    category: "Electricity",
    amount: "$79.99",
    timestamp: "Oct 15, 2025",
    icon: Zap,
    iconColor: "text-[#F59E0B]",
    bgColor: "bg-[#FEF3C7]",
    group: "October 2025",
    status: "completed",
    paymentMethod: "Bank of America ••4532",
    reference: "TXN-2024-1015-001",
  },
  {
    id: "2",
    type: "payment_out",
    title: "Autopay charge succeeded",
    biller: "City Water Department",
    category: "Water",
    amount: "$38.00",
    timestamp: "Oct 15, 2025",
    icon: Droplets,
    iconColor: "text-[#3B82F6]",
    bgColor: "bg-[#DBEAFE]",
    group: "October 2025",
    status: "completed",
    paymentMethod: "Bank of America ••4532",
    reference: "TXN-2024-1015-002",
  },
  {
    id: "3",
    type: "payment_out",
    title: "Autopay charge succeeded",
    biller: "Spectrum Internet",
    category: "Internet",
    amount: "$38.00",
    timestamp: "Oct 5, 2025",
    icon: Wifi,
    iconColor: "text-[#8B5CF6]",
    bgColor: "bg-[#EDE9FE]",
    group: "October 2025",
    status: "completed",
    paymentMethod: "Bank of America ••4532",
    reference: "TXN-2024-1005-003",
  },
  {
    id: "4",
    type: "bill_detected",
    title: "Bill detected",
    biller: "City Water Department",
    category: "Water",
    amount: "$120.00",
    timestamp: "Oct 1, 2025",
    icon: Mail,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
    group: "October 2025",
    status: "pending",
    paymentMethod: null,
    reference: "BILL-2024-1001-004",
    source: "gmail",
  },
  {
    id: "5",
    type: "payment_out",
    title: "Autopay charge succeeded",
    biller: "Pacific Gas & Electric",
    category: "Electricity",
    amount: "$71.80",
    timestamp: "Sep 28, 2025",
    icon: Zap,
    iconColor: "text-[#F59E0B]",
    bgColor: "bg-[#FEF3C7]",
    group: "September 2025",
    status: "completed",
    paymentMethod: "Bank of America ••4532",
    reference: "TXN-2024-0928-005",
  },
  {
    id: "6",
    type: "payment_out",
    title: "Autopay charge succeeded",
    biller: "SoCalGas",
    category: "Gas",
    amount: "$42.80",
    timestamp: "Sep 21, 2025",
    icon: Flame,
    iconColor: "text-[#EF4444]",
    bgColor: "bg-[#FEE2E2]",
    group: "September 2025",
    status: "completed",
    paymentMethod: "Visa ••4242",
    reference: "TXN-2024-0921-006",
  },
];

export function PaymentLedgerDrawer({
  open,
  onOpenChange,
  onBillClick,
}: PaymentLedgerDrawerProps) {
  const [filter, setFilter] = useState<"all" | "payments" | "bills">("all");

  const filteredTransactions = allTransactions.filter((txn) => {
    if (filter === "payments") return txn.type === "payment_out";
    if (filter === "bills")
      return txn.type === "bill_detected" || txn.type === "bill_uploaded";
    return true;
  });

  const totalPaid = allTransactions
    .filter((txn) => txn.type === "payment_out" && txn.amount)
    .reduce((sum, txn) => sum + parseFloat(txn.amount.replace("$", "")), 0);

  const octTransactions = allTransactions.filter(
    (t) => t.group === "October 2025"
  );
  const totalPaidOctober = octTransactions
    .filter((txn) => txn.type === "payment_out" && txn.amount)
    .reduce((sum, txn) => sum + parseFloat(txn.amount.replace("$", "")), 0);

  const groupedByMonth = ["October 2025", "September 2025"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[720px] sm:max-w-[720px] p-0 flex flex-col"
        style={{ maxHeight: "100vh" }}
      >
        <SheetHeader className="px-6 py-5 border-b border-[#E5E7EB] flex-shrink-0">
          <SheetTitle
            className="text-xl text-[#111827]"
            style={{ fontWeight: 600 }}
          >
            Payment Ledger
          </SheetTitle>
          <SheetDescription className="text-sm text-[#6B7280]">
            Complete history of all payments and transactions
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card
                className="rounded-xl border border-[#E5E7EB] bg-white p-4"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#6B7280] mb-0.5">Total Paid</p>
                    <p
                      className="text-lg text-[#111827]"
                      style={{ fontWeight: 600 }}
                    >
                      ${totalPaid.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className="rounded-xl border border-[#E5E7EB] bg-white p-4"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Receipt className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#6B7280] mb-0.5">
                      Transactions
                    </p>
                    <p
                      className="text-lg text-[#111827]"
                      style={{ fontWeight: 600 }}
                    >
                      {allTransactions.length}
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className="rounded-xl border border-[#E5E7EB] bg-white p-4"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#6B7280] mb-0.5">This Month</p>
                    <p
                      className="text-lg text-[#111827]"
                      style={{ fontWeight: 600 }}
                    >
                      ${totalPaidOctober.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Filter Pills */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-white rounded-lg border border-[#E5E7EB] p-1">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-5 py-2 rounded-md text-sm transition-all ${
                    filter === "all"
                      ? "bg-[#16A34A] text-white"
                      : "text-[#6B7280] hover:bg-[#F9FAFB]"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("payments")}
                  className={`px-5 py-2 rounded-md text-sm transition-all ${
                    filter === "payments"
                      ? "bg-[#16A34A] text-white"
                      : "text-[#6B7280] hover:bg-[#F9FAFB]"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  Payments
                </button>
                <button
                  onClick={() => setFilter("bills")}
                  className={`px-5 py-2 rounded-md text-sm transition-all ${
                    filter === "bills"
                      ? "bg-[#16A34A] text-white"
                      : "text-[#6B7280] hover:bg-[#F9FAFB]"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  Bills
                </button>
              </div>
            </div>

            {/* Transaction Groups */}
            <div className="space-y-6">
              {groupedByMonth.map((month) => {
                const monthTransactions = filteredTransactions.filter(
                  (t) => t.group === month
                );
                if (monthTransactions.length === 0) return null;

                const monthTotal = monthTransactions
                  .filter((t) => t.amount)
                  .reduce(
                    (sum, t) => sum + parseFloat(t.amount!.replace("$", "")),
                    0
                  );
                const autopayPct =
                  monthTransactions.filter((t) => t.type === "payment_out")
                    .length > 0
                    ? 100
                    : 0;

                return (
                  <div key={month}>
                    <div className="mb-4 pb-3 border-b border-[#F3F4F6]">
                      <h3
                        className="text-sm text-[#111827] mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        {month}
                      </h3>
                      <p className="text-xs text-[#6B7280]">
                        Total Paid:{" "}
                        <span style={{ fontWeight: 600 }}>
                          ${monthTotal.toFixed(2)}
                        </span>{" "}
                        · {monthTransactions.length} transaction
                        {monthTransactions.length !== 1 ? "s" : ""} ·{" "}
                        {autopayPct}% via Autopay
                      </p>
                    </div>

                    <div className="space-y-1">
                      {monthTransactions.map((transaction) => {
                        const Icon = transaction.icon;
                        const isClickable =
                          transaction.type === "payment_out" ||
                          transaction.type === "bill_detected" ||
                          transaction.type === "bill_uploaded";

                        return (
                          <div
                            key={transaction.id}
                            onClick={() =>
                              isClickable && onBillClick?.(transaction.id)
                            }
                            className={`flex items-start gap-4 p-3 rounded-lg transition-colors ${
                              isClickable
                                ? "hover:bg-[#FAFAFA] cursor-pointer"
                                : "hover:bg-[#F9FAFB]"
                            }`}
                          >
                            <div
                              className={`h-9 w-9 rounded-full ${transaction.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}
                            >
                              <Icon
                                className={`h-4 w-4 ${transaction.iconColor}`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div
                                    className="text-sm text-[#111827] mb-0.5"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {transaction.title}
                                  </div>
                                  <div className="text-sm text-[#6B7280] flex items-center gap-2 flex-wrap">
                                    <span>{transaction.biller}</span>
                                    {transaction.source && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-gray-100 text-gray-600 hover:bg-gray-100 rounded-full text-xs flex items-center gap-1 px-2 py-0 h-5"
                                      >
                                        {transaction.source === "gmail" ? (
                                          <>
                                            <Mail className="h-2.5 w-2.5" />
                                            Gmail
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="h-2.5 w-2.5" />
                                            Manual
                                          </>
                                        )}
                                      </Badge>
                                    )}
                                  </div>
                                  {transaction.paymentMethod && (
                                    <div className="text-xs text-[#9CA3AF] mt-1">
                                      Paid with {transaction.paymentMethod}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {transaction.amount && (
                                    <div
                                      className="text-base text-[#111827] mb-0.5"
                                      style={{ fontWeight: 600 }}
                                    >
                                      {transaction.amount}
                                    </div>
                                  )}
                                  <div className="text-xs text-[#9CA3AF]">
                                    {transaction.timestamp}
                                  </div>
                                  <StatusBadge
                                    status={
                                      transaction.status === "completed"
                                        ? BillStatus.PAID
                                        : BillStatus.PENDING
                                    }
                                    size="sm"
                                    showTooltip={false}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-[#E5E7EB]">
          <Button
            variant="outline"
            className="w-full border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB] rounded-lg"
            onClick={() => toast.success("Exporting transaction history...")}
            style={{ fontWeight: 600 }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
