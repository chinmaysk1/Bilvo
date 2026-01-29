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
} from "lucide-react";
import {
  StatusBadge,
  isBillOverdue,
} from "@/components/bills/BillStatusConfig";
import { BillStatus } from "@prisma/client";

import type { Bill } from "@/interfaces/bills";
import type { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";
import { getBillerIcon } from "@/utils/bills/getBillerIcon";
import { formatMonthDay } from "@/utils/common/formatMonthYear";

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
  earliestDueDateISO: string | null;
  totalAmount: number;
  groupStatus: BillStatus;
};

function deriveGroupStatus(bills: Bill[]) {
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
  defaultExpandedOwnerIds?: string[];
  hideDelete?: boolean;
  onPayBill?: (bill: Bill, e?: React.MouseEvent) => void;
  onPayGroup?: (
    payload: {
      ownerUserId: string;
      ownerName: string;
      ownerInitials: string;
      ownerColor: string;
      amount: number;
      dueDateISO: string;
      bills: Bill[];
    },
    e?: React.MouseEvent,
  ) => void;
  onToggleAutopay?: (billId: string) => void;
  onDeleteBill?: (bill: Bill, e?: React.MouseEvent) => void;
};

export function BatchedBillsTable({
  title = "This Month's Bills",
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

  const groups = useMemo(() => {
    const byOwner: Record<string, Bill[]> = {};
    for (const b of bills) {
      const k = b.ownerUserId || "unknown";
      if (!byOwner[k]) byOwner[k] = [];
      byOwner[k].push(b);
    }

    const out: BillsGroup[] = Object.entries(byOwner).map(
      ([ownerUserId, list]) => {
        const sorted = [...list].sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        const earliestDueDateISO =
          sorted.find((b) => !!b.dueDate)?.dueDate ?? null;
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

    out.sort((a, b) => {
      if (!a.earliestDueDateISO && !b.earliestDueDateISO) return 0;
      if (!a.earliestDueDateISO) return 1;
      if (!b.earliestDueDateISO) return -1;
      return (
        new Date(a.earliestDueDateISO).getTime() -
        new Date(b.earliestDueDateISO).getTime()
      );
    });
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
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ border: "1px solid #F3F4F6" }}
      />

      {/* Header bar */}
      <div
        className="px-4 sm:px-6 flex items-center justify-between"
        style={{ backgroundColor: "#F9FAFB", minHeight: 44 }}
      >
        <div className="flex items-center gap-2">
          <h2
            style={{
              fontSize: 14, // CHANGED: from 13 for mobile
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
                  className="h-4 w-4 cursor-help" // CHANGED: from 3.5
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

      {/* DESKTOP TABLE VIEW - Hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
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
            {groups.map((group, idx) => (
              <DesktopGroupRow
                key={group.ownerUserId}
                group={group}
                idx={idx}
                isExpanded={expandedOwners.has(group.ownerUserId)}
                currentUserId={currentUserId}
                hideDelete={hideDelete}
                toggleOwner={toggleOwner}
                onPayBill={onPayBill}
                onPayGroup={onPayGroup}
                onToggleAutopay={onToggleAutopay}
                onDeleteBill={onDeleteBill}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE CARD VIEW - Shown on mobile only */}
      <div className="md:hidden">
        {groups.map((group) => (
          <MobileGroupCard
            key={group.ownerUserId}
            group={group}
            isExpanded={expandedOwners.has(group.ownerUserId)}
            currentUserId={currentUserId}
            hideDelete={hideDelete}
            toggleOwner={toggleOwner}
            onPayBill={onPayBill}
            onPayGroup={onPayGroup}
            onToggleAutopay={onToggleAutopay}
            onDeleteBill={onDeleteBill}
          />
        ))}
      </div>
    </Card>
  );
}

// Desktop table row component (existing logic)
function DesktopGroupRow({
  group,
  idx,
  isExpanded,
  currentUserId,
  hideDelete,
  toggleOwner,
  onPayBill,
  onPayGroup,
  onToggleAutopay,
  onDeleteBill,
}: {
  group: BillsGroup;
  idx: number;
  isExpanded: boolean;
  currentUserId: string;
  hideDelete: boolean;
  toggleOwner: (id: string, e?: React.MouseEvent) => void;
  onPayBill?: (bill: Bill, e?: React.MouseEvent) => void;
  onPayGroup?: (payload: any, e?: React.MouseEvent) => void;
  onToggleAutopay?: (billId: string) => void;
  onDeleteBill?: (bill: Bill, e?: React.MouseEvent) => void;
}) {
  const isSingle = group.bills.length === 1;
  const isEven = idx % 2 === 0;
  const ownerFirstName = group.owner.name
    .replace(" (You)", "")
    .trim()
    .split(" ")[0];
  const canPayGroup =
    !group.owner.isYou &&
    group.totalAmount > 0 &&
    group.groupStatus !== BillStatus.PAID;

  return (
    <Fragment>
      <TableRow
        className="cursor-pointer border-b"
        style={{
          borderColor: "#E5E7EB",
          height: 52,
          backgroundColor: isEven ? "transparent" : "#FAFBFC",
        }}
        onClick={(e) => {
          toggleOwner(group.ownerUserId, e);
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
            <div
              style={{
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
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
              Due{" "}
              {group.earliestDueDateISO
                ? formatMonthDay(group.earliestDueDateISO)
                : "—"}{" "}
              • {isSingle ? "Single bill" : "Auto-grouped"}
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
              dueDate: group.earliestDueDateISO
                ? formatMonthDay(group.earliestDueDateISO)
                : "—",
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
              onPayGroup?.(
                {
                  ownerUserId: group.ownerUserId,
                  ownerName: group.owner.name.replace(" (You)", ""),
                  ownerInitials: group.owner.initials,
                  ownerColor: group.owner.color,
                  amount: group.totalAmount,
                  dueDateISO:
                    group.earliestDueDateISO || new Date().toISOString(),
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

      {isExpanded &&
        group.bills.map((bill, billIdx) => {
          const isOverdue =
            bill.myStatus === BillStatus.PENDING &&
            !!bill.dueDate &&
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
                  billIdx === group.bills.length - 1 ? "#E5E7EB" : "#F3F4F6",
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
                      {bill.dueDate ? formatMonthDay(bill.dueDate) : "—"}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell style={{ paddingTop: 10, paddingBottom: 10 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: "#9CA3AF",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Due {bill.dueDate ? formatMonthDay(bill.dueDate) : "—"}
                </span>
              </TableCell>

              <TableCell style={{ paddingTop: 10, paddingBottom: 10 }}>
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

              <TableCell style={{ paddingTop: 10, paddingBottom: 10 }}>
                <StatusBadge
                  status={bill.myStatus}
                  contextData={{
                    dueDate: bill.dueDate ? formatMonthDay(bill.dueDate) : "—",
                    autopayDate:
                      bill.myAutopayEnabled && bill.dueDate
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
                      onCheckedChange={() => onToggleAutopay?.(bill.id)}
                      className="data-[state=checked]:bg-[#008a4b] w-10 h-5"
                    />
                  </div>

                  {!hideDelete && bill.ownerUserId === currentUserId && (
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
}

// NEW: Mobile card view component
function MobileGroupCard({
  group,
  isExpanded,
  currentUserId,
  hideDelete,
  toggleOwner,
  onPayBill,
  onPayGroup,
  onToggleAutopay,
  onDeleteBill,
}: {
  group: BillsGroup;
  isExpanded: boolean;
  currentUserId: string;
  hideDelete: boolean;
  toggleOwner: (id: string, e?: React.MouseEvent) => void;
  onPayBill?: (bill: Bill, e?: React.MouseEvent) => void;
  onPayGroup?: (payload: any, e?: React.MouseEvent) => void;
  onToggleAutopay?: (billId: string) => void;
  onDeleteBill?: (bill: Bill, e?: React.MouseEvent) => void;
}) {
  const isSingle = group.bills.length === 1;
  const ownerFirstName = group.owner.name
    .replace(" (You)", "")
    .trim()
    .split(" ")[0];
  const canPayGroup =
    !group.owner.isYou &&
    group.totalAmount > 0 &&
    group.groupStatus !== BillStatus.PAID;

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      {/* Group Header */}
      <div
        className="p-4 cursor-pointer active:bg-gray-50"
        onClick={(e) => {
          if (!isSingle) toggleOwner(group.ownerUserId, e);
        }}
      >
        {/* Owner info */}
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width: 16 }}>
            {!isSingle && (
              <div onClick={(e) => toggleOwner(group.ownerUserId, e)}>
                {isExpanded ? (
                  <ChevronDown
                    className="h-5 w-5"
                    style={{ color: "#6B7280" }}
                  />
                ) : (
                  <ChevronRight
                    className="h-5 w-5"
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

          <div className="flex-1">
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#111827",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {group.owner.name.replace(" (You)", "")}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#9CA3AF",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {isSingle ? "Single bill" : `${group.bills.length} bills`}
            </div>
          </div>
        </div>

        {/* Bills preview and amount */}
        <div className="mb-3">
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#111827",
              fontFamily: "Inter, sans-serif",
              marginBottom: 4,
            }}
          >
            {group.bills.map((b) => b.biller).join(" • ")}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#9CA3AF",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Due{" "}
            {group.earliestDueDateISO
              ? formatMonthDay(group.earliestDueDateISO)
              : "—"}
          </div>
        </div>

        {/* Amount and status row */}
        <div className="flex items-center justify-between mb-3">
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "Inter, sans-serif",
            }}
          >
            ${group.totalAmount.toFixed(2)}
          </span>
          <StatusBadge
            status={group.groupStatus}
            contextData={{
              dueDate: group.earliestDueDateISO
                ? formatMonthDay(group.earliestDueDateISO)
                : "—",
              billOwnerName: group.owner.name,
            }}
          />
        </div>

        {/* Pay button */}
        {canPayGroup && (
          <Button
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onPayGroup?.(
                {
                  ownerUserId: group.ownerUserId,
                  ownerName: group.owner.name.replace(" (You)", ""),
                  ownerInitials: group.owner.initials,
                  ownerColor: group.owner.color,
                  amount: group.totalAmount,
                  dueDateISO:
                    group.earliestDueDateISO || new Date().toISOString(),
                  bills: group.bills,
                },
                e,
              );
            }}
            style={{
              backgroundColor: "#008a4b",
              color: "white",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              height: "48px", // Larger touch target
            }}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Pay {ownerFirstName} ${group.totalAmount.toFixed(2)}
          </Button>
        )}
      </div>

      {/* Expanded bills */}
      {isExpanded && (
        <div className="bg-gray-50">
          {group.bills.map((bill, billIdx) => {
            const canPay = bill.ownerUserId !== currentUserId;
            const showPay =
              (bill.myStatus === BillStatus.PENDING ||
                bill.myStatus === BillStatus.SCHEDULED ||
                bill.myStatus === BillStatus.FAILED) &&
              canPay &&
              !bill.myHasPaid;

            return (
              <div key={bill.id} className="p-4 border-t border-gray-200">
                {/* Bill header */}
                <div className="flex items-start gap-3 mb-3">
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
                          className="h-5 w-5"
                          style={{ color: iconColor }}
                          strokeWidth={2}
                        />
                      </div>
                    );
                  })()}

                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111827",
                        fontFamily: "Inter, sans-serif",
                        marginBottom: 2,
                      }}
                    >
                      {bill.biller}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#9CA3AF",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Due {bill.dueDate ? formatMonthDay(bill.dueDate) : "—"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      ${Number(bill.yourShare || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mb-3">
                  <StatusBadge
                    status={bill.myStatus}
                    contextData={{
                      dueDate: bill.dueDate
                        ? formatMonthDay(bill.dueDate)
                        : "—",
                      autopayDate:
                        bill.myAutopayEnabled && bill.dueDate
                          ? formatMonthDay(bill.dueDate)
                          : undefined,
                      isOverdue:
                        bill.myStatus === BillStatus.PENDING &&
                        !!bill.dueDate &&
                        isBillOverdue(bill.dueDate),
                      billOwnerName: group.owner.name,
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {showPay && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => onPayBill?.(bill, e)}
                      style={{
                        borderColor: "#008a4b",
                        color: "#008a4b",
                        backgroundColor: "white",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: "Inter, sans-serif",
                        height: 44, // Touch-friendly
                      }}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay This Bill
                    </Button>
                  )}

                  {/* Autopay toggle */}
                  <div
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                    style={{ minHeight: 48 }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#111827",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Autopay
                    </span>
                    <Switch
                      checked={!!bill.myAutopayEnabled}
                      onCheckedChange={() => onToggleAutopay?.(bill.id)}
                      className="data-[state=checked]:bg-[#008a4b]"
                    />
                  </div>

                  {/* Delete button */}
                  {!hideDelete && bill.ownerUserId === currentUserId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-red-600 hover:bg-red-50"
                      onClick={(e) => onDeleteBill?.(bill, e)}
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        height: 44,
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Bill
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
