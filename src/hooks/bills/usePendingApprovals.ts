import { useCallback, useMemo } from "react";
import type { Bill } from "@/interfaces/bills";
import type { PendingPayment } from "@/components/bills/PaymentConfirmationBanner";
import { formatMonthDay } from "@/utils/common/formatMonthYear";

function initialsFor(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

export function usePendingApprovals(params: {
  bills: Bill[];
  currentUserId: string;
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
}) {
  const { bills, currentUserId, setBills } = params;

  const pendingApprovals = useMemo<PendingPayment[]>(() => {
    const list: PendingPayment[] = [];

    for (const b of bills as any[]) {
      if (b.ownerUserId !== currentUserId) continue;

      const approvals = (b.pendingVenmoApprovals || []) as any[];
      for (const a of approvals) {
        const payerName = a.payerName || "Unknown";
        list.push({
          id: a.id,
          billName: a.billName || b.biller,
          amount: Number(a.amount || 0),
          payerName,
          payerInitials: initialsFor(payerName),
          paymentMethod: a.paymentMethod, // "venmo" | "zelle"
          dueDate: a.dueDate,
          submittedDate: formatMonthDay(a.submittedDate),
        });
      }
    }
    return list;
  }, [bills, currentUserId]);

  const approve = useCallback(
    async (paymentId: string) => {
      const res = await fetch(`/api/payments/payment-attempts/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed to approve");

      // remove approval in-place
      setBills((prev: any[]) =>
        prev.map((bill: any) => {
          if (!bill.pendingVenmoApprovals?.some((a: any) => a.id === paymentId))
            return bill;
          return {
            ...bill,
            pendingVenmoApprovals: bill.pendingVenmoApprovals.filter(
              (a: any) => a.id !== paymentId,
            ),
          };
        }),
      );
    },
    [setBills],
  );

  const reject = useCallback(
    async (paymentId: string) => {
      const res = await fetch(`/api/payments/payment-attempts/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) throw new Error("Failed to deny");

      setBills((prev: any[]) =>
        prev.map((bill: any) => {
          if (!bill.pendingVenmoApprovals?.some((a: any) => a.id === paymentId))
            return bill;
          return {
            ...bill,
            pendingVenmoApprovals: bill.pendingVenmoApprovals.filter(
              (a: any) => a.id !== paymentId,
            ),
          };
        }),
      );
    },
    [setBills],
  );

  return { pendingApprovals, approve, reject };
}
