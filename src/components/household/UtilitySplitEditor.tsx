// src/components/household/UtilitySplitEditor.tsx
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Check, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { UtilitySplit } from "@/interfaces/utilities";
import { InteractivePieChart } from "./InteractivePieChart";

type Member = {
  id: string;
  name: string;
  initials: string;
  color: string;
  phone?: string;
  email?: string;
};

type UtilitySplitEditorProps = {
  utilityId: string;
  utilityName?: string;
  members: Member[];
  split: UtilitySplit;
  onSplitChange: (split: UtilitySplit) => void;
  isAdmin: boolean;
  totalBillAmount?: number;
  onClose: () => void;
};

// --- split helpers (local, so you don’t need the figma lib/splitUtils) ---
function includedCount(splits: UtilitySplit["memberSplits"]) {
  return splits.filter((ms) => ms.included).length;
}

function calcTotal(split: UtilitySplit) {
  return split.memberSplits.reduce(
    (sum, ms) => sum + (ms.included ? ms.value : 0),
    0,
  );
}

function isValid(split: UtilitySplit) {
  const total = calcTotal(split);
  if (split.splitType === "percentage") return Math.abs(total - 100) < 0.01;
  return true;
}

function equalPercentages(count: number) {
  if (count <= 0) return [];
  const v = 100 / count;
  return new Array(count).fill(v);
}

function equalFractionString(count: number) {
  if (count <= 0) return "—";
  return `1/${count}`;
}

function equalPercentString(count: number) {
  if (count <= 0) return "—";
  return (100 / count).toFixed(2);
}

export function UtilitySplitEditor({
  utilityId,
  utilityName,
  members,
  split,
  onSplitChange,
  isAdmin,
  totalBillAmount = 100,
  onClose,
}: UtilitySplitEditorProps) {
  const [showSaved, setShowSaved] = useState(false);

  const showSavedIndicator = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const equalCount = useMemo(
    () => includedCount(split.memberSplits),
    [split.memberSplits],
  );

  const handleCustomizeToggle = (enabled: boolean) => {
    if (!enabled) {
      // Switching back to Equal Split
      const count = includedCount(split.memberSplits);
      const percents = equalPercentages(count);

      let idx = 0;
      const updatedSplits = split.memberSplits.map((ms) => ({
        ...ms,
        value: ms.included ? percents[idx++] : 0,
      }));

      onSplitChange({
        ...split,
        memberSplits: updatedSplits,
        isCustom: false,
      });

      showSavedIndicator();
      toast.success("Split reset to Equal (100%)");
    } else {
      // Switching to Custom Split
      onSplitChange({ ...split, isCustom: true });
      showSavedIndicator();
    }
  };

  // Figma behavior: when you type a number for one member, other included members
  // auto-adjust so total = 100.
  const handleLegendPercentageChange = (memberId: string, newValue: number) => {
    if (split.splitType !== "percentage") return;

    const constrainedValue = Math.max(1, Math.min(99, Number(newValue || 0)));

    const includedSplits = split.memberSplits.filter((ms) => ms.included);
    const otherMembers = includedSplits.filter(
      (ms) => ms.memberId !== memberId,
    );

    if (otherMembers.length === 0) return;

    const remaining = 100 - constrainedValue;
    const perMember = remaining / otherMembers.length;

    const updatedSplits = split.memberSplits.map((ms) => {
      if (ms.memberId === memberId) return { ...ms, value: constrainedValue };
      if (ms.included) return { ...ms, value: perMember };
      return ms;
    });

    onSplitChange({
      ...split,
      memberSplits: updatedSplits,
      isCustom: true,
    });

    showSavedIndicator();
  };

  const handleInclusionChange = (memberId: string, included: boolean) => {
    const updatedSplits = split.memberSplits.map((ms) =>
      ms.memberId === memberId
        ? { ...ms, included, value: included ? ms.value : 0 }
        : ms,
    );

    // If equal mode, recalc distribution
    if (!split.isCustom) {
      const count = updatedSplits.filter((ms) => ms.included).length;

      if (count > 0 && split.splitType === "percentage") {
        const percents = equalPercentages(count);
        let idx = 0;
        for (const ms of updatedSplits) {
          if (ms.included) ms.value = percents[idx++];
        }
      }

      if (count > 0 && split.splitType === "fixed") {
        const equalValue = Math.floor(totalBillAmount / count);
        for (const ms of updatedSplits) {
          if (ms.included) ms.value = equalValue;
        }
      }
    }

    onSplitChange({ ...split, memberSplits: updatedSplits });
    showSavedIndicator();
  };

  const handleSplitTypeChange = (newType: "percentage" | "fixed") => {
    const count = includedCount(split.memberSplits);

    let updatedSplits: UtilitySplit["memberSplits"];
    if (newType === "percentage") {
      const percents = equalPercentages(count);
      let idx = 0;
      updatedSplits = split.memberSplits.map((ms) => ({
        ...ms,
        value: ms.included ? percents[idx++] : 0,
      }));
    } else {
      const equalValue = count > 0 ? Math.floor(totalBillAmount / count) : 0;
      updatedSplits = split.memberSplits.map((ms) => ({
        ...ms,
        value: ms.included ? equalValue : 0,
      }));
    }

    onSplitChange({
      ...split,
      splitType: newType,
      memberSplits: updatedSplits,
    });
    showSavedIndicator();
  };

  const total = calcTotal(split);
  const valid = isValid(split);
  const hasIncluded = split.memberSplits.some((ms) => ms.included);

  return (
    // ✅ key: min-w-0 + overflow-hidden so nothing can “push” wider than the dialog
    <div className="flex flex-col w-full h-full min-w-0 overflow-x-hidden">
      {/* Title row */}
      <div className="mb-3 flex-shrink-0">
        <p className="text-sm text-[#111827]" style={{ fontWeight: 700 }}>
          {utilityName ? `${utilityName} Split` : "Utility Split"}
        </p>
        <p className="text-xs text-[#6B7280]" style={{ fontWeight: 500 }}>
          Configure who pays for this utility and how it’s split.
        </p>
      </div>

      {/* ✅ main content takes remaining height; NO horizontal overflow */}
      <div className="flex-1 min-h-0 min-w-0 overflow-x-hidden">
        {/* ✅ fixed left column, right column can shrink (minmax(0,1fr)) */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 h-full min-w-0">
          {/* LEFT COLUMN */}
          <div className="flex flex-col items-center justify-start lg:justify-center min-w-0">
            {split.splitType === "percentage" && hasIncluded ? (
              <div className="w-full flex flex-col items-center min-w-0">
                <div className="w-[160px] h-[160px] flex items-center justify-center">
                  <InteractivePieChart
                    members={members}
                    splits={split.memberSplits}
                    onSplitChange={(newSplits: any) => {
                      onSplitChange({
                        ...split,
                        memberSplits: newSplits,
                        isCustom: true,
                      });
                      showSavedIndicator();
                    }}
                    isAdmin={isAdmin && split.isCustom}
                    size={160}
                  />
                </div>

                <div className="mt-3 flex flex-col items-center gap-0.5">
                  <p
                    className="text-[11px]"
                    style={{
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "#4B5563",
                    }}
                  >
                    TOTAL
                  </p>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "18px",
                      color: valid ? "#111827" : "#D97706",
                    }}
                  >
                    {!split.isCustom && split.splitType === "percentage"
                      ? `${equalFractionString(equalCount)} (100%)`
                      : `${Math.round(total)}${
                          split.splitType === "percentage" ? "%" : "$"
                        }`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full rounded-lg border border-dashed border-[#E5E7EB] bg-[#F9FAFB] p-4 text-center">
                <p
                  className="text-xs text-[#6B7280]"
                  style={{ fontWeight: 600 }}
                >
                  No included members
                </p>
                <p
                  className="text-xs text-[#9CA3AF]"
                  style={{ fontWeight: 500 }}
                >
                  Select at least 1 member to see the chart.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col min-w-0 h-full">
            {/* Toggle row */}
            <div className="flex-shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-xs"
                    style={{
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      color: "#374151",
                    }}
                  >
                    CUSTOMIZE
                  </span>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={split.isCustom}
                            onCheckedChange={handleCustomizeToggle}
                            disabled={!isAdmin}
                            className={`${
                              split.isCustom
                                ? "data-[state=checked]:bg-[#008a4b]"
                                : ""
                            } focus-visible:ring-2 focus-visible:ring-[#008a4b] focus-visible:ring-offset-2`}
                          />
                          <span
                            className="text-xs"
                            style={{
                              fontWeight: 700,
                              color: split.isCustom ? "#008a4b" : "#6B7280",
                            }}
                          >
                            {split.isCustom ? "ON" : "OFF"}
                          </span>
                        </div>
                      </TooltipTrigger>

                      {!isAdmin ? (
                        <TooltipContent>
                          <p className="text-xs">
                            Only the bill owner enable custom splits
                          </p>
                        </TooltipContent>
                      ) : (
                        <TooltipContent>
                          <p className="text-xs">
                            {split.isCustom
                              ? "Switch OFF to reset to equal split"
                              : "Switch ON to assign unique percentages"}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {!split.isCustom ? (
                  <Badge
                    className="border-0 text-xs px-2 py-0.5"
                    style={{
                      fontWeight: 700,
                      backgroundColor: "#F3F4F6",
                      color: "#1F2937",
                    }}
                  >
                    Equal Split
                  </Badge>
                ) : (
                  <Badge
                    className="border-0 text-xs px-2 py-0.5"
                    style={{
                      fontWeight: 700,
                      backgroundColor: "#D1FAE5",
                      color: "#047857",
                    }}
                  >
                    Custom Split Active
                  </Badge>
                )}

                {split.isCustom && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="min-w-30">
                          <Select
                            value={split.splitType}
                            onValueChange={(v) =>
                              handleSplitTypeChange(v as "percentage" | "fixed")
                            }
                            disabled={!isAdmin}
                          >
                            <SelectTrigger
                              className="w-40 h-8 border-gray-300 focus:ring-2 focus:ring-[#008a4b] focus:border-[#008a4b]"
                              style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#1F2937",
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage (%)
                              </SelectItem>
                              <SelectItem value="fixed">
                                Fixed Amount ($)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>

                      {!isAdmin && (
                        <TooltipContent>
                          <p className="text-xs">
                            Only the bill owner modify split modes
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {showSaved && (
                <div className="flex items-center gap-1.5 text-[#008a4b] flex-shrink-0">
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-xs" style={{ fontWeight: 700 }}>
                    Saved
                  </span>
                </div>
              )}
            </div>

            {/* ✅ member list gets the remaining space and scrolls internally if needed,
                but never overflows the dialog horizontally */}
            <div className="mt-3 w-full flex-1 min-h-0 pr-2">
              <div className="space-y-1.5 min-w-0">
                {split.memberSplits.map((memberSplit) => {
                  const member = members.find(
                    (m) => m.id === memberSplit.memberId,
                  );
                  if (!member) return null;

                  const rowDisabled = !memberSplit.included;

                  return (
                    <div
                      key={member.id}
                      className={[
                        "flex items-center gap-3 rounded-lg border px-2.5 py-2 transition-all min-w-0",
                        memberSplit.included
                          ? "bg-white border-gray-300"
                          : "bg-gray-50 border-gray-300 opacity-60",
                      ].join(" ")}
                      style={{ minHeight: "44px" }}
                    >
                      {/* Left cluster */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex-shrink-0">
                                <Checkbox
                                  checked={memberSplit.included}
                                  onCheckedChange={(checked) =>
                                    handleInclusionChange(
                                      member.id,
                                      checked as boolean,
                                    )
                                  }
                                  disabled={!isAdmin}
                                  className="data-[state=checked]:bg-[#008a4b] data-[state=checked]:border-[#008a4b] border-gray-400 focus-visible:ring-2 focus-visible:ring-[#008a4b] focus-visible:ring-offset-2"
                                />
                              </div>
                            </TooltipTrigger>
                            {!isAdmin && (
                              <TooltipContent>
                                <p className="text-xs">
                                  Only the bill owner modify member inclusion
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>

                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarFallback
                            style={{
                              backgroundColor: member.color,
                              color: "white",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className="text-sm truncate"
                            style={{
                              fontWeight: 700,
                              color: memberSplit.included
                                ? "#111827"
                                : "#6B7280",
                            }}
                          >
                            {member.name}
                          </span>

                          {member.phone && !member.email && (
                            <Badge
                              variant="outline"
                              className="rounded px-1.5 py-0.5 flex-shrink-0"
                              style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                color: "#6B7280",
                                borderColor: "#D1D5DB",
                                backgroundColor: "#F9FAFB",
                              }}
                            >
                              <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                              SMS
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Right cluster: value */}
                      <div className="flex-shrink-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {!split.isCustom &&
                              split.splitType === "percentage" ? (
                                <div
                                  className="h-8 w-[72px] flex items-center justify-center rounded-lg border"
                                  style={{
                                    fontSize: "12px",
                                    backgroundColor: "#F9FAFB",
                                    borderColor: "#D1D5DB",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: "#374151",
                                    }}
                                  >
                                    {memberSplit.included
                                      ? equalFractionString(equalCount)
                                      : "—"}
                                  </span>
                                </div>
                              ) : (
                                <div className="relative w-[92px]">
                                  <Input
                                    type="number"
                                    value={Math.round(memberSplit.value)}
                                    onChange={(e) =>
                                      handleLegendPercentageChange(
                                        member.id,
                                        parseFloat(e.target.value),
                                      )
                                    }
                                    disabled={
                                      !isAdmin || rowDisabled || !split.isCustom
                                    }
                                    className="h-8 pr-7 text-right border-gray-400 focus-visible:ring-2 focus-visible:ring-[#008a4b] focus-visible:border-[#008a4b]"
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#1F2937",
                                    }}
                                    step="1"
                                    min="0"
                                    max={
                                      split.splitType === "percentage"
                                        ? "100"
                                        : undefined
                                    }
                                  />
                                  <span
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                                    style={{
                                      fontWeight: 700,
                                      color: "#6B7280",
                                    }}
                                  >
                                    {split.splitType === "percentage"
                                      ? "%"
                                      : "$"}
                                  </span>
                                </div>
                              )}
                            </TooltipTrigger>

                            {!isAdmin ? (
                              <TooltipContent>
                                <p className="text-xs">
                                  Only the bill owner modify split values
                                </p>
                              </TooltipContent>
                            ) : !split.isCustom ? (
                              <TooltipContent>
                                <p className="text-xs">
                                  Equal Split ·{" "}
                                  {equalFractionString(equalCount)} each (
                                  {equalPercentString(equalCount)}%)
                                </p>
                              </TooltipContent>
                            ) : (
                              <TooltipContent>
                                <p className="text-xs">
                                  Type a new % - others auto-adjust to 100%
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status banner */}
            <div className="mt-3 flex-shrink-0">
              {!split.isCustom && split.splitType === "percentage" && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg border"
                  style={{ backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" }}
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: "#047857" }}
                  />
                  <p
                    className="text-xs"
                    style={{ fontWeight: 700, color: "#047857" }}
                  >
                    ✓ Equal split active
                    {split.memberSplits.filter((ms) => ms.included).length <
                    split.memberSplits.length
                      ? ` among ${
                          split.memberSplits.filter((ms) => ms.included).length
                        } members`
                      : ""}
                    . Totals automatically balanced.
                  </p>
                </div>
              )}

              {split.isCustom && !valid && split.splitType === "percentage" && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg border"
                  style={{ backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }}
                >
                  <AlertCircle
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: "#B45309" }}
                  />
                  <p
                    className="text-xs"
                    style={{ fontWeight: 600, color: "#92400E" }}
                  >
                    ⚠️ Total split must equal 100%. Current total:{" "}
                    {Math.round(total)}%
                  </p>
                </div>
              )}

              {split.isCustom && valid && split.splitType === "percentage" && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg border"
                  style={{ backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" }}
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: "#047857" }}
                  />
                  <p
                    className="text-xs"
                    style={{ fontWeight: 700, color: "#047857" }}
                  >
                    ✓ Custom split balanced. Total = 100%
                  </p>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div
              className="flex items-center justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0"
              style={{ borderColor: "#E5E7EB" }}
            >
              <Button
                onClick={onClose}
                variant="ghost"
                className="h-9 px-4 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#008a4b] focus-visible:ring-offset-2"
                style={{ fontWeight: 600, fontSize: "13px", color: "#4B5563" }}
              >
                Cancel
              </Button>

              {isAdmin && (
                <Button
                  onClick={() => {
                    // NOTE: this only saves in local state right now.
                    // Hook persistence here later.
                    toast.success("Split configuration saved");
                    onClose();
                  }}
                  className="h-9 px-5 rounded-lg hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#008a4b] focus-visible:ring-offset-2"
                  style={{
                    backgroundColor: "#008a4b",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  Save &amp; Apply
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UtilitySplitEditor;
