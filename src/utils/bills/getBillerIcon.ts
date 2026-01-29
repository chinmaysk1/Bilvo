import {
  Droplets,
  Flame,
  Home,
  Receipt,
  Recycle,
  ShoppingCart,
  Toilet,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

export const getBillerIcon = (billerType: string) => {
  const type = (billerType || "").toLowerCase();
  if (type.includes("internet")) {
    return { icon: Wifi, iconColor: "#8B5CF6", iconBg: "#EDE9FE" };
  } else if (type.includes("gas")) {
    return { icon: Flame, iconColor: "#EF4444", iconBg: "#FEE2E2" };
  } else if (type.includes("water")) {
    return { icon: Droplets, iconColor: "#3B82F6", iconBg: "#DBEAFE" };
  } else if (type.includes("electric")) {
    return { icon: Zap, iconColor: "#F59E0B", iconBg: "#FEF3C7" };
  } else if (type.includes("waste")) {
    return { icon: Recycle, iconColor: "#10B981", iconBg: "#D1FAE5" };
  }

  if (type.includes("misc_") || type.includes("manual")) {
    if (type.includes("grocery") || type.includes("groceries")) {
      return { icon: ShoppingCart, iconColor: "#16A34A", iconBg: "#DCFCE7" };
    } else if (type.includes("toilet") || type.includes("paper")) {
      return { icon: Toilet, iconColor: "#0EA5E9", iconBg: "#E0F2FE" };
    } else if (
      type.includes("rent") ||
      type.includes("mortgage") ||
      type.includes("housing") ||
      type.includes("home")
    ) {
      return { icon: Home, iconColor: "#6366F1", iconBg: "#E0E7FF" };
    } else if (
      type.includes("repair") ||
      type.includes("maintenance") ||
      type.includes("fix")
    ) {
      return { icon: Wrench, iconColor: "#F97316", iconBg: "#FFEDD5" };
    }
  }

  return { icon: Receipt, iconColor: "#6B7280", iconBg: "#F3F4F6" };
};
