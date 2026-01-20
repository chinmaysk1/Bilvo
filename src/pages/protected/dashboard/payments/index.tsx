// pages/protected/dashboard/payments/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Edit,
  EditIcon,
  GripVertical,
  Lock,
  Plus,
  Send,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AddCardStripeForm from "@/components/payments/AddCardStripeForm";
import { PaymentMethod, PriorityItem } from "@/interfaces/payments";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ensureOwnerConnectOnboarding } from "../utilities";
import VerifiedBadge from "@/components/payments/VerifiedBadge";

interface PaymentsPageProps {
  paymentMethods: PaymentMethod[];
}

export default function PaymentsPage({
  paymentMethods: initialMethods,
}: PaymentsPageProps) {
  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethod[]>(initialMethods);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userOwnsAnyUtility, setUserOwnsAnyUtility] = useState(false);
  const [utilityOwnershipLoading, setUtilityOwnershipLoading] = useState(true);
  const [stripeReadyToReceive, setStripeReadyToReceive] = useState<
    boolean | null
  >(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true);
  const [venmoHandle, setVenmoHandle] = useState("");
  const [venmoLoading, setVenmoLoading] = useState(true);
  const [venmoSaving, setVenmoSaving] = useState(false);
  const [isEditingVenmo, setIsEditingVenmo] = useState(false);

  const isVenmoSaved = !!venmoHandle && !venmoSaving;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setUtilityOwnershipLoading(true);
        setStripeStatusLoading(true);

        const meRes = await fetch("/api/user/me");
        if (!meRes.ok) throw new Error("Failed to fetch current user");
        const me = await meRes.json();
        if (cancelled) return;

        setCurrentUserId(me.id);

        const [utilRes, stripeRes, venmoRes] = await Promise.all([
          fetch("/api/utilities"),
          fetch("/api/payments/stripe/connect/status-from-db"),
          fetch("/api/payments/payment-methods/venmo"),
        ]);

        if (!utilRes.ok) throw new Error("Failed to fetch utilities");
        const utilData = await utilRes.json();
        if (cancelled) return;

        const utilities = utilData.utilityAccounts ?? [];
        const owns = utilities.some(
          (u: { ownerUserId: string | null }) => u.ownerUserId === me.id,
        );
        setUserOwnsAnyUtility(owns);

        // Stripe status (DB-only endpoint)
        if (stripeRes.ok) {
          const st = await stripeRes.json().catch(() => ({}));
          if (!cancelled) setStripeReadyToReceive(!!st?.isReadyToReceive);
        } else {
          if (!cancelled) setStripeReadyToReceive(null);
        }

        if (venmoRes.ok) {
          const wallet = await venmoRes.json().catch(() => ({}));
          if (!cancelled) setVenmoHandle(wallet?.venmoHandle || "");
        }
      } catch (e) {
        console.error("Failed to load ownership/stripe status:", e);
        if (!cancelled) {
          setUserOwnsAnyUtility(false);
          setStripeReadyToReceive(null);
        }
      } finally {
        if (!cancelled) {
          setUtilityOwnershipLoading(false);
          setStripeStatusLoading(false);
          setVenmoLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleRemove = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this payment method? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/payments/payment-methods/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");

      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to remove payment method");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = paymentMethods.findIndex((pm) => pm.id === active.id);
    const newIndex = paymentMethods.findIndex((pm) => pm.id === over.id);

    const newOrder = arrayMove(paymentMethods, oldIndex, newIndex);
    setPaymentMethods(newOrder);

    // Save order to backend
    setIsSavingOrder(true);
    try {
      const res = await fetch("/api/payments/payment-methods/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: newOrder.map((pm) => pm.id),
        }),
      });

      if (!res.ok) throw new Error("Failed to save order");
    } catch (e) {
      console.error(e);
      alert("Failed to save payment method order");
      // Revert to original order on error
      setPaymentMethods(paymentMethods);
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Figma banner wants "priority order" pills.
  const priorityItems: PriorityItem[] = useMemo(() => {
    const items = paymentMethods.map((m): PriorityItem => {
      const isBank = m.type === "bank";
      return {
        id: m.id,
        type: isBank ? "bank" : "card",
        name: isBank
          ? `${m.brand || "Bank"} •••• ${m.last4}`
          : `${(m.brand || "Card").toUpperCase()} •••• ${m.last4}`,
        icon: isBank ? Building2 : CreditCard,
        iconBg: isBank ? "#ECFDF5" : "#F3F4F6",
        iconColor: isBank ? "#16A34A" : "#6B7280",
      };
    });

    if (items.length === 0) {
      items.push({
        id: "no-method",
        type: "card",
        name: "Add a payment method",
        icon: CreditCard,
        iconBg: "#F3F4F6",
        iconColor: "#6B7280",
      });
    }

    return items;
  }, [paymentMethods]);

  // Figma "Pay With" list rows
  const payWithRows = useMemo(() => {
    return paymentMethods.map((m) => {
      const isBank = m.type === "bank";
      const title = isBank
        ? `${m.brand || "Bank"} Checking`
        : `${(m.brand || "Card").toUpperCase()} Card`;
      const details = isBank
        ? `•••• ${m.last4} · Free transfers · Added ${new Date(
            m.createdAt,
          ).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
        : `•••• ${m.last4} · 2.9% + $0.30 fee per transaction`;

      return {
        id: m.id,
        isDefault: m.isDefault,
        type: isBank ? "bank" : "card",
        title,
        details,
        icon: isBank ? Building2 : CreditCard,
        iconBg: isBank ? "#ECFDF5" : "#F3F4F6",
        iconColor: isBank ? "#16A34A" : "#6B7280",
      };
    });
  }, [paymentMethods]);

  return (
    <DashboardLayout>
      <main className="mx-auto px-8 py-3 space-y-3">
        {/* Header */}
        <div className="pb-1 flex items-center justify-between">
          <h1
            className="text-[18px] text-[#111827]"
            style={{ fontWeight: 600, lineHeight: 1.2 }}
          >
            Payment Settings
          </h1>
        </div>

        {/* Payment Priority Info Banner (Figma) */}
        <section
          className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-[#6B7280]" />
              <h3
                className="text-[16px] text-[#111827]"
                style={{ fontWeight: 600, lineHeight: 1.3 }}
              >
                Payment Priority Order
              </h3>
              {isSavingOrder && (
                <span className="text-[12px] text-[#6B7280] ml-2">
                  Saving...
                </span>
              )}
            </div>

            <p className="text-[14px] text-[#6B7280] mb-3">
              Drag to reorder your payment methods. Bills will be charged in the
              following order:
            </p>

            {/* Priority Flow */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {priorityItems.map((method, index) => (
                <div
                  key={method.id}
                  className="flex items-center gap-2 flex-shrink-0"
                >
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                      index === 0
                        ? "bg-[#ECFDF5] border-[#BBF7D0]"
                        : "bg-[#F9FAFB] border-[#E5E7EB]"
                    }`}
                  >
                    <div
                      className="flex items-center justify-center h-5 w-5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: index === 0 ? "#008a4b" : "#E5E7EB",
                        color: index === 0 ? "#FFFFFF" : "#6B7280",
                        fontWeight: 600,
                        fontSize: "11px",
                      }}
                    >
                      {index + 1}
                    </div>

                    <div
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: method.iconBg }}
                    >
                      <method.icon
                        className="h-3 w-3"
                        style={{ color: method.iconColor }}
                      />
                    </div>

                    <span
                      className={`text-[13px] ${
                        index === 0 ? "text-[#111827]" : "text-[#6B7280]"
                      }`}
                      style={{ fontWeight: index === 0 ? 600 : 500 }}
                    >
                      {method.name}
                    </span>
                  </div>

                  {index < priorityItems.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-[#9CA3AF] flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pay With (Figma list with drag-and-drop) */}
        <section
          className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-4">
            <h2
              className="text-[16px] text-[#111827] mb-4"
              style={{ fontWeight: 600, lineHeight: 1.3 }}
            >
              Pay With
            </h2>

            <div className="space-y-3">
              {payWithRows.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[#6B7280]">
                    Add a payment method to enable payments.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={paymentMethods.map((pm) => pm.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {payWithRows.map((row, index) => (
                      <SortablePaymentMethodRow
                        key={row.id}
                        row={row}
                        index={index}
                        onRemove={handleRemove}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {/* Add Payment Method (Figma style) */}
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-[#E5E7EB] bg-white hover:border-[#16A34A] hover:bg-[#ECFDF5]/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F9FAFB] group-hover:bg-[#ECFDF5] transition-colors">
                    <Plus className="h-4 w-4 text-[#9CA3AF] group-hover:text-[#16A34A] transition-colors" />
                  </div>
                  <div className="text-left">
                    <h3
                      className="text-[14px] text-[#111827] group-hover:text-[#16A34A] transition-colors mb-0.5"
                      style={{ fontWeight: 600 }}
                    >
                      Add Payment Method
                    </h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Link bank account or credit card
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Receiving Money (My Wallet) — Figma section (UI only for now) */}
        <section
          className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-4">
            <h2
              className="text-[16px] text-[#111827] mb-2"
              style={{ fontWeight: 600, lineHeight: 1.3 }}
            >
              Receiving Money (My Wallet)
            </h2>
            <p className="text-[13px] text-[#6B7280] mb-4">
              Set up how you want to receive payments from roommates
            </p>

            <div className="space-y-3">
              {/* Bank Deposit row — UI-only placeholder */}
              <div
                className="flex items-center gap-3 p-4 rounded-lg border border-[#FEF3C7] bg-[#FFFBEB]"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ backgroundColor: "#EFF6FF" }}
                >
                  <Building2 className="h-4 w-4" style={{ color: "#3B82F6" }} />
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-shrink-0" style={{ width: "100px" }}>
                    <h3
                      className="text-[14px] text-[#111827]"
                      style={{ fontWeight: 600 }}
                    >
                      Bank Deposit
                    </h3>
                    <p className="text-[11px] text-[#6B7280]">(Stripe)</p>
                  </div>

                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1">
                      <p
                        className="text-[13px] text-[#92400E]"
                        style={{ fontWeight: 500 }}
                      >
                        Verify identity to enable payouts
                      </p>
                    </div>

                    {stripeReadyToReceive === true ? (
                      <VerifiedBadge />
                    ) : (
                      <button
                        type="button"
                        disabled={
                          utilityOwnershipLoading ||
                          stripeStatusLoading ||
                          !userOwnsAnyUtility
                        }
                        className={[
                          "h-9 px-4 text-[13px] rounded-lg",
                          utilityOwnershipLoading ||
                          stripeStatusLoading ||
                          !userOwnsAnyUtility
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-[#3B82F6] hover:bg-[#2563EB] text-white",
                        ].join(" ")}
                        style={{ fontWeight: 600 }}
                        onClick={async () => {
                          if (
                            utilityOwnershipLoading ||
                            stripeStatusLoading ||
                            !userOwnsAnyUtility
                          )
                            return;
                          await ensureOwnerConnectOnboarding(); // redirect
                        }}
                        title={
                          !userOwnsAnyUtility
                            ? "Only utility owners can enable payouts."
                            : "Verify your identity to enable payouts."
                        }
                      >
                        {utilityOwnershipLoading || stripeStatusLoading
                          ? "Checking..."
                          : "Verify Now"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Venmo Row (UI only) */}
              <div
                className="flex items-center gap-3 p-4 rounded-lg border border-[#E5E7EB] bg-white"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ backgroundColor: "#E5F3FF" }}
                >
                  {/* simple venmo mark */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                    style={{ color: "#008CFF" }}
                  >
                    <path d="M20.48 2.73c.72 1.24 1.04 2.42 1.04 4.02 0 4.95-4.2 11.36-7.62 16.25H8.35L5.25 4.21l5.56-.51L12.42 16c1.72-2.61 3.64-6.28 3.64-9.09 0-1.49-.29-2.42-.76-3.18l4.18-.99z" />
                  </svg>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-shrink-0" style={{ width: "100px" }}>
                    <h3
                      className="text-[14px] text-[#111827]"
                      style={{ fontWeight: 600 }}
                    >
                      Venmo
                    </h3>
                  </div>

                  <div className="flex-1 flex items-center gap-2">
                    <input
                      placeholder="@username"
                      className="flex-1 h-9 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#008a4b] focus:border-transparent"
                      value={venmoHandle}
                      onChange={(e) => setVenmoHandle(e.target.value)}
                      disabled={
                        venmoLoading ||
                        venmoSaving ||
                        (isVenmoSaved && !isEditingVenmo)
                      }
                    />

                    {isVenmoSaved && !isEditingVenmo ? (
                      <>
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded-md"
                          style={{ backgroundColor: "#ECFDF5" }}
                        >
                          <VerifiedBadge label="Saved" />
                        </div>

                        <button
                          type="button"
                          disabled={venmoLoading || venmoSaving}
                          className={[
                            "h-9 px-3 rounded-lg border text-[13px]",
                            venmoLoading || venmoSaving
                              ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "border-[#D1D5DB] bg-white text-[#111827] hover:bg-[#F9FAFB]",
                          ].join(" ")}
                          style={{ fontWeight: 600 }}
                          onClick={() => setIsEditingVenmo(true)}
                        >
                          <Edit size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={
                            venmoLoading || venmoSaving || !venmoHandle.trim()
                          }
                          className={[
                            "h-9 px-3 rounded-lg border text-[13px]",
                            venmoLoading || venmoSaving || !venmoHandle.trim()
                              ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "border-[#D1D5DB] bg-white text-[#111827] hover:bg-[#F9FAFB]",
                          ].join(" ")}
                          style={{ fontWeight: 600 }}
                          onClick={async () => {
                            setVenmoSaving(true);
                            try {
                              const res = await fetch(
                                "/api/payments/payment-methods/venmo",
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ venmoHandle }),
                                },
                              );
                              if (!res.ok)
                                throw new Error("Failed to save Venmo");
                              const data = await res.json();
                              setVenmoHandle(data?.venmoHandle || "");
                              setIsEditingVenmo(false); // lock it back down after save
                            } catch (e) {
                              console.error(e);
                              alert("Failed to save Venmo handle");
                            } finally {
                              setVenmoSaving(false);
                            }
                          }}
                        >
                          {venmoSaving ? "Saving..." : "Save"}
                        </button>

                        {isVenmoSaved && isEditingVenmo && (
                          <button
                            type="button"
                            disabled={venmoLoading || venmoSaving}
                            className={[
                              "h-9 px-3 rounded-lg border text-[13px]",
                              venmoLoading || venmoSaving
                                ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                                : "border-[#D1D5DB] bg-white text-[#111827] hover:bg-[#F9FAFB]",
                            ].join(" ")}
                            style={{ fontWeight: 600 }}
                            onClick={() => setIsEditingVenmo(false)}
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Parent or External Payers (UI-only placeholder to match Figma) */}
        <section
          className="rounded-xl border border-[#D1D5DB] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-[16px] text-[#111827]"
                style={{ fontWeight: 600, lineHeight: 1.3 }}
              >
                Parent or External Payers (Coming Soon)
              </h2>

              <button
                type="button"
                className="rounded-lg bg-[#008a4b] hover:bg-[#00A03C] text-white h-9 px-3 text-[13px]"
                style={{ fontWeight: 600 }}
                onClick={() => alert("Invite payer (coming soon)")}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 inline-block" />
                Invite Payer
              </button>
            </div>

            <p className="text-[13px] text-[#6B7280] mb-4">
              Invite someone else to pay.
            </p>

            {/* Example active payer card (static for now) */}
            <div className="border border-[#E5E7EB] rounded-lg p-4 bg-gradient-to-r from-purple-50 to-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3E8FF] flex-shrink-0">
                    <UserPlus className="h-5 w-5 text-[#9333EA]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className="text-[15px] text-[#111827]"
                        style={{ fontWeight: 600 }}
                      >
                        Julia Mantel
                      </h3>
                      <span
                        className="bg-[#F3E8FF] text-[#9333EA] border-[#E9D5FF] text-[10px] px-2 py-0 rounded border"
                        style={{ fontWeight: 600 }}
                      >
                        Mom
                      </span>
                      <span
                        className="bg-[#ECFDF5] text-[#16A34A] border-[#BBF7D0] text-[10px] px-2 py-0 rounded border"
                        style={{ fontWeight: 600 }}
                      >
                        Active
                      </span>
                    </div>

                    <p className="text-[12px] text-[#6B7280]">
                      Checking ending in ••1234 · Can pay bills on your behalf
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="rounded-lg h-8 px-3 border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[12px]"
                    style={{ fontWeight: 600 }}
                    onClick={() => alert("Edit payer (coming soon)")}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg h-8 px-3 border border-[#008a4b] text-[#008a4b] hover:bg-[#ECFDF5] text-[12px]"
                    style={{ fontWeight: 600 }}
                    onClick={() => alert("Resend invite (coming soon)")}
                  >
                    <Send className="h-3.5 w-3.5 mr-1 inline-block" />
                    Resend
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Note */}
        <div className="pt-3 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5 text-[#9CA3AF]" />
            <p className="text-[12px] text-[#6B7280]">
              All payments are processed through Stripe. Bilvo never stores your
              banking credentials.
            </p>
          </div>
        </div>
      </main>

      {/* Keep your existing Add Payment Method flow (modal) */}
      {showAddModal && (
        <AddPaymentMethodModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newMethod) => {
            setPaymentMethods((prev) => [newMethod, ...prev]);
            setShowAddModal(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}

interface SortablePaymentMethodRowProps {
  row: {
    id: string;
    isDefault: boolean;
    type: string;
    title: string;
    details: string;
    icon: LucideIcon;
    iconBg: string;
    iconColor: string;
  };
  index: number;
  onRemove: (id: string) => void;
}

function SortablePaymentMethodRow({
  row,
  index,
  onRemove,
}: SortablePaymentMethodRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] transition-colors"
    >
      {/* Priority Number */}
      <div
        className="flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0"
        style={{
          backgroundColor: index === 0 ? "#008a4b" : "#E5E7EB",
          color: index === 0 ? "#FFFFFF" : "#6B7280",
          fontWeight: 600,
          fontSize: "13px",
        }}
      >
        {index + 1}
      </div>

      {/* Grip (draggable handle) */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
      </div>

      {/* Icon */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
        style={{ backgroundColor: row.iconBg }}
      >
        <row.icon className="h-4 w-4" style={{ color: row.iconColor }} />
      </div>

      {/* Details */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h3
            className="text-[14px] text-[#111827]"
            style={{ fontWeight: 600 }}
          >
            {row.title}
          </h3>

          {/* "Primary" tag for your default */}
          {row.isDefault && (
            <span
              className="text-[10px] px-2 py-0 rounded border"
              style={{
                fontWeight: 600,
                backgroundColor: "#ECFDF5",
                color: "#16A34A",
                borderColor: "#BBF7D0",
              }}
            >
              Primary
            </span>
          )}
        </div>
        <p className="text-[12px] text-[#6B7280]">{row.details}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="text-[#DC2626] hover:text-[#B91C1C] hover:bg-red-50 text-[12px] h-8 px-3 rounded-lg"
          style={{ fontWeight: 600 }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AddPaymentMethodModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (method: PaymentMethod) => void;
}) {
  const [paymentType, setPaymentType] = useState<"bank" | "card">("bank");
  const [formData, setFormData] = useState({
    type: "bank",
    last4: "",
    brand: "Bank of America",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.last4.length !== 4 || !/^\d{4}$/.test(formData.last4)) {
      alert("Please enter the last 4 digits");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/payments/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, type: paymentType }),
      });

      if (!res.ok) throw new Error("Failed to add payment method");

      const { paymentMethod } = await res.json();
      onSuccess(paymentMethod);
    } catch (error) {
      console.error("Error adding payment method:", error);
      alert("Failed to add payment method");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
      <div className="relative mx-auto my-10 w-full max-w-lg px-4">
        <div className="bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Add Payment Method
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Choose how you'd like to pay your bills.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentType("bank");
                  setFormData({
                    ...formData,
                    type: "bank",
                    brand: "Bank of America",
                  });
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  paymentType === "bank"
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Building2 className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Bank account</p>
                    <p className="text-xs text-gray-500">ACH (coming soon)</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType("card");
                  setFormData({ ...formData, type: "card", brand: "Visa" });
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  paymentType === "card"
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <CreditCard className="w-5 h-5 text-gray-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Card</p>
                    <p className="text-xs text-gray-500">Instant, via Stripe</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {paymentType === "card" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">
                    Add a card securely. Bilvo never sees your card number.
                  </p>
                </div>

                <AddCardStripeForm
                  onSaved={async () => {
                    const syncRes = await fetch(
                      "/api/payments/payment-methods/sync",
                      { method: "POST" },
                    );
                    if (!syncRes.ok) {
                      alert(
                        "Card saved in Stripe, but failed to sync to your database.",
                      );
                      return;
                    }

                    const res = await fetch("/api/payments/payment-methods");
                    const data = await res.json();
                    const newest = data.paymentMethods?.[0];
                    if (newest) onSuccess(newest);
                    else onClose();
                  }}
                />
              </div>
            ) : (
              <form
                id="bank-form"
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-800">
                    Bank linking is coming soon. This is demo-only for now.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank name
                  </label>
                  <select
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Bank of America">Bank of America</option>
                    <option value="Chase">Chase</option>
                    <option value="Wells Fargo">Wells Fargo</option>
                    <option value="Citibank">Citibank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last 4 digits
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="\d{4}"
                    value={formData.last4}
                    onChange={(e) =>
                      setFormData({ ...formData, last4: e.target.value })
                    }
                    placeholder="1234"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Demo only.</p>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              {paymentType === "bank" && (
                <button
                  type="button"
                  onClick={() => {
                    const form = document.getElementById(
                      "bank-form",
                    ) as HTMLFormElement | null;
                    form?.requestSubmit();
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isLoading ? "Adding..." : "Add Bank (Demo)"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session?.user?.email) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const pmResponse = await fetch(`${baseUrl}/api/payments/payment-methods`, {
      headers: { Cookie: context.req.headers.cookie || "" },
    });
    if (!pmResponse.ok) throw new Error("Failed to fetch payment methods");

    const pmData = await pmResponse.json();

    return {
      props: {
        paymentMethods: pmData.paymentMethods,
      },
    };
  } catch (error) {
    console.error("Error loading payments:", error);
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
};
