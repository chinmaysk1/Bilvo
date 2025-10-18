// components/dashboard/AutopayCard.tsx
import { Zap, CreditCard } from "lucide-react";
import { useState } from "react";

interface AutopayCardProps {
  enabled: boolean;
  nextChargeDate: string | null;
  nextChargeAmount: number | null;
  hasPaymentMethod: boolean;
}

export default function AutopayCard({
  enabled,
  nextChargeDate,
  nextChargeAmount,
  hasPaymentMethod,
}: AutopayCardProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleToggle = async () => {
    if (!hasPaymentMethod) {
      alert("Please add a payment method first");
      return;
    }
    // TODO: Call API to toggle autopay
    setIsEnabled(!isEnabled);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 rounded-lg p-2">
            <Zap className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Autopay</h3>
        </div>

        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnabled ? "bg-green-500" : "bg-gray-200"
          }`}
          disabled={!hasPaymentMethod}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {isEnabled && nextChargeDate && nextChargeAmount ? (
        <>
          <div className="mb-1 text-xs font-medium text-gray-600 uppercase tracking-wide">
            Next Charge
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-4">
            {formatDate(nextChargeDate)}
          </div>
          <div className="text-3xl font-bold text-green-600 mb-4">
            ${nextChargeAmount.toFixed(2)}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Checking ••••1234</span>
          </div>
          <div className="text-xs text-gray-500 mt-1 ml-6">
            Payer: Mary Sanchez
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Active
            </span>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            {!hasPaymentMethod
              ? "Add a payment method to enable autopay"
              : "Enable autopay to automatically pay your bills"}
          </p>
        </div>
      )}
    </div>
  );
}
