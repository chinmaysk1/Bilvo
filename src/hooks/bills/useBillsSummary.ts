import { useMemo } from "react";
import { BillStatus } from "@prisma/client";
import type { Bill } from "@/interfaces/bills";
import { formatMonthDay } from "@/utils/common/formatMonthYear";

type Options = {
  yourShare?: number; // for remainingBalance
};

function safeTime(value?: string | Date | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

export function useBillsSummary(bills: Bill[], opts: Options = {}) {
  const yourShare = Number(opts.yourShare ?? 0);

  const totalBillsCount = bills?.length || 0;

  const pendingBills = useMemo(
    () => (bills || []).filter((b) => b.myStatus !== BillStatus.PAID),
    [bills],
  );

  const unpaidBills = pendingBills.length;

  const totalDueThisMonth = useMemo(
    () => pendingBills.reduce((acc, b) => acc + Number(b.yourShare ?? 0), 0),
    [pendingBills],
  );

  const autopayCount = useMemo(
    () => (bills || []).filter((b) => !!b.myAutopayEnabled).length,
    [bills],
  );

  const nextDueBill = useMemo(() => {
    const copy = [...pendingBills];
    copy.sort((a, b) => safeTime(a.dueDate) - safeTime(b.dueDate));
    return copy[0] ?? null;
  }, [pendingBills]);

  // Paid counts & amounts (your perspective)
  const paidBillsCount = useMemo(
    () => (bills || []).filter((b) => b.myStatus === BillStatus.PAID).length,
    [bills],
  );

  const paidAmount = useMemo(() => {
    return (bills || [])
      .filter((b) => b.myStatus === BillStatus.PAID)
      .reduce((sum, b) => sum + Number(b.yourShare ?? 0), 0);
  }, [bills]);

  const remainingBalance = useMemo(() => {
    // remaining = yourShare - what you've already paid
    return Math.max(0, yourShare - paidAmount);
  }, [yourShare, paidAmount]);

  // Next autopay (your perspective)
  const nextAutoPayBill = useMemo(() => {
    return (
      [...(bills || [])]
        .filter((b) => b.myStatus === BillStatus.SCHEDULED)
        .sort((a, b) => {
          const dateA = safeTime(a.scheduledCharge ?? a.dueDate);
          const dateB = safeTime(b.scheduledCharge ?? b.dueDate);
          return dateA - dateB;
        })[0] ?? null
    );
  }, [bills]);

  const nextAutopayAmount = Number(nextAutoPayBill?.yourShare ?? 0);
  const nextAutopayDate = nextAutoPayBill?.dueDate
    ? formatMonthDay(nextAutoPayBill.dueDate)
    : "";
  const nextAutopayBiller = nextAutoPayBill?.biller ?? "";

  return {
    // counts
    totalBillsCount,
    unpaidBills,
    paidBillsCount,
    autopayCount,

    // due/paid amounts
    totalDueThisMonth,
    paidAmount,
    remainingBalance,

    // due/autopay details
    nextDueBill,
    nextAutoPayBill,
    nextAutopayAmount,
    nextAutopayDate,
    nextAutopayBiller,

    // raw lists if needed elsewhere
    pendingBills,
  };
}
