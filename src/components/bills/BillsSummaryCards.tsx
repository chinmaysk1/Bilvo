import { Card } from "../ui/card";
import { DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface BillsSummaryCardsProps {
  totalDue: number;
  nextDueBill?: {
    dueDate: string;
    biller: string;
  };
  autopayCount: number;
  totalBills: number;
  overdueBills: number;
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

export function BillsSummaryCards({
  totalDue,
  nextDueBill,
  autopayCount,
  totalBills,
  overdueBills,
}: BillsSummaryCardsProps) {
  const totalDueCount = useCountUp(totalDue, 600, 0);
  const autopayCountAnim = useCountUp(autopayCount, 600, 100);
  const overdueCountAnim = useCountUp(overdueBills, 600, 200);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
      {/* Total Due Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full"
      >
        <Card
          className="rounded-xl border flex flex-col transition-all duration-200 bg-white relative overflow-hidden w-full"
          style={{
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            padding: "20px",
            height: "200px",
            borderColor: "#E5E7EB",
            minWidth: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
            e.currentTarget.style.borderColor = "#D1D5DB";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
            e.currentTarget.style.borderColor = "#E5E7EB";
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <DollarSign
              className="h-[16px] w-[16px]"
              style={{ color: "#047857", opacity: 0.9 }}
              strokeWidth={2}
            />
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#6B7280",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Total Due
            </h3>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                marginBottom: "6px",
              }}
            >
              ${totalDueCount.toFixed(2)}
            </div>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#9CA3AF",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Across all bills
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Next Due Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="w-full"
      >
        <Card
          className="rounded-xl border flex flex-col transition-all duration-200 bg-white relative overflow-hidden w-full"
          style={{
            boxShadow: "0 1px 3px rgba(16, 24, 40, 0.08)",
            padding: "20px",
            height: "200px",
            borderColor: "#EFF6FF",
            minWidth: 0,
            background: "linear-gradient(to bottom, #FFFFFF 0%, #F9FAFB 100%)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 8px rgba(16, 24, 40, 0.12)";
            e.currentTarget.style.borderColor = "#BFDBFE";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 1px 3px rgba(16, 24, 40, 0.08)";
            e.currentTarget.style.borderColor = "#EFF6FF";
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock
              className="h-[16px] w-[16px]"
              style={{ color: "#2563EB", opacity: 0.9 }}
              strokeWidth={2}
            />
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#6B7280",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Next Due
            </h3>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                marginBottom: "6px",
              }}
            >
              {nextDueBill ? nextDueBill.dueDate : "—"}
            </div>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#9CA3AF",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {nextDueBill ? nextDueBill.biller : "No bills upcoming"}
            </p>
          </div>
        </Card>
      </motion.div>

      {/* On Autopay Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="w-full"
      >
        <Card
          className="rounded-xl border flex flex-col transition-all duration-200 bg-white relative overflow-hidden w-full"
          style={{
            boxShadow: "0 1px 3px rgba(16, 24, 40, 0.08)",
            padding: "20px",
            height: "200px",
            borderColor: "#E5E7EB",
            minWidth: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 8px rgba(16, 24, 40, 0.12)";
            e.currentTarget.style.borderColor = "#D1D5DB";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 1px 3px rgba(16, 24, 40, 0.08)";
            e.currentTarget.style.borderColor = "#E5E7EB";
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle
              className="h-[16px] w-[16px]"
              style={{ color: "#7C3AED", opacity: 0.9 }}
              strokeWidth={2}
            />
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#6B7280",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              On Autopay
            </h3>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                marginBottom: "6px",
              }}
            >
              {Math.round(autopayCountAnim)}
            </div>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#9CA3AF",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              of {totalBills} bills
            </p>
          </div>
        </Card>
      </motion.div>

      {/* All Caught Up / Bills Due Soon Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        className="w-full"
      >
        <Card
          className="rounded-xl border flex flex-col transition-all duration-200 bg-white relative overflow-hidden w-full"
          style={{
            boxShadow: "0 1px 3px rgba(16, 24, 40, 0.08)",
            padding: "20px",
            height: "200px",
            borderColor: overdueBills > 0 ? "#FCD34D" : "#E5E7EB",
            minWidth: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 8px rgba(16, 24, 40, 0.12)";
            e.currentTarget.style.borderColor =
              overdueBills > 0 ? "#FBBF24" : "#D1D5DB";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 1px 3px rgba(16, 24, 40, 0.08)";
            e.currentTarget.style.borderColor =
              overdueBills > 0 ? "#FCD34D" : "#E5E7EB";
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            {overdueBills > 0 ? (
              <AlertCircle
                className="h-[16px] w-[16px]"
                style={{ color: "#D97706", opacity: 0.9 }}
                strokeWidth={2}
              />
            ) : (
              <CheckCircle
                className="h-[16px] w-[16px]"
                style={{ color: "#6B7280", opacity: 0.9 }}
                strokeWidth={2}
              />
            )}
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#6B7280",
                lineHeight: "1.4",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {overdueBills > 0 ? "Bills Due Soon" : "All Caught Up"}
            </h3>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                marginBottom: "6px",
              }}
            >
              {Math.round(overdueCountAnim)}
            </div>
            <div className="flex items-center gap-2">
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#9CA3AF",
                  lineHeight: "1.4",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {overdueBills > 0 ? "Requires attention" : "All caught up"}
              </p>
              {overdueBills > 0 && (
                <Badge
                  className="rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    fontSize: "10px",
                    fontWeight: 500,
                    border: "none",
                  }}
                >
                  Alert
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
