import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface PendingPayment {
  id: string;
  billName: string;
  amount: number;
  payerName: string;
  payerInitials: string;
  paymentMethod: "venmo" | "zelle";
  dueDate: string;
  submittedDate: string;
}

interface PaymentConfirmationBannerProps {
  pendingPayments: PendingPayment[];
  onConfirmPayment: (paymentId: string) => Promise<void> | void;
  onDisputePayment: (paymentId: string) => Promise<void> | void;
  currentRole?: "admin" | "member" | "parent";
}

export function PaymentConfirmationBanner({
  pendingPayments,
  onConfirmPayment,
  onDisputePayment,
  currentRole = "admin",
}: PaymentConfirmationBannerProps) {
  // Only show to bill owners (admins)
  if (currentRole !== "admin" || pendingPayments.length === 0) {
    return null;
  }

  const handleConfirm = async (payment: PendingPayment) => {
    try {
      await onConfirmPayment(payment.id);
      toast.success("Payment Confirmed", {
        description: `${payment.payerName}'s $${payment.amount.toFixed(2)} ${
          payment.paymentMethod === "venmo" ? "Venmo" : "Zelle"
        } payment marked as received.`,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to confirm payment", {
        description: "Please try again.",
      });
    }
  };

  const handleDispute = async (payment: PendingPayment) => {
    try {
      await onDisputePayment(payment.id);
      toast.error("Payment Denied", {
        description: `${payment.payerName} will be notified that payment was not received.`,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to deny payment", {
        description: "Please try again.",
      });
    }
  };

  return (
    <div className="space-y-2">
      {pendingPayments.map((payment) => (
        <Card
          key={payment.id}
          className="rounded-xl border bg-white overflow-hidden"
          style={{
            borderColor: "#FFA500",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            {/* Left Side: Avatar + Payment Info */}
            <div className="flex items-center gap-3 flex-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0"
                style={{
                  backgroundColor: "#00B948",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {payment.payerInitials}
              </div>

              <div className="flex-1">
                <p
                  className="text-gray-900"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.3,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {payment.payerName} sent ${payment.amount.toFixed(2)} for{" "}
                  {payment.billName}
                </p>

                <div
                  className="flex items-center gap-2"
                  style={{ marginTop: "3px" }}
                >
                  <Badge
                    className="rounded px-1.5 py-0.5"
                    style={{
                      backgroundColor:
                        payment.paymentMethod === "venmo"
                          ? "#008CFF"
                          : "#6D1ED4",
                      color: "#FFFFFF",
                      fontWeight: 600,
                      fontSize: "10px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {payment.paymentMethod === "venmo" ? "Venmo" : "Zelle"}
                  </Badge>

                  <p
                    className="text-gray-500"
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      lineHeight: 1.3,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Submitted {payment.submittedDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={() => handleConfirm(payment)}
                className="rounded-lg text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: "#00B948",
                  fontWeight: 600,
                  fontSize: "12px",
                  height: "32px",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Confirm
              </Button>

              <Button
                onClick={() => handleDispute(payment)}
                variant="outline"
                className="rounded-lg border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                style={{
                  fontWeight: 600,
                  fontSize: "12px",
                  height: "32px",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Deny
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
