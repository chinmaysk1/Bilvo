// replace your useBills with this minimal change version
import { useCallback, useEffect, useRef, useState } from "react";

export type Bill = {
  id: string;
  source: string;
  biller: string;
  billerType: string;
  amount: number;
  yourShare: number;
  dueDate: string;
  scheduledCharge: string | null;
  status: string;
};

export function useBills({ autoLoad = false }: { autoLoad?: boolean } = {}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/bills", { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to fetch bills");
      const data = await res.json();
      setBills(data.bills ?? []);
      return data.bills ?? [];
    } catch (err: any) {
      // Ignore aborts; only surface real errors
      if (err?.name !== "AbortError") {
        console.error("Error fetching bills:", err);
        setError(err);
      }
      // DO NOT rethrow — prevents runtime AbortError
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void fetchBills();
    return () => {
      // abort safely and clear ref
      try {
        abortRef.current?.abort();
      } finally {
        abortRef.current = null;
      }
    };
  }, [autoLoad, fetchBills]);

  const deleteBill = async (billId: string, { refresh = true } = {}) => {
    setLoadingId(billId);
    try {
      const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete bill");
      if (refresh) await fetchBills();
      return true;
    } finally {
      setLoadingId(null);
    }
  };

  const markBillAsPaid = async (billId: string, { refresh = true } = {}) => {
    setLoadingId(billId);
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid" }),
      });
      if (!res.ok) throw new Error("Failed to update bill");
      if (refresh) await fetchBills();
      return true;
    } finally {
      setLoadingId(null);
    }
  };

  return {
    bills,
    isLoading,
    error,
    fetchBills,
    setBills,
    deleteBill,
    markBillAsPaid,
    loadingId,
  };
}
