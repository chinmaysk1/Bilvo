import { Droplets, Flame, Recycle, Wifi, Zap } from "lucide-react";

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
  return { icon: Wifi, iconColor: "#6B7280", iconBg: "#F3F4F6" };
};
