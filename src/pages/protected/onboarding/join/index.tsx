import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";

export default function JoinHouseholdPage() {
  const { update } = useSession();
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [joinedInfo, setJoinedInfo] = useState<{
    name?: string;
    address?: string;
    memberCount?: number;
  } | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length <= 6) {
      setInviteCode(value);
      setError("");
    }
  };

  const handleJoin = async () => {
    if (!inviteCode || inviteCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/household/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to join household");
        return;
      }

      // Refresh JWT so middleware sees hasCompletedOnboarding = true
      await update({ hasCompletedOnboarding: true });

      // Show success UI (optionally display household info)
      setJoinedInfo({
        name: data?.household?.name,
        address: data?.household?.address,
        memberCount: data?.household?.memberCount,
      });
      setShowSuccess(true);
    } catch (err) {
      console.error("Error joining household:", err);
      setError("An error occurred. Please try again.");
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
            Joined household successfully!
          </h2>

          {joinedInfo && (
            <p className="text-gray-600 mb-8">
              {joinedInfo.name ? (
                <span className="font-semibold">{joinedInfo.name}</span>
              ) : (
                "Household"
              )}{" "}
              {joinedInfo.address ? <>• {joinedInfo.address}</> : null}
              {typeof joinedInfo.memberCount === "number" ? (
                <> • {joinedInfo.memberCount} members</>
              ) : null}
            </p>
          )}

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
      <div className="max-w-md w-full">
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

          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Join a Household
          </h2>
          <p className="text-gray-600 mb-8">
            Enter your invitation code to join your household.
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Invitation Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={handleCodeChange}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className={`w-full px-4 py-3 bg-gray-50 border ${
                  error ? "border-red-500" : "border-gray-200"
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl font-mono tracking-wider uppercase`}
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <button
              onClick={handleJoin}
              disabled={isLoading || inviteCode.length !== 6}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? "Joining..." : "Join Household →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
