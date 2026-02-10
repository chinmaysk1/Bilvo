import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { useStripe } from "@stripe/react-stripe-js";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  CreditCard,
  Building2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentMethod } from "@/interfaces/payments";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data as T;
}

type PaymentType = "card" | "bank"; // for now: only card supported fully

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  billParticipantId: string | null;
  groupBillParticipantIds?: string[];

  biller: string;
  amountDisplay: string;
  recipientName?: string;

  billIcon?: React.ComponentType<any>;
  billIconBg?: string;
  billIconColor?: string;
  dueDateDisplay?: string;
  category?: string;

  paymentType: PaymentType;
  onSucceeded?: () => void;
};

export function PayWithStripeModal(props: Props) {
  const {
    open,
    onOpenChange,
    billParticipantId,
    groupBillParticipantIds,
    biller,
    amountDisplay,
    recipientName,
    billIcon: BillIcon,
    billIconBg,
    billIconColor,
    dueDateDisplay,
    category,
    paymentType,
    onSucceeded,
  } = props;

  const [step, setStep] = useState<"details" | "method">("details");
  const [amount, setAmount] = useState(amountDisplay);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedProviderPmId, setSelectedProviderPmId] = useState<
    string | null
  >(null);

  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("details");
    setAmount(amountDisplay);
    setMethods([]);
    setSelectedProviderPmId(null);
    setIsConfirming(false);
  }, [open, amountDisplay]);

  const close = () => {
    onOpenChange(false);
    setStep("details");
    setIsLoadingMethods(false);
    setMethods([]);
    setSelectedProviderPmId(null);
    setIsConfirming(false);
  };

  const filteredMethods = useMemo(() => {
    // only show ACTIVE and matching type
    const active = methods.filter((m) => (m.status ?? "ACTIVE") === "ACTIVE");
    const byType = active.filter((m) => m.type === paymentType);
    // order: default/priority first if you have it
    return byType.sort(
      (a, b) => (a.priorityOrder ?? 999) - (b.priorityOrder ?? 999),
    );
  }, [methods, paymentType]);

  const loadMethods = async () => {
    setIsLoadingMethods(true);
    try {
      const data = await fetchJson<{ paymentMethods: PaymentMethod[] }>(
        "/api/payments/payment-methods",
        { method: "GET" },
      );
      setMethods(data.paymentMethods || []);

      // auto-select first
      const first = (data.paymentMethods || [])
        .filter((m) => (m.status ?? "ACTIVE") === "ACTIVE")
        .filter((m) => m.type === paymentType)
        .sort((a, b) => (a.priorityOrder ?? 999) - (b.priorityOrder ?? 999))[0];

      if (first?.providerPaymentMethodId) {
        setSelectedProviderPmId(first.providerPaymentMethodId);
      }
    } catch (e: any) {
      toast.error("Could not load payment methods", {
        description: e?.message ?? "Try again.",
      });
    } finally {
      setIsLoadingMethods(false);
    }
  };

  const isGroup = (groupBillParticipantIds?.length ?? 0) > 0;
  const canPay = isGroup
    ? groupBillParticipantIds!.length > 0
    : !!billParticipantId;

  const continueToMethods = async () => {
    if (!canPay) {
      toast.error(
        isGroup
          ? "Missing group bill participants"
          : "Missing billParticipantId",
      );
      return;
    }

    // bank support is a bigger project; keep UX but block for now if needed
    if (paymentType === "bank") {
      toast.info("Bank payments coming soon", {
        description: "For now, please add a card in /payments and pay by card.",
      });
      return;
    }

    setStep("method");
    // load once when entering
    await loadMethods();
  };

  const confirmCardPayment = async () => {
    if (!selectedProviderPmId) {
      toast.error("Select a payment method first");
      return;
    }

    setIsConfirming(true);

    const isGroup = (groupBillParticipantIds?.length ?? 0) > 0;

    const ids = isGroup ? groupBillParticipantIds! : [billParticipantId!];

    const endpoint = isGroup
      ? "/api/payments/pay-now-group"
      : "/api/payments/pay-now";

    const payload = isGroup
      ? { billParticipantIds: ids }
      : { billParticipantId: ids[0] };

    try {
      // 1) Create PaymentIntent + attempt RIGHT NOW
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        toast.error("Owner can't receive card payments yet", {
          description: body?.error ?? "Ask them to finish Stripe onboarding.",
        });
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to start payment");
      }

      const start = body as
        | { clientSecret: string; paymentAttemptId: string }
        | { clientSecret: string; groupKey: string };

      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe failed to initialize");

      // 2) Confirm using the saved Stripe payment method (no PaymentElement)
      const result = await stripe.confirmCardPayment(start.clientSecret, {
        payment_method: selectedProviderPmId,
      });

      if (result.error) {
        throw new Error(result.error.message || "Payment failed");
      }

      toast.success("Payment submitted", {
        description: "Waiting for confirmation…",
      });

      // 3) Optionally: you can keep your existing polling here using paymentAttemptId
      // For now, simplest: close + let bills refresh/poll elsewhere
      onSucceeded?.();
      close();
    } catch (e: any) {
      toast.error("Payment failed", {
        description: e?.message ?? "Try again.",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-[520px] rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 20, fontWeight: 700 }}>
            Pay ${amount} for {biller}
          </DialogTitle>
          <DialogDescription>
            {recipientName
              ? `Recipient: ${recipientName}`
              : "Secure payment via Stripe"}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: looks like old PayBillModal */}
        {step === "details" && (
          <div className="space-y-6 py-4">
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                backgroundColor: "#F9FAFB",
                border: "1px solid #E5E7EB",
              }}
            >
              {BillIcon && (
                <div
                  className="rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: billIconBg || "#F3F4F6",
                  }}
                >
                  <BillIcon
                    className="h-5 w-5"
                    style={{ color: billIconColor || "#6B7280" }}
                    strokeWidth={2}
                  />
                </div>
              )}
              <div className="flex-1">
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#111827",
                    marginBottom: 2,
                  }}
                >
                  {biller}
                </div>
                <div style={{ fontSize: 14, color: "#6B7280" }}>
                  {category ? `${category} · ` : ""}
                  {dueDateDisplay ? `Due ${dueDateDisplay}` : ""}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="amount"
                style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
              >
                Your Share
              </Label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ fontSize: 20, fontWeight: 600, color: "#6B7280" }}
                >
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-left"
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    height: "56px",
                    borderColor: "#E5E7EB",
                    borderRadius: "12px",
                  }}
                  disabled={true}
                />
              </div>
              <p style={{ fontSize: 13, color: "#6B7280" }}>
                Review your amount, then continue.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={continueToMethods}
                className="w-full h-12"
                style={{
                  backgroundColor: "#008a4b",
                  borderRadius: 12,
                  fontWeight: 600,
                }}
              >
                Continue
              </Button>
              <Button variant="outline" onClick={close} className="w-full h-12">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: saved payment methods list */}
        {step === "method" && (
          <div className="space-y-4 py-2">
            {isLoadingMethods ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading payment methods…
              </div>
            ) : filteredMethods.length === 0 ? (
              <div
                className="rounded-lg p-4 flex gap-3"
                style={{
                  backgroundColor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                }}
              >
                <AlertCircle
                  className="h-5 w-5 mt-0.5"
                  style={{ color: "#B45309" }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "#92400E" }}>
                    No saved payment methods
                  </div>
                  <div style={{ color: "#92400E", fontSize: 14 }}>
                    Add a {paymentType} payment method first.{" "}
                    <Link
                      href="/protected/dashboard/payments"
                      className="underline font-semibold"
                    >
                      Go to Payments
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMethods.map((m) => (
                  <button
                    key={m.providerPaymentMethodId}
                    onClick={() =>
                      setSelectedProviderPmId(m.providerPaymentMethodId)
                    }
                    className="w-full text-left rounded-xl border p-4 flex items-center justify-between hover:bg-gray-50"
                    style={{
                      borderColor:
                        selectedProviderPmId === m.providerPaymentMethodId
                          ? "#008a4b"
                          : "#E5E7EB",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {m.type === "card" ? (
                        <CreditCard className="h-5 w-5 text-gray-600" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-600" />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827" }}>
                          {(m.brand || "Card").toUpperCase()} ••
                          {m.last4 || "0000"}
                        </div>
                        <div style={{ fontSize: 13, color: "#6B7280" }}>
                          {m.expMonth && m.expYear
                            ? `Exp ${m.expMonth}/${m.expYear}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    {m.isDefault ? (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "#008a4b" }}
                      >
                        Default
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            {/* Sticky footer so confirm is always reachable */}
            <div
              className="sticky bottom-0 bg-white pt-3 border-t"
              style={{ borderColor: "#E5E7EB" }}
            >
              <div className="flex flex-col gap-3">
                <Button
                  onClick={confirmCardPayment}
                  disabled={
                    isConfirming ||
                    !selectedProviderPmId ||
                    filteredMethods.length === 0
                  }
                  className="w-full h-12 gap-2"
                  style={{
                    backgroundColor: "#008a4b",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Confirming…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Confirm payment
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setStep("details")}
                  className="w-full h-12"
                >
                  Back
                </Button>

                <Button variant="ghost" onClick={close} className="w-full h-10">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
