// pages/protected/dashboard/utilities/index.tsx
import { useState, useEffect } from "react";
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
// Main utilities content (UI only, no backend yet)
// ------------------------------------------------------

function UtilitiesContent() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [utilities, setUtilities] = useState<UtilityLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedUtility, setExpandedUtility] = useState<string | null>(null);
  const [editingUtility, setEditingUtility] = useState<string | null>(null);

  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  // Form state for expanded / editing utility
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

  // Utility types
  const utilityTypes = [
    { name: "Electricity", icon: Zap, iconColor: "#F59E0B", iconBg: "#FEF3C7" },
    { name: "Water", icon: Droplets, iconColor: "#3B82F6", iconBg: "#DBEAFE" },
    { name: "Gas", icon: Flame, iconColor: "#EF4444", iconBg: "#FEE2E2" },
    { name: "Internet", icon: Wifi, iconColor: "#8B5CF6", iconBg: "#EDE9FE" },
    { name: "Waste", icon: Trash, iconColor: "#10B981", iconBg: "#D1FAE5" },
  ];

  // Companies per utility
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
      {
        name: "Spectrum Internet",
        website: "https://www.spectrum.com",
      },
      { name: "AT&T Internet", website: "https://www.att.com" },
      { name: "Xfinity", website: "https://www.xfinity.com" },
      { name: "Frontier", website: "https://www.frontier.com" },
    ],
    Waste: [
      { name: "Waste Management", website: "https://www.wm.com" },
      {
        name: "Republic Services",
        website: "https://www.republicservices.com",
      },
      { name: "Recology", website: "https://www.recology.com" },
      {
        name: "Athens Services",
        website: "https://www.athensservices.com",
      },
    ],
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1) Fetch current user
        const userRes = await fetch("/api/user/me");
        if (userRes.ok) {
          const user = await userRes.json();
          setCurrentUserId(user.id);
        } else {
          console.error("Failed to fetch current user");
        }

        // 2) Fetch utility accounts
        const res = await fetch("/api/utilities");
        if (!res.ok) {
          throw new Error("Failed to load utilities");
        }
        const data: { utilityAccounts: UtilityAccountResponse[] } =
          await res.json();

        setUtilities(data.utilityAccounts.map(mapApiToUtilityLink));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load utility accounts");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Polling Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPolling) {
      interval = setInterval(async () => {
        const res = await fetch(`/api/utilities/${expandedUtility}/job-status`);
        const data = await res.json();
        setJobStatus(data.status);

        if (data.status === "SUCCESS" || data.status === "FAILED") {
          setIsPolling(false);
          if (data.status === "SUCCESS") toast.success("Account Linked!");
        }
      }, 3000); // Poll every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isPolling, expandedUtility]);

  // ------------------------------------------------------
  // Handlers (all local state for now)
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
        setJobStatus("PENDING");
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
      setExpandedUtility(null);
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
                        <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-blue-100 rounded-2xl bg-gradient-to-b from-slate-50 to-white">
                          <div className="max-w-md w-full space-y-6 text-center">
                            {/* Status Icon/Animation */}
                            <div className="relative mx-auto w-16 h-16">
                              <div className="absolute inset-0 rounded-full border-4 border-blue-50"></div>
                              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                              <ShieldCheck className="absolute inset-0 m-auto h-8 w-8 text-blue-600" />
                            </div>

                            {jobStatus === "NEEDS_2FA" ? (
                              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div>
                                  <h3 className="text-lg font-semibold text-slate-900">
                                    Verification Required
                                  </h3>
                                  <p className="text-sm text-slate-500 mt-1">
                                    PG&E sent a 6-digit security code to your
                                    registered phone number.
                                  </p>
                                </div>

                                <div className="flex flex-col items-center gap-3">
                                  <div className="flex gap-2">
                                    <Input
                                      value={twoFactorCode}
                                      onChange={(e) =>
                                        setTwoFactorCode(e.target.value)
                                      }
                                      placeholder="000000"
                                      className="h-12 text-center text-xl tracking-[0.5em] font-mono max-w-[180px] border-2 focus:border-blue-500"
                                      maxLength={6}
                                    />
                                    <Button
                                      onClick={handleTwoFactorSubmit}
                                      className="h-12 px-6 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                                    >
                                      Verify
                                    </Button>
                                  </div>
                                  <p className="text-xs text-slate-400">
                                    Secure encrypted connection established...
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <h3 className="text-sm font-medium text-blue-800 uppercase tracking-wider">
                                  Active Session
                                </h3>
                                <div className="space-y-1">
                                  <p className="text-lg font-semibold text-slate-900">
                                    {jobStatus === "PENDING"
                                      ? "Establishing connection..."
                                      : "Fetching latest bill data..."}
                                  </p>
                                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    {jobStatus === "PENDING"
                                      ? "Authenticating with PG&E servers"
                                      : "Bypassing portal redirects..."}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
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

  return {
    props: {},
  };
};
