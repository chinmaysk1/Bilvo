import { useCallback, useState } from "react";
import type { Bill } from "@/interfaces/bills";

export function useBillsStore(initialBills: Bill[]) {
  const [bills, setBills] = useState<Bill[]>(initialBills);

  const patchBill = useCallback((billId: string, patch: Partial<Bill>) => {
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? ({ ...b, ...patch } as Bill) : b)),
    );
  }, []);

  const removeBill = useCallback((billId: string) => {
    setBills((prev) => prev.filter((b) => b.id !== billId));
  }, []);

  const upsertBills = useCallback((incoming: Bill[]) => {
    if (!incoming?.length) return;
    setBills((prev) => [...prev, ...incoming]);
  }, []);

  return { bills, setBills, patchBill, removeBill, upsertBills };
}
