// hooks/useAutopay.ts
import { useState } from "react";

type Init = {
  enabled: boolean;
  paymentMethodId?: string | null;
};

export function useAutopay(billId: string, initial: Init) {
  const [isEnabled, setIsEnabled] = useState<boolean>(!!initial?.enabled);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    initial?.paymentMethodId ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const toggleAutopay = async ({
    hasPaymentMethod,
    nextPaymentMethodId,
  }: {
    hasPaymentMethod: boolean;
    nextPaymentMethodId?: string | null;
  }) => {
    if (!billId) {
      throw new Error("billId is required for useAutopay");
    }
    if (!hasPaymentMethod && !isEnabled) {
      alert("Please add a payment method first");
      return;
    }

    const newEnabled = !isEnabled;
    const pmIdToUse =
      typeof nextPaymentMethodId !== "undefined"
        ? nextPaymentMethodId
        : paymentMethodId;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/bills/${billId}/autopay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: newEnabled,
          paymentMethodId: pmIdToUse ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update autopay");
      const data = await res.json();
      setIsEnabled(!!data.autopayEnabled);
      setPaymentMethodId(data.paymentMethodId ?? null);
      return data;
    } catch (err) {
      console.error("Error toggling autopay:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const setAutopay = async (
    enabled: boolean,
    nextPaymentMethodId?: string | null
  ) => {
    return toggleAutopay({
      hasPaymentMethod: !!(paymentMethodId || nextPaymentMethodId),
      nextPaymentMethodId,
    });
  };

  return {
    isEnabled,
    isLoading,
    paymentMethodId,
    setPaymentMethodId,
    toggleAutopay,
    setAutopay,
  };
}
