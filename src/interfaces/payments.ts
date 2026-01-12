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
