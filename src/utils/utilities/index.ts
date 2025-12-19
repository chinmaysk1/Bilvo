import { UtilityAccountResponse, UtilityLink } from "@/interfaces/utilities";
import { Zap, Droplets, Flame, Wifi, Link2, Trash } from "lucide-react";

export function getUtilityIconMeta(type: string) {
  switch (type) {
    case "Electricity":
      return { icon: Zap, iconColor: "#F59E0B", iconBg: "#FEF3C7" };
    case "Water":
      return { icon: Droplets, iconColor: "#3B82F6", iconBg: "#DBEAFE" };
    case "Gas":
      return { icon: Flame, iconColor: "#EF4444", iconBg: "#FEE2E2" };
    case "Internet":
      return { icon: Wifi, iconColor: "#8B5CF6", iconBg: "#EDE9FE" };
    case "Waste":
      return { icon: Trash, iconColor: "#10B981", iconBg: "#D1FAE5" };
    default:
      return { icon: Link2, iconColor: "#6B7280", iconBg: "#E5E7EB" };
  }
}

export function mapApiToUtilityLink(u: UtilityAccountResponse): UtilityLink {
  const { icon, iconColor, iconBg } = getUtilityIconMeta(u.type);

  return {
    id: u.id,
    householdId: u.householdId,
    ownerUserId: u.ownerUserId,
    type: u.type,
    provider: u.provider,
    providerWebsite: u.providerWebsite ?? undefined,
    accountHolderName: u.accountHolderName ?? "",
    email: u.email ?? "",
    accountNumber: u.accountNumber ?? "",
    isLinked: u.isLinked,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    owner: u.owner,
    icon,
    iconColor,
    iconBg,
  };
}
