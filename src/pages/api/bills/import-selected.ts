// pages/api/bills/import-selected.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { BillSource, BillStatus } from "@prisma/client";
import { Bill, BillToImport } from "@/interfaces/bills";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { household: { include: { members: true } } },
    });

    if (!me?.household?.id) {
      return res.status(400).json({ error: "User not in a household" });
    }

    const { bills: billsToImport } = (req.body || {}) as {
      bills: BillToImport[];
    };
    if (!Array.isArray(billsToImport) || billsToImport.length === 0) {
      return res.status(400).json({ error: "No bills provided" });
    }

    const householdId = me.household.id;
    const myUserId = me.id;
    const members = me.household.members;

    const importedBills: Array<Bill> = [];

    for (const billData of billsToImport) {
      try {
        // Skip duplicates
        const existing = await prisma.bill.findFirst({
          where: {
            householdId,
            source: BillSource.GMAIL,
            externalId: billData.id,
          },
          select: { id: true },
        });
        if (existing) continue;

        const dueDateObj = new Date(billData.dueDate);
        if (Number.isNaN(dueDateObj.getTime())) continue;

        const amountNum = Number(billData.amount) || 0;

        // Use -3 days like manual upload for consistency
        const scheduledCharge = new Date(dueDateObj);
        scheduledCharge.setDate(scheduledCharge.getDate() - 3);

        // equal split across members
        const divisor = Math.max(members.length, 1);
        const split = amountNum ? amountNum / divisor : 0;

        const created = await prisma.$transaction(async (tx) => {
          // 1) Create bill (owner = uploader)
          const bill = await tx.bill.create({
            data: {
              householdId,
              ownerUserId: myUserId,
              createdByUserId: myUserId,
              source: BillSource.GMAIL,
              externalId: billData.id,
              biller: billData.biller,
              billerType: billData.billerType,
              amount: amountNum,
              dueDate: dueDateObj,
              scheduledCharge,
              status: BillStatus.SCHEDULED,
            },
          });

          // 2) Equal split for all members
          await tx.billParticipant.createMany({
            data: members.map((m) => ({
              billId: bill.id,
              userId: m.id,
              shareAmount: split,
              autopayEnabled: false,
            })),
          });

          // 3) Get my share for response
          const myPart = await tx.billParticipant.findUnique({
            where: { billId_userId: { billId: bill.id, userId: myUserId } },
            select: { shareAmount: true },
          });

          return { bill, yourShare: myPart?.shareAmount ?? 0 };
        });

        // participants for frontend response (mirror Bill interface)
        const participantsForResponse = members.map((m) => ({
          userId: m.id,
          shareAmount: split,
          autopayEnabled: false,
          paymentMethodId: null,
        }));

        importedBills.push({
          id: created.bill.id,
          source: created.bill.source,
          biller: created.bill.biller,
          billerType: created.bill.billerType,
          amount: created.bill.amount ?? 0,
          yourShare: created.yourShare,
          dueDate: created.bill.dueDate.toISOString(),
          scheduledCharge: created.bill.scheduledCharge
            ? created.bill.scheduledCharge.toISOString()
            : null,
          status: created.bill.status,
          ownerUserId: created.bill.ownerUserId,
          createdByUserId: created.bill.createdByUserId,
          myAutopayEnabled: false,
          myPaymentMethodId: null,
          participants: participantsForResponse,
          myHasPaid: false,
        });
      } catch (error) {
        console.error(`Error importing bill ${billData.id}:`, error);
        // continue with next one
      }
    }

    return res.status(200).json({
      success: true,
      imported: importedBills.length,
      bills: importedBills,
    });
  } catch (error) {
    console.error("Error importing bills:", error);
    return res.status(500).json({
      error: "Failed to import bills",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
