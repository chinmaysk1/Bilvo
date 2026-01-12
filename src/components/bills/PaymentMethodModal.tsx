import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, CreditCard, Building2 } from "lucide-react";

interface PaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billName: string;
  amount: string;

  onVenmoClick: () => void;
  onZelleClick: () => void;
  onBankAccountClick: () => void;
  onCreditCardClick: () => void;
  onAutoPayClick: () => void;

  // Optional: allow you to change labels later without refactor
  bankLabel?: string;
  cardLabel?: string;
}

export function PaymentMethodModal({
  open,
  onOpenChange,
  billName,
  amount,
  onVenmoClick,
  onZelleClick,
  onBankAccountClick,
  onCreditCardClick,
  onAutoPayClick,
  bankLabel = "Pay with Bank Account",
  cardLabel = "Pay with Credit Card",
}: PaymentMethodModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
        <DialogDescription className="sr-only">
          Select a payment method to pay your share of ${amount} for {billName}
        </DialogDescription>

        <div className="px-6 py-8 space-y-8">
          <div className="text-center space-y-4">
            <DialogTitle
              className="text-xl text-gray-900"
              style={{ fontWeight: 600 }}
            >
              Pay Share for {billName}
            </DialogTitle>

            <div className="py-2">
              <div
                className="text-5xl text-gray-900"
                style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
              >
                ${amount}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Venmo */}
            <Button
              onClick={onVenmoClick}
              className="w-full h-14 rounded-xl border-0 hover:shadow-lg transition-all"
              style={{
                backgroundColor: "#008CFF",
                color: "white",
                fontWeight: 600,
                fontSize: "16px",
              }}
            >
              <svg
                className="h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M20.48 2.73c.72 1.24 1.04 2.42 1.04 4.02 0 4.95-4.2 11.36-7.62 16.25H8.35L5.25 4.21l5.56-.51L12.42 16c1.72-2.61 3.64-6.28 3.64-9.09 0-1.49-.29-2.42-.76-3.18l4.18-.99z" />
              </svg>
              Pay with Venmo
            </Button>

            {/* Zelle */}
            <Button
              onClick={onZelleClick}
              variant="outline"
              className="w-full h-14 rounded-xl border-2 hover:bg-gray-50 transition-all"
              style={{
                borderColor: "#D1D5DB",
                backgroundColor: "white",
                color: "#374151",
                fontWeight: 600,
                fontSize: "16px",
              }}
            >
              <Copy className="h-5 w-5 mr-2" />
              Copy Zelle Info
            </Button>

            {/* Bank */}
            <Button
              onClick={onBankAccountClick}
              variant="outline"
              className="w-full h-14 rounded-xl border-2 hover:bg-gray-50 transition-all"
              style={{
                borderColor: "#D1D5DB",
                backgroundColor: "white",
                color: "#374151",
                fontWeight: 600,
                fontSize: "16px",
              }}
            >
              <Building2 className="h-5 w-5 mr-2" />
              {bankLabel}
            </Button>

            {/* Card */}
            <Button
              onClick={onCreditCardClick}
              variant="outline"
              className="w-full h-14 rounded-xl border-2 hover:bg-gray-50 transition-all"
              style={{
                borderColor: "#D1D5DB",
                backgroundColor: "white",
                color: "#374151",
                fontWeight: 600,
                fontSize: "16px",
              }}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {cardLabel}
            </Button>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={onAutoPayClick}
              className="text-sm text-gray-500 hover:text-[#00B948] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Hate doing this manually?{" "}
              <span style={{ fontWeight: 600, textDecoration: "underline" }}>
                Enable Auto-Pay
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
