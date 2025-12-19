import { BillStatus } from "@prisma/client";

export interface Bill {
  id: string;
  source: string;
  biller: string;
  billerType: string;
  amount: number;
  yourShare: number;
  myAutopayEnabled: boolean;
  myPaymentMethodId: string | null;
  dueDate: string;
  scheduledCharge: string | null;
  status: BillStatus;
  ownerUserId: string;
  createdByUserId: string;
  participants: Array<{
    userId: string;
    shareAmount: number;
    autopayEnabled: boolean;
    paymentMethodId: string | null;
  }>;
}

// Bill from Gmail
export interface BillToImport {
  id: string; // Gmail message ID
  biller: string;
  billerType: string;
  amount: number;
  dueDate: string; // ISO
}

export interface FoundBill extends BillToImport {
  subject?: string;
  from?: string;
}
