import { useCallback } from "react";
import { toast } from "sonner";
import { BillStatus } from "@prisma/client";
import type { Bill } from "@/interfaces/bills";
import { determineMyStatus } from "@/components/bills/BillStatusConfig";

export function useAutopayToggle(params: {
  bills: Bill[];
  patchBill: (billId: string, patch: Partial<Bill>) => void;
}) {
  const { bills, patchBill } = params;

  const toggleAutopay = useCallback(
    async (billId: string) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) return;

      const previousAutopay = !!bill.myAutopayEnabled;
      const nextAutopay = !previousAutopay;
      const previousMyStatus = bill.myStatus;

      // optimistic status
      const optimisticMyStatus = determineMyStatus({
        myPart: {
          id: bill.myBillParticipantId!,
          autopayEnabled: nextAutopay,
        },
        hasSucceededAttempt: bill.myHasPaid,
        hasFailedAttempt: bill.myStatus === BillStatus.FAILED,
      });

      patchBill(billId, {
        myAutopayEnabled: nextAutopay,
        myStatus: optimisticMyStatus,
      });

      try {
        const res = await fetch(`/api/bills/${billId}/autopay`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: nextAutopay,
            paymentMethodId: bill.myPaymentMethodId ?? null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to update autopay");
        }

        const data = await res.json();
        const confirmedAutopay = !!data.autopayEnabled;

        const confirmedMyStatus = determineMyStatus({
          myPart: {
            id: bill.myBillParticipantId!,
            autopayEnabled: confirmedAutopay,
          },
          hasSucceededAttempt: bill.myHasPaid,
          hasFailedAttempt: bill.myStatus === BillStatus.FAILED,
        });

        patchBill(billId, {
          myAutopayEnabled: confirmedAutopay,
          myStatus: confirmedMyStatus,
        });

        toast.success(
          confirmedAutopay ? "Autopay enabled" : "Autopay disabled",
        );
      } catch (err) {
        console.error("Failed to update autopay", err);

        patchBill(billId, {
          myAutopayEnabled: previousAutopay,
          myStatus: previousMyStatus,
        });

        toast.error("Failed to update autopay");
      }
    },
    [bills, patchBill],
  );

  return { toggleAutopay };
}
