import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Upload,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Recycle,
  Info,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useAutopay } from "@/hooks/useAutopay";
import ScanGmailUploadButton from "@/components/bills/ScanGmailUploadButton";
import { Bill } from "@/interfaces/bills";
import { Household } from "@/interfaces/household";
import { StatusBadge } from "../bills/BillStatusConfig";
import { BillStatus } from "@prisma/client";
import { getBillerIcon } from "@/utils/bills/getBillerIcon";

interface ActiveBillsTableProps {
  bills: Bill[];
  hasPaymentMethod: boolean;
  household: Household;
  onBillsImported: (bills: Bill[]) => void;
}

// Roommate data for split visualization
const avatarColors = ["#F2C94C", "#008a4b", "#BB6BD9", "#3B82F6", "#EF4444"];

function AutopayToggleCell({
  billId,
  hasPaymentMethod,
  initialEnabled = false,
}: {
  billId: string;
  hasPaymentMethod: boolean;
  initialEnabled?: boolean;
}) {
  const { isEnabled, isLoading, toggleAutopay } = useAutopay(billId, {
    enabled: initialEnabled,
  });

  const onToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleAutopay({ hasPaymentMethod });
  };

  return (
    <div className="flex items-center justify-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div onClick={onToggle}>
              <Switch
                checked={isEnabled}
                disabled={isLoading}
                onCheckedChange={() => {}}
                className="data-[state=checked]:bg-[#008a4b]"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">
              {isEnabled
                ? "Autopay enabled — your share will be charged automatically."
                : hasPaymentMethod
                  ? "Enable autopay to charge your share automatically."
                  : "Add a payment method to enable autopay."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function ActiveBillsTable({
  bills,
  hasPaymentMethod,
  household,
  onBillsImported,
}: ActiveBillsTableProps) {
  const totalHousehold = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalYourShare = bills.reduce((sum, bill) => sum + bill.yourShare, 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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
      {/* Inner border */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ border: "1px solid #F3F4F6" }}
      />

      {/* Gray Header Bar */}
      <div
        className="px-6 flex items-center justify-between mt-5"
        style={{ backgroundColor: "#F9FAFB", height: "40px" }}
      >
        <div className="flex items-center gap-2">
          <h2
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#111827",
              lineHeight: 1.5,
              fontFamily: "Inter, sans-serif",
            }}
          >
            This Month's Bills
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
                  All bills are split equally among roommates. Click any bill to
                  see full details.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ScanGmailUploadButton
          householdMemberCount={household.members.length || 1}
          onBillsImported={onBillsImported}
          className="rounded-xl transition-all flex-shrink-0"
          style={{
            fontWeight: 500,
            fontSize: "13px",
            backgroundColor: "#008a4b",
            color: "#FFFFFF",
            border: "none",
            height: "32px",
            paddingLeft: "12px",
            paddingRight: "12px",
          }}
        />
      </div>

      {/* Table */}
      <div className="mt-3 [&>div.relative.w-full.overflow-auto]:overflow-visible">
        <Table>
          <TableHeader>
            <TableRow
              className="border-b"
              style={{ borderColor: "#E5E7EB", height: "32px" }}
            >
              <TableHead
                className="pl-6"
                style={{
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.05em",
                  fontFamily: "Inter, sans-serif",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                }}
              >
                Biller
              </TableHead>
              <TableHead
                style={{
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.05em",
                  fontFamily: "Inter, sans-serif",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                }}
              >
                Your Share
              </TableHead>
              <TableHead
                style={{
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.05em",
                  fontFamily: "Inter, sans-serif",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                }}
              >
                Due Date
              </TableHead>
              <TableHead
                style={{
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.05em",
                  fontFamily: "Inter, sans-serif",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                }}
              >
                Status
              </TableHead>
              <TableHead
                className="pr-6"
                style={{
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  fontSize: "11px",
                  letterSpacing: "0.05em",
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                }}
              >
                Autopay
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill, index) => {
              const {
                icon: Icon,
                iconBg: bgColor,
                iconColor,
              } = getBillerIcon(bill.biller);
              const isLast = index === bills.length - 1;
              const isEven = index % 2 === 0;

              const roommatesWithShare = household.members.map(
                (member, memberIndex) => {
                  const initials = member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  // match member with BillParticipant
                  const participant = bill.participants?.find(
                    (p) => p.userId === member.id,
                  );

                  return {
                    id: member.id,
                    name: member.name,
                    initials,
                    color: avatarColors[memberIndex % avatarColors.length],
                    share:
                      participant?.shareAmount ??
                      bill.amount / (household.members.length || 1),
                  };
                },
              );

              return (
                <TableRow
                  key={bill.id}
                  className="group transition-all duration-200 cursor-pointer border-b"
                  style={{
                    borderColor: isLast ? "transparent" : "#E5E7EB",
                    height: "44px",
                    backgroundColor: isEven ? "transparent" : "#FAFBFC",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isEven
                      ? "transparent"
                      : "#FAFBFC";
                  }}
                >
                  {/* Biller */}
                  <TableCell
                    className="pl-6"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          width: "32px",
                          height: "32px",
                          backgroundColor: bgColor,
                        }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: iconColor }}
                          strokeWidth={2}
                        />
                      </div>

                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "#111827",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {bill.biller}
                      </span>
                    </div>
                  </TableCell>
                  {/* Your Share with Split Breakdown */}
                  <TableCell
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#111827",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        ${bill.yourShare.toFixed(2)}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-1 cursor-help transition-transform hover:scale-110">
                              {roommatesWithShare.map((roommate) => (
                                <Avatar
                                  key={roommate.id}
                                  className="max-h-7 max-w-7 border-2 border-white transition-all"
                                >
                                  <AvatarFallback
                                    style={{
                                      backgroundColor: roommate.color,
                                      color: "white",
                                      fontSize: "9px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {roommate.initials}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-2 min-w-[200px]">
                              <p className="font-medium mb-2 text-white">
                                Split Breakdown
                              </p>
                              <div className="text-xs space-y-1.5">
                                {roommatesWithShare.map((roommate) => (
                                  <div
                                    key={roommate.id}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-4 w-4">
                                        <AvatarFallback
                                          style={{
                                            backgroundColor: roommate.color,
                                            color: "white",
                                            fontSize: "8px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {roommate.initials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>{roommate.name}</span>
                                    </div>
                                    <span className="font-medium">
                                      ${bill.yourShare.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                                <span>Total</span>
                                <span>${bill.amount.toFixed(2)}</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  {/* Due Date */}
                  <TableCell
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#6B7280",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {new Date(bill.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </TableCell>
                  {/* Status */}
                  <TableCell
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <StatusBadge
                      status={bill.myStatus as BillStatus}
                      contextData={{
                        dueDate: formatDate(bill.dueDate),
                      }}
                    />
                  </TableCell>
                  {/* Autopay Toggle */}
                  <TableCell
                    className="pr-6"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <AutopayToggleCell
                      billId={bill.id}
                      hasPaymentMethod={hasPaymentMethod}
                      initialEnabled={bill.myAutopayEnabled} // set true if you hydrate from API later
                    />
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Totals Row */}
            <TableRow
              className="border-t-2"
              style={{
                borderColor: "#E5E7EB",
                height: "46px",
                backgroundColor: "#F9FAFB",
              }}
            >
              <TableCell
                className="pl-6"
                style={{ paddingTop: "12px", paddingBottom: "12px" }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Total
                </span>
              </TableCell>
              <TableCell style={{ paddingTop: "12px", paddingBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ${totalYourShare.toFixed(2)}
                </span>
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
