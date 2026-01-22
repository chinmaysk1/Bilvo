import {
  ArrowRight,
  Info,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Bill } from "@/interfaces/bills";
import { BillStatus } from "@prisma/client";
import { formatMonthDay } from "@/utils/common/formatMonthYear";
import { useBillsSummary } from "@/hooks/bills/useBillsSummary";

interface BilvoSummaryCardsProps {
  household: {
    id: string;
    name: string;
    address: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
    }>;
  };
  bills: Bill[];
  totalHousehold: number;
  yourShare: number;
}

// Count-up animation hook
const useCountUp = (end: number, duration: number = 600, delay: number = 0) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(end * easeOutQuart);

        if (progress === 1) {
          clearInterval(timer);
          setCount(end);
        }
      }, 16);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [end, duration, delay]);

  return count;
};

// Generate initials from name
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// Color palette for avatars
const avatarColors = ["#F2C94C", "#008a4b", "#BB6BD9", "#3B82F6", "#EF4444"];

export default function BilvoSummaryCards({
  household,
  bills,
  totalHousehold,
  yourShare,
}: BilvoSummaryCardsProps) {
  const router = useRouter();

  const {
    totalBillsCount,
    paidBillsCount,
    remainingBalance,
    nextAutoPayBill,
    nextAutopayAmount,
    nextAutopayDate,
    nextAutopayBiller,
  } = useBillsSummary(bills, { yourShare });

  // Count-up animations
  const householdCount = useCountUp(Number(totalHousehold || 0), 600, 0);
  const autopayCount = useCountUp(nextAutopayAmount, 600, 100);
  const yourShareCount = useCountUp(Number(yourShare || 0), 600, 200);

  const memberCount = household.members.length;

  // Shared card styles
  const cardBaseClass =
    "rounded-xl border flex flex-col cursor-pointer transition-all duration-300 group bg-white relative w-full z-0 hover:z-20";
  const cardStyle = {
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    padding: "16px",
    borderColor: "#E5E7EB",
  };

  return (
    // CHANGED: Single column on mobile (grid-cols-1), 3 columns on md and up
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {/* Household Total Card */}
      <div
        className={cardBaseClass}
        style={{ ...cardStyle, minHeight: "160px" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
          e.currentTarget.style.borderColor = "#D1D5DB";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
          e.currentTarget.style.borderColor = "#E5E7EB";
        }}
        onClick={() => router.push("/protected/dashboard/household")}
      >
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ border: "1px solid #F3F4F6" }}
        />

        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "8px" }}
        >
          <h3
            style={{
              fontSize: "14px", // CHANGED: from 13px for better mobile readability
              fontWeight: 600,
              color: "#6B7280",
              lineHeight: "1.4",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            Household Total
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info
                  className="h-4 w-4 cursor-help" // CHANGED: from 3.5 to 4 for better touch target
                  style={{ color: "#9CA3AF" }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Total amount for all household bills this month before
                  splitting.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          className="flex-1 flex flex-col justify-center"
          style={{ minHeight: 0, marginBottom: "8px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "32px", // CHANGED: from 30px for better mobile visibility
                fontWeight: 700,
                color: "#111827",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              ${householdCount.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {household.members.slice(0, 3).map((member, index) => (
                <Avatar
                  key={member.id}
                  className="h-6 w-6 border-2 border-white" // CHANGED: from h-5 w-5 for better mobile visibility
                >
                  <AvatarFallback
                    style={{
                      backgroundColor:
                        avatarColors[index % avatarColors.length],
                      color: "white",
                      fontSize: "10px", // CHANGED: from 9px
                      fontWeight: 600,
                    }}
                  >
                    {getInitials(member.name || member.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span
              style={{
                fontSize: "13px", // CHANGED: from 12px
                fontWeight: 500,
                color: "#6B7280",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {totalBillsCount} bills • {memberCount} roommates
            </span>
          </div>
        </div>

        <div
          className="flex items-center justify-between mt-auto pt-2.5 group-hover:gap-2 transition-all"
          style={{ borderTop: "1px solid #F3F4F6", minHeight: "44px" }} // CHANGED: Added min height for touch target
        >
          <span
            style={{
              fontSize: "13px", // CHANGED: from 12px
              fontWeight: 500,
              color: "#008a4b",
              fontFamily: "Inter, sans-serif",
            }}
          >
            View Household
          </span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1" // CHANGED: from 3.5
            style={{ color: "#008a4b" }}
          />
        </div>
      </div>

      {/* Next Autopay Card */}
      <div
        className={cardBaseClass}
        style={{ ...cardStyle, minHeight: "160px" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
          e.currentTarget.style.borderColor = "#D1D5DB";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
          e.currentTarget.style.borderColor = "#E5E7EB";
        }}
        onClick={() => router.push("/protected/dashboard/payments")}
      >
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ border: "1px solid #F3F4F6" }}
        />

        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "8px" }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#6B7280",
              lineHeight: "1.4",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            Next Autopay
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info
                  className="h-4 w-4 cursor-help"
                  style={{ color: "#9CA3AF" }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Next bill that will be automatically paid. Enable autopay on
                  bills to see them here.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          className="flex-1 flex flex-col justify-center"
          style={{ minHeight: 0, marginBottom: "8px" }}
        >
          {nextAutoPayBill ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "32px",
                    fontWeight: 700,
                    color: "#111827",
                    lineHeight: "1.2",
                    letterSpacing: "-0.02em",
                    fontFamily: "Inter, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  ${autopayCount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" style={{ color: "#1E40AF" }} />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#6B7280",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {nextAutopayBiller} on {nextAutopayDate}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center py-3">
              <DollarSign
                className="h-8 w-8 mx-auto mb-2" // CHANGED: from h-7 w-7
                style={{ color: "#D1D5DB" }}
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#9CA3AF",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                No autopay scheduled
              </p>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between mt-auto pt-2.5 group-hover:gap-2 transition-all"
          style={{ borderTop: "1px solid #F3F4F6", minHeight: "44px" }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#008a4b",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Payment Settings
          </span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            style={{ color: "#008a4b" }}
          />
        </div>
      </div>

      {/* Your Share Card */}
      <div
        className={cardBaseClass}
        style={{ ...cardStyle, minHeight: "160px" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
          e.currentTarget.style.borderColor = "#D1D5DB";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
          e.currentTarget.style.borderColor = "#E5E7EB";
        }}
        onClick={() => router.push("/protected/dashboard/bills")}
      >
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ border: "1px solid #F3F4F6" }}
        />

        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "8px" }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#6B7280",
              lineHeight: "1.4",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            Your Share
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info
                  className="h-4 w-4 cursor-help"
                  style={{ color: "#9CA3AF" }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Your total portion of all household bills this month.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          className="flex-1 flex flex-col justify-center"
          style={{ minHeight: 0, marginBottom: "8px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              ${yourShareCount.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {" "}
            {/* CHANGED: Added flex-wrap */}
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" style={{ color: "#059669" }} />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#6B7280",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {paidBillsCount} paid
              </span>
            </div>
            {remainingBalance > 0 && (
              <>
                <span style={{ color: "#D1D5DB", fontSize: "12px" }}>•</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#DC2626",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ${remainingBalance.toFixed(2)} remaining
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between mt-auto pt-2.5 group-hover:gap-2 transition-all"
          style={{ borderTop: "1px solid #F3F4F6", minHeight: "44px" }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#008a4b",
              fontFamily: "Inter, sans-serif",
            }}
          >
            View Details
          </span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            style={{ color: "#008a4b" }}
          />
        </div>
      </div>
    </div>
  );
}
