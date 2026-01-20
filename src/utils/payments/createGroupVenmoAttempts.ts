// utils/payments/createGroupVenmoAttempts.ts

type BillLike = { id: string; yourShare?: number; dueDate?: string };

export type GroupAttemptResult = {
  ok: boolean;
  index: number;
  billId?: string;
  status?: number;
  body?: any;
  error?: any;
};

export type GroupAttemptResponse = {
  successes: GroupAttemptResult[]; // ok === true
  failures: GroupAttemptResult[]; // ok === false
};

export type CreateGroupVenmoAttemptsOptions = {
  bills: BillLike[];
  onProgress?: (index: number, ok: boolean, payload?: any) => void;
  signal?: AbortSignal | null;
};

export async function createGroupVenmoAttempts({
  bills,
  onProgress,
  signal,
}: CreateGroupVenmoAttemptsOptions): Promise<GroupAttemptResponse> {
  // We send one POST per bill to POST /api/payments/payment-attempts
  // The server will:
  //  - validate household membership
  //  - prevent owners from paying their own bills
  //  - reuse existing PROCESSING attempt (idempotent-ish)
  //
  // Return: { successes: Array, failures: Array }

  const promises = bills.map(async (bill, i) => {
    try {
      const res = await fetch("/api/payments/payment-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: bill.id, provider: "venmo" }),
        signal: signal ?? undefined,
      });

      const json = await (async () => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        // server returned non-2xx
        const err = json?.error || `HTTP ${res.status}`;
        onProgress?.(i, false, err);
        return {
          ok: false,
          index: i,
          billId: bill.id,
          error: err,
          status: res.status,
          body: json,
        } as GroupAttemptResult;
      }

      // OK: server either created (201) or reused (200)
      onProgress?.(i, true, json);
      return {
        ok: true,
        index: i,
        billId: bill.id,
        body: json,
      } as GroupAttemptResult;
    } catch (err: any) {
      // network/abort
      const message = err?.message || String(err);
      onProgress?.(i, false, message);
      return {
        ok: false,
        index: i,
        billId: bill.id,
        error: message,
      } as GroupAttemptResult;
    }
  });

  const settled = await Promise.allSettled(promises);
  const successes: GroupAttemptResult[] = [];
  const failures: GroupAttemptResult[] = [];

  for (const r of settled) {
    if (r.status === "fulfilled") {
      if (r.value.ok) successes.push(r.value);
      else failures.push(r.value);
    } else {
      // promise rejected (should be rare since we catch above)
      failures.push({
        ok: false,
        index: -1,
        error: r.reason,
      });
    }
  }

  return { successes, failures };
}
