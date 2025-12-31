// pages/protected/dashboard/utilities/index.tsx
import { useState, useEffect, useCallback } from "react";
import type { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Zap,
  Droplets,
  Flame,
  Wifi,
  Link2,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronRight,
  Trash,
  ShieldCheck,
  Loader2,
  Lock,
  FileText,
  ArrowRight,
  AlertCircle,
  Globe,
  Database,
} from "lucide-react";

import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UtilityLink, UtilityAccountResponse } from "@/interfaces/utilities";
import { getUtilityIconMeta, mapApiToUtilityLink } from "@/utils/utilities";

// ------------------------------------------------------
// Enhanced Status Types
// ------------------------------------------------------

type LinkingPhase =
  | "IDLE"
  | "PENDING"
  | "INITIALIZING"
  | "BROWSER_STARTING"
  | "NAVIGATING"
  | "AUTHENTICATING"
  | "AUTH_CHECKING"
  | "NEEDS_2FA"
  | "VERIFYING_2FA"
  | "AUTHENTICATED"
  | "SCRAPING"
  | "SYNCING"
  | "SUCCESS"
  | "FAILED";

interface PhaseInfo {
  label: string;
  description: string;
  icon: any;
}

const PHASE_INFO: Record<LinkingPhase, PhaseInfo> = {
  IDLE: {
    label: "Ready",
    description: "Ready to begin linking",
    icon: Link2,
  },
  PENDING: {
    label: "Queued",
    description: "Your request is queued and waiting for an available worker",
    icon: Loader2,
  },
  INITIALIZING: {
    label: "Initializing",
    description: "Setting up secure session",
    icon: ShieldCheck,
  },
  BROWSER_STARTING: {
    label: "Starting Browser",
    description: "Launching secure browser environment",
    icon: Globe,
  },
  NAVIGATING: {
    label: "Connecting",
    description: "Navigating to PG&E login portal",
    icon: ArrowRight,
  },
  AUTHENTICATING: {
    label: "Logging In",
    description: "Submitting your credentials securely",
    icon: Lock,
  },
  AUTH_CHECKING: {
    label: "Verifying",
    description: "Checking authentication status",
    icon: ShieldCheck,
  },
  NEEDS_2FA: {
    label: "Verification Required",
    description: "PG&E requires two-factor authentication",
    icon: ShieldCheck,
  },
  VERIFYING_2FA: {
    label: "Verifying Code",
    description: "Confirming your security code with PG&E",
    icon: ShieldCheck,
  },
  AUTHENTICATED: {
    label: "Access Granted",
    description: "Successfully authenticated - accessing dashboard",
    icon: CheckCircle2,
  },
  SCRAPING: {
    label: "Reading Bill Data",
    description: "Extracting current balance and due date",
    icon: FileText,
  },
  SYNCING: {
    label: "Syncing",
    description: "Saving bill details to your account",
    icon: Database,
  },
  SUCCESS: {
    label: "Complete",
    description: "Your utility account is now linked",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Connection Failed",
    description: "Unable to complete linking process",
    icon: AlertCircle,
  },
};

/**
 * Parse backend status message to determine frontend phase
 */
function parseBackendStatus(
  status: string,
  lastError: string | null
): LinkingPhase {
  // Terminal states
  if (status === "SUCCESS") return "SUCCESS";
  if (status === "FAILED") return "FAILED";
  if (status === "NEEDS_2FA") return "NEEDS_2FA";
  if (status === "PENDING") return "PENDING";

  console.log("parseBackendStatus: ", status, lastError);

  // Parse progress messages from lastError field
  if (status === "RUNNING" && lastError) {
    const msg = lastError.toLowerCase();
    console.log("lastError: ", msg);

    // Check for progress indicators
    if (msg.includes("[progress]")) {
      if (msg.includes("initializing")) return "INITIALIZING";
      if (msg.includes("starting secure browser")) return "BROWSER_STARTING";
      if (msg.includes("navigating")) return "NAVIGATING";
      if (
        msg.includes("submitting login") ||
        msg.includes("submitting credentials")
      )
        return "AUTHENTICATING";
      if (msg.includes("checking authentication")) return "AUTH_CHECKING";
      if (msg.includes("verifying security code")) return "VERIFYING_2FA";
      if (msg.includes("authenticated") || msg.includes("accessing dashboard"))
        return "AUTHENTICATED";
      if (msg.includes("extracting") || msg.includes("reading bill"))
        return "SCRAPING";
      if (msg.includes("syncing") || msg.includes("saving")) return "SYNCING";
      if (msg.includes("complete")) return "SUCCESS";
    }
  }

  // Default RUNNING state
  return "INITIALIZING";
}

/**
 * Extract user-friendly message from backend
 */
function extractProgressMessage(lastError: string | null): string | null {
  if (!lastError) return null;

  // Remove [PROGRESS] prefix if present
  const cleaned = lastError.replace(/^\[PROGRESS\]\s*/i, "");
  return cleaned || null;
}

// ------------------------------------------------------
// Enhanced Linking Session Component
// ------------------------------------------------------

interface LinkingSessionProps {
  phase: LinkingPhase;
  progressMessage: string | null;
  twoFactorCode: string;
  onTwoFactorChange: (code: string) => void;
  onTwoFactorSubmit: () => void;
  lastError?: string | null;
  elapsedTime: number;
}

function LinkingSession({
  phase,
  progressMessage,
  twoFactorCode,
  onTwoFactorChange,
  onTwoFactorSubmit,
  lastError,
  elapsedTime,
}: LinkingSessionProps) {
  const info = PHASE_INFO[phase];
  const Icon = info.icon;

  const getProgress = () => {
    const progressMap: Record<LinkingPhase, number> = {
      IDLE: 0,
      PENDING: 5,
      INITIALIZING: 10,
      BROWSER_STARTING: 20,
      NAVIGATING: 30,
      AUTHENTICATING: 45,
      AUTH_CHECKING: 55,
      NEEDS_2FA: 60,
      VERIFYING_2FA: 70,
      AUTHENTICATED: 75,
      SCRAPING: 85,
      SYNCING: 95,
      SUCCESS: 100,
      FAILED: 0,
    };
    return progressMap[phase] || 0;
  };

  const isActive = !["IDLE", "SUCCESS", "FAILED"].includes(phase);
  const isWaitingForUser = phase === "NEEDS_2FA";
  const isTerminal = ["SUCCESS", "FAILED"].includes(phase);

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 border-2 border-dashed border-blue-100 rounded-2xl bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-md w-full space-y-6">
        {/* Progress Bar */}
        {isActive && (
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-700 ease-out rounded-full"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        )}

        {/* Status Icon */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {isActive && !isWaitingForUser && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-blue-50 w-20 h-20" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin w-20 h-20" />
              </>
            )}

            <div
              className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-colors ${
                phase === "SUCCESS"
                  ? "bg-green-100"
                  : phase === "FAILED"
                  ? "bg-red-100"
                  : isWaitingForUser
                  ? "bg-blue-100"
                  : "bg-transparent"
              }`}
            >
              <Icon
                className={`w-10 h-10 ${
                  phase === "SUCCESS"
                    ? "text-green-600"
                    : phase === "FAILED"
                    ? "text-red-600"
                    : "text-blue-600"
                } ${isActive && !isWaitingForUser ? "animate-pulse" : ""}`}
              />
            </div>
          </div>

          {/* Phase Title */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {info.label}
            </h3>
            <p className="text-sm text-slate-600 max-w-xs">
              {progressMessage || info.description}
            </p>

            {/* Elapsed Time */}
            {isActive && !isTerminal && (
              <p className="text-xs text-slate-400 font-mono">
                Elapsed: {Math.floor(elapsedTime / 1000)}s
              </p>
            )}
          </div>
        </div>

        {/* 2FA Input Section */}
        {phase === "NEEDS_2FA" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                  <p className="font-medium">Check your phone</p>
                  <p className="text-slate-600">
                    {progressMessage ||
                      "PG&E sent a 6-digit code to your registered phone number"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2 w-full">
                <Input
                  value={twoFactorCode}
                  onChange={(e) => onTwoFactorChange(e.target.value)}
                  placeholder="000000"
                  className="h-12 text-center text-xl tracking-[0.5em] font-mono border-2 focus:border-blue-500"
                  maxLength={6}
                  autoFocus
                />
                <Button
                  onClick={onTwoFactorSubmit}
                  disabled={twoFactorCode.length < 6}
                  className="h-12 px-6 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95 min-w-[100px]"
                >
                  Verify
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Enter the code to continue linking your account
              </p>
            </div>
          </div>
        )}

        {/* Processing 2FA Feedback */}
        {phase === "VERIFYING_2FA" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-700">
                {progressMessage || "Verifying your code with PG&E servers..."}
              </p>
            </div>
          </div>
        )}

        {/* Active Progress Indicator */}
        {isActive &&
          !isWaitingForUser &&
          !isTerminal &&
          phase !== "VERIFYING_2FA" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>Active session in progress</span>
              </div>

              {/* Progress details */}
              <div className="text-xs text-slate-400 bg-slate-50 rounded p-2 border border-slate-200">
                {progressMessage || "Processing..."}
              </div>
            </div>
          )}

        {/* Error Message */}
        {phase === "FAILED" && lastError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-900">
                  Link attempt failed
                </p>
                <p className="text-xs text-red-700">
                  {lastError.replace(/^\[PROGRESS\]\s*/i, "")}
                </p>
                <p className="text-xs text-red-600 mt-2">Common issues:</p>
                <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                  <li>Incorrect username or password</li>
                  <li>Account locked due to too many attempts</li>
                  <li>PG&E website maintenance</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {phase === "SUCCESS" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-900">
                  Account successfully linked!
                </p>
                <p className="text-xs text-green-700">
                  {progressMessage ||
                    "Your latest bill has been synced and participants have been created."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------
// Page wrapper
// ------------------------------------------------------

export default function UtilitiesPage() {
  return (
    <DashboardLayout>
      <main className="mx-auto space-y-8">
        <UtilitiesContent />
      </main>
    </DashboardLayout>
  );
}

// ------------------------------------------------------
// Main utilities content
// ------------------------------------------------------

function UtilitiesContent() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [utilities, setUtilities] = useState<UtilityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUtility, setExpandedUtility] = useState<string | null>(null);
  const [editingUtility, setEditingUtility] = useState<string | null>(null);

  // Enhanced state tracking
  const [jobStatus, setJobStatus] = useState("IDLE");
  const [linkingPhase, setLinkingPhase] = useState<LinkingPhase>("IDLE");
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    accountHolderName: "",
    email: "",
    password: "",
    confirmPassword: "",
    accountNumber: "",
  });

  // Add Utility modal state
  const [showAddUtilityModal, setShowAddUtilityModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [selectedUtilityType, setSelectedUtilityType] = useState<{
    name: string;
    icon: any;
    iconColor: string;
    iconBg: string;
  } | null>(null);

  const utilityTypes = [
    { name: "Electricity", icon: Zap, iconColor: "#F59E0B", iconBg: "#FEF3C7" },
    { name: "Water", icon: Droplets, iconColor: "#3B82F6", iconBg: "#DBEAFE" },
    { name: "Gas", icon: Flame, iconColor: "#EF4444", iconBg: "#FEE2E2" },
    { name: "Internet", icon: Wifi, iconColor: "#8B5CF6", iconBg: "#EDE9FE" },
    { name: "Waste", icon: Trash, iconColor: "#10B981", iconBg: "#D1FAE5" },
  ];

  const companiesByUtility: Record<
    string,
    Array<{ name: string; website: string }>
  > = {
    Electricity: [
      { name: "Pacific Gas & Electric", website: "https://www.pge.com" },
      { name: "Southern California Edison", website: "https://www.sce.com" },
      { name: "San Diego Gas & Electric", website: "https://www.sdge.com" },
      {
        name: "Los Angeles Department of Water and Power",
        website: "https://www.ladwp.com",
      },
    ],
    Water: [
      {
        name: "City of San Luis Obispo, CA",
        website: "https://www.slocity.org",
      },
      {
        name: "Los Angeles Department of Water and Power",
        website: "https://www.ladwp.com",
      },
      {
        name: "San Diego Water Department",
        website: "https://www.sandiego.gov/water",
      },
      {
        name: "East Bay Municipal Utility District",
        website: "https://www.ebmud.com",
      },
    ],
    Gas: [
      { name: "SoCalGas", website: "https://www.socalgas.com" },
      { name: "Pacific Gas & Electric", website: "https://www.pge.com" },
      { name: "San Diego Gas & Electric", website: "https://www.sdge.com" },
      { name: "Southwest Gas", website: "https://www.swgas.com" },
    ],
    Internet: [
      { name: "Spectrum Internet", website: "https://www.spectrum.com" },
      { name: "AT&T Internet", website: "https://www.att.com" },
      { name: "Xfinity", website: "https://www.xfinity.com" },
      { name: "Frontier", website: "https://www.frontier.com" },
    ],
    Waste: [
      { name: "San Luis Garbage", website: "https://www.sanluisgarbage.com" },
      { name: "Waste Management", website: "https://www.wm.com" },
      {
        name: "Republic Services",
        website: "https://www.republicservices.com",
      },
      { name: "Recology", website: "https://www.recology.com" },
      { name: "Athens Services", website: "https://www.athensservices.com" },
    ],
  };

  const fetchData = useCallback(async () => {
    try {
      const userRes = await fetch("/api/user/me");
      if (userRes.ok) {
        const user = await userRes.json();
        setCurrentUserId(user.id);
      }

      const res = await fetch("/api/utilities");
      if (!res.ok) throw new Error("Failed to load utilities");

      const data: { utilityAccounts: UtilityAccountResponse[] } =
        await res.json();
      setUtilities(data.utilityAccounts.map(mapApiToUtilityLink));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load utility accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Elapsed time counter
  useEffect(() => {
    if (!isPolling || linkingPhase === "IDLE") return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - sessionStartTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isPolling, sessionStartTime, linkingPhase]);

  // Enhanced polling with backend message parsing
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPolling && expandedUtility) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/utilities/${expandedUtility}/job-status`
          );
          if (!res.ok) return;

          const data = await res.json();
          const backendStatus = data.status;
          const error = data.lastError;

          // Parse phase from backend
          const newPhase = parseBackendStatus(backendStatus, error);

          // Extract progress message
          const message = extractProgressMessage(error);
          setProgressMessage(message);

          // Only update actual errors (not progress messages)
          if (backendStatus === "FAILED") {
            setLastError(error);
          }

          // Terminal states
          if (backendStatus === "SUCCESS") {
            setLinkingPhase("SUCCESS");
            setIsPolling(false);
            toast.success("Account Linked!");
            await fetchData();
            return;
          }

          if (backendStatus === "FAILED") {
            setLinkingPhase("FAILED");
            setIsPolling(false);
            toast.error("Linking failed. Please check your credentials.");
            return;
          }

          // Prevent 2FA state from reverting after code submission
          if (
            linkingPhase === "VERIFYING_2FA" &&
            backendStatus === "NEEDS_2FA"
          ) {
            return;
          }

          setLinkingPhase(newPhase);
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, expandedUtility, fetchData, linkingPhase]);

  // ------------------------------------------------------
  // Handlers
  // ------------------------------------------------------

  const handleToggleExpand = (utilityId: string) => {
    if (expandedUtility === utilityId) {
      setExpandedUtility(null);
      setEditingUtility(null);
      return;
    }

    setExpandedUtility(utilityId);
    setEditingUtility(null);

    const utility = utilities.find((u) => u.id === utilityId);
    if (utility && utility.isLinked) {
      setFormData({
        accountHolderName: utility.accountHolderName,
        email: utility.email,
        password: "",
        confirmPassword: "",
        accountNumber: utility.accountNumber,
      });
    } else {
      setFormData({
        accountHolderName: "",
        email: "",
        password: "",
        confirmPassword: "",
        accountNumber: "",
      });
    }
  };

  // Submit 2FA Code
  const handleTwoFactorSubmit = async () => {
    try {
      await fetch(`/api/utilities/${expandedUtility}/job-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorCode }),
      });
      toast.info("Submitting code...");
      setJobStatus("RUNNING"); // Optimistic UI update
    } catch (err) {
      toast.error("Failed to submit 2FA code");
    }
  };

  const handleLinkUtility = async () => {
    if (
      !formData.accountHolderName ||
      !formData.email ||
      !formData.password ||
      !formData.accountNumber
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!expandedUtility) return;

    try {
      const res = await fetch(`/api/utilities/${expandedUtility}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: formData.accountHolderName,
          loginEmail: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          accountNumber: formData.accountNumber,
        }),
      });

      if (res.ok) {
        setIsPolling(true); // Start watching the job status
        setSessionStartTime(Date.now());
        setElapsedTime(0);
        setLinkingPhase("PENDING");
        setLastError(null);
      }

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || "Failed to link utility");
      }

      // Update local non-sensitive fields to match what we just submitted
      setUtilities((prev) =>
        prev.map((u) =>
          u.id === expandedUtility
            ? {
                ...u,
                accountHolderName: formData.accountHolderName,
                email: formData.email,
                accountNumber: formData.accountNumber,
                // isLinked stays as DB says (likely false until worker verifies)
              }
            : u
        )
      );

      toast.success(
        body.message || "Credentials saved. Link attempt will proceed."
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to link utility");
    }
  };

  const handleUnlinkUtility = async () => {
    if (!expandedUtility) return;

    try {
      const res = await fetch(`/api/utilities/${expandedUtility}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink" }),
      });

      const body: UtilityAccountResponse | { error?: string } = await res
        .json()
        .catch(() => ({} as any));

      if (!res.ok) {
        throw new Error((body as any).error || "Failed to unlink utility");
      }

      const updated = mapApiToUtilityLink(body as UtilityAccountResponse);
      setUtilities((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );

      toast.success("Utility account unlinked successfully");
      setExpandedUtility(null);
      setEditingUtility(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to unlink utility");
    }
  };

  const handleEditUtility = (utilityId: string) => {
    setEditingUtility(utilityId);
    const utility = utilities.find((u) => u.id === utilityId);
    if (utility) {
      setFormData({
        accountHolderName: utility.accountHolderName,
        email: utility.email,
        password: "",
        confirmPassword: "",
        accountNumber: utility.accountNumber,
      });
    }
  };

  const handleSaveEdit = async () => {
    if (
      !formData.accountHolderName ||
      !formData.email ||
      !formData.accountNumber
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!editingUtility) return;

    try {
      const res = await fetch(`/api/utilities/${editingUtility}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: formData.accountHolderName,
          email: formData.email,
          accountNumber: formData.accountNumber,
          // ownerUserId can be added here later if you build "change owner" UI
        }),
      });

      const body: UtilityAccountResponse | { error?: string } = await res
        .json()
        .catch(() => ({} as any));

      if (!res.ok) {
        throw new Error((body as any).error || "Failed to update utility");
      }

      const updated = mapApiToUtilityLink(body as UtilityAccountResponse);
      setUtilities((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );

      toast.success("Utility account updated successfully!");
      setEditingUtility(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update utility");
    }
  };

  const handleCancelEdit = () => {
    setEditingUtility(null);
    if (expandedUtility) {
      const utility = utilities.find((u) => u.id === expandedUtility);
      if (utility) {
        setFormData({
          accountHolderName: utility.accountHolderName,
          email: utility.email,
          password: "",
          confirmPassword: "",
          accountNumber: utility.accountNumber,
        });
      }
    }
  };

  const handleRemoveUtility = async (utilityId: string) => {
    try {
      const res = await fetch(`/api/utilities/${utilityId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to remove utility");
      }

      setUtilities((prev) => prev.filter((u) => u.id !== utilityId));
      toast.success("Utility account removed successfully");

      if (expandedUtility === utilityId) {
        setExpandedUtility(null);
        setEditingUtility(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove utility");
    }
  };

  const handleAddUtility = () => {
    setShowAddUtilityModal(true);
  };

  const handleSelectUtilityType = (utilityType: {
    name: string;
    icon: any;
    iconColor: string;
    iconBg: string;
  }) => {
    setSelectedUtilityType(utilityType);
    setShowAddUtilityModal(false);
    setShowCompanyModal(true);
  };

  const handleSelectCompany = async (company: {
    name: string;
    website: string;
  }) => {
    if (!selectedUtilityType) return;

    try {
      const res = await fetch("/api/utilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedUtilityType.name, // "Electricity", etc
          provider: company.name,
          providerWebsite: company.website,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create utility");
      }

      const created: UtilityAccountResponse = await res.json();
      const mapped = mapApiToUtilityLink(created);

      setUtilities((prev) => [...prev, mapped]);
      setExpandedUtility(mapped.id);

      setFormData({
        accountHolderName: "",
        email: "",
        password: "",
        confirmPassword: "",
        accountNumber: "",
      });
      setShowCompanyModal(false);
      setSelectedUtilityType(null);

      toast.success(`${mapped.type} utility added`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add utility");
    }
  };

  // ------------------------------------------------------
  // JSX
  // ------------------------------------------------------

  if (loading) {
    return <div className="text-sm text-gray-500">Loading utilities…</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link2 className="h-7 w-7" style={{ color: "#00B948" }} />
            <h1
              className="text-[28px] text-gray-900"
              style={{ fontWeight: 600 }}
            >
              Link Utility Accounts
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            Connect your utility accounts to automatically sync bills and
            payments.
          </p>
        </div>

        {/* Utilities table */}
        <Card className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_1fr] gap-4 px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
              UTILITY
            </div>
            <div className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
              LINK STATUS
            </div>
            <div
              className="text-xs text-gray-500 text-right"
              style={{ fontWeight: 600 }}
            >
              DETAILS
            </div>
          </div>

          {/* Rows */}
          <div>
            {utilities.map((utility, index) => {
              const Icon = utility.icon;
              const isExpanded = expandedUtility === utility.id;
              const isOwner =
                !!currentUserId && utility.ownerUserId === currentUserId;

              return (
                <div key={utility.id}>
                  {/* Row */}
                  <div
                    className={`grid grid-cols-[2fr_2fr_1fr] gap-4 px-6 py-5 ${
                      index < utilities.length - 1 && !isExpanded
                        ? "border-b border-gray-200"
                        : ""
                    } ${
                      isExpanded ? "bg-gray-50" : "hover:bg-gray-50"
                    } transition-colors`}
                  >
                    {/* Utility name */}
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                        style={{ backgroundColor: utility.iconBg }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: utility.iconColor }}
                        />
                      </div>
                      <span
                        className="text-base text-gray-900"
                        style={{ fontWeight: 600 }}
                      >
                        {utility.type}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                      {utility.isLinked ? (
                        <div className="flex items-center gap-2">
                          <LinkIcon
                            className="h-4 w-4"
                            style={{ color: "#00B948" }}
                          />
                          <span
                            className="text-sm"
                            style={{ color: "#00B948", fontWeight: 600 }}
                          >
                            Linked
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-red-500" />
                          <span
                            className="text-sm text-red-500"
                            style={{ fontWeight: 600 }}
                          >
                            Not Linked
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleToggleExpand(utility.id)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-white">
                      {/* 1. Success Banner (Only show if not currently polling) */}
                      {utility.isLinked && !isPolling && (
                        <div
                          className="mb-4 px-3 py-2 rounded-lg flex items-center gap-2"
                          style={{
                            backgroundColor: "#D1FAE5",
                            border: "1px solid #A7F3D0",
                          }}
                        >
                          <CheckCircle2
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: "#00B948" }}
                          />
                          <p className="text-sm text-gray-900">
                            This account information has been accepted and we
                            are able to access your account!
                          </p>
                        </div>
                      )}

                      {/* 2. INTERACTIVE SESSION MODE (Shows when isPolling is true) */}
                      {isPolling ? (
                        <LinkingSession
                          phase={linkingPhase}
                          progressMessage={progressMessage}
                          twoFactorCode={twoFactorCode}
                          onTwoFactorChange={setTwoFactorCode}
                          onTwoFactorSubmit={handleTwoFactorSubmit}
                          lastError={lastError}
                          elapsedTime={elapsedTime}
                        />
                      ) : (
                        /* 3. STANDARD UI (Shows when NOT polling) */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Provider info */}
                          <Card className="rounded-lg border border-gray-200 bg-white p-4">
                            <h3
                              className="text-base text-gray-900 mb-2 text-center"
                              style={{ fontWeight: 600 }}
                            >
                              {utility.provider}
                            </h3>

                            <div className="space-y-3 text-sm text-gray-700">
                              <p className="text-center">
                                Visit the {utility.provider} website{" "}
                                <a
                                  href={utility.providerWebsite ?? ""}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#00B948] hover:underline"
                                  style={{ fontWeight: 600 }}
                                >
                                  here
                                </a>{" "}
                                to set up service.
                              </p>

                              <div className="text-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p
                                  className="text-sm"
                                  style={{ fontWeight: 600 }}
                                >
                                  Setup Your Account Online
                                </p>
                              </div>

                              <p className="text-center text-xs">
                                After setting up service, create an online
                                account on their website. You will need a recent
                                bill to fill in some of the information.
                              </p>
                            </div>
                          </Card>

                          {/* Link / edit form */}
                          <Card className="rounded-lg border border-gray-200 bg-white p-4">
                            <h3
                              className="text-base text-gray-900 mb-4 text-center"
                              style={{ fontWeight: 600 }}
                            >
                              Link Utility
                            </h3>

                            <div className="space-y-3">
                              {/* Account holder */}
                              <div>
                                <Label
                                  className="text-sm text-gray-700 mb-1 block"
                                  style={{ fontWeight: 500 }}
                                >
                                  Account Holder Name
                                </Label>
                                <Input
                                  type="text"
                                  value={formData.accountHolderName}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      accountHolderName: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    utility.isLinked ? "Alex Chen" : ""
                                  }
                                  className="h-10 rounded-lg border-gray-300"
                                  disabled={
                                    utility.isLinked &&
                                    editingUtility !== utility.id
                                  }
                                />
                              </div>

                              {/* Email */}
                              <div>
                                <Label
                                  className="text-sm text-gray-700 mb-1 block"
                                  style={{ fontWeight: 500 }}
                                >
                                  Email Address
                                </Label>
                                <Input
                                  type="email"
                                  value={
                                    isOwner
                                      ? formData.email
                                      : "••••••@••••••.com"
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      email: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    utility.isLinked
                                      ? "alec.sanchez@email.com"
                                      : ""
                                  }
                                  className="h-10 rounded-lg border-gray-300"
                                  disabled={
                                    utility.isLinked &&
                                    (editingUtility !== utility.id || !isOwner)
                                  }
                                />
                              </div>

                              {/* Password Fields */}
                              <div>
                                <Label
                                  className="text-sm text-gray-700 mb-1 block"
                                  style={{ fontWeight: 500 }}
                                >
                                  Password{" "}
                                  {editingUtility === utility.id && isOwner && (
                                    <span className="text-gray-500 text-xs">
                                      (leave blank to keep current)
                                    </span>
                                  )}
                                </Label>
                                <Input
                                  type="password"
                                  value={
                                    isOwner ? formData.password : "••••••••"
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      password: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    utility.isLinked ? "••••••••" : ""
                                  }
                                  className="h-10 rounded-lg border-gray-300"
                                  disabled={
                                    utility.isLinked &&
                                    (editingUtility !== utility.id || !isOwner)
                                  }
                                />
                              </div>

                              <div>
                                <Label
                                  className="text-sm text-gray-700 mb-1 block"
                                  style={{ fontWeight: 500 }}
                                >
                                  Confirm Password{" "}
                                  {editingUtility === utility.id && isOwner && (
                                    <span className="text-gray-500 text-xs">
                                      (leave blank to keep current)
                                    </span>
                                  )}
                                </Label>
                                <Input
                                  type="confirmPassword"
                                  value={
                                    isOwner
                                      ? formData.confirmPassword
                                      : "••••••••"
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      confirmPassword: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    utility.isLinked ? "••••••••" : ""
                                  }
                                  className="h-10 rounded-lg border-gray-300"
                                  disabled={
                                    utility.isLinked &&
                                    (editingUtility !== utility.id || !isOwner)
                                  }
                                />
                              </div>

                              <div>
                                <Label
                                  className="text-sm text-gray-700 mb-1 block"
                                  style={{ fontWeight: 500 }}
                                >
                                  Account Number
                                </Label>
                                <Input
                                  type="text"
                                  value={
                                    isOwner
                                      ? formData.accountNumber
                                      : "****-****"
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      accountNumber: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    utility.isLinked ? "055873-000" : ""
                                  }
                                  className="h-10 rounded-lg border-gray-300"
                                  disabled={
                                    utility.isLinked &&
                                    (editingUtility !== utility.id || !isOwner)
                                  }
                                />
                              </div>

                              {/* Actions (Buttons) */}
                              <div className="pt-1 space-y-2">
                                {utility.isLinked &&
                                editingUtility !== utility.id ? (
                                  isOwner ? (
                                    <div className="space-y-2">
                                      <Button
                                        onClick={() =>
                                          handleEditUtility(utility.id)
                                        }
                                        variant="outline"
                                        className="w-full h-10 rounded-lg border-gray-300 text-gray-700"
                                        style={{ fontWeight: 600 }}
                                      >
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Edit Account
                                      </Button>
                                      <Button
                                        onClick={handleUnlinkUtility}
                                        variant="outline"
                                        className="w-full h-10 rounded-lg border-red-300 text-red-600 hover:bg-red-50"
                                        style={{ fontWeight: 600 }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Unlink Account
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2 text-center italic text-xs text-gray-400">
                                      Only {utility.accountHolderName} can
                                      modify this link.
                                    </div>
                                  )
                                ) : editingUtility === utility.id ? (
                                  <div className="space-y-2">
                                    <Button
                                      onClick={handleSaveEdit}
                                      className="w-full h-10 rounded-lg bg-[#00B948] hover:bg-[#00A040]"
                                      style={{ fontWeight: 600 }}
                                    >
                                      <Save className="h-4 w-4 mr-2" />
                                      Save Changes
                                    </Button>
                                    <Button
                                      onClick={handleCancelEdit}
                                      variant="outline"
                                      className="w-full h-10 rounded-lg border-gray-300 text-gray-700"
                                      style={{ fontWeight: 600 }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <Button
                                      onClick={handleLinkUtility}
                                      className="w-full h-10 rounded-lg bg-[#00B948] hover:bg-[#00A040]"
                                      style={{ fontWeight: 600 }}
                                      disabled={isPolling}
                                    >
                                      Link Account
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        handleRemoveUtility(utility.id)
                                      }
                                      variant="outline"
                                      className="w-full h-10 rounded-lg border-gray-300 text-gray-600"
                                      style={{ fontWeight: 600 }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Add utility button */}
        <div className="flex justify-center">
          <Button
            onClick={handleAddUtility}
            size="lg"
            className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg px-8"
            style={{ fontWeight: 600 }}
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Utility
          </Button>
        </div>

        {/* Select utility type modal */}
        <Dialog
          open={showAddUtilityModal}
          onOpenChange={setShowAddUtilityModal}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl" style={{ fontWeight: 600 }}>
                Select Utility Type
              </DialogTitle>
              <DialogDescription>
                Choose the type of utility account you want to add.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {utilityTypes.map((utilityType) => {
                const Icon = utilityType.icon;
                return (
                  <button
                    key={utilityType.name}
                    onClick={() => handleSelectUtilityType(utilityType)}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#00B948] hover:bg-gray-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: utilityType.iconBg }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: utilityType.iconColor }}
                        />
                      </div>
                      <span
                        className="text-base text-gray-900"
                        style={{ fontWeight: 600 }}
                      >
                        {utilityType.name}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#00B948]" />
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Select provider modal */}
        <Dialog open={showCompanyModal} onOpenChange={setShowCompanyModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl" style={{ fontWeight: 600 }}>
                Select Provider
              </DialogTitle>
              <DialogDescription>
                Choose your {selectedUtilityType?.name} provider from the list.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4 max-h-[400px] overflow-y-auto">
              {selectedUtilityType &&
                companiesByUtility[selectedUtilityType.name]?.map((company) => (
                  <button
                    key={company.name}
                    onClick={() => handleSelectCompany(company)}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#00B948] hover:bg-gray-50 transition-all group text-left"
                  >
                    <span
                      className="text-base text-gray-900"
                      style={{ fontWeight: 500 }}
                    >
                      {company.name}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#00B948] flex-shrink-0" />
                  </button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ------------------------------------------------------
// Auth gate (same pattern as household page)
// ------------------------------------------------------

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
  return { props: {} };
};
