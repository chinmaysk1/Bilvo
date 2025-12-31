export interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand?: string;
  isDefault: boolean;
  createdAt: string;
}

export type PriorityItem = {
  id: string;
  type: "bank" | "card";
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
};
