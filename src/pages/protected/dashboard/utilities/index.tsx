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
  RefreshCw,
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
import { ActionBanner } from "@/components/common/ActionBanner";

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
  IDLE: { label: "Ready", description: "Ready to begin linking", icon: Link2 },
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
    label: "Starting Session",
    description: "Launching secure session",
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
  lastError: string | null,
): LinkingPhase {
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

  return "INITIALIZING";
}

/**
 * Extract user-friendly message from backend
 */
function extractProgressMessage(lastError: string | null): string | null {
  if (!lastError) return null;
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
    <div className="flex flex-col items-center justify-center py-6 sm:py-8 px-4 sm:px-6 border-2 border-dashed border-blue-100 rounded-2xl bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-md w-full space-y-4 sm:space-y-6">
        {isActive && (
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-700 ease-out rounded-full"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {isActive && !isWaitingForUser && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-blue-50 w-16 sm:w-20 h-16 sm:h-20" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin w-16 sm:w-20 h-16 sm:h-20" />
              </>
            )}

            <div
              className={`relative flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 rounded-full transition-colors ${
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
                className={`w-8 sm:w-10 h-8 sm:h-10 ${
                  phase === "SUCCESS"
                    ? "text-green-600"
                    : phase === "FAILED"
                      ? "text-red-600"
                      : "text-blue-600"
                } ${isActive && !isWaitingForUser ? "animate-pulse" : ""}`}
              />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              {info.label}
            </h3>
            <p className="text-sm text-slate-600 max-w-xs px-2">
              {progressMessage || info.description}
            </p>
            {isActive && !isTerminal && (
              <p className="text-xs text-slate-400 font-mono">
                Elapsed: {Math.floor(elapsedTime / 1000)}s
              </p>
            )}
          </div>
        </div>

        {phase === "NEEDS_2FA" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 space-y-2">
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
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Input
                  value={twoFactorCode}
                  onChange={(e) => onTwoFactorChange(e.target.value)}
                  placeholder="000000"
                  className="h-12 sm:h-12 text-center text-xl tracking-[0.5em] font-mono border-2 focus:border-blue-500"
                  maxLength={6}
                  autoFocus
                />
                <Button
                  onClick={onTwoFactorSubmit}
                  disabled={twoFactorCode.length < 6}
                  className="h-12 sm:h-12 w-full sm:w-auto px-6 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95 sm:min-w-[100px]"
                >
                  Verify
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center px-4">
                Enter the code to continue linking your account
              </p>
            </div>
          </div>
        )}

        {phase === "VERIFYING_2FA" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-700">
                {progressMessage || "Verifying your code with PG&E servers..."}
              </p>
            </div>
          </div>
        )}

        {isActive &&
          !isWaitingForUser &&
          !isTerminal &&
          phase !== "VERIFYING_2FA" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>Active session in progress</span>
              </div>
              <div className="text-xs text-slate-400 bg-slate-50 rounded p-2 border border-slate-200">
                {progressMessage || "Processing..."}
              </div>
            </div>
          )}

        {phase === "FAILED" && lastError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
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

        {phase === "SUCCESS" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
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

export async function ensureOwnerConnectOnboarding() {
  // 1) DB-only readiness (cheap)
  const stRes = await fetch("/api/payments/stripe/connect/status-from-db");
  if (!stRes.ok) {
    const body = await stRes.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to check Stripe Connect status");
  }
  const st = await stRes.json();
  if (st?.isReadyToReceive) return;

  const ensureRes = await fetch("/api/payments/stripe/connect/ensure-account", {
    method: "POST",
  });
  if (!ensureRes.ok) {
    const body = await ensureRes.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to create Stripe connected account");
  }

  const linkRes = await fetch("/api/payments/stripe/connect/account-link", {
    method: "POST",
  });
  if (!linkRes.ok) {
    const body = await linkRes.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to start Stripe onboarding");
  }
  const link = await linkRes.json();
  if (!link?.url) throw new Error("Stripe onboarding link missing url");
  window.location.href = link.url;
}

// ------------------------------------------------------
// Page wrapper
// ------------------------------------------------------

export default function UtilitiesPage() {
  return (
    <DashboardLayout>
      <main className="mx-auto space-y-6 sm:space-y-8">
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
  const [stripeReadyToReceive, setStripeReadyToReceive] = useState<
    boolean | null
  >(null);
  const [stripeCtaLoading, setStripeCtaLoading] = useState(false);

  // Enhanced state tracking - now supports multiple utilities syncing
  const [syncingUtilities, setSyncingUtilities] = useState<Set<string>>(
    new Set(),
  );
  const [utilityStates, setUtilityStates] = useState<
    Record<
      string,
      {
        phase: LinkingPhase;
        progressMessage: string | null;
        lastError: string | null;
        twoFactorCode: string;
        sessionStartTime: number;
        elapsedTime: number;
      }
    >
  >({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    accountHolderName: "",
    email: "",
    password: "",
    confirmPassword: "",
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

  const userOwnsAnyUtility =
    !!currentUserId && utilities.some((u) => u.ownerUserId === currentUserId);

  // Get count of linked utilities
  const linkedUtilitiesCount = utilities.filter(
    (u) => u.isLinked && u.ownerUserId === currentUserId,
  ).length;

  // [Keep all useCallback and useEffect hooks - unchanged except for spacing adjustments]
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
    refreshStripeConnectStatus();
    const onFocus = () => refreshStripeConnectStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Elapsed time counter - now works for multiple utilities
  useEffect(() => {
    const activeUtilities = Object.entries(utilityStates).filter(
      ([_, state]) => state.phase !== "IDLE",
    );
    if (activeUtilities.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setUtilityStates((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((id) => {
          if (updated[id].phase !== "IDLE") {
            updated[id] = {
              ...updated[id],
              elapsedTime: now - updated[id].sessionStartTime,
            };
          }
        });
        return updated;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [Object.keys(utilityStates).length]);

  // Enhanced polling - now handles multiple utilities simultaneously
  useEffect(() => {
    const intervals: Record<string, NodeJS.Timeout> = {};

    syncingUtilities.forEach((utilityId) => {
      intervals[utilityId] = setInterval(async () => {
        try {
          const res = await fetch(`/api/utilities/${utilityId}/job-status`);
          if (!res.ok) return;

          const data = await res.json();
          const backendStatus = data.status;
          const error = data.lastError;

          const newPhase = parseBackendStatus(backendStatus, error);
          const message = extractProgressMessage(error);

          setUtilityStates((prev) => ({
            ...prev,
            [utilityId]: {
              ...prev[utilityId],
              phase: newPhase,
              progressMessage: message,
              lastError:
                backendStatus === "FAILED" ? error : prev[utilityId]?.lastError,
            },
          }));

          // Terminal states
          if (backendStatus === "SUCCESS") {
            setSyncingUtilities((prev) => {
              const next = new Set(prev);
              next.delete(utilityId);
              return next;
            });
            toast.success(
              `${utilities.find((u) => u.id === utilityId)?.type} synced successfully!`,
            );
            await fetchData();
            await refreshStripeConnectStatus();
            return;
          }

          if (backendStatus === "FAILED") {
            setSyncingUtilities((prev) => {
              const next = new Set(prev);
              next.delete(utilityId);
              return next;
            });
            const errorMessage =
              error?.replace(/^\[PROGRESS\]\s*/i, "") || "Linking failed";
            toast.error(
              `${utilities.find((u) => u.id === utilityId)?.type}: ${errorMessage}`,
            );
            return;
          }

          // Prevent 2FA state from reverting after code submission
          const currentPhase = utilityStates[utilityId]?.phase;
          if (
            currentPhase === "VERIFYING_2FA" &&
            backendStatus === "NEEDS_2FA"
          ) {
            return;
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 2000);
    });

    return () => {
      Object.values(intervals).forEach((interval) => clearInterval(interval));
    };
  }, [syncingUtilities, fetchData, utilities]);

  // ------------------------------------------------------
  // Handlers
  // ------------------------------------------------------

  async function refreshStripeConnectStatus() {
    const res = await fetch("/api/payments/stripe/connect/status-from-db");
    if (!res.ok) {
      setStripeReadyToReceive(null);
      return;
    }
    const st = await res.json().catch(() => ({}));
    setStripeReadyToReceive(!!st?.isReadyToReceive);
  }

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
      });
    } else {
      setFormData({
        accountHolderName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    }

    if (!utilityStates[utilityId]) {
      setUtilityStates((prev) => ({
        ...prev,
        [utilityId]: {
          phase: "IDLE",
          progressMessage: null,
          lastError: null,
          twoFactorCode: "",
          sessionStartTime: 0,
          elapsedTime: 0,
        },
      }));
    }
  };

  // Submit 2FA Code
  const handleTwoFactorSubmit = async (utilityId: string) => {
    try {
      const code = utilityStates[utilityId]?.twoFactorCode;
      await fetch(`/api/utilities/${utilityId}/job-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      toast.info("Submitting code...");

      setUtilityStates((prev) => ({
        ...prev,
        [utilityId]: {
          ...prev[utilityId],
          phase: "VERIFYING_2FA",
        },
      }));
    } catch (err) {
      toast.error("Failed to submit 2FA code");
    }
  };

  const handleLinkUtility = async () => {
    if (!formData.accountHolderName || !formData.email || !formData.password) {
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
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || "Failed to link utility");
      }

      // Start tracking this utility
      setSyncingUtilities((prev) => new Set([...prev, expandedUtility]));
      setUtilityStates((prev) => ({
        ...prev,
        [expandedUtility]: {
          phase: "PENDING",
          progressMessage: null,
          lastError: null,
          twoFactorCode: "",
          sessionStartTime: Date.now(),
          elapsedTime: 0,
        },
      }));

      // Update local non-sensitive fields
      setUtilities((prev) =>
        prev.map((u) =>
          u.id === expandedUtility
            ? {
                ...u,
                accountHolderName: formData.accountHolderName,
                email: formData.email,
              }
            : u,
        ),
      );

      toast.success(
        body.message || "Credentials saved. Link attempt will proceed.",
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
        .catch(() => ({}) as any);

      if (!res.ok) {
        throw new Error((body as any).error || "Failed to unlink utility");
      }

      const updated = mapApiToUtilityLink(body as UtilityAccountResponse);
      setUtilities((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u)),
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
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!formData.accountHolderName || !formData.email) {
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
          // ownerUserId can be added here later if you build "change owner" UI
        }),
      });

      const body: UtilityAccountResponse | { error?: string } = await res
        .json()
        .catch(() => ({}) as any);

      if (!res.ok) {
        throw new Error((body as any).error || "Failed to update utility");
      }

      const updated = mapApiToUtilityLink(body as UtilityAccountResponse);
      setUtilities((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u)),
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
          type: selectedUtilityType.name,
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
      });
      setShowCompanyModal(false);
      setSelectedUtilityType(null);

      toast.success(`${mapped.type} utility added`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add utility");
    }
  };

  // Sync All Utilities - calls existing link endpoint for each linked utility
  const handleSyncAllUtilities = async () => {
    const linkedUtilities = utilities.filter(
      (u) => u.isLinked && u.ownerUserId === currentUserId,
    );

    if (linkedUtilities.length === 0) {
      toast.error("No linked utilities to sync");
      return;
    }

    setIsSyncing(true);

    try {
      let successCount = 0;
      let failCount = 0;

      // Call link endpoint for each utility (without password to trigger re-sync)
      for (const utility of linkedUtilities) {
        try {
          // Just create a new job - the backend will use existing credentials
          const res = await fetch(`/api/utilities/${utility.id}/link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountHolderName: utility.accountHolderName,
              loginEmail: utility.email,
              password: "", // Backend will use existing encrypted password
            }),
          });

          if (res.ok) {
            successCount++;

            // Start tracking this utility and expand it
            setSyncingUtilities((prev) => new Set([...prev, utility.id]));
            setUtilityStates((prev) => ({
              ...prev,
              [utility.id]: {
                phase: "PENDING",
                progressMessage: null,
                lastError: null,
                twoFactorCode: "",
                sessionStartTime: Date.now(),
                elapsedTime: 0,
              },
            }));

            // Auto-expand first syncing utility
            if (successCount === 1) {
              setExpandedUtility(utility.id);
            }
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Failed to sync ${utility.type}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Started syncing ${successCount} ${successCount === 1 ? "utility" : "utilities"}`,
        );
      }

      if (failCount > 0) {
        toast.error(
          `Failed to start sync for ${failCount} ${failCount === 1 ? "utility" : "utilities"}`,
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to sync utilities");
    } finally {
      setIsSyncing(false);
    }
  };

  // ------------------------------------------------------
  // JSX
  // ------------------------------------------------------

  if (loading) {
    return <div className="text-sm text-gray-500 p-4">Loading utilities…</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 sm:space-y-8">
        {/* Action Banner - already responsive */}
        <ActionBanner
          show={stripeReadyToReceive === false && userOwnsAnyUtility}
          variant="danger"
          Icon={AlertCircle}
          title="Action needed"
          actionLabel={
            stripeCtaLoading ? "Redirecting to Stripe" : "Enable payouts"
          }
          actionDisabled={stripeCtaLoading}
          onActionClick={async () => {
            if (stripeCtaLoading) return;
            try {
              setStripeCtaLoading(true);
              await ensureOwnerConnectOnboarding();
            } catch (e) {
              setStripeCtaLoading(false);
            }
          }}
        >
          connect your Stripe account to receive payments.
        </ActionBanner>

        {/* Page header */}
        <div className="px-1">
          <div className="flex items-center gap-3 mb-2">
            <Link2
              className="h-6 w-6 sm:h-7 sm:w-7"
              style={{ color: "#008a4b" }}
            />
            <h1
              className="text-2xl sm:text-[28px] text-gray-900"
              style={{ fontWeight: 600 }}
            >
              Link Utility Accounts
            </h1>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            Connect your utility accounts to automatically sync bills and
            payments.
          </p>
        </div>

        {/* Utilities table */}
        <Card className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
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
                    } ${isExpanded ? "bg-gray-50" : "hover:bg-gray-50"} transition-colors`}
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
                            style={{ color: "#008a4b" }}
                          />
                          <span
                            className="text-sm"
                            style={{ color: "#008a4b", fontWeight: 600 }}
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
                      {utility.isLinked &&
                        !syncingUtilities.has(utility.id) && (
                          <div
                            className="mb-4 px-3 py-2 rounded-lg flex items-center gap-2"
                            style={{
                              backgroundColor: "#D1FAE5",
                              border: "1px solid #A7F3D0",
                            }}
                          >
                            <CheckCircle2
                              className="h-4 w-4 flex-shrink-0"
                              style={{ color: "#008a4b" }}
                            />
                            <p className="text-sm text-gray-900">
                              This account information has been accepted and we
                              are able to access your account!
                            </p>
                          </div>
                        )}

                      {/* 2. INTERACTIVE SESSION MODE (Shows when isPolling is true) */}
                      {syncingUtilities.has(utility.id) &&
                      utilityStates[utility.id] ? (
                        <LinkingSession
                          phase={utilityStates[utility.id].phase}
                          progressMessage={
                            utilityStates[utility.id].progressMessage
                          }
                          twoFactorCode={
                            utilityStates[utility.id].twoFactorCode
                          }
                          onTwoFactorChange={(code) =>
                            setUtilityStates((prev) => ({
                              ...prev,
                              [utility.id]: {
                                ...prev[utility.id],
                                twoFactorCode: code,
                              },
                            }))
                          }
                          onTwoFactorSubmit={() =>
                            handleTwoFactorSubmit(utility.id)
                          }
                          lastError={utilityStates[utility.id].lastError}
                          elapsedTime={utilityStates[utility.id].elapsedTime}
                        />
                      ) : (
                        /* 3. STANDARD UI (Shows when NOT polling) */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Provider info card */}
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
                                  className="text-[#008a4b] hover:underline"
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

                          {/* Link form card */}
                          <Card className="rounded-lg border border-gray-200 bg-white p-4">
                            <h3
                              className="text-base text-gray-900 mb-4 text-center"
                              style={{ fontWeight: 600 }}
                            >
                              Link Utility
                            </h3>
                            <div className="space-y-3">
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
                                  type="password"
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
                                      Only {utility.owner?.name} can modify this
                                      link.
                                    </div>
                                  )
                                ) : editingUtility === utility.id ? (
                                  <div className="space-y-2">
                                    <Button
                                      onClick={handleSaveEdit}
                                      className="w-full h-10 rounded-lg bg-[#008a4b] hover:bg-[#00A040]"
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
                                      className="w-full h-10 rounded-lg bg-[#008a4b] hover:bg-[#00A040]"
                                      style={{ fontWeight: 600 }}
                                      disabled={syncingUtilities.has(
                                        utility.id,
                                      )}
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

        {/* MOBILE CARD VIEW - Shown on mobile only */}
        <div className="md:hidden space-y-3">
          {utilities.map((utility) => {
            const Icon = utility.icon;
            const isExpanded = expandedUtility === utility.id;
            const isOwner =
              !!currentUserId && utility.ownerUserId === currentUserId;

            return (
              <Card
                key={utility.id}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden"
              >
                {/* Mobile utility card header */}
                <div
                  className={`p-4 ${isExpanded ? "bg-gray-50" : ""} transition-colors`}
                  onClick={() => !isExpanded && handleToggleExpand(utility.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0"
                        style={{ backgroundColor: utility.iconBg }}
                      >
                        <Icon
                          className="h-6 w-6"
                          style={{ color: utility.iconColor }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {utility.type}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {utility.provider}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(utility.id);
                      }}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-center py-2">
                    {utility.isLinked ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
                        <LinkIcon
                          className="h-4 w-4"
                          style={{ color: "#008a4b" }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "#008a4b" }}
                        >
                          Linked
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full border border-red-200">
                        <Link2 className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-semibold text-red-500">
                          Not Linked
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded mobile content */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 bg-white space-y-4">
                    {/* Success banner */}
                    {utility.isLinked && !syncingUtilities.has(utility.id) && (
                      <div
                        className="px-3 py-2.5 rounded-lg flex items-start gap-2"
                        style={{
                          backgroundColor: "#D1FAE5",
                          border: "1px solid #A7F3D0",
                        }}
                      >
                        <CheckCircle2
                          className="h-5 w-5 flex-shrink-0 mt-0.5"
                          style={{ color: "#008a4b" }}
                        />
                        <p className="text-sm text-gray-900">
                          This account information has been accepted and we are
                          able to access your account!
                        </p>
                      </div>
                    )}

                    {/* Linking session or form */}
                    {syncingUtilities.has(utility.id) &&
                    utilityStates[utility.id] ? (
                      <LinkingSession
                        phase={utilityStates[utility.id].phase}
                        progressMessage={
                          utilityStates[utility.id].progressMessage
                        }
                        twoFactorCode={utilityStates[utility.id].twoFactorCode}
                        onTwoFactorChange={(code) =>
                          setUtilityStates((prev) => ({
                            ...prev,
                            [utility.id]: {
                              ...prev[utility.id],
                              twoFactorCode: code,
                            },
                          }))
                        }
                        onTwoFactorSubmit={() =>
                          handleTwoFactorSubmit(utility.id)
                        }
                        lastError={utilityStates[utility.id].lastError}
                        elapsedTime={utilityStates[utility.id].elapsedTime}
                      />
                    ) : (
                      <>
                        {/* Provider info */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900 text-center">
                            {utility.provider}
                          </h4>
                          <p className="text-sm text-gray-700 text-center">
                            Visit the {utility.provider} website{" "}
                            <a
                              href={utility.providerWebsite ?? ""}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#008a4b] hover:underline font-semibold"
                            >
                              here
                            </a>{" "}
                            to set up service.
                          </p>
                          <div className="text-center py-2 px-3 bg-white rounded-lg border border-gray-200">
                            <p className="text-sm font-semibold">
                              Setup Your Account Online
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 text-center">
                            After setting up service, create an online account
                            on their website.
                          </p>
                        </div>

                        {/* Form fields */}
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block font-medium">
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
                              placeholder="Full name"
                              className="h-12 rounded-lg border-gray-300 text-base"
                              disabled={
                                utility.isLinked &&
                                editingUtility !== utility.id
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block font-medium">
                              Email Address
                            </Label>
                            <Input
                              type="email"
                              value={
                                isOwner ? formData.email : "••••••@••••••.com"
                              }
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  email: e.target.value,
                                }))
                              }
                              placeholder="email@example.com"
                              className="h-12 rounded-lg border-gray-300 text-base"
                              disabled={
                                utility.isLinked &&
                                (editingUtility !== utility.id || !isOwner)
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block font-medium">
                              Password
                              {editingUtility === utility.id && isOwner && (
                                <span className="text-gray-500 text-xs ml-1">
                                  (leave blank to keep current)
                                </span>
                              )}
                            </Label>
                            <Input
                              type="password"
                              value={isOwner ? formData.password : "••••••••"}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  password: e.target.value,
                                }))
                              }
                              placeholder="••••••••"
                              className="h-12 rounded-lg border-gray-300 text-base"
                              disabled={
                                utility.isLinked &&
                                (editingUtility !== utility.id || !isOwner)
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block font-medium">
                              Confirm Password
                              {editingUtility === utility.id && isOwner && (
                                <span className="text-gray-500 text-xs ml-1">
                                  (leave blank to keep current)
                                </span>
                              )}
                            </Label>
                            <Input
                              type="password"
                              value={
                                isOwner ? formData.confirmPassword : "••••••••"
                              }
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  confirmPassword: e.target.value,
                                }))
                              }
                              placeholder="••••••••"
                              className="h-12 rounded-lg border-gray-300 text-base"
                              disabled={
                                utility.isLinked &&
                                (editingUtility !== utility.id || !isOwner)
                              }
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="space-y-2 pt-2">
                          {utility.isLinked && editingUtility !== utility.id ? (
                            isOwner ? (
                              <>
                                <Button
                                  onClick={() => handleEditUtility(utility.id)}
                                  variant="outline"
                                  className="w-full h-12 rounded-lg border-gray-300 text-gray-700 text-base font-semibold"
                                >
                                  <Edit2 className="h-5 w-5 mr-2" />
                                  Edit Account
                                </Button>
                                <Button
                                  onClick={handleUnlinkUtility}
                                  variant="outline"
                                  className="w-full h-12 rounded-lg border-red-300 text-red-600 hover:bg-red-50 text-base font-semibold"
                                >
                                  <Trash2 className="h-5 w-5 mr-2" />
                                  Unlink Account
                                </Button>
                              </>
                            ) : (
                              <div className="text-center italic text-sm text-gray-400 py-3">
                                Only {utility.owner?.name} can modify this link.
                              </div>
                            )
                          ) : editingUtility === utility.id ? (
                            <>
                              <Button
                                onClick={handleSaveEdit}
                                className="w-full h-12 rounded-lg bg-[#008a4b] hover:bg-[#00A040] text-base font-semibold"
                              >
                                <Save className="h-5 w-5 mr-2" />
                                Save Changes
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                variant="outline"
                                className="w-full h-12 rounded-lg border-gray-300 text-gray-700 text-base font-semibold"
                              >
                                <X className="h-5 w-5 mr-2" />
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={handleLinkUtility}
                                className="w-full h-12 rounded-lg bg-[#008a4b] hover:bg-[#00A040] text-base font-semibold"
                                disabled={syncingUtilities.has(utility.id)}
                              >
                                <Link2 className="h-5 w-5 mr-2" />
                                Link Account
                              </Button>
                              <Button
                                onClick={() => handleRemoveUtility(utility.id)}
                                variant="outline"
                                className="w-full h-12 rounded-lg border-gray-300 text-gray-600 text-base font-semibold"
                              >
                                <Trash2 className="h-5 w-5 mr-2" />
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSyncAllUtilities}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-[#008a4b] text-[#008a4b] hover:bg-[#008a4b] hover:text-white rounded-lg px-6 sm:px-8 text-base"
                // className="border-[#008a4b] text-[#008a4b] hover:bg-[#008a4b] hover:text-white rounded-lg px-8"
                style={{ fontWeight: 600 }}
                disabled={isSyncing || linkedUtilitiesCount === 0}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Sync Utilities
                    {linkedUtilitiesCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-[#008a4b] text-white rounded-full text-xs">
                        {linkedUtilitiesCount}
                      </span>
                    )}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {linkedUtilitiesCount === 0
                  ? "No linked utilities to sync"
                  : `Sync all ${linkedUtilitiesCount} linked ${linkedUtilitiesCount === 1 ? "utility" : "utilities"}`}
              </p>
            </TooltipContent>
          </Tooltip>

          <Button
            onClick={handleAddUtility}
            size="lg"
            className="w-full sm:w-auto bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg px-6 sm:px-8 h-12 sm:h-auto text-base"
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
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className="text-lg sm:text-xl"
                style={{ fontWeight: 600 }}
              >
                Select Utility Type
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
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
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#008a4b] hover:bg-gray-50 transition-all group active:scale-98"
                    style={{ minHeight: "60px" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{ backgroundColor: utilityType.iconBg }}
                      >
                        <Icon
                          className="h-6 w-6"
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
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#008a4b]" />
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Select provider modal */}
        <Dialog open={showCompanyModal} onOpenChange={setShowCompanyModal}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className="text-lg sm:text-xl"
                style={{ fontWeight: 600 }}
              >
                Select Provider
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Choose your {selectedUtilityType?.name} provider from the list.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4 max-h-[400px] overflow-y-auto">
              {selectedUtilityType &&
                companiesByUtility[selectedUtilityType.name]?.map((company) => (
                  <button
                    key={company.name}
                    onClick={() => handleSelectCompany(company)}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#008a4b] hover:bg-gray-50 transition-all group text-left active:scale-98"
                    style={{ minHeight: "60px" }}
                  >
                    <span
                      className="text-base text-gray-900 pr-2"
                      style={{ fontWeight: 500 }}
                    >
                      {company.name}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#008a4b] flex-shrink-0" />
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
