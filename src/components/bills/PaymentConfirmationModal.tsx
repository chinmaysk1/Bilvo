import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ThumbsUp } from "lucide-react";

interface PaymentConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  recipientName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PaymentConfirmationModal({
  open,
  onOpenChange,
  amount,
  recipientName,
  onConfirm,
  onCancel,
}: PaymentConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Payment Confirmation</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm whether you successfully sent ${amount} to {recipientName}
        </DialogDescription>

        <div className="px-6 py-8 text-center space-y-6">
          <div className="flex justify-center">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#E9F7EE" }}
            >
              <ThumbsUp
                className="h-10 w-10"
                style={{ color: "#00B948" }}
                strokeWidth={2.5}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl text-gray-900" style={{ fontWeight: 700 }}>
              Did you send the payment?
            </h2>
            <p className="text-base text-gray-600" style={{ fontWeight: 500 }}>
              Did you successfully transfer{" "}
              <span style={{ fontWeight: 700, color: "#111827" }}>
                ${amount}
              </span>{" "}
              to {recipientName}?
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              onClick={onConfirm}
              className="w-full h-14 rounded-xl text-white border-0"
              style={{
                backgroundColor: "#00B948",
                fontWeight: 600,
                fontSize: "16px",
              }}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Yes, I Sent It
            </Button>

            <button
              onClick={onCancel}
              className="w-full text-center text-sm text-gray-500 hover:text-red-600 transition-colors py-2"
              style={{ fontWeight: 500 }}
            >
              No, I cancelled
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
