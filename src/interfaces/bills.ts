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
  myBillParticipantId?: string | null;
  dueDate: string | null;
  scheduledCharge: string | null;
  status: BillStatus;
  myStatus: BillStatus;
  pendingVenmoApprovals: {
    id: string;
    createdAt: Date;
    userId: string;
    billId: string;
    amountCents: number;
  }[];
  ownerUserId: string;
  createdByUserId: string;
  participants: Array<{
    userId: string;
    shareAmount: number;
    autopayEnabled: boolean;
    paymentMethodId: string | null;
  }>;
  myHasPaid: boolean;
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
