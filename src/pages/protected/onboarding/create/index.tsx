import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";

export default function CreateHouseholdPage() {
  const { update } = useSession();
  const [address, setAddress] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [roommates, setRoommates] = useState([{ name: "", contact: "" }]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const addRoommate = () => {
    setRoommates([...roommates, { name: "", contact: "" }]);
  };

  const removeRoommate = (index: number) => {
    setRoommates(roommates.filter((_, i) => i !== index));
  };

  const updateRoommate = (
    index: number,
    field: "name" | "contact",
    value: string
  ) => {
    const updated = [...roommates];
    updated[index][field] = value;
    setRoommates(updated);
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/household/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          name: householdName || address,
          roommates: roommates.filter((r) => r.name || r.contact),
        }),
      });

      if (!response.ok) throw new Error("Failed to create household");

      await update({ hasCompletedOnboarding: true });
      setShowSuccess(true);
    } catch (error) {
      console.error("Error creating household:", error);
      alert("Failed to create household. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-12 max-w-md w-full text-center">
          <div className="bg-green-500 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Household created successfully!
          </h2>

          <p className="text-gray-600 mb-8">
            Roommates will receive their invites.
          </p>

          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-green-500 rounded-lg w-12 h-12 flex items-center justify-center">
              <span className="text-white text-xl font-bold">B</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Bilvo</h1>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Create Your Household
          </h2>

          <div className="space-y-6">
            {/* Household Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Household Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (!householdName) {
                    setHouseholdName(e.target.value);
                  }
                }}
                placeholder="123 Main Street, Apt 4B"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Household Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Household Name
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Auto-suggested from address"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Invite Roommates */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Invite Roommates
              </label>
              <div className="space-y-3">
                {roommates.map((roommate, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      value={roommate.name}
                      onChange={(e) =>
                        updateRoommate(index, "name", e.target.value)
                      }
                      placeholder="Name"
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={roommate.contact}
                      onChange={(e) =>
                        updateRoommate(index, "contact", e.target.value)
                      }
                      placeholder="Email or phone"
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    {roommates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoommate(index)}
                        className="p-3 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addRoommate}
                className="mt-3 flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add another roommate
              </button>
            </div>

            <button
              type="button"
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Invite a parent or payer (optional)
            </button>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !address}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? "Creating..." : "Create Household →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
