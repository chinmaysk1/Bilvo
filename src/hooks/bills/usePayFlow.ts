import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BillStatus } from "@prisma/client";
import type { Bill } from "@/interfaces/bills";
import type { HouseholdApiMember as HouseholdMember } from "@/interfaces/household";
import { getBillerIcon } from "@/utils/bills/getBillerIcon";
import { createGroupVenmoAttempts } from "@/utils/payments/createGroupVenmoAttempts";
import { formatMonthDay } from "@/utils/common/formatMonthYear";

function buildVenmoPayUrl(params: {
  handle: string;
  amount: number;
  note: string;
}) {
  const handle = (params.handle || "").trim().replace(/^@/, "");
  const amount = Number(params.amount);

  const qs = new URLSearchParams({
    txn: "pay",
    amount: amount.toFixed(2),
    note: params.note || "",
  });

  return `https://venmo.com/${encodeURIComponent(handle)}?${qs.toString()}`;
}

function initialsFor(name?: string | null) {
  const s = (name || "").trim();
  if (!s) return "U";
  return s
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = ["#F2C94C", "#008a4b", "#BB6BD9", "#3B82F6", "#EF4444"];

function getBillOwnerMeta(params: {
  bill: Bill;
  householdMembers: HouseholdMember[];
  currentUserId: string;
}) {
  const { bill, householdMembers, currentUserId } = params;
  const owner = householdMembers.find((m) => m.id === bill.ownerUserId);
  if (!owner) return { name: "Unknown", initials: "UK", color: "#6B7280" };

  const isYou = owner.id === currentUserId;
  const idx = householdMembers.findIndex((m) => m.id === owner.id);
  const color = avatarColors[idx % avatarColors.length];

  return {
    name: isYou ? `${owner.name || "You"} (You)` : owner.name || "Unknown",
    initials: initialsFor(owner.name),
    color,
  };
}

export type SelectedBillForPayment = {
  id: string;
  ownerUserId: string;
  biller: string;
  category: string;
  yourShare: number;
  dueDate: string | null; // "Jan 5"
  icon: any;
  iconColor: string;
  iconBg: string;
  recipientName: string;
};

export function usePayFlow(params: {
  bills: Bill[];
  householdMembers: HouseholdMember[];
  currentUserId: string;
  patchBill: (billId: string, patch: Partial<Bill>) => void;
}) {
  const { bills, householdMembers, currentUserId, patchBill } = params;

  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [stripePayOpen, setStripePayOpen] = useState(false);

  const [selectedBillForPayment, setSelectedBillForPayment] =
    useState<SelectedBillForPayment | null>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "venmo" | "zelle" | "bank" | "card" | null
  >(null);

  const [stripePaymentType, setStripePaymentType] = useState<"card" | "bank">(
    "card",
  );

  const [groupPendingMeta, setGroupPendingMeta] = useState<{
    ownerUserId?: string;
    ownerName?: string;
    bills?: Bill[]; // original bills
    amount?: number;
  } | null>(null);

  const getIsOwner = useCallback(
    (bill: Bill) => bill.ownerUserId === currentUserId,
    [currentUserId],
  );

  const startPayFlow = useCallback(
    (bill: Bill, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      if (getIsOwner(bill)) {
        toast.info("You can’t pay bills you manage.", {
          description: "Only other household members can pay their share.",
        });
        return;
      }

      const { icon, iconColor, iconBg } = getBillerIcon(bill.billerType);
      const owner = getBillOwnerMeta({ bill, householdMembers, currentUserId });

      setSelectedBillForPayment({
        id: bill.id,
        ownerUserId: bill.ownerUserId,
        biller: bill.biller,
        category: bill.billerType,
        yourShare: Number(bill.yourShare || 0),
        dueDate: bill.dueDate
          ? new Date(bill.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : null,
        icon,
        iconColor,
        iconBg,
        recipientName: owner.name,
      });

      setPaymentMethodModalOpen(true);
    },
    [currentUserId, getIsOwner, householdMembers],
  );

  const handleVenmoClick = useCallback(async () => {
    // close payment method modal
    setPaymentMethodModalOpen(false);

    const bill = selectedBillForPayment;
    if (!bill?.ownerUserId || !bill?.yourShare) {
      toast.error("Missing bill details for Venmo.");
      return;
    }

    try {
      // fetch venmo handle
      const res = await fetch(
        `/api/payments/payment-methods/venmo/${bill.ownerUserId}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load Venmo handle");
      }

      const data = await res.json();
      const handle: string | null = data?.venmoHandle || null;

      if (!handle) {
        toast.error("Venmo not set up", {
          description: `${bill.recipientName} hasn’t added a Venmo handle yet.`,
        });
        return;
      }

      // build venmo url
      const note = `Bilvo • ${bill.biller} • ${bill.dueDate ? formatMonthDay(bill.dueDate) : null}`;
      const url = buildVenmoPayUrl({
        handle,
        amount: Number(bill.yourShare),
        note,
      });

      // open venmo
      window.open(url, "_blank", "noopener,noreferrer");

      // continue normal flow
      setSelectedPaymentMethod("venmo");
      setPaymentConfirmationOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Couldn’t open Venmo", {
        description: e?.message || "Please try again.",
      });
    }
  }, [
    selectedBillForPayment,
    setPaymentMethodModalOpen,
    setSelectedPaymentMethod,
    setPaymentConfirmationOpen,
  ]);

  const handleZelleClick = useCallback(() => {
    setPaymentMethodModalOpen(false);
    setSelectedPaymentMethod("zelle");
    setPaymentConfirmationOpen(true);
  }, []);

  const handleAutoPayClick = useCallback(() => {
    setPaymentMethodModalOpen(false);
    toast.success("Autopay setup coming soon!");
  }, []);

  const handleBankAccountClick = useCallback(() => {
    setPaymentMethodModalOpen(false);
    setSelectedPaymentMethod("bank");
    setStripePaymentType("bank");
    setStripePayOpen(true);
  }, []);

  const handleCreditCardClick = useCallback(() => {
    setPaymentMethodModalOpen(false);
    setSelectedPaymentMethod("card");
    setStripePaymentType("card");
    setStripePayOpen(true);
  }, []);

  const handlePaymentConfirmed = useCallback(async () => {
    setPaymentConfirmationOpen(false);

    if (!selectedBillForPayment?.id) return;

    try {
      if (selectedPaymentMethod === "venmo") {
        // if this is a group pay, record one attempt per bill
        if (groupPendingMeta?.bills?.length) {
          const prevStates: Record<
            string,
            { myStatus: any; myHasPaid: boolean }
          > = {};

          // optimistic UI (only AFTER "Yes I sent it")
          groupPendingMeta.bills.forEach((b) => {
            prevStates[b.id] = { myStatus: b.myStatus, myHasPaid: b.myHasPaid };
            patchBill(b.id, { myStatus: BillStatus.PENDING_APPROVAL });
          });

          try {
            const { failures } = await createGroupVenmoAttempts({
              bills: groupPendingMeta.bills.map((b) => ({
                id: b.id,
                yourShare: b.yourShare,
                dueDate: b.dueDate ?? null,
              })),
            });

            // rollback only failed ones
            if (failures.length) {
              failures.forEach((f) => {
                if (!f.billId) return;
                const prev = prevStates[f.billId];
                patchBill(f.billId, {
                  myStatus: prev?.myStatus ?? BillStatus.PENDING,
                  myHasPaid: prev?.myHasPaid ?? false,
                });
              });

              toast.error(
                `Some payments failed to record (${failures.length}).`,
              );
            }
          } catch (err) {
            // rollback all
            groupPendingMeta.bills.forEach((b) => {
              const prev = prevStates[b.id];
              patchBill(b.id, {
                myStatus: prev?.myStatus ?? BillStatus.PENDING,
                myHasPaid: prev?.myHasPaid ?? false,
              });
            });
            throw err;
          }
        } else {
          // single-bill venmo attempt recorded only AFTER "Yes I sent it"
          const res = await fetch("/api/payments/payment-attempts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              billId: selectedBillForPayment.id,
              provider: "venmo",
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || "Failed to record Venmo payment");
          }

          // optimistic UI update (only AFTER "Yes I sent it")
          patchBill(selectedBillForPayment.id, {
            myStatus: BillStatus.PENDING_APPROVAL,
          });
        }
      }

      toast.success("Payment recorded!", {
        description: "Thanks — we’ll mark it paid once it clears.",
        duration: 4000,
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn’t record payment", {
        description: "Please try again.",
      });
    } finally {
      setGroupPendingMeta(null);
      setSelectedBillForPayment(null);
      setSelectedPaymentMethod(null);
    }
  }, [
    patchBill,
    selectedBillForPayment,
    selectedPaymentMethod,
    groupPendingMeta,
  ]);

  const handlePaymentCancelled = useCallback(() => {
    setPaymentConfirmationOpen(false);
    toast.info("Payment cancelled", {
      description: "No worries, you can try again later.",
    });
    setSelectedPaymentMethod(null);
    setSelectedBillForPayment(null);
  }, []);

  const stripeBillParticipantId = useMemo(() => {
    if (!selectedBillForPayment) return null;
    return (
      bills.find((b) => b.id === selectedBillForPayment.id)
        ?.myBillParticipantId ?? null
    );
  }, [bills, selectedBillForPayment]);

  const onStripeSucceeded = useCallback(() => {
    if (!selectedBillForPayment) return;
    patchBill(selectedBillForPayment.id, {
      myHasPaid: true,
      myStatus: BillStatus.PAID,
    });
    setSelectedBillForPayment(null);
    setSelectedPaymentMethod(null);
  }, [patchBill, selectedBillForPayment]);

  // startGroupPay: open the payment modal for a group
  function startGroupPay(
    group: {
      ownerUserId: string;
      ownerName?: string;
      amount: number;
      bills: Bill[];
      dueDateISO?: string;
    },
    e?: React.MouseEvent,
  ) {
    if (e) e.stopPropagation();

    // Build synthetic selectedBillForPayment same shape as single bill flow expects
    const syntheticBill: any = {
      id: `group-${group.ownerUserId}-${Date.now()}`,
      ownerUserId: group.ownerUserId,
      biller: `Payment to ${group.ownerName || "Member"}`,
      billerType: "group",
      yourShare: group.amount,
      dueDate: group.dueDateISO || new Date().toISOString(),
      myStatus: BillStatus.PENDING,
      myHasPaid: false,
      myAutopayEnabled: false,
      participants: [],
      // optional: pass owner display name
      recipientName: group.ownerName,
    };

    // set meta so later handler knows this is a group
    setGroupPendingMeta({
      ownerUserId: group.ownerUserId,
      ownerName: group.ownerName,
      bills: group.bills,
      amount: group.amount,
    });

    // set selected bill and open modal (mimic old flow)
    setSelectedBillForPayment(syntheticBill);
    setPaymentMethodModalOpen(true);
  }

  return {
    // state
    paymentMethodModalOpen,
    setPaymentMethodModalOpen,
    paymentConfirmationOpen,
    setPaymentConfirmationOpen,
    stripePayOpen,
    setStripePayOpen,
    selectedBillForPayment,
    selectedPaymentMethod,
    stripePaymentType,
    stripeBillParticipantId,

    // actions
    startPayFlow,
    startGroupPay,
    handleVenmoClick,
    handleZelleClick,
    handleAutoPayClick,
    handleBankAccountClick,
    handleCreditCardClick,
    handlePaymentConfirmed,
    handlePaymentCancelled,
    onStripeSucceeded,
  };
}
