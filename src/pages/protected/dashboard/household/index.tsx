import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Activity as DashboardActivity } from "@/interfaces/activity";
import RecentActivity from "@/components/dashboard/RecentActivity";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

// shadcn ui
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  CheckCircle2,
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
} from "lucide-react";

import { toast } from "sonner";
import { formatMonthYear } from "@/utils/common/formatMonthYear";
import { HouseholdApiResponse, Member } from "@/interfaces/household";
import { UtilityAccount, UtilitySplit } from "@/interfaces/utilities";
import { UserMeResponse } from "@/interfaces/user";

// placeholder UtilitySplitEditor – replace with your real component if you have one
type UtilitySplitEditorProps = {
  utilityId: string;
  utilityName: string;
  members: { id: string; name: string; initials: string; color: string }[];
  split: UtilitySplit;
  onSplitChange: (split: UtilitySplit) => void;
  isAdmin: boolean;
  totalBillAmount?: number;
};

function UtilitySplitEditor(props: UtilitySplitEditorProps) {
  const { members, split } = props;

  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-xs text-gray-700">
      <p className="mb-2 font-semibold text-gray-800">
        Split configuration (placeholder)
      </p>
      <div className="space-y-1">
        {split.memberSplits.map((ms) => {
          const m = members.find((mm) => mm.id === ms.memberId);
          if (!m || !ms.included) return null;
          return (
            <div
              key={ms.memberId}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback
                    style={{
                      backgroundColor: m.color,
                      color: "white",
                      fontSize: "10px",
                      fontWeight: 600,
                    }}
                  >
                    {m.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-medium">{m.name}</span>
              </div>
              <span className="text-[11px]">{ms.value.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        This is a placeholder. Replace with your real{" "}
        <code>UtilitySplitEditor</code> component when ready.
      </p>
    </div>
  );
}

// ------------------------------------------------------
// Page component wrapper
// ------------------------------------------------------

type HouseholdPageProps = {}; // still empty props from SSR

export default function HouseholdPage(_props: HouseholdPageProps) {
  return (
    <DashboardLayout>
      <main className="mx-auto space-y-8">
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

  // backend-driven state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [householdName, setHouseholdName] = useState("");
  const [householdAddress, setHouseholdAddress] = useState("");
  const [createdAt, setCreatedAt] = useState<Date | null>(null);

  const [isAdmin, setisAdmin] = useState(false);
  const [isParentView] = useState(false); // keep feature-flag for later
  const sponsoredMemberName = "Alex Chen"; // placeholder for parent view

  const [splitRule, setSplitRule] = useState<"equal" | "custom" | "itemized">(
    "equal"
  );
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [defaultPayment] = useState("Bank of America Checking ••••1234"); // still stub for now

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
  const [utilities, setUtilities] = useState<UtilityAccount[]>([]); // still front-end only for now

  const [utilitySplits, setUtilitySplits] = useState<
    Record<string, UtilitySplit>
  >({});

  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [loading, setLoading] = useState(true);

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
            (householdJson as any).error || "Failed to load household"
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

        setisAdmin(
          householdJson.household.adminId === householdJson.currentUserId
        );

        setAutopayEnabled(userJson.autopayEnabled ?? false);

        // map members from API -> UI members
        const colors = [
          "#F2C94C",
          "#00B948",
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
          }
        );

        setMembers(mappedMembers);

        // (Optional) if you want some placeholder utilities for now, keep your old initial utilities instead of empty
        // setUtilities([...]);

        // initialize splits for whatever utilities exist
        setUtilitySplits((prev) => {
          if (utilities.length === 0 || mappedMembers.length === 0) return prev;
          const splits: Record<string, UtilitySplit> = {};
          utilities.forEach((utility) => {
            const equalValue = 100 / mappedMembers.length;
            splits[utility.id] = {
              utilityId: utility.id,
              splitType: "percentage",
              memberSplits: mappedMembers.map((member) => ({
                memberId: member.id,
                value: equalValue,
                included: true,
              })),
              isCustom: false,
            };
          });
          return splits;
        });

        if (activityRes.ok) {
          setActivities(
            (activitiesJson.activities || []) as DashboardActivity[]
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

  const handleSplitChange = (utilityId: string, newSplit: UtilitySplit) => {
    setUtilitySplits((prev) => ({
      ...prev,
      [utilityId]: newSplit,
    }));
  };

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
      const res = await fetch("/api/household/leave", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to leave household");
      }

      toast.success("Left household", {
        description: "You have left the household successfully.",
      });

      router.push("/protected/dashboard").catch(() => {});
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
            : { ...m, role: "Member" as const }
        )
      );

      setTransferStep("success");
      toast.success(
        `Ownership transferred to ${newOwner.name.replace(" (You)", "")}.`
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
      {/* Invite Member Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-[480px] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontWeight: 600 }}>
              Invite New Member
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Send an invitation to join this household.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
              className="h-11 rounded-lg border-gray-300"
            />
          </div>
          <div className="py-4">
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
              className="h-11 rounded-lg border-gray-300"
            />
          </div>
          <div className="py-4">
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
              className="h-11 rounded-lg border-gray-300"
            />
          </div>
          <div className="py-4">
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
              <SelectTrigger className="w-48 h-9" style={{ fontSize: "14px" }}>
                <SelectValue placeholder="Invite mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteModalOpen(false)}
              className="rounded-lg"
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
              className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
              style={{ fontWeight: 600 }}
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Household Info Modal */}
      <Dialog open={editInfoModalOpen} onOpenChange={setEditInfoModalOpen}>
        <DialogContent className="max-w-[520px] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontWeight: 600 }}>
              Edit Household Info
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Update your household name and address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                className="h-11 rounded-lg border-gray-300"
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
                className="h-11 rounded-lg border-gray-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditInfoModalOpen(false)}
              className="rounded-lg"
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
                      data?.error || "Failed to update household"
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
              className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
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
        <DialogContent className="max-w-[520px] rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontWeight: 600 }}>
              Transfer Household Ownership
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Choose a new admin for this household.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                    className="w-48 h-9"
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
                  className="h-11 rounded-lg border-gray-300"
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferOwnershipModalOpen(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            {transferStep === "select" && (
              <Button
                onClick={() => setTransferStep("confirm")}
                disabled={!selectedNewOwner}
                className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
                style={{ fontWeight: 600 }}
              >
                Next
              </Button>
            )}
            {transferStep === "confirm" && (
              <Button
                onClick={handleTransferOwnership}
                disabled={confirmationText.toUpperCase() !== "TRANSFER"}
                className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
                style={{ fontWeight: 600 }}
              >
                Transfer Ownership
              </Button>
            )}
            {transferStep === "success" && (
              <Button
                onClick={() => setTransferOwnershipModalOpen(false)}
                className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
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
          <div className="px-4 py-3 flex items-center gap-3">
            <ActivityIcon className="h-5 w-5 text-[#6B7280] flex-shrink-0" />
            <p
              className="text-[13px] text-[#374151]"
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
      <div className="mt-4">
        <div className="flex items-center gap-3 mb-2">
          <Home className="h-7 w-7" style={{ color: "#00B948" }} />
          <h1 className="text-[28px] text-gray-900" style={{ fontWeight: 600 }}>
            Household
          </h1>
          {isAdmin && (
            <Badge
              className="bg-[#E9F7EE] text-[#00B948] border-0"
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
          <span>{householdAddress}</span>
        </div>
      </div>

      {/* Household Summary Card */}
      <Card className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ActivityIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg text-gray-900" style={{ fontWeight: 600 }}>
                Household Summary
              </h2>
              <p className="text-sm text-gray-500">
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
              className="rounded-lg text-sm"
              style={{ fontWeight: 600 }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Household Info
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Members */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p
              className="text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {totalMembers}
            </p>
            <p className="text-sm text-gray-500">
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
              className="text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {utilities.length}
            </p>
            <p className="text-sm text-gray-500">Linked Utilities</p>
          </div>

          {/* Created Date */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p
              className="text-2xl text-gray-900 mb-1"
              style={{ fontWeight: 600 }}
            >
              {createdAt ? formatMonthYear(createdAt) : "—"}
            </p>
            <p className="text-sm text-gray-500">Household Created</p>
          </div>
        </div>

        <div className="border-t border-gray-200 my-6" />

        {/* Quick Info */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p
                  className="text-sm text-gray-900 mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Next Bill Due
                </p>
                <p className="text-sm text-gray-500">Dec 15, 2024</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() =>
                router.push("/protected/dashboard/bills").catch(() => {})
              }
              className="text-[#00B948] hover:text-[#00A040] hover:bg-green-50 text-sm"
              style={{ fontWeight: 500 }}
            >
              View Bills
            </Button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p
                  className="text-sm text-gray-900 mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Total Outstanding
                </p>
                <p className="text-sm text-gray-500">$487.32</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() =>
                router.push("/protected/dashboard/payments").catch(() => {})
              }
              className="text-[#00B948] hover:text-[#00A040] hover:bg-green-50 text-sm"
              style={{ fontWeight: 500 }}
            >
              View Payments
            </Button>
          </div>
        </div>
      </Card>

      {/* Utility Accounts */}
      <Card className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg text-gray-900" style={{ fontWeight: 600 }}>
            Utility Accounts
          </h2>
          {!isParentView && (
            <Button
              size="sm"
              disabled={!isAdmin}
              className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
              style={{ fontWeight: 600 }}
              onClick={() =>
                toast.info("Add Utility", {
                  description: "Hook this up to your link-utilities flow.",
                })
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Utility
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {utilities.map((utility) => {
            const Icon = utility.icon;
            const owner = members.find((m) => m.id === utility.ownerId);
            const split = utilitySplits[utility.id];

            return (
              <div
                key={utility.id}
                className="rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: utility.iconBg }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: utility.iconColor }}
                      />
                    </div>
                    <div>
                      <p
                        className="text-sm text-gray-900"
                        style={{ fontWeight: 600 }}
                      >
                        {utility.provider}
                      </p>
                      <p className="text-xs text-gray-500">
                        {utility.type} · Account {utility.accountNumber}
                      </p>
                    </div>
                  </div>

                  {/* Bill Owner */}
                  {isParentView ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs text-gray-500"
                        style={{ fontWeight: 600 }}
                      >
                        BILL OWNER
                      </span>
                      {owner && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback
                              style={{
                                backgroundColor: owner.color,
                                color: "white",
                                fontSize: "10px",
                                fontWeight: 600,
                              }}
                            >
                              {owner.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm text-gray-900"
                            style={{ fontWeight: 600 }}
                          >
                            {owner.name}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs text-gray-500"
                        style={{ fontWeight: 600 }}
                      >
                        BILL OWNER
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Select
                                value={utility.ownerId}
                                onValueChange={(newOwnerId) => {
                                  setUtilities(
                                    utilities.map((u) =>
                                      u.id === utility.id
                                        ? { ...u, ownerId: newOwnerId }
                                        : u
                                    )
                                  );
                                  const newOwner = members.find(
                                    (m) => m.id === newOwnerId
                                  );
                                  if (newOwner) {
                                    toast.success(
                                      `${
                                        utility.type
                                      } ownership updated to ${newOwner.name.replace(
                                        " (You)",
                                        ""
                                      )}.`
                                    );
                                  }
                                }}
                                disabled={!isAdmin}
                              >
                                <SelectTrigger
                                  className="w-48 h-9"
                                  style={{ fontSize: "14px" }}
                                >
                                  <SelectValue placeholder="Select owner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {members.map((member) => (
                                    <SelectItem
                                      key={member.id}
                                      value={member.id}
                                    >
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
                          </TooltipTrigger>
                          {!isAdmin && (
                            <TooltipContent>
                              <p className="text-xs">
                                Only the household admin can edit bill owners
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>

                {/* Split Editor */}
                {split && !isParentView && (
                  <div className="px-4 pb-4">
                    <UtilitySplitEditor
                      utilityId={utility.id}
                      utilityName={utility.provider}
                      members={members.map((m) => ({
                        id: m.id,
                        name: m.name,
                        initials: m.initials,
                        color: m.color,
                      }))}
                      split={split}
                      onSplitChange={(newSplit) =>
                        handleSplitChange(utility.id, newSplit)
                      }
                      isAdmin={isAdmin}
                      totalBillAmount={100}
                    />
                  </div>
                )}
                {split && isParentView && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    <p
                      className="text-xs text-gray-500 mb-2"
                      style={{ fontWeight: 600 }}
                    >
                      SPLIT CONFIGURATION
                    </p>
                    <p className="text-sm text-gray-700">
                      {split.isCustom
                        ? "Custom Split"
                        : `Equal Split — 1/${totalMembers} each`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Members */}
      <Card className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg text-gray-900" style={{ fontWeight: 600 }}>
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
            <div className="flex items-center gap-2">
              {isAdmin && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={handleOpenTransferModal}
                        className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
                        style={{ fontWeight: 600 }}
                      >
                        <Repeat className="h-3.5 w-3.5 mr-1.5" />
                        Transfer Ownership
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
                className="bg-[#00B948] hover:bg-[#00A040] text-white rounded-lg"
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
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback
                    style={{ backgroundColor: member.color, color: "#FFFFFF" }}
                  >
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p
                      className="text-sm text-gray-900"
                      style={{ fontWeight: 600 }}
                    >
                      {member.name}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-xs border-gray-300"
                      style={{ fontWeight: 600 }}
                    >
                      {member.role}
                    </Badge>
                    {member.hasAccount ? (
                      <Badge
                        className="bg-[#E9F7EE] text-[#00B948] border-0 text-xs"
                        style={{ fontWeight: 600 }}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        Account Active
                      </Badge>
                    ) : (
                      <Badge
                        className="bg-blue-50 text-blue-700 border-0 text-xs"
                        style={{ fontWeight: 600 }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        SMS Only
                      </Badge>
                    )}
                    {member.autopay && member.hasAccount && (
                      <Badge
                        className="bg-[#E9F7EE] text-[#00B948] border-0 text-xs"
                        style={{ fontWeight: 600 }}
                      >
                        Autopay On
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {member.hasAccount ? (
                      <>
                        <Mail className="h-3 w-3" />
                        <span>{member.email}</span>
                      </>
                    ) : (
                      <>
                        <Phone className="h-3 w-3" />
                        <span>{member.phone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!member.hasAccount && member.phone && !isParentView && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
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
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ fontWeight: 600 }}
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Remove
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

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This member will be removed from your household and
                          will no longer have access to shared bills, payments,
                          or utilities.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
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

      {/* Payment Preferences */}
      <Card className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-gray-900 mb-6" style={{ fontWeight: 600 }}>
          Payment Preferences
        </h2>

        <div className="space-y-6">
          {/* Default Payment Method */}
          <div className="flex items-center justify-between pb-6 border-b border-gray-200">
            <div>
              <p
                className="text-sm text-gray-900 mb-1"
                style={{ fontWeight: 600 }}
              >
                Default Payment Method
              </p>
              <p className="text-sm text-gray-600">{defaultPayment}</p>
            </div>
            {!isParentView && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                style={{ fontWeight: 600 }}
                onClick={() =>
                  router.push("/protected/dashboard/payments").catch(() => {})
                }
              >
                Change
              </Button>
            )}
          </div>

          {/* Autopay Toggle */}
          <div className="flex items-center justify-between pb-6 border-b border-gray-200">
            <div>
              <p
                className="text-sm text-gray-900 mb-1"
                style={{ fontWeight: 600 }}
              >
                Automatic Payments
              </p>
              <p className="text-sm text-gray-600">
                Pay bills automatically when they're due
              </p>
            </div>
            <Switch
              checked={autopayEnabled}
              onCheckedChange={setAutopayEnabled}
              disabled={!isAdmin || isParentView}
            />
          </div>

          {/* Split Rule */}
          <div>
            <p
              className="text-sm text-gray-900 mb-3"
              style={{ fontWeight: 600 }}
            >
              Split Rule
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={splitRule}
                      onValueChange={(value) =>
                        setSplitRule(value as "equal" | "custom" | "itemized")
                      }
                      disabled={!isAdmin || isParentView}
                    >
                      <SelectTrigger className="h-11 rounded-lg border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equal">Equal Split</SelectItem>
                        <SelectItem value="custom">
                          Custom Percentages
                        </SelectItem>
                        <SelectItem value="itemized">
                          Itemized by Bill
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                {(!isAdmin || isParentView) && (
                  <TooltipContent>
                    <p className="text-xs">
                      {isParentView
                        ? "Parents can only view payment settings"
                        : "Only the admin can modify global split rules"}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <p className="text-xs text-gray-500 mt-2">
              Bills are split equally among all {totalMembers} members (
              {(100 / totalMembers).toFixed(1)}% each)
            </p>
          </div>

          {isParentView && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600" style={{ lineHeight: 1.5 }}>
                Parents can only view payment settings. Changes must be made by
                the household admin.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Recent Activity */}
      <RecentActivity activities={activities} />

      {/* Danger Zone */}
      {!isParentView && (
        <Card className="rounded-lg border-2 border-red-200 bg-red-50/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg text-red-900" style={{ fontWeight: 600 }}>
              Danger Zone
            </h2>
          </div>

          <div className="space-y-4">
            {/* Leave Household */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-red-200">
              <div>
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
                    className="border-red-300 text-red-700 hover:bg-red-50 rounded-lg ml-4"
                    style={{ fontWeight: 600 }}
                  >
                    Leave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Household?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be removed from this household and lose access to
                      all shared bills and payment history. You can join again
                      if invited.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveHousehold}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Leave Household
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Delete Household - Only visible to Admin */}
            {isAdmin && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-red-300">
                <div>
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
                      className="border-red-600 text-red-700 hover:bg-red-100 rounded-lg ml-4"
                      style={{ fontWeight: 600 }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
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
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteHousehold}
                        className="bg-red-600 hover:bg-red-700"
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
        <div className="bg-[#F9FAFB] border-t border-[#E5E7EB] rounded-lg px-4 py-3">
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
                color: "#00B948",
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
