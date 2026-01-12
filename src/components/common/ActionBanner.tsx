import React from "react";
import type { LucideIcon } from "lucide-react";

type ActionBannerVariant = "danger" | "warning" | "info" | "success";

const VARIANT_STYLES: Record<
  ActionBannerVariant,
  {
    container: string;
    border: string;
    icon: string;
    text: string;
    action: string;
  }
> = {
  danger: {
    container: "bg-red-50",
    border: "border-red-500",
    icon: "text-red-500",
    text: "text-red-800",
    action: "text-green-600 hover:text-green-700",
  },
  warning: {
    container: "bg-yellow-50",
    border: "border-yellow-500",
    icon: "text-yellow-600",
    text: "text-yellow-900",
    action: "text-green-600 hover:text-green-700",
  },
  info: {
    container: "bg-blue-50",
    border: "border-blue-500",
    icon: "text-blue-600",
    text: "text-blue-900",
    action: "text-green-600 hover:text-green-700",
  },
  success: {
    container: "bg-green-50",
    border: "border-green-500",
    icon: "text-green-600",
    text: "text-green-900",
    action: "text-green-700 hover:text-green-800",
  },
};

type ActionBannerProps = {
  show: boolean;
  variant?: ActionBannerVariant;
  Icon: LucideIcon;

  title?: string;
  children: React.ReactNode;

  actionLabel: string;
  href?: string;
  onActionClick?: () => void;

  actionDisabled?: boolean;

  className?: string;
};

export function ActionBanner({
  show,
  variant = "danger",
  Icon,
  title = "Action needed",
  children,
  actionLabel,
  href,
  onActionClick,
  actionDisabled,
  className = "",
}: ActionBannerProps) {
  if (!show) return null;

  const s = VARIANT_STYLES[variant];
  const isLink = !!href;

  return (
    <div
      className={[
        s.container,
        "border-l-4",
        s.border,
        "p-4 mb-6 flex items-start justify-between rounded-lg",
        className,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <Icon className={["w-5 h-5 mt-0.5", s.icon].join(" ")} />
        <p className={s.text}>
          <span className="font-semibold">{title}</span> — {children}
        </p>
      </div>

      {isLink ? (
        <a
          href={href}
          className={[
            s.action,
            "font-medium whitespace-nowrap",
            actionDisabled ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          aria-disabled={actionDisabled}
        >
          {actionLabel} →
        </a>
      ) : (
        <button
          type="button"
          onClick={onActionClick}
          disabled={actionDisabled}
          className={[
            s.action,
            "font-medium whitespace-nowrap",
            actionDisabled ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}
