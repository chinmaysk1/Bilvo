// components/bills/BatchedBillsTable.tsx
import React, { Fragment, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Info,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Trash2,
  Wifi,
  Flame,
  Droplets,
  Zap,
  Recycle,
  FileText,
} from "lucide-react";
import {
  StatusBadge,
  isBillOverdue,
} from "@/components/bills/BillStatusConfig";
import { BillStatus } from "@prisma/client";

import type { Bill } from "@/interfaces/bills";
import type { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";
import { getBillerIcon } from "@/utils/bills/getBillerIcon";

const avatarColors = ["#F2C94C", "#008a4b", "#BB6BD9", "#3B82F6", "#EF4444"];

function initialsFor(name?: string | null) {
  const s = (name || "").trim();
  if (!s) return "U";
  return s
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMonthDay(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type OwnerMeta = {
  name: string;
  initials: string;
  color: string;
  isYou: boolean;
};

function getOwnerMeta(
  ownerUserId: string,
  householdMembers: HouseholdMember[],
  currentUserId: string,
): OwnerMeta {
  const owner = householdMembers.find((m) => m.id === ownerUserId);
  if (!owner)
    return { name: "Unknown", initials: "UK", color: "#6B7280", isYou: false };

  const isYou = owner.id === currentUserId;
  const idx = householdMembers.findIndex((m) => m.id === owner.id);
  const color = avatarColors[idx % avatarColors.length];

  return {
    name: isYou ? `${owner.name || "You"} (You)` : owner.name || "Unknown",
    initials: initialsFor(owner.name),
    color,
    isYou,
  };
}

type BillsGroup = {
  ownerUserId: string;
  owner: OwnerMeta;
  bills: Bill[];
  earliestDueDateISO: string;
  totalAmount: number;
  groupStatus: BillStatus; // derived
};

function deriveGroupStatus(bills: Bill[]) {
  // If any bill is FAILED or PENDING_APPROVAL, surface that.
  // Otherwise if any is PENDING/SCHEDULED, surface PENDING/SCHEDULED.
  // Else PAID.
  const statuses = bills.map((b) => b.myStatus);
  if (statuses.includes(BillStatus.FAILED)) return BillStatus.FAILED;
  if (statuses.includes(BillStatus.PENDING_APPROVAL))
    return BillStatus.PENDING_APPROVAL;
  if (statuses.includes(BillStatus.PENDING)) return BillStatus.PENDING;
  if (statuses.includes(BillStatus.SCHEDULED)) return BillStatus.SCHEDULED;
  return BillStatus.PAID;
}

export type BatchedBillsTableProps = {
  title?: string;
  bills: Bill[];
  householdMembers: HouseholdMember[];
  currentUserId: string;

  // UI knobs
  defaultExpandedOwnerIds?: string[];
  hideDelete?: boolean;

  // actions (wire to your existing handlers)
  onPayBill?: (bill: Bill, e?: React.MouseEvent) => void;
  onPayGroup?: (
    payload: {
      ownerUserId: string;
      ownerName: string; // no "(You)"
      ownerInitials: string;
      ownerColor: string;
      amount: number; // group.totalAmount
      dueDateISO: string; // group.earliestDueDateISO
      bills: Bill[]; // the bills included
    },
    e?: React.MouseEvent,
  ) => void;
  onToggleAutopay?: (billId: string) => void;
  onDeleteBill?: (bill: Bill, e?: React.MouseEvent) => void;
};

export function BatchedBillsTable({
  title = "This Month’s Bills",
  bills,
  householdMembers,
  currentUserId,
  defaultExpandedOwnerIds = [],
  hideDelete = false,
  onPayBill,
  onPayGroup,
  onToggleAutopay,
  onDeleteBill,
}: BatchedBillsTableProps) {
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(
    new Set(defaultExpandedOwnerIds),
  );

  const activeBills = useMemo(() => {
    // "Active" in your app means not paid
    return (bills || []).filter((b) => b.myStatus !== BillStatus.PAID);
  }, [bills]);

  const groups = useMemo(() => {
    const byOwner: Record<string, Bill[]> = {};
    for (const b of bills) {
      const k = b.ownerUserId || "unknown";
      if (!byOwner[k]) byOwner[k] = [];
      byOwner[k].push(b);
    }

    const out: BillsGroup[] = Object.entries(byOwner).map(
      ([ownerUserId, list]) => {
        const sorted = [...list].sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        );

        const earliestDueDateISO =
          sorted[0]?.dueDate || new Date().toISOString();
        const totalAmount = sorted.reduce(
          (sum, b) => sum + Number(b.yourShare || 0),
          0,
        );

        return {
          ownerUserId,
          owner: getOwnerMeta(ownerUserId, householdMembers, currentUserId),
          bills: sorted,
          earliestDueDateISO,
          totalAmount,
          groupStatus: deriveGroupStatus(sorted),
        };
      },
    );

    // sort groups: unpaid-like first by earliest due
    out.sort(
      (a, b) =>
        new Date(a.earliestDueDateISO).getTime() -
        new Date(b.earliestDueDateISO).getTime(),
    );
    return out;
  }, [bills, householdMembers, currentUserId]);

  const toggleOwner = (ownerUserId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(ownerUserId)) next.delete(ownerUserId);
      else next.add(ownerUserId);
      return next;
    });
  };

  return (
    <Card
      className="rounded-xl border bg-white relative"
      style={{
        boxShadow:
          "0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)",
        borderColor: "#E5E7EB",
      }}
    >
      {/* inner border */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ border: "1px solid #F3F4F6" }}
      />

      {/* header bar */}
      <div
        className="px-6 flex items-center justify-between"
        style={{ backgroundColor: "#F9FAFB", height: 40 }}
      >
        <div className="flex items-center gap-2">
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {title}
          </h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info
                  className="h-3.5 w-3.5 cursor-help"
                  style={{ color: "#9CA3AF" }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Bills are grouped by owner to reduce clutter. Expand a group
                  to pay or toggle autopay per bill.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow
              className="border-b"
              style={{ borderColor: "#E5E7EB", height: 32 }}
            >
              <TableHead className="pl-6" style={headStyle}>
                Creditor
              </TableHead>
              <TableHead style={headStyle}>Bills</TableHead>
              <TableHead style={headStyle}>Your Share</TableHead>
              <TableHead style={headStyle}>Status</TableHead>
              <TableHead
                className="pr-6"
                style={{ ...headStyle, textAlign: "right" }}
              >
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups.map((group, idx) => {
              const isExpanded = expandedOwners.has(group.ownerUserId);
              const isSingle = group.bills.length === 1;
              const isEven = idx % 2 === 0;
              const ownerFirstName = group.owner.name
                .replace(" (You)", "")
                .trim()
                .split(" ")[0];

              const canPayGroup = !group.owner.isYou && group.totalAmount > 0;

              return (
                <Fragment key={group.ownerUserId}>
                  {/* Group row */}
                  <TableRow
                    className="cursor-pointer border-b"
                    style={{
                      borderColor: "#E5E7EB",
                      height: 52,
                      backgroundColor: isEven ? "transparent" : "#FAFBFC",
                    }}
                    onClick={(e) => {
                      if (!isSingle) toggleOwner(group.ownerUserId, e);
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#F9FAFB")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = isEven
                        ? "transparent"
                        : "#FAFBFC")
                    }
                  >
                    <TableCell
                      className="pl-6"
                      style={{ paddingTop: 12, paddingBottom: 12 }}
                    >
                      <div className="flex items-center gap-3">
                        {/* chevron */}
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {!isSingle && (
                            <div
                              onClick={(e) => toggleOwner(group.ownerUserId, e)}
                              style={{ cursor: "pointer" }}
                            >
                              {isExpanded ? (
                                <ChevronDown
                                  className="h-4 w-4"
                                  style={{ color: "#6B7280" }}
                                />
                              ) : (
                                <ChevronRight
                                  className="h-4 w-4"
                                  style={{ color: "#6B7280" }}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        <Avatar style={{ width: 40, height: 40 }}>
                          <AvatarFallback
                            style={{
                              backgroundColor: group.owner.color,
                              color: "white",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            {group.owner.initials}
                          </AvatarFallback>
                        </Avatar>

                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#111827",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {group.owner.name.replace(" (You)", "")}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell style={{ paddingTop: 12, paddingBottom: 12 }}>
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#111827",
                            fontFamily: "Inter, sans-serif",
                            marginBottom: 2,
                          }}
                        >
                          {group.bills.map((b) => b.biller).join(" • ")}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#9CA3AF",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Due {formatMonthDay(group.earliestDueDateISO)} •{" "}
                          {isSingle ? "Single bill" : "Auto-grouped"}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell style={{ paddingTop: 12, paddingBottom: 12 }}>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#111827",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        ${group.totalAmount.toFixed(2)}
                      </span>
                    </TableCell>

                    <TableCell style={{ paddingTop: 12, paddingBottom: 12 }}>
                      <StatusBadge
                        status={group.groupStatus}
                        contextData={{
                          dueDate: formatMonthDay(group.earliestDueDateISO),
                          billOwnerName: group.owner.name,
                        }}
                      />
                    </TableCell>

                    <TableCell
                      className="pr-6"
                      style={{
                        paddingTop: 12,
                        paddingBottom: 12,
                        textAlign: "right",
                      }}
                    >
                      <Button
                        size="sm"
                        disabled={!canPayGroup}
                        onClick={(e) => {
                          e.stopPropagation();

                          // fire group pay
                          onPayGroup?.(
                            {
                              ownerUserId: group.ownerUserId,
                              ownerName: group.owner.name.replace(" (You)", ""),
                              ownerInitials: group.owner.initials,
                              ownerColor: group.owner.color,
                              amount: group.totalAmount,
                              dueDateISO: group.earliestDueDateISO,
                              bills: group.bills,
                            },
                            e,
                          );
                        }}
                        style={{
                          backgroundColor: canPayGroup ? "#008a4b" : "#E5E7EB",
                          color: canPayGroup ? "white" : "#6B7280",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: 600,
                          fontFamily: "Inter, sans-serif",
                          height: "36px",
                          paddingLeft: "16px",
                          paddingRight: "16px",
                          borderColor: canPayGroup ? "#008a4b" : "#E5E7EB",
                        }}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay {ownerFirstName} ${group.totalAmount.toFixed(2)}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded per-bill rows */}
                  {isExpanded &&
                    group.bills.map((bill, billIdx) => {
                      const isOverdue =
                        bill.myStatus === BillStatus.PENDING &&
                        isBillOverdue(bill.dueDate);
                      const canPay = bill.ownerUserId !== currentUserId;
                      const showPay =
                        (bill.myStatus === BillStatus.PENDING ||
                          bill.myStatus === BillStatus.SCHEDULED ||
                          bill.myStatus === BillStatus.FAILED) &&
                        canPay &&
                        !bill.myHasPaid;

                      return (
                        <TableRow
                          key={bill.id}
                          className="border-b"
                          style={{
                            borderColor:
                              billIdx === group.bills.length - 1
                                ? "#E5E7EB"
                                : "#F3F4F6",
                            backgroundColor: "#FAFBFC",
                          }}
                        >
                          <TableCell
                            className="pl-6"
                            style={{ paddingTop: 10, paddingBottom: 10 }}
                          >
                            <div
                              className="flex items-center gap-3"
                              style={{ paddingLeft: 16 }}
                            >
                              {(() => {
                                const {
                                  icon: Icon,
                                  iconBg,
                                  iconColor,
                                } = getBillerIcon(bill.billerType);
                                return (
                                  <div
                                    className="rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                      width: 40,
                                      height: 40,
                                      backgroundColor: iconBg,
                                    }}
                                  >
                                    <Icon
                                      className="h-4 w-4"
                                      style={{ color: iconColor }}
                                      strokeWidth={2}
                                    />
                                  </div>
                                );
                              })()}

                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "#6B7280",
                                    fontFamily: "Inter, sans-serif",
                                    lineHeight: "18px",
                                  }}
                                >
                                  {bill.biller}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 400,
                                    color: "#9CA3AF",
                                    fontFamily: "Inter, sans-serif",
                                    lineHeight: "16px",
                                  }}
                                >
                                  {formatMonthDay(bill.dueDate)}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell
                            style={{ paddingTop: 10, paddingBottom: 10 }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                color: "#9CA3AF",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              Due {formatMonthDay(bill.dueDate)}
                            </span>
                          </TableCell>

                          <TableCell
                            style={{ paddingTop: 10, paddingBottom: 10 }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#6B7280",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              ${Number(bill.yourShare || 0).toFixed(2)}
                            </span>
                          </TableCell>

                          <TableCell
                            style={{ paddingTop: 10, paddingBottom: 10 }}
                          >
                            <StatusBadge
                              status={bill.myStatus}
                              contextData={{
                                dueDate: formatMonthDay(bill.dueDate),
                                autopayDate: bill.myAutopayEnabled
                                  ? formatMonthDay(bill.dueDate)
                                  : undefined,
                                isOverdue,
                                billOwnerName: group.owner.name,
                              }}
                            />
                          </TableCell>

                          <TableCell
                            className="pr-6"
                            style={{
                              paddingTop: 10,
                              paddingBottom: 10,
                              textAlign: "right",
                            }}
                          >
                            <div className="flex items-center justify-end gap-3">
                              {showPay && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => onPayBill?.(bill, e)}
                                  style={{
                                    borderColor: "#008a4b",
                                    color: "#008a4b",
                                    backgroundColor: "white",
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: "Inter, sans-serif",
                                    height: 32,
                                    paddingLeft: 12,
                                    paddingRight: 12,
                                  }}
                                >
                                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                  Pay
                                </Button>
                              )}

                              <div className="flex items-center gap-2">
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: "#9CA3AF",
                                    fontFamily: "Inter, sans-serif",
                                  }}
                                >
                                  AUTOPAY
                                </span>
                                <Switch
                                  checked={!!bill.myAutopayEnabled}
                                  onCheckedChange={() =>
                                    onToggleAutopay?.(bill.id)
                                  }
                                  className="data-[state=checked]:bg-[#008a4b] w-10 h5"
                                />
                              </div>

                              {!hideDelete &&
                                bill.ownerUserId === currentUserId && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => onDeleteBill?.(bill, e)}
                                    className="h-7 px-2 hover:bg-red-50 text-red-600 hover:text-red-700"
                                    style={{ fontSize: 13, fontWeight: 500 }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

const headStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#9CA3AF",
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.05em",
  fontFamily: "Inter, sans-serif",
  paddingTop: 8,
  paddingBottom: 8,
};
