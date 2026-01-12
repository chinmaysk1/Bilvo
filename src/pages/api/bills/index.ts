// pages/api/bills/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../auth/[...nextauth]";
import { BillStatus } from "@prisma/client";
import { determineMyStatus } from "@/components/bills/BillStatusConfig";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { household: { include: { members: true } } },
    });

    if (!me?.household?.id || !me?.household?.members) {
      return res.status(400).json({ error: "User not in a household" });
    }

    const householdId = me.household.id;
    const myUserId = me.id;

    // -----------------------
    // GET /api/bills
    // -----------------------
    if (req.method === "GET") {
      const { status } = req.query;

      const whereClause: any = { householdId };
      if (status && typeof status === "string") {
        whereClause.status = status;
      }

      const bills = await prisma.bill.findMany({
        where: whereClause,
        orderBy: { dueDate: "asc" },
        include: {
          participants: true,
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // 1) collect my participant ids
      const myParticipantIds = bills
        .map((b) => b.participants.find((p) => p.userId === myUserId)?.id)
        .filter((id): id is string => !!id);

      // 2) load all SUCCEEDED attempts for those participants
      const succeeded = await prisma.paymentAttempt.findMany({
        where: {
          billParticipantId: { in: myParticipantIds },
          status: "SUCCEEDED",
        },
        select: { billParticipantId: true },
      });

      // 3) build set for quick lookup
      const paidSet = new Set(succeeded.map((a) => a.billParticipantId));

      // Same for FAILED attempts
      const failed = await prisma.paymentAttempt.findMany({
        where: {
          billParticipantId: { in: myParticipantIds },
          status: "FAILED",
        },
        select: { billParticipantId: true },
      });
      const failedSet = new Set(failed.map((a) => a.billParticipantId));

      const shaped = bills.map((b) => {
        const myPart = b.participants.find((p) => p.userId === myUserId);

        const myParticipantId = myPart?.id ?? null;
        const hasSucceededAttempt = myParticipantId
          ? paidSet.has(myParticipantId)
          : false;
        const hasFailedAttempt = myParticipantId
          ? failedSet.has(myParticipantId)
          : false;

        const myStatus = determineMyStatus({
          myPart: myPart
            ? { id: myPart.id, autopayEnabled: !!myPart.autopayEnabled }
            : null,
          hasSucceededAttempt,
          hasFailedAttempt,
        });

        return {
          id: b.id,
          source: b.source,
          biller: b.biller,
          billerType: b.billerType,
          amount: b.amount ?? 0,
          yourShare: myPart?.shareAmount ?? 0,
          myAutopayEnabled: !!myPart?.autopayEnabled,
          myPaymentMethodId: myPart?.paymentMethodId ?? null,
          myBillParticipantId: myPart?.id ?? null,
          myHasPaid: hasSucceededAttempt,
          myStatus,
          dueDate: b.dueDate.toISOString(),
          scheduledCharge: b.scheduledCharge
            ? b.scheduledCharge.toISOString()
            : null,
          status: b.status,
          ownerUserId: b.ownerUserId,
          createdByUserId: b.createdByUserId,
          participants: b.participants.map((p) => ({
            userId: p.userId,
            shareAmount: p.shareAmount,
            autopayEnabled: p.autopayEnabled,
            paymentMethodId: p.paymentMethodId,
          })),
        };
      });

      return res.status(200).json({ bills: shaped });
    }

    // -----------------------
    // POST /api/bills
    // Creates Bill + BillParticipants (equal split for ALL members)
    // -----------------------
    if (req.method === "POST") {
      const { biller, billerType, amount, dueDate, source, externalId } =
        req.body || {};

      if (!biller || !billerType || amount == null || !dueDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const amountNum = parseFloat(amount);
      if (Number.isNaN(amountNum) || amountNum < 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const dueDateObj = new Date(dueDate);
      if (Number.isNaN(dueDateObj.getTime())) {
        return res.status(400).json({ error: "Invalid dueDate" });
      }

      // Default scheduled charge: 3 days before due date (nullable in schema)
      const scheduledChargeDate = new Date(dueDateObj);
      scheduledChargeDate.setDate(scheduledChargeDate.getDate() - 3);

      const bill = await prisma.$transaction(async (tx) => {
        // 1) create the bill; owner = uploader
        const created = await tx.bill.create({
          data: {
            householdId,
            ownerUserId: myUserId,
            createdByUserId: myUserId,
            source: source || "Manual",
            externalId: externalId ?? null,
            biller,
            billerType,
            amount: amountNum,
            dueDate: dueDateObj,
            scheduledCharge: scheduledChargeDate,
            status: BillStatus.SCHEDULED,
          },
        });

        // 2) participants: equal split for all members (including owner)
        const members = me.household!.members;
        const divisor = Math.max(members.length, 1);
        const split = amountNum ? amountNum / divisor : 0;

        await tx.billParticipant.createMany({
          data: members.map((m) => ({
            billId: created.id,
            userId: m.id,
            shareAmount: split,
            autopayEnabled: false,
          })),
        });

        // 3) return enriched bill
        return tx.bill.findUnique({
          where: { id: created.id },
          include: {
            participants: { include: { user: true } },
            owner: true,
            createdBy: true,
          },
        });
      });

      // Activity log
      await prisma.activity.create({
        data: {
          householdId,
          userId: myUserId,
          type: "bill_uploaded",
          description: "Bill uploaded",
          detail: `${biller} - $${amountNum.toFixed(2)}`,
          amount: amountNum,
          source: source || "Manual",
        },
      });

      return res.status(201).json({ success: true, bill });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling bills:", error);
    return res.status(500).json({ error: "Failed to handle bills" });
  }
}
