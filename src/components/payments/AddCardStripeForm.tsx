import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function Inner({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        // no redirect needed for cards
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Failed to save card");
      setSaving(false);
      return;
    }

    // setupIntent succeeded
    onSuccess();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={!stripe || saving}
        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save payment method"}
      </button>
    </form>
  );
}

export default function AddCardStripeForm({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/payments/stripe/setup-intent", {
        method: "POST",
      });
      const data = await res.json();
      setClientSecret(data.clientSecret);
    })();
  }, []);

  const options = useMemo(() => {
    if (!clientSecret) return undefined;
    return { clientSecret };
  }, [clientSecret]);

  if (!clientSecret || !options)
    return <p className="text-sm text-gray-600">Loading Stripe…</p>;

  return (
    <Elements stripe={stripePromise} options={options}>
      <Inner onSuccess={onSaved} />
    </Elements>
  );
}
