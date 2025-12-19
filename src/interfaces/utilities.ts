import { MemberSplit } from "./household";
import type { LucideIcon } from "lucide-react";

export interface UtilityAccount {
  id: string;
  provider: string;
  accountNumber: string;
  type: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  ownerId: string;
}

export interface UtilityAccountOwner {
  id: string;
  name: string | null;
  email: string | null;
}

export interface UtilityAccountResponse {
  id: string;
  householdId: string;
  ownerUserId: string | null;

  // For the left column ("Electricity", "Water", etc.)
  type: string;
  provider: string;
  providerWebsite: string | null;

  // Right-side form
  accountHolderName: string | null;
  email: string | null; // maps from loginEmail in DB
  accountNumber: string | null;

  isLinked: boolean;

  createdAt: string; // ISO
  updatedAt: string; // ISO

  owner: UtilityAccountOwner | null;
}

export interface UtilitySplit {
  utilityId: string;
  splitType: "percentage" | "fixed";
  memberSplits: MemberSplit[];
  isCustom: boolean;
}

export interface UtilityLink {
  id: string;
  householdId: string;
  ownerUserId: string | null;
  type: string; // same as `name` used before
  provider: string;
  providerWebsite?: string | null;
  accountHolderName: string;
  email: string;
  accountNumber: string;
  isLinked: boolean;
  createdAt: string;
  updatedAt: string;

  // for permissions
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;

  // UI-only fields
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}
