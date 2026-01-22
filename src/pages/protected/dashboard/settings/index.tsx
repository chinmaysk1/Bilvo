// pages/protected/dashboard/settings/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User,
  Bell,
  Lock,
  AlertCircle,
  Shield,
  FileText,
  HelpCircle,
  ChevronRight,
  Crown,
  CreditCard,
  Smartphone,
} from "lucide-react";

interface NotificationSetting {
  id: string;
  label: string;
  email: boolean;
  sms: boolean;
  locked?: boolean;
}

type ActiveSection = "profile" | "notifications" | "billing" | "legal";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  // Profile fields (loaded from /api/user/me)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Admin gate for billing card (derived from /api/household/data)
  const [isAdmin, setIsAdmin] = useState(false);

  // Quick jump nav
  const [activeSection, setActiveSection] = useState<ActiveSection>("profile");

  // Notifications (UI-only for now)
  const [billsNotifications, setBillsNotifications] = useState<
    NotificationSetting[]
  >([
    {
      id: "bill-reminder",
      label: "Bill Due Reminders",
      email: true,
      sms: true,
    },
    {
      id: "overdue",
      label: "Overdue / Late Alerts",
      email: true,
      sms: true,
      locked: true,
    },
    { id: "bill-modified", label: "Bill Modified", email: true, sms: false },
  ]);

  const [myPaymentsNotifications, setMyPaymentsNotifications] = useState<
    NotificationSetting[]
  >([
    {
      id: "autopay-success",
      label: "Autopay Success",
      email: true,
      sms: false,
    },
    {
      id: "autopay-failed",
      label: "Autopay Failed",
      email: true,
      sms: true,
      locked: true,
    },
    {
      id: "manual-payment",
      label: "Manual Payment Receipt",
      email: true,
      sms: false,
    },
  ]);

  const [reimbursementsNotifications, setReimbursementsNotifications] =
    useState<NotificationSetting[]>([
      {
        id: "payment-received",
        label: "Payment Received",
        email: true,
        sms: true,
      },
      {
        id: "settlement-request",
        label: "Settlement Request",
        email: true,
        sms: true,
      },
    ]);

  const [securityNotifications, setSecurityNotifications] = useState<
    NotificationSetting[]
  >([
    { id: "new-device", label: "New Device Login", email: true, sms: false },
    {
      id: "household-changes",
      label: "Household Changes",
      email: true,
      sms: false,
    },
  ]);

  // Fetch user + admin gate
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [meRes, householdRes] = await Promise.all([
          fetch("/api/user/me"),
          fetch("/api/household/data"),
        ]);

        const me = meRes.ok ? await meRes.json().catch(() => null) : null;
        const householdData = householdRes.ok
          ? await householdRes.json().catch(() => null)
          : null;

        if (cancelled) return;

        setFullName(me?.name || "");
        setEmail(me?.email || "");
        setPhone(me?.phone || "");

        const adminId = householdData?.household?.adminId;
        const currentUserId = householdData?.currentUserId;
        setIsAdmin(!!adminId && !!currentUserId && adminId === currentUserId);
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleNotification = (
    section: "bills" | "myPayments" | "reimbursements" | "security",
    id: string,
    type: "email" | "sms",
  ) => {
    const setters = {
      bills: setBillsNotifications,
      myPayments: setMyPaymentsNotifications,
      reimbursements: setReimbursementsNotifications,
      security: setSecurityNotifications,
    } as const;

    const setter = setters[section];
    setter((prev) =>
      prev.map((item) => {
        if (item.id === id && !item.locked) {
          return { ...item, [type]: !item[type] };
        }
        return item;
      }),
    );
  };

  const scrollToSection = (sectionId: ActiveSection) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);

      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          phone,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update profile");
      }

      // optional: re-sync local state from response
      setFullName(data.name || "");
      setPhone(data.phone || "");

      alert("Profile updated");
    } catch (err: any) {
      console.error(err);
      alert(err.message ?? "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const billingDisabledContent = useMemo(() => {
    return (
      <div className="relative">
        {/* Blurred background content */}
        <div className="space-y-4 sm:space-y-5 blur-sm select-none pointer-events-none opacity-40 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg"
                style={{ backgroundColor: "#FEF3C7" }}
              >
                <Crown className="h-4 w-4" style={{ color: "#D97706" }} />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#92400E",
                    fontFamily: "Inter, sans-serif",
                  }}
                  className="sm:text-sm"
                >
                  Bilvo Pro
                </span>
              </div>
              <span
                style={{
                  fontSize: "13px",
                  color: "#6B7280",
                  fontFamily: "Inter, sans-serif",
                }}
                className="sm:text-sm"
              >
                Household License: $5.99/mo
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB]">
            <div
              className="mb-3 sm:text-sm"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#111827",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Payment Method
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB]">
              <CreditCard className="h-5 w-5 text-[#6B7280] flex-shrink-0" />
              <span
                style={{
                  fontSize: "13px",
                  color: "#374151",
                  fontFamily: "Inter, sans-serif",
                }}
                className="sm:text-sm"
              >
                Visa ending in 4242
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-2">
            <button
              className="text-sm hover:underline text-left sm:text-sm"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#00B948",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Update Payment Method
            </button>
            <span style={{ color: "#D1D5DB" }} className="hidden sm:inline">
              •
            </span>
            <button
              className="text-sm hover:underline text-left sm:text-sm"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#00B948",
                fontFamily: "Inter, sans-serif",
              }}
            >
              View Billing History
            </button>
          </div>
        </div>

        {/* overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] p-4 sm:p-6">
          <div className="text-center px-4 sm:px-6 py-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm max-w-sm">
            <p
              className="text-[14px] sm:text-[15px] text-[#111827] mb-1"
              style={{ fontWeight: 600 }}
            >
              Testing Mode
            </p>
            <p className="text-[12px] sm:text-[13px] text-[#6B7280]">
              Billing features are disabled during beta testing
            </p>
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <DashboardLayout>
      <main
        className="mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
        style={{ backgroundColor: "#F9FAFB" }}
      >
        {/* Page title */}
        <div className="mb-4 sm:mb-6">
          <h1
            className="text-lg sm:text-xl text-[#111827]"
            style={{ fontWeight: 700 }}
          >
            Settings
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage your profile, notifications, and legal links.
          </p>
        </div>

        {/* Quick Jump Navigation */}
        <div
          className="flex items-center gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b overflow-x-auto scrollbar-hide"
          style={{ borderColor: "#E5E7EB" }}
        >
          {(
            ["profile", "billing", "notifications", "legal"] as ActiveSection[]
          ).map((section) => (
            <button
              key={section}
              onClick={() => scrollToSection(section)}
              className="relative pb-1 transition-colors whitespace-nowrap flex-shrink-0"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: activeSection === section ? "#111827" : "#6B7280",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {section === "profile"
                ? "Profile"
                : section === "billing"
                  ? "Billing"
                  : section === "notifications"
                    ? "Notifications"
                    : "Legal"}
              {activeSection === section && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: "#00B948" }}
                />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-[#6B7280] py-8 text-center">
            Loading settings…
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Card A: Profile & Security */}
            <Card
              id="section-profile"
              className="rounded-xl border border-[#D1D5DB] bg-white p-4 sm:p-6"
              style={{
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                scrollMarginTop: "80px",
              }}
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#F3F4F6" }}
                >
                  <User
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    style={{ color: "#475569" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily: "Inter, sans-serif",
                  }}
                  className="sm:text-lg"
                >
                  Profile & Security
                </h2>
              </div>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="full-name"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#374151",
                      marginBottom: "6px",
                      fontFamily: "Inter, sans-serif",
                    }}
                    className="sm:text-sm"
                  >
                    Full Name
                  </label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 sm:h-11 rounded-lg border-[#D1D5DB]"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </div>

                {/* Email Address (Read-only) */}
                <div>
                  <label
                    htmlFor="email"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#374151",
                      marginBottom: "6px",
                      fontFamily: "Inter, sans-serif",
                    }}
                    className="sm:text-sm"
                  >
                    Email Address
                  </label>
                  <Input
                    id="email"
                    value={email}
                    readOnly
                    disabled
                    className="h-10 sm:h-11 rounded-lg border-[#D1D5DB]"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                      backgroundColor: "#F9FAFB",
                      color: "#6B7280",
                      cursor: "not-allowed",
                    }}
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="phone"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#374151",
                      marginBottom: "6px",
                      fontFamily: "Inter, sans-serif",
                    }}
                    className="sm:text-sm"
                  >
                    Phone Number
                  </label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 sm:h-11 rounded-lg border-[#D1D5DB]"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="h-10 sm:h-11 gap-2 w-full sm:w-auto justify-center"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      fontFamily: "Inter, sans-serif",
                      borderColor: "#D1D5DB",
                      color: "#374151",
                    }}
                    onClick={() => alert("Change password (hook up later)")}
                  >
                    <Lock className="h-4 w-4" />
                    Change Password
                  </Button>

                  <Button
                    variant="outline"
                    className="h-10 sm:h-11 gap-2 w-full sm:w-auto justify-center"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      fontFamily: "Inter, sans-serif",
                      borderColor: "#D1D5DB",
                      color: "#374151",
                    }}
                    onClick={() => alert("Add 2FA (coming soon)")}
                  >
                    <Smartphone className="h-4 w-4" />
                    Add 2FA
                  </Button>

                  <Button
                    className="h-10 sm:h-11 w-full sm:w-auto bg-[#008a4b] hover:bg-[#00A03C] text-white justify-center"
                    style={{ fontWeight: 600 }}
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Card B: Subscription & Billing (Admin Only) */}
            {isAdmin && (
              <Card
                id="section-billing"
                className="rounded-xl border border-[#D1D5DB] overflow-hidden bg-white"
                style={{
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                  scrollMarginTop: "80px",
                }}
              >
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b border-[#E5E7EB]">
                  <h2
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#111827",
                      fontFamily: "Inter, sans-serif",
                    }}
                    className="sm:text-lg"
                  >
                    Plan & Billing
                  </h2>
                </div>
                {billingDisabledContent}
              </Card>
            )}

            {/* Card C: Notification Preferences */}
            <Card
              id="section-notifications"
              className="rounded-xl border border-[#D1D5DB] bg-white p-4 sm:p-6"
              style={{
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                scrollMarginTop: "80px",
              }}
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#F3F4F6" }}
                >
                  <Bell
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    style={{ color: "#475569" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily: "Inter, sans-serif",
                  }}
                  className="sm:text-lg"
                >
                  Notifications
                </h2>
              </div>

              {/* Responsive grid header */}
              <div className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_70px_70px] md:grid-cols-[1fr_80px_80px] gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-[#E5E7EB]">
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "Inter, sans-serif",
                  }}
                  className="sm:text-xs"
                >
                  Notification Type
                </div>
                <div
                  className="text-center sm:text-xs"
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Email
                </div>
                <div
                  className="text-center sm:text-xs"
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  SMS
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {/* Section 1: Bills & Deadlines */}
                <div>
                  <h3
                    className="mb-2 sm:mb-3 flex items-center gap-2 sm:text-sm"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#111827",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <AlertCircle
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: "#DC2626" }}
                    />
                    <span className="truncate">Bills & Deadlines (Urgent)</span>
                  </h3>

                  <div className="space-y-2 sm:space-y-3">
                    {billsNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_70px_70px] md:grid-cols-[1fr_80px_80px] gap-2 sm:gap-3 md:gap-4 items-center"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className="truncate text-xs sm:text-sm"
                            style={{
                              color: notif.locked ? "#9CA3AF" : "#374151",
                              fontFamily: "Inter, sans-serif",
                            }}
                            title={notif.label}
                          >
                            {notif.label}
                          </span>
                          {notif.locked && (
                            <Lock
                              className="h-3 w-3 flex-shrink-0"
                              style={{ color: "#9CA3AF" }}
                            />
                          )}
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.email}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification("bills", notif.id, "email")
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.sms}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification("bills", notif.id, "sms")
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: My Payments */}
                <div>
                  <h3
                    className="mb-2 sm:mb-3 sm:text-sm"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#111827",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    My Payments (Outgoing Money)
                  </h3>

                  <div className="space-y-2 sm:space-y-3">
                    {myPaymentsNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_70px_70px] md:grid-cols-[1fr_80px_80px] gap-2 sm:gap-3 md:gap-4 items-center"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className="truncate text-xs sm:text-sm"
                            style={{
                              color: notif.locked ? "#9CA3AF" : "#374151",
                              fontFamily: "Inter, sans-serif",
                            }}
                            title={notif.label}
                          >
                            {notif.label}
                          </span>
                          {notif.locked && (
                            <Lock
                              className="h-3 w-3 flex-shrink-0"
                              style={{ color: "#9CA3AF" }}
                            />
                          )}
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.email}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification(
                                "myPayments",
                                notif.id,
                                "email",
                              )
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.sms}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification("myPayments", notif.id, "sms")
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Reimbursements */}
                <div>
                  <h3
                    className="mb-2 sm:mb-3 sm:text-sm"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#111827",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Reimbursements (Incoming Money)
                  </h3>

                  <div className="space-y-2 sm:space-y-3">
                    {reimbursementsNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_70px_70px] md:grid-cols-[1fr_80px_80px] gap-2 sm:gap-3 md:gap-4 items-center"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className="truncate text-xs sm:text-sm"
                            style={{
                              color: notif.locked ? "#9CA3AF" : "#374151",
                              fontFamily: "Inter, sans-serif",
                            }}
                            title={notif.label}
                          >
                            {notif.label}
                          </span>
                          {notif.locked && (
                            <Lock
                              className="h-3 w-3 flex-shrink-0"
                              style={{ color: "#9CA3AF" }}
                            />
                          )}
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.email}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification(
                                "reimbursements",
                                notif.id,
                                "email",
                              )
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.sms}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification(
                                "reimbursements",
                                notif.id,
                                "sms",
                              )
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Security */}
                <div>
                  <h3
                    className="mb-2 sm:mb-3 sm:text-sm"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#111827",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Security & Account
                  </h3>

                  <div className="space-y-2 sm:space-y-3">
                    {securityNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_70px_70px] md:grid-cols-[1fr_80px_80px] gap-2 sm:gap-3 md:gap-4 items-center"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className="truncate text-xs sm:text-sm"
                            style={{
                              color: notif.locked ? "#9CA3AF" : "#374151",
                              fontFamily: "Inter, sans-serif",
                            }}
                            title={notif.label}
                          >
                            {notif.label}
                          </span>
                          {notif.locked && (
                            <Lock
                              className="h-3 w-3 flex-shrink-0"
                              style={{ color: "#9CA3AF" }}
                            />
                          )}
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.email}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification("security", notif.id, "email")
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={notif.sms}
                            disabled={notif.locked}
                            onCheckedChange={() =>
                              toggleNotification("security", notif.id, "sms")
                            }
                            className={notif.locked ? "opacity-50" : ""}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#6B7280] pt-2">
                  (UI-only) Notification preferences aren’t saved yet.
                </p>
              </div>
            </Card>

            {/* Card D: Legal */}
            <Card
              id="section-legal"
              className="rounded-xl border border-[#D1D5DB] bg-white p-4 sm:p-6"
              style={{
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                scrollMarginTop: "80px",
              }}
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#F3F4F6" }}
                >
                  <Shield
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    style={{ color: "#475569" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily: "Inter, sans-serif",
                  }}
                  className="sm:text-lg"
                >
                  Legal
                </h2>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => alert("Open Terms (coming soon)")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText
                      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                      style={{ color: "#6B7280" }}
                    />
                    <span
                      className="text-xs sm:text-sm truncate"
                      style={{
                        color: "#374151",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Terms of Service
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                    style={{ color: "#9CA3AF" }}
                  />
                </button>

                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => alert("Open Privacy (coming soon)")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Shield
                      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                      style={{ color: "#6B7280" }}
                    />
                    <span
                      className="text-xs sm:text-sm truncate"
                      style={{
                        color: "#374151",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Privacy Policy
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                    style={{ color: "#9CA3AF" }}
                  />
                </button>

                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => alert("Open Security Promise (coming soon)")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Lock
                      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                      style={{ color: "#6B7280" }}
                    />
                    <span
                      className="text-xs sm:text-sm truncate"
                      style={{
                        color: "#374151",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Data Security Promise
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                    style={{ color: "#9CA3AF" }}
                  />
                </button>

                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => alert("Contact support (coming soon)")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HelpCircle
                      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                      style={{ color: "#6B7280" }}
                    />
                    <span
                      className="text-xs sm:text-sm truncate"
                      style={{
                        color: "#374151",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Contact Support
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                    style={{ color: "#9CA3AF" }}
                  />
                </button>
              </div>
            </Card>

            {/* Footer */}
            <div
              className="text-center py-4 sm:py-6 sm:text-xs"
              style={{
                fontSize: "11px",
                color: "#9CA3AF",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Version 1.0.0 • © 2026 Bilvo Inc.
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session?.user?.email) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: {} };
};
