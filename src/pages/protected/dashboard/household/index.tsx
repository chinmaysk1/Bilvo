import { GetServerSideProps } from "next";
import { getSession, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { Activity as DashboardActivity } from "@/interfaces/activity";
import RecentActivity from "@/components/dashboard/RecentActivity";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

// shadcn ui
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Home,
  Users,
  Zap,
  Plus,
  Mail,
  Crown,
  MapPin,
  CreditCard,
  AlertTriangle,
  Trash2,
  DollarSign,
  Calendar,
  Pencil,
  Droplets,
  Flame,
  Wifi,
  Activity as ActivityIcon,
  Recycle,
  Repeat,
  Phone,
  MessageSquare,
  UserCheck,
  UserPlus,
  Lock,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { toast } from "sonner";
import { formatMonthYear } from "@/utils/common/formatMonthYear";
import { HouseholdApiResponse, Member } from "@/interfaces/household";
import { UtilityAccount, UtilitySplit } from "@/interfaces/utilities";
import { UserMeResponse } from "@/interfaces/user";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import UtilitySplitEditor from "@/components/household/UtilitySplitEditor";

function utilityTypeToUi(type: string) {
  const t = (type || "").toLowerCase();

  if (t.includes("internet") || t.includes("wifi"))
    return { icon: Wifi, iconColor: "#8B5CF6", iconBg: "#EDE9FE" };

  if (t.includes("gas") && !t.includes("electric"))
    return { icon: Flame, iconColor: "#EF4444", iconBg: "#FEE2E2" };

  if (t.includes("water"))
    return { icon: Droplets, iconColor: "#3B82F6", iconBg: "#DBEAFE" };

  if (t.includes("trash") || t.includes("recycl"))
    return { icon: Recycle, iconColor: "#10B981", iconBg: "#D1FAE5" };

  // default: electric / other
  return { icon: Zap, iconColor: "#F59E0B", iconBg: "#FEF3C7" };
}

type PieDatum = { name: string; value: number; color: string };

const UtilitySplitPie = dynamic(
  async () => {
    const recharts = await import("recharts");
    const { PieChart, Pie, Cell, ResponsiveContainer } = recharts;

    const Comp = ({ data }: { data: PieDatum[] }) => (
      <ResponsiveContainer width={100} height={100}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={50}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((d, idx) => (
              <Cell key={`cell-${idx}`} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );

    return Comp as ComponentType<{ data: PieDatum[] }>;
  },
  { ssr: false },
);

// ------------------------------------------------------
// Page component wrapper
// ------------------------------------------------------

type HouseholdPageProps = {}; // still empty props from SSR

export default function HouseholdPage(_props: HouseholdPageProps) {
  return (
    <DashboardLayout>
      <main className="mx-auto space-y-6 md:space-y-8">
        <HouseholdContent />
      </main>
    </DashboardLayout>
  );
}

// ------------------------------------------------------
// Main UI content (Figma UI adapted to Next + TS)
// ------------------------------------------------------

function HouseholdContent() {
  const router = useRouter();
  const { update } = useSession();

  // backend-driven state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [householdName, setHouseholdName] = useState("");
  const [householdAddress, setHouseholdAddress] = useState("");
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  const [isAdmin, setisAdmin] = useState(false);
  const [isParentView] = useState(false); // keep feature-flag for later
  const sponsoredMemberName = "Alex Chen"; // placeholder for parent view

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"email" | "sms">("email");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");

  const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
  const [transferOwnershipModalOpen, setTransferOwnershipModalOpen] =
    useState(false);
  const [transferStep, setTransferStep] = useState<
    "select" | "confirm" | "success"
  >("select");
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>("");
  const [confirmationText, setConfirmationText] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [utilities, setUtilities] = useState<UtilityAccount[]>([]);

  const [utilitySplits, setUtilitySplits] = useState<
    Record<string, UtilitySplit>
  >({});

  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Bill Configuration (Figma) – hook "Customize" to show the split editor for that utility
  const [editingSplitUtilityId, setEditingSplitUtilityId] = useState<
    string | null
  >(null);
  const editingUtility =
    utilities.find((u) => u.id === editingSplitUtilityId) || null;
  const editingSplit = editingUtility ? utilitySplits[editingUtility.id] : null;

  type SplitMode = "equal" | "custom";

  const [expandedUtilities, setExpandedUtilities] = useState<Set<string>>(
    new Set(),
  );

  const splitModeByUtilityId = useMemo(() => {
    const map: Record<string, SplitMode> = {};
    for (const u of utilities) {
      const split = utilitySplits[u.id];
      map[u.id] = split?.isCustom ? "custom" : "equal";
    }
    return map;
  }, [utilities, utilitySplits]);

  async function onChangeSplitMode(utilityId: string, mode: SplitMode) {
    // ✅ UI behavior:
    // - selecting "custom" should open your existing editor
    // - selecting "equal" should revert to automatic/equal

    if (mode === "custom") {
      setEditingSplitUtilityId(utilityId);
      return;
    }

    // If you already have an endpoint for resetting to equal, call it here.
    // Otherwise, update your local state store (wherever utilitySplits lives).
    //
    // Example (pseudo):
    // await api.utilities.setSplitMode({ utilityId, mode: "equal" });
    // refreshUtilitySplits();

    // If you don't have an endpoint yet, keep it local for now:
    // setUtilitySplits(prev => ({ ...prev, [utilityId]: makeEqualSplit(prev[utilityId]) }))
  }

  // billing summary
  const [nextDueBill, setNextDueBill] = useState<any | null>(null);
  const [totalOutstanding, setTotalOutstanding] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [householdRes, userRes, activityRes] = await Promise.all([
          fetch("/api/household/data"),
          fetch("/api/user/me"),
          fetch("/api/activities?limit=5"),
        ]);

        const householdJson =
          (await householdRes.json()) as HouseholdApiResponse;
        const userJson = (await userRes.json()) as UserMeResponse;
        const activitiesJson = await activityRes.json();

        if (!householdRes.ok) {
          throw new Error(
            (householdJson as any).error || "Failed to load household",
          );
        }
        if (!userRes.ok) {
          throw new Error((userJson as any).error || "Failed to load user");
        }

        setCurrentUserId(householdJson.currentUserId);
        setHouseholdId(householdJson.household.id);
        setHouseholdName(householdJson.household.name);
        setHouseholdAddress(householdJson.household.address);
        setCreatedAt(new Date(householdJson.household.createdAt));
        setInviteCode(householdJson.household.inviteCode);

        setisAdmin(
          householdJson.household.adminId === householdJson.currentUserId,
        );

        // map members from API -> UI members
        const colors = [
          "#F2C94C",
          "#008a4b",
          "#BB6BD9",
          "#3B82F6",
          "#8B5CF6",
          "#EC4899",
          "#F59E0B",
          "#10B981",
        ];

        const buildInitials = (name?: string | null, email?: string | null) => {
          const source = name || email || "";
          const parts = source.trim().split(" ");
          if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
          }
          if (source.length >= 2) {
            return source.slice(0, 2).toUpperCase();
          }
          return "HH";
        };

        const mappedMembers: Member[] = householdJson.household.members.map(
          (m, index) => {
            const isAdmin = m.id === householdJson.household.adminId;
            const isYou = m.id === householdJson.currentUserId;
            const baseName = m.name || m.email || "Household member";
            const displayName = isYou ? `${baseName} (You)` : baseName;

            return {
              id: m.id,
              name: displayName,
              initials: buildInitials(m.name, m.email),
              email: m.email || "",
              role: isAdmin ? "Admin" : "Member",
              color: colors[index % colors.length],
              autopay:
                isYou && (userJson.autopayEnabled ?? false) ? true : false,
              moveInDate: null,
              moveOutDate: null,
              hasAccount: true, // until you add SMS-only logic from backend
            };
          },
        );

        setMembers(mappedMembers);

        // ✅ Fetch utilities (you already have /api/utilities)
        const utilitiesRes = await fetch("/api/utilities");
        const utilitiesJson = await utilitiesRes.json();

        if (!utilitiesRes.ok) {
          throw new Error(utilitiesJson?.error || "Failed to load utilities");
        }

        const fetchedUtilities: UtilityAccount[] = (
          utilitiesJson.utilityAccounts || []
        ).map((u: any) => {
          const ui = utilityTypeToUi(u.type);
          return {
            id: u.id,
            provider: u.provider,
            accountNumber: u.accountNumber ? String(u.accountNumber) : "—",
            type: u.type,
            ownerId: u.ownerUserId,
            icon: ui.icon,
            iconColor: ui.iconColor,
            iconBg: ui.iconBg,
          };
        });

        setUtilities(fetchedUtilities);

        // ✅ Initialize splits using fetchedUtilities + mappedMembers (NOT state `utilities`)
        setUtilitySplits(() => {
          if (fetchedUtilities.length === 0 || mappedMembers.length === 0)
            return {};

          const splits: Record<string, UtilitySplit> = {};
          const equalValue = 100 / mappedMembers.length;

          for (const utility of fetchedUtilities) {
            splits[utility.id] = {
              utilityId: utility.id,
              splitType: "percentage",
              memberSplits: mappedMembers.map((m) => ({
                memberId: m.id,
                value: equalValue,
                included: true,
              })),
              isCustom: false,
            };
          }

          return splits;
        });

        // --- after you set utilities / members etc. in load() ---
        try {
          // fetch bills summary (same pattern as bills page)
          const billsRes = await fetch("/api/bills");
          const billsJson = await billsRes.json().catch(() => ({ bills: [] }));

          if (billsRes.ok) {
            const bills: any[] = billsJson.bills || [];

            // compute total outstanding for current user (yourShare)
            const total = bills
              .filter((b) => b.myStatus !== "PAID") // treat non-paid as outstanding
              .reduce((sum, b) => sum + (Number(b.yourShare || 0) || 0), 0);

            // find next due unpaid bill
            const unpaid = bills
              .filter((b) => b.myStatus !== "PAID")
              .filter((b) => b.dueDate)
              .sort(
                (a, b) =>
                  new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
              );

            setTotalOutstanding(total);
            setNextDueBill(unpaid.length > 0 ? unpaid[0] : null);
          } else {
            // tolerate failure silently — leave values as defaults
            console.warn("Failed to load bills for household page");
          }
        } catch (err) {
          console.error("Error loading bills:", err);
        }

        if (activityRes.ok) {
          setActivities(
            (activitiesJson.activities || []) as DashboardActivity[],
          );
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load household", {
          description: err.message ?? "Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // --- Handlers ---

  // TODO: wire to backend
  const handleSaveUtilitySplit = async (
    utilityId: string,
    newSplit: UtilitySplit,
  ) => {
    // optimistic UI update
    setUtilitySplits((prev) => ({ ...prev, [utilityId]: newSplit }));

    try {
      const res = await fetch(`/api/utilities/${utilityId}/split`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSplit),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save split");
      }

      toast.success("Split saved");

      // after split saved server-side, re-fetch bills to reflect changed shares
      const billsRes = await fetch("/api/bills");
      const billsJson = await billsRes.json().catch(() => ({ bills: [] }));
      if (billsRes.ok) {
        const bills: any[] = billsJson.bills || [];
        const total = bills
          .filter((b) => b.myStatus !== "PAID")
          .reduce((sum, b) => sum + (Number(b.yourShare || 0) || 0), 0);
        const unpaid = bills
          .filter((b) => b.myStatus !== "PAID")
          .filter((b) => b.dueDate)
          .sort(
            (a, b) =>
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
          );

        setTotalOutstanding(total);
        setNextDueBill(unpaid.length > 0 ? unpaid[0] : null);

        // optional: if you store bills in state elsewhere, update there too
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save split", {
        description: err.message ?? "Please try again.",
      });

      // rollback could be implemented here if you keep copies of previous splits
    }
  };

  function toggleUtilityExpanded(id: string) {
    setExpandedUtilities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleInviteMember = async () => {
    try {
      if (inviteMode === "email" && inviteEmail) {
        const res = await fetch("/api/household/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "email",
            name: inviteName || null,
            email: inviteEmail,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to send email invite");
        }

        toast.success("Invitation sent", {
          description: `An email invite has been sent to ${inviteEmail}`,
        });
      } else if (inviteMode === "sms" && inviteName && invitePhone) {
        const res = await fetch("/api/household/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "sms",
            name: inviteName,
            phone: invitePhone,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to send SMS invite");
        }

        toast.success("Member invited", {
          description: `We sent an invite to ${invitePhone}`,
        });

        // optional: optimistically add SMS-only member to UI list
        const nameParts = inviteName.trim().split(" ");
        const initials =
          nameParts.length >= 2
            ? `${nameParts[0][0]}${
                nameParts[nameParts.length - 1][0]
              }`.toUpperCase()
            : inviteName.substring(0, 2).toUpperCase();
        const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        setMembers((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`, // real id will come from backend later
            name: inviteName,
            initials,
            email: "",
            phone: invitePhone,
            role: "Member",
            color: randomColor,
            autopay: false,
            moveInDate: new Date(),
            moveOutDate: null,
            hasAccount: false,
          },
        ]);
      }

      // reset on success
      setInviteEmail("");
      setInviteName("");
      setInvitePhone("");
      setInviteModalOpen(false);
      setInviteMode("email");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to invite member", {
        description: err.message ?? "Please try again.",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    try {
      const res = await fetch(`/api/household/members/${memberId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to remove member");
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));

      toast.success("Member removed", {
        description: `${member.name} has been removed from the household.`,
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to remove member", {
        description: err.message ?? "Please try again.",
      });
    }
  };

  const handleLeaveHousehold = async () => {
    try {
      const res = await fetch("/api/household/leave", { method: "POST" });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to leave household");

      // Refresh JWT cookie so middleware sees householdId=null
      await update();

      toast.success("Left household", {
        description: "You have left the household successfully.",
      });

      // after update(), go to onboarding (or any non-onboarding route will redirect there)
      router.push("/onboarding").catch(() => {});
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to leave household", {
        description: err.message ?? "Please try again.",
      });
    }
  };

  const handleDeleteHousehold = async () => {
    try {
      const res = await fetch("/api/household/delete", {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete household");
      }

      toast.error("Household deleted", {
        description:
          "The household and all its data have been permanently deleted.",
      });

      router.push("/protected/dashboard").catch(() => {});
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete household", {
        description: err.message ?? "Please try again.",
      });
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner || confirmationText.toUpperCase() !== "TRANSFER") {
      return;
    }

    const newOwner = members.find((m) => m.id === selectedNewOwner);
    if (!newOwner) return;

    try {
      const res = await fetch("/api/household/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to transfer ownership");
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedNewOwner
            ? { ...m, role: "Admin" as const }
            : { ...m, role: "Member" as const },
        ),
      );

      setTransferStep("success");
      toast.success(
        `Ownership transferred to ${newOwner.name.replace(" (You)", "")}.`,
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to transfer ownership", {
        description: err.message ?? "Please try again.",
      });
    }
  };

  const handleOpenTransferModal = () => {
    setTransferOwnershipModalOpen(true);
    setTransferStep("select");
    setSelectedNewOwner("");
    setConfirmationText("");
  };

  const totalMembers = members.length;
  const adminCount = members.filter((m) => m.role === "Admin").length;
  const memberCount = totalMembers - adminCount;

  const smsOnlyCount = members.filter((m) => !m.hasAccount && m.phone).length;

  // --- JSX ---

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading household…</div>;
  }

  return (
    <>
      <Dialog
        open={!!editingSplitUtilityId}
        onOpenChange={(open) => {
          if (!open) setEditingSplitUtilityId(null);
        }}
      >
        <DialogContent
          className="
          w-[95vw] max-w-[980px]
          h-[90vh] sm:h-[80vh] md:h-[65vh] max-h-[90vh] sm:max-h-[80vh] md:max-h-[65vh]
          overflow-hidden
          overflow-x-hidden
          p-0
          min-w-0
        "
        >
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 min-w-0">
            {editingUtility && editingSplit ? (
              <UtilitySplitEditor
                utilityId={editingUtility.id}
                utilityName={editingUtility.provider}
                members={members.map((m) => ({
                  id: m.id,
                  name: m.name,
                  initials: m.initials,
                  color: m.color,
                  phone: (m as any).phone,
                  email: m.email,
                }))}
                split={editingSplit}
                onSplitChange={(newSplit) =>
                  handleSaveUtilitySplit(editingUtility.id, newSplit)
                }
                isAdmin={isAdmin || editingUtility.ownerId === currentUserId}
                totalBillAmount={100}
                onClose={() => setEditingSplitUtilityId(null)}
              />
            ) : (
              <div className="text-sm text-gray-500">Loading split…</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Member Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] rounded-lg">
          <DialogHeader>
            <DialogTitle
              className="text-lg sm:text-xl"
              style={{ fontWeight: 600 }}
            >
              Invite New Member
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Send an invitation to join this household.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 sm:py-4">
            <Label
              className="text-sm text-gray-900 mb-2 block"
              style={{ fontWeight: 600 }}
            >
              Email Address
            </Label>
            <Input
              type="email"
              placeholder="roommate@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-10 sm:h-11 rounded-lg border-gray-300"
            />
          </div>
          {/* <div className="py-3 sm:py-4">
            <Label
              className="text-sm text-gray-900 mb-2 block"
              style={{ fontWeight: 600 }}
            >
              Name
            </Label>
            <Input
              type="text"
              placeholder="Full Name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="h-10 sm:h-11 rounded-lg border-gray-300"
            />
          </div>
          <div className="py-3 sm:py-4">
            <Label
              className="text-sm text-gray-900 mb-2 block"
              style={{ fontWeight: 600 }}
            >
              Phone Number
            </Label>
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              className="h-10 sm:h-11 rounded-lg border-gray-300"
            />
          </div>
          <div className="py-3 sm:py-4">
            <Label
              className="text-sm text-gray-900 mb-2 block"
              style={{ fontWeight: 600 }}
            >
              Invite Mode
            </Label>
            <Select
              value={inviteMode}
              onValueChange={(value) => setInviteMode(value as "email" | "sms")}
            >
              <SelectTrigger
                className="w-full sm:w-48 h-9"
                style={{ fontSize: "14px" }}
              >
                <SelectValue placeholder="Invite mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div> */}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setInviteModalOpen(false)}
              className="rounded-lg w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteMember}
              disabled={
                inviteMode === "email"
                  ? !inviteEmail
                  : !(inviteName && invitePhone)
              }
              className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg w-full sm:w-auto"
              style={{ fontWeight: 600 }}
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Household Info Modal */}
      <Dialog open={editInfoModalOpen} onOpenChange={setEditInfoModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[520px] rounded-lg">
          <DialogHeader>
            <DialogTitle
              className="text-lg sm:text-xl"
              style={{ fontWeight: 600 }}
            >
              Edit Household Info
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Update your household name and address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 sm:py-4">
            <div>
              <Label
                className="text-sm text-gray-900 mb-2 block"
                style={{ fontWeight: 600 }}
              >
                Household Name
              </Label>
              <Input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="h-10 sm:h-11 rounded-lg border-gray-300"
              />
            </div>
            <div>
              <Label
                className="text-sm text-gray-900 mb-2 block"
                style={{ fontWeight: 600 }}
              >
                Address
              </Label>
              <Input
                type="text"
                value={householdAddress}
                onChange={(e) => setHouseholdAddress(e.target.value)}
                className="h-10 sm:h-11 rounded-lg border-gray-300"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setEditInfoModalOpen(false)}
              className="rounded-lg w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const res = await fetch("/api/household/data", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: householdName,
                      address: householdAddress,
                    }),
                  });

                  const data = await res.json().catch(() => null);
                  if (!res.ok) {
                    throw new Error(
                      data?.error || "Failed to update household",
                    );
                  }

                  toast.success("Household info updated");
                  setEditInfoModalOpen(false);
                } catch (err: any) {
                  console.error(err);
                  toast.error("Failed to update household", {
                    description: err.message ?? "Please try again.",
                  });
                }
              }}
              className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg w-full sm:w-auto"
              style={{ fontWeight: 600 }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Modal */}
      <Dialog
        open={transferOwnershipModalOpen}
        onOpenChange={setTransferOwnershipModalOpen}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[520px] rounded-lg">
          <DialogHeader>
            <DialogTitle
              className="text-lg sm:text-xl"
              style={{ fontWeight: 600 }}
            >
              Transfer Household Ownership
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Choose a new admin for this household.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 sm:py-4">
            {transferStep === "select" && (
              <div>
                <Label
                  className="text-sm text-gray-900 mb-2 block"
                  style={{ fontWeight: 600 }}
                >
                  Select New Admin
                </Label>
                <Select
                  value={selectedNewOwner}
                  onValueChange={(value) => setSelectedNewOwner(value)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger
                    className="w-full h-9"
                    style={{ fontSize: "14px" }}
                  >
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback
                              style={{
                                backgroundColor: member.color,
                                color: "white",
                                fontSize: "10px",
                                fontWeight: 600,
                              }}
                            >
                              {member.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {transferStep === "confirm" && (
              <div>
                <Label
                  className="text-sm text-gray-900 mb-2 block"
                  style={{ fontWeight: 600 }}
                >
                  Confirm Transfer
                </Label>
                <Input
                  type="text"
                  placeholder="Type TRANSFER to confirm"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  className="h-10 sm:h-11 rounded-lg border-gray-300"
                />
              </div>
            )}
            {transferStep === "success" && (
              <div>
                <Label
                  className="text-sm text-gray-900 mb-2 block"
                  style={{ fontWeight: 600 }}
                >
                  Transfer Successful
                </Label>
                <p className="text-sm text-gray-600">
                  Ownership has been transferred to{" "}
                  {members.find((m) => m.id === selectedNewOwner)?.name}.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setTransferOwnershipModalOpen(false)}
              className="rounded-lg w-full sm:w-auto"
            >
              Cancel
            </Button>
            {transferStep === "select" && (
              <Button
                onClick={() => setTransferStep("confirm")}
                disabled={!selectedNewOwner}
                className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg w-full sm:w-auto"
                style={{ fontWeight: 600 }}
              >
                Next
              </Button>
            )}
            {transferStep === "confirm" && (
              <Button
                onClick={handleTransferOwnership}
                disabled={confirmationText.toUpperCase() !== "TRANSFER"}
                className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg w-full sm:w-auto"
                style={{ fontWeight: 600 }}
              >
                Transfer Ownership
              </Button>
            )}
            {transferStep === "success" && (
              <Button
                onClick={() => setTransferOwnershipModalOpen(false)}
                className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg w-full sm:w-auto"
                style={{ fontWeight: 600 }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parent View Banner (disabled for now because isParentView = false) */}
      {isParentView && (
        <Card
          className="rounded-lg border bg-[#F6F6F6]"
          style={{
            borderColor: "#E5E7EB",
          }}
        >
          <div className="px-3 sm:px-4 py-3 flex items-center gap-3">
            <ActivityIcon className="h-5 w-5 text-[#6B7280] flex-shrink-0" />
            <p
              className="text-xs sm:text-[13px] text-[#374151]"
              style={{ fontWeight: 500 }}
            >
              You are viewing household settings for{" "}
              <span style={{ fontWeight: 600 }}>{sponsoredMemberName}</span>.
              Editing is restricted for parent accounts.
            </p>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="mt-4 px-4 sm:px-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
          <Home
            className="h-6 w-6 sm:h-7 sm:w-7"
            style={{ color: "#008a4b" }}
          />
          <h1
            className="text-2xl sm:text-[28px] text-gray-900"
            style={{ fontWeight: 600 }}
          >
            Household
          </h1>
          {isAdmin && (
            <Badge
              className="bg-[#E9F7EE] text-[#008a4b] border-0"
              style={{ fontWeight: 600 }}
            >
              <Crown className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Manage members, utilities, and payment settings for your home.
        </p>
        <div className="flex items-start gap-2 text-sm text-gray-700">
          <MapPin className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
          <span className="break-words">{householdAddress}</span>
        </div>
      </div>

      {/* Household Summary Card */}
      <Card className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 mx-4 sm:mx-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <ActivityIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2
                className="text-base sm:text-lg text-gray-900"
                style={{ fontWeight: 600 }}
              >
                Household Summary
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Overview of your household activity
              </p>
            </div>
          </div>
          {!isParentView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditInfoModalOpen(true)}
              disabled={!isAdmin}
              className="rounded-lg text-sm w-full sm:w-auto"
              style={{ fontWeight: 600 }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Household Info
            </Button>
          )}
        </div>

        {/* Stats Grid - responsive from 1 column on mobile to 2 on tablet to 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Household Invite Code */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-slate-600" />
              </div>
            </div>
            <p
              className="text-xl sm:text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {inviteCode}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              Household Invite Code
            </p>
          </div>

          {/* Members */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p
              className="text-xl sm:text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {totalMembers}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              {adminCount} Admin{adminCount !== 1 ? "s" : ""}, {memberCount}{" "}
              Member{memberCount !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Utilities */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Zap className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <p
              className="text-xl sm:text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {utilities.length}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">Linked Utilities</p>
          </div>

          {/* Created Date */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p
              className="text-xl sm:text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {createdAt ? formatMonthYear(createdAt) : "—"}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              Household Created
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 my-4 sm:my-6" />

        {/* Quick Info */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p
                  className="text-sm text-gray-900 mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Next Due
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {nextDueBill
                    ? `${new Date(nextDueBill.dueDate).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )} • ${nextDueBill.biller || "Bill"}`
                    : "—"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() =>
                router.push("/protected/dashboard/bills").catch(() => {})
              }
              className="text-[#008a4b] hover:text-[#00A040] hover:bg-green-50 text-sm w-full sm:w-auto justify-start sm:justify-center"
              style={{ fontWeight: 500 }}
            >
              View Bills
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p
                  className="text-sm text-gray-900 mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Total Outstanding
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  ${totalOutstanding.toFixed(2)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() =>
                router.push("/protected/dashboard/payments").catch(() => {})
              }
              className="text-[#008a4b] hover:text-[#00A040] hover:bg-green-50 text-sm w-full sm:w-auto justify-start sm:justify-center"
              style={{ fontWeight: 500 }}
            >
              View Payments
            </Button>
          </div>
        </div>
      </Card>

      {/* Members */}
      <Card className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 mx-4 sm:mx-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2
              className="text-base sm:text-lg text-gray-900"
              style={{ fontWeight: 600 }}
            >
              Members
            </h2>
            {!isParentView && smsOnlyCount > 0 && (
              <Badge
                className="bg-blue-50 text-blue-700 border-blue-200"
                style={{ fontWeight: 600 }}
              >
                {smsOnlyCount} SMS-Only
              </Badge>
            )}
          </div>
          {!isParentView && (
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={handleOpenTransferModal}
                        className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg text-xs sm:text-sm"
                        style={{ fontWeight: 600 }}
                      >
                        <Repeat className="h-3.5 w-3.5 mr-1.5" />
                        <span className="hidden sm:inline">
                          Transfer Ownership
                        </span>
                        <span className="sm:hidden">Transfer</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Reassign the household admin role to another member
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                size="sm"
                onClick={() => setInviteModalOpen(true)}
                disabled={!isAdmin}
                className="bg-[#008a4b] hover:bg-[#00A040] text-white rounded-lg text-xs sm:text-sm"
                style={{ fontWeight: 600 }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Member
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border border-gray-200 gap-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: member.color, color: "#FFFFFF" }}
                  >
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p
                      className="text-sm text-gray-900 truncate"
                      style={{ fontWeight: 600 }}
                    >
                      {member.name}
                    </p>
                    <Badge
                      variant="secondary"
                      className="text-xs border-gray-300 flex-shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      {member.role}
                    </Badge>
                    {member.hasAccount ? (
                      <Badge
                        variant="default"
                        className="text-[#008a4b] border-0 text-xs flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Account Active</span>
                        <span className="sm:hidden">Active</span>
                      </Badge>
                    ) : (
                      <Badge
                        className="bg-blue-50 text-blue-700 border-0 text-xs flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        SMS Only
                      </Badge>
                    )}
                    {member.autopay && member.hasAccount && (
                      <Badge
                        className="bg-[#E9F7EE] text-[#008a4b] border-0 text-xs flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        Autopay On
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {member.hasAccount ? (
                      <>
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </>
                    ) : (
                      <>
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{member.phone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {!member.hasAccount && member.phone && !isParentView && (
                  <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <span
                      className="text-xs text-blue-700"
                      style={{ fontWeight: 600 }}
                    >
                      Auto SMS Active
                    </span>
                  </div>
                )}

                {isAdmin && !isParentView && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                                style={{ fontWeight: 600 }}
                              >
                                <Trash2 className="h-4 w-4 sm:mr-1.5" />
                                <span className="hidden sm:inline">Remove</span>
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {!isAdmin && (
                            <TooltipContent>
                              <p className="text-xs">
                                Only the household admin can edit or remove
                                members
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </AlertDialogTrigger>

                    <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This member will be removed from your household and
                          will no longer have access to shared bills, payments,
                          or utilities.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="w-full sm:w-auto">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          Remove Member
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------ */}
      {/* ✅ Bill Configuration */}
      {/* ------------------------------------------------------ */}
      <Card
        id="section-bills"
        className="rounded-xl border border-gray-200 bg-white p-6"
        style={{ scrollMarginTop: "100px" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#111827",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Bill Configuration{" "}
          </h2>
          {!isParentView && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push("/protected/dashboard/utilities").catch(() => {});
              }}
              className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
              style={{ fontWeight: 600 }}
            >
              {" "}
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Service{" "}
            </Button>
          )}{" "}
        </div>
        <div className="space-y-4">
          {utilities.map((utility) => {
            const Icon = utility.icon as any;
            const owner = members.find((m) => m.id === utility.ownerId);
            const split = utilitySplits[utility.id];

            const canEdit =
              !isParentView &&
              !!currentUserId &&
              utility.ownerId === currentUserId;

            const includedSplits =
              split?.memberSplits?.filter((ms) => ms.included) || [];
            const isExpanded = expandedUtilities.has(utility.id);

            return (
              <div
                key={utility.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* ✅ Collapsible Header */}
                <div
                  className="flex items-start sm:items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-3"
                  onClick={() => toggleUtilityExpanded(utility.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Chevron */}
                    <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                      style={{ backgroundColor: utility.iconBg }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: utility.iconColor }}
                      />
                    </div>

                    {/* Provider info */}
                    <div className="min-w-0">
                      <p
                        className="text-sm text-gray-900 truncate"
                        style={{ fontWeight: 600 }}
                      >
                        {utility.provider}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {utility.type} · Account {utility.accountNumber}
                      </p>
                    </div>
                  </div>

                  {/* Right side: owner + dropdown + manage/lock */}
                  <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
                      {/* Owner pill */}
                      <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback
                            style={{
                              backgroundColor: owner?.color || "#9CA3AF",
                              color: "white",
                              fontSize: "10px",
                              fontWeight: 600,
                            }}
                          >
                            {owner?.initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="text-sm text-gray-900"
                          style={{ fontWeight: 600 }}
                        >
                          {owner?.name || "Unknown"}
                        </span>
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#008a4b]">
                          <Check
                            className="h-3 w-3 text-white"
                            style={{ strokeWidth: 3 }}
                          />
                        </div>
                      </div>

                      {/* ✅ Dropdown per utility */}
                      <div
                        className="w-full sm:w-[190px]"
                        onClick={(e) => e.stopPropagation()} // IMPORTANT: don’t toggle accordion when using dropdown
                      >
                        <Select
                          disabled={!canEdit}
                          value={splitModeByUtilityId[utility.id] ?? "equal"}
                          onValueChange={(v) =>
                            onChangeSplitMode(utility.id, v as SplitMode)
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Split method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equal">
                              Equal (Automatic)
                            </SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Manage/Lock */}
                      {canEdit ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 text-xs"
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  color: "#6B7280",
                                  borderColor: "#D1D5DB",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router
                                    .push("/protected/dashboard/utilities")
                                    .catch(() => {});
                                }}
                              >
                                Manage / Unlink
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Edit account settings or unlink utility
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Lock className="h-4 w-4 text-gray-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Only {owner?.name || "the owner"} can edit this
                                utility account
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </div>

                {/* ✅ Expanded content (your existing split detail UI) */}
                {isExpanded && split && (
                  <div
                    className="px-3 sm:px-4 pb-3 sm:pb-4 pt-3 border-t"
                    style={{ borderColor: "#F3F4F6" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Keep your existing pie + breakdown */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-shrink-0 mx-auto sm:mx-0">
                        <UtilitySplitPie
                          data={includedSplits.map((ms) => {
                            const m = members.find(
                              (mm) => mm.id === ms.memberId,
                            );
                            return {
                              name: m?.name || "Unknown",
                              value: ms.value,
                              color: m?.color || "#9CA3AF",
                            };
                          })}
                        />
                      </div>

                      <div className="flex-1 space-y-1.5 w-full">
                        {includedSplits.map((ms) => {
                          const m = members.find((mm) => mm.id === ms.memberId);
                          return (
                            <div
                              key={`${utility.id}-${ms.memberId}`}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: m?.color || "#9CA3AF",
                                  }}
                                />
                                <span
                                  className="text-xs text-gray-700 truncate"
                                  style={{ fontWeight: 500 }}
                                >
                                  {m?.name || "Unknown"}
                                </span>
                              </div>
                              <span
                                className="text-xs text-gray-500 flex-shrink-0 ml-2"
                                style={{ fontWeight: 600 }}
                              >
                                {(ms.value || 0).toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Activity */}
      <div className="mx-4 sm:mx-0">
        <RecentActivity activities={activities} />
      </div>

      {/* Danger Zone */}
      {!isParentView && (
        <Card className="rounded-lg border-2 border-red-200 bg-red-50/30 p-4 sm:p-6 mx-4 sm:mx-0">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <h2
              className="text-base sm:text-lg text-red-900"
              style={{ fontWeight: 600 }}
            >
              Danger Zone
            </h2>
          </div>

          <div className="space-y-4">
            {/* Leave Household */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg bg-white border border-red-200 gap-3">
              <div className="flex-1">
                <p
                  className="text-sm text-gray-900 mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Leave Household
                </p>
                <p className="text-sm text-gray-600">
                  Remove yourself from this household. You can join again with
                  an invite.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50 rounded-lg w-full sm:w-auto sm:ml-4"
                    style={{ fontWeight: 600 }}
                  >
                    Leave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Household?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be removed from this household and lose access to
                      all shared bills and payment history. You can join again
                      if invited.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveHousehold}
                      className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                    >
                      Leave Household
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Delete Household - Only visible to Admin */}
            {isAdmin && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg bg-white border border-red-300 gap-3">
                <div className="flex-1">
                  <p
                    className="text-sm text-red-900 mb-1"
                    style={{ fontWeight: 600 }}
                  >
                    Delete Household
                  </p>
                  <p className="text-sm text-gray-600">
                    Permanently delete this household and all its data. This
                    cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-600 text-red-700 hover:bg-red-100 rounded-lg w-full sm:w-auto sm:ml-4"
                      style={{ fontWeight: 600 }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete Household Permanently?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All members will lose
                        access, and all bills, payment history, and settings
                        will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteHousehold}
                        className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                      >
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Parent View Footer Note (hidden for now) */}
      {isParentView && (
        <div className="bg-[#F9FAFB] border-t border-[#E5E7EB] rounded-lg px-4 py-3 mx-4 sm:mx-0">
          <p
            className="text-[12px] text-[#6B7280] text-center"
            style={{ lineHeight: 1.5 }}
          >
            This is a read-only view. To update household or payment settings,
            contact the household admin. To stop sponsoring{" "}
            {sponsoredMemberName}, go to{" "}
            <span
              style={{
                fontWeight: 600,
                color: "#008a4b",
                cursor: "pointer",
              }}
              onClick={() =>
                router.push("/protected/dashboard/payments").catch(() => {})
              }
            >
              Payment Settings
            </span>
            .
          </p>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------
// getServerSideProps – auth gate only for now
// ------------------------------------------------------

export const getServerSideProps: GetServerSideProps<
  HouseholdPageProps
> = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  // Later: fetch household, activities, etc. and pass as props.
  return {
    props: {},
  };
};
