export interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand?: string;
  isDefault: boolean;
  createdAt: string;
}
