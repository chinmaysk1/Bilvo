import React from "react";
import { Check } from "lucide-react";

type VerifiedBadgeProps = {
  label?: string; // default "Verified"
  className?: string;
};

export default function VerifiedBadge({
  label = "Verified",
  className = "",
}: VerifiedBadgeProps) {
  return (
    <div
      className={[
        "flex items-center gap-1 px-2 py-1 rounded-md",
        className,
      ].join(" ")}
      style={{ backgroundColor: "#ECFDF5" }}
    >
      <Check className="h-3 w-3" style={{ color: "#008a4b" }} />
      <span
        className="text-[11px]"
        style={{ fontWeight: 600, color: "#008a4b" }}
      >
        {label}
      </span>
    </div>
  );
}
