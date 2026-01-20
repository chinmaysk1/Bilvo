import { PaymentMethodStatus } from "@prisma/client";

export interface PaymentMethod {
  id: string;
  provider: "stripe";
  providerPaymentMethodId: string; // Stripe pm_...
  type: "card" | "bank";
  brand?: string;
  last4: string;
  expMonth?: number | null;
  expYear?: number | null;
  status: PaymentMethodStatus;
  isDefault: boolean;
  createdAt: string;
  priorityOrder?: number;
}

export type PriorityItem = {
  id: string;
  type: "bank" | "card";
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
};

export interface PaymentAttemptRow {
  id: string;
  status: string;
  provider: string;
  amount: number;
  amountCents?: number | null;
  currency?: string | null;
  createdAt: string;
  processedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  payer: { id: string | null; name: string; email: string | null };
  bill: {
    id: string;
    biller: string;
    billerType: string;
    dueDate: string;
    owner: { id: string; name: string; email: string | null } | null;
  } | null;
  billParticipantId: string | null;
}
