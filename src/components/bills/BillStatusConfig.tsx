import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { BillStatus } from "@prisma/client";

export type BillStatusType =
  | "SCHEDULED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELED"
  | "PROCESSING";

export interface StatusConfig {
  label: string;
  bg: string;
  color: string;
  icon: typeof Calendar;
  borderColor?: string;
  tooltip?: string;
}

export const getStatusConfig = (
  status: BillStatusType,
  contextData?: {
    dueDate?: string;
    autopayDate?: string;
    failureReason?: string;
    isOverdue?: boolean;
  }
): StatusConfig => {
  switch (status) {
    case BillStatus.SCHEDULED:
      return {
        label: "Scheduled",
        bg: "#E3F5FF",
        color: "#2D9CDB",
        icon: Calendar,
        tooltip: contextData?.autopayDate
          ? `Autopay scheduled for ${contextData.autopayDate}`
          : "Scheduled for autopay",
      };

    case "PROCESSING":
      return {
        label: "Processing",
        bg: "#FEF6E6",
        color: "#F2C94C",
        icon: Clock,
        tooltip:
          "Payment in progress — estimated clear date in 2–3 business days",
      };

    case BillStatus.PAID:
      return {
        label: "Paid",
        bg: "#E9F7EE",
        color: "#00B948",
        icon: CheckCircle2,
        tooltip: "Payment completed",
      };

    case BillStatus.PENDING:
      return {
        label: "Unpaid",
        bg: "#F3F4F6",
        color: "#9CA3AF",
        icon: AlertCircle,
        borderColor: contextData?.isOverdue ? "#EB5757" : undefined,
        tooltip: contextData?.isOverdue
          ? "Overdue - action required"
          : "Not yet paid",
      };

    case BillStatus.FAILED:
      return {
        label: "Failed",
        bg: "#FEE2E2",
        color: "#EB5757",
        icon: XCircle,
        tooltip: contextData?.failureReason || "Payment failed",
      };

    default:
      return {
        label: "Unknown",
        bg: "#F3F4F6",
        color: "#9CA3AF",
        icon: AlertCircle,
      };
  }
};

interface StatusBadgeProps {
  status: BillStatusType;
  contextData?: {
    dueDate?: string;
    autopayDate?: string;
    failureReason?: string;
    isOverdue?: boolean;
  };
  showTooltip?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  clickable?: boolean;
}

export function StatusBadge({
  status,
  contextData,
  showTooltip = true,
  size = "md",
  onClick,
  clickable = false,
}: StatusBadgeProps) {
  const config = getStatusConfig(status, contextData);
  const Icon = config.icon;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const fontSize = size === "sm" ? "11px" : "12px";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const height = size === "sm" ? "20px" : "22px";

  const isClickable = clickable || (status === BillStatus.PENDING && onClick);

  const tooltipText =
    isClickable && status === BillStatus.PENDING
      ? "This bill hasn't been paid yet. Click to make a payment."
      : config.tooltip;

  const badge = (
    <Badge
      variant="secondary"
      className={`rounded-full ${padding} gap-1.5 ${
        isClickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
      }`}
      style={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: fontSize,
        fontWeight: 500,
        fontFamily: "Inter, sans-serif",
        height: height,
        display: "inline-flex",
        alignItems: "center",
        border: config.borderColor
          ? `1.5px solid ${config.borderColor}`
          : "none",
      }}
      onClick={
        isClickable
          ? (e) => {
              e.stopPropagation();
              onClick?.();
            }
          : undefined
      }
    >
      {status === "PROCESSING" ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Icon className={iconSize} strokeWidth={2.5} />
        </motion.div>
      ) : (
        <Icon className={iconSize} strokeWidth={2.5} />
      )}
      {config.label}
    </Badge>
  );

  if (showTooltip && tooltipText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{badge}</span>
          </TooltipTrigger>
          <TooltipContent
            className="bg-gray-900 text-white text-xs px-2 py-1.5 rounded-md max-w-[220px]"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
            }}
          >
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

export function determineBillStatus(bill: {
  isPaid?: boolean;
  isProcessing?: boolean;
  autopayEnabled?: boolean;
  hasFailed?: boolean;
  dueDate?: string;
}): BillStatusType {
  if (bill.hasFailed) return BillStatus.FAILED;
  if (bill.isPaid) return BillStatus.PAID;
  if (bill.isProcessing) return "PROCESSING";
  if (bill.autopayEnabled) return BillStatus.SCHEDULED;
  return BillStatus.PENDING;
}

export function isBillOverdue(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  return due < today;
}
