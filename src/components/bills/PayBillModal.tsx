import { useState } from "react";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  CreditCard,
  Building2,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface PayBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: {
    id: string;
    biller: string;
    category?: string;
    yourShare: number;
    dueDate: string;
    icon?: any;
    iconColor?: string;
    iconBg?: string;
  } | null;
  onPaymentSubmit: (
    billId: string,
    amount: number,
    paymentMethodId: string
  ) => void;
}

const paymentMethods = [
  {
    id: "bank-4532",
    type: "bank",
    name: "Bank of America",
    last4: "4532",
    icon: Building2,
  },
  {
    id: "visa-4242",
    type: "card",
    name: "Visa",
    last4: "4242",
    icon: CreditCard,
  },
];

export function PayBillModal({
  open,
  onOpenChange,
  bill,
  onPaymentSubmit,
}: PayBillModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("bank-4532");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  React.useEffect(() => {
    if (bill && open) {
      setAmount(bill.yourShare.toFixed(2));
      setSelectedMethod("bank-4532");
      setIsProcessing(false);
      setPaymentSuccess(false);
    }
  }, [bill, open]);

  const handlePayNow = async () => {
    if (!bill) return;

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Invalid amount", {
        description: "Please enter a valid payment amount.",
      });
      return;
    }

    setIsProcessing(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsProcessing(false);
    setPaymentSuccess(true);

    onPaymentSubmit(bill.id, paymentAmount, selectedMethod);

    toast.success("Payment initiated", {
      description: `Your payment of $${paymentAmount.toFixed(
        2
      )} is being processed.`,
    });

    setTimeout(() => {
      onOpenChange(false);
      setPaymentSuccess(false);
    }, 1500);
  };

  const selectedPaymentMethod = paymentMethods.find(
    (m) => m.id === selectedMethod
  );
  const PaymentIcon = selectedPaymentMethod?.icon || CreditCard;

  if (!bill) return null;

  const BillIcon = bill.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        style={{
          fontFamily: "Inter, sans-serif",
          borderRadius: "16px",
          border: "1px solid #E5E7EB",
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#111827",
              fontFamily: "Inter, sans-serif",
              marginBottom: "8px",
            }}
          >
            Pay Your Share
          </DialogTitle>
          <DialogDescription
            style={{
              fontSize: "14px",
              color: "#6B7280",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Make a one-time payment for this bill
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {paymentSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <div
                className="rounded-full flex items-center justify-center mb-4"
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#E9F7EE",
                }}
              >
                <CheckCircle2
                  className="h-8 w-8"
                  style={{ color: "#00B948" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#111827",
                  fontFamily: "Inter, sans-serif",
                  marginBottom: "4px",
                }}
              >
                Payment Initiated
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6B7280",
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                }}
              >
                Your payment is being processed
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 py-4"
            >
              {/* Bill Details */}
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
                      backgroundColor: bill.iconBg || "#F3F4F6",
                    }}
                  >
                    <BillIcon
                      className="h-5 w-5"
                      style={{ color: bill.iconColor || "#6B7280" }}
                      strokeWidth={2}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#111827",
                      fontFamily: "Inter, sans-serif",
                      marginBottom: "2px",
                    }}
                  >
                    {bill.biller}
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {bill.category && `${bill.category} · `}Due {bill.dueDate}
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="amount"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Your Share
                </Label>
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "#6B7280",
                      fontFamily: "Inter, sans-serif",
                    }}
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
                      fontFamily: "Inter, sans-serif",
                      borderColor: "#E5E7EB",
                      borderRadius: "12px",
                    }}
                    disabled={isProcessing}
                  />
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6B7280",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Adjust the amount if needed
                </p>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <Label
                  htmlFor="payment-method"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Payment Method
                </Label>
                <Select
                  value={selectedMethod}
                  onValueChange={setSelectedMethod}
                  disabled={isProcessing}
                >
                  <SelectTrigger
                    id="payment-method"
                    style={{
                      height: "48px",
                      borderRadius: "12px",
                      borderColor: "#E5E7EB",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <SelectItem key={method.id} value={method.id}>
                          <div className="flex items-center gap-2">
                            <Icon
                              className="h-4 w-4"
                              style={{ color: "#6B7280" }}
                            />
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "#111827",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {method.name} ••{method.last4}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Security Note */}
              <div
                className="rounded-lg p-3 flex gap-2"
                style={{
                  backgroundColor: "#F0F9FF",
                  border: "1px solid #DBEAFE",
                }}
              >
                <AlertCircle
                  className="h-4 w-4 flex-shrink-0 mt-0.5"
                  style={{ color: "#3B82F6" }}
                />
                <p
                  style={{
                    fontSize: "13px",
                    color: "#1E40AF",
                    lineHeight: "1.5",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Your payment will be processed securely through Stripe. Funds
                  may take 2–3 business days to clear.
                </p>
              </div>

              {/* Pay Now Button */}
              <Button
                onClick={handlePayNow}
                disabled={isProcessing || !amount || parseFloat(amount) <= 0}
                className="w-full h-12 gap-2"
                style={{
                  backgroundColor: "#00B948",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <PaymentIcon className="h-5 w-5" />
                    Pay ${amount ? parseFloat(amount).toFixed(2) : "0.00"}
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
