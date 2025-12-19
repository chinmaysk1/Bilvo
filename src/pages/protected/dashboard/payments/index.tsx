// pages/protected/dashboard/payments/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAutopay } from "@/hooks/useAutopay";
import { CreditCard, Building2, Users, Plus, ChevronRight } from "lucide-react";
import { PaymentMethod } from "@/interfaces/payments";

interface PaymentsPageProps {
  paymentMethods: PaymentMethod[];
  autopayEnabled: boolean;
}

export default function PaymentsPage({
  paymentMethods: initialMethods,
  autopayEnabled: initialAutopay,
}: PaymentsPageProps) {
  const [paymentMethods, setPaymentMethods] = useState(initialMethods);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSetPrimary = async (id: string) => {
    try {
      const res = await fetch(`/api/payment-methods/${id}/set-default`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to set primary");

      setPaymentMethods(
        paymentMethods.map((pm) => ({
          ...pm,
          isDefault: pm.id === id,
        }))
      );
    } catch (error) {
      console.error("Error setting primary:", error);
      alert("Failed to set primary payment method");
    }
  };

  const handleRemove = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this payment method? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove");

      setPaymentMethods(paymentMethods.filter((pm) => pm.id !== id));
    } catch (error) {
      console.error("Error removing payment method:", error);
      alert("Failed to remove payment method");
    }
  };

  const getPaymentIcon = (type: string, brand?: string) => {
    if (type === "bank") {
      return (
        <div className="bg-green-100 p-3 rounded-lg">
          <Building2 className="w-6 h-6 text-green-600" />
        </div>
      );
    }
    return (
      <div className="bg-gray-100 p-3 rounded-lg">
        <CreditCard className="w-6 h-6 text-gray-600" />
      </div>
    );
  };

  // Mock data for primary payment method (in real app, get from user)
  const primaryPaymentMethod = paymentMethods.find((pm) => pm.isDefault);
  const backupMethods = paymentMethods.filter((pm) => !pm.isDefault);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payment Settings
        </h1>
      </div>

      {/* Payment Priority Order */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">
              Payment Priority Order
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Bills are paid using the following fallback sequence:
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4">
            {/* Primary Payer */}
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Mary Sanchez</p>
                <span className="inline-block bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded mt-1">
                  PRIMARY
                </span>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-gray-400" />

            {/* Bank Account */}
            {primaryPaymentMethod && (
              <>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Building2 className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="font-medium text-gray-700">
                    {primaryPaymentMethod.brand || "Bank"} ••••{" "}
                    {primaryPaymentMethod.last4}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400" />
              </>
            )}

            {/* Backup Card */}
            {backupMethods.length > 0 && (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                </div>
                <p className="font-medium text-gray-700">
                  {backupMethods[0].brand} Card
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Your Payment Methods */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Payment Methods
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {paymentMethods.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No payment methods added yet</p>
              <p className="text-sm mt-1">
                Add a payment method to enable autopay
              </p>
            </div>
          ) : (
            paymentMethods.map((method) => (
              <div
                key={method.id}
                className="p-6 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  {getPaymentIcon(method.type, method.brand)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">
                        {method.type === "bank"
                          ? `${method.brand || "Bank"} Checking`
                          : `${method.brand || "Visa"} Card`}
                      </p>
                      {method.isDefault && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                          Backup
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      •••• {method.last4}
                      {method.type === "bank" ? (
                        <>
                          {" "}
                          · Free transfers · Added{" "}
                          {new Date(method.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </>
                      ) : (
                        <> · 2.9% + $0.30 fee per transaction</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetPrimary(method.id)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                    >
                      Set as Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(method.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Add Payment Method Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full p-6 flex items-start gap-3 hover:bg-gray-50 border-2 border-dashed border-gray-200 text-left"
          >
            <Plus className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Add Payment Method</p>
              <p className="text-sm text-gray-500">
                Link bank account or credit card
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Parent or External Payers */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Parent or External Payers
          </h2>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900">Mary Sanchez</p>
                  <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded">
                    Mom
                  </span>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">
                    Connected
                  </span>
                  <span className="bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded">
                    Primary
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Checking ending in ••1234 · Can pay bills on your behalf
                </p>
              </div>
            </div>

            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {showAddModal && (
        <AddPaymentMethodModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newMethod) => {
            setPaymentMethods([...paymentMethods, newMethod]);
            setShowAddModal(false);
          }}
        />
      )}
    </DashboardLayout>
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
      const res = await fetch("/api/payment-methods", {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Payment Method</h2>

        {/* Payment Type Selection */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => {
              setPaymentType("bank");
              setFormData({
                ...formData,
                type: "bank",
                brand: "Bank of America",
              });
            }}
            className={`flex-1 p-4 border-2 rounded-lg text-left ${
              paymentType === "bank"
                ? "border-green-600 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Building2 className="w-6 h-6 mb-2 text-green-600" />
            <p className="font-medium text-gray-900">Bank Account</p>
            <p className="text-xs text-gray-500">Free transfers</p>
          </button>

          <button
            onClick={() => {
              setPaymentType("card");
              setFormData({ ...formData, type: "card", brand: "Visa" });
            }}
            className={`flex-1 p-4 border-2 rounded-lg text-left ${
              paymentType === "card"
                ? "border-green-600 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <CreditCard className="w-6 h-6 mb-2 text-gray-600" />
            <p className="font-medium text-gray-900">Credit/Debit Card</p>
            <p className="text-xs text-gray-500">2.9% + $0.30 fee</p>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {paymentType === "bank" ? "Bank Name" : "Card Brand"}
            </label>
            <select
              value={formData.brand}
              onChange={(e) =>
                setFormData({ ...formData, brand: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {paymentType === "bank" ? (
                <>
                  <option value="Bank of America">Bank of America</option>
                  <option value="Chase">Chase</option>
                  <option value="Wells Fargo">Wells Fargo</option>
                  <option value="Citibank">Citibank</option>
                </>
              ) : (
                <>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="American Express">American Express</option>
                  <option value="Discover">Discover</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last 4 Digits
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
            <p className="text-xs text-gray-500 mt-1">
              For demo purposes, just enter any 4 digits
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Payment Method"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const pmResponse = await fetch(`${baseUrl}/api/payment-methods`, {
      headers: {
        Cookie: context.req.headers.cookie || "",
      },
    });

    if (!pmResponse.ok) {
      throw new Error("Failed to fetch payment methods");
    }

    const pmData = await pmResponse.json();

    const autopayResponse = await fetch(`${baseUrl}/api/user/autopay`, {
      headers: {
        Cookie: context.req.headers.cookie || "",
      },
    });

    const autopayData = await autopayResponse.json();

    return {
      props: {
        paymentMethods: pmData.paymentMethods,
        autopayEnabled: autopayData.autopayEnabled || false,
      },
    };
  } catch (error) {
    console.error("Error loading payments:", error);
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }
};
