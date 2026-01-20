import { Card } from "../ui/card";
import {
  Mail,
  Upload,
  CheckCircle,
  CreditCard,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useRouter } from "next/router";
import { Activity } from "@/interfaces/activity";

export interface RecentActivityProps {
  activities: Activity[];
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "payment_success":
      return { icon: CheckCircle, bgColor: "#DCFCE7", iconColor: "#16A34A" };
    case "bill_uploaded":
      return { icon: Upload, bgColor: "#F3F4F6", iconColor: "#6B7280" };
    case "bill_imported":
      return { icon: Mail, bgColor: "#DBEAFE", iconColor: "#3B82F6" };
    case "payment_method_added":
      return { icon: CreditCard, bgColor: "#F3E8FF", iconColor: "#9333EA" };
    case "payment_failed":
      return { icon: AlertCircle, bgColor: "#FEE2E2", iconColor: "#DC2626" };
    default:
      return { icon: Clock, bgColor: "#F3F4F6", iconColor: "#6B7280" };
  }
};

const formatTimestamp = (timestamp: string) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return diffMins <= 0 ? "Just now" : `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "1d ago";
  } else {
    return `${diffDays}d ago`;
  }
};

export default function RecentActivity({ activities }: RecentActivityProps) {
  const router = useRouter();

  // Show only the 5 most recent activities
  const recentActivities = activities.slice(0, 5);

  return (
    <Card
      className="rounded-xl border bg-white relative overflow-hidden"
      style={{
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        borderColor: "#E5E7EB",
      }}
    >
      {/* Inner border */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ border: "1px solid #F3F4F6" }}
      />

      {/* Header */}
      <div
        className="px-6 flex items-center justify-between"
        style={{ backgroundColor: "#F9FAFB", height: "40px" }}
      >
        <h2
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#111827",
            lineHeight: 1.5,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Recent Activity
        </h2>
        <button
          onClick={() => router.push("/protected/dashboard/activity")}
          className="transition-colors"
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "#008a4b",
            lineHeight: 1.5,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#00A040";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#008a4b";
          }}
        >
          View All
        </button>
      </div>

      {/* Activity List */}
      <div className="px-6 py-2">
        {recentActivities.length === 0 ? (
          <div className="text-center py-8">
            <Clock
              className="h-8 w-8 mx-auto mb-2"
              style={{ color: "#D1D5DB" }}
            />
            <p
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#9CA3AF",
                fontFamily: "Inter, sans-serif",
              }}
            >
              No recent activity
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {recentActivities.map((activity, index) => {
              const {
                icon: Icon,
                bgColor,
                iconColor,
              } = getActivityIcon(activity.type);

              return (
                <div
                  key={activity.id}
                  className="flex gap-2.5 py-2.5 transition-all duration-200"
                  style={{
                    backgroundColor: "transparent",
                    borderBottom:
                      index < recentActivities.length - 1
                        ? "1px solid #F3F4F6"
                        : "none",
                    minHeight: "36px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Icon */}
                  <div className="flex items-start pt-0.5">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: bgColor }}
                    >
                      <Icon
                        className="h-2.5 w-2.5"
                        style={{ color: iconColor }}
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#111827",
                            lineHeight: 1.4,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {activity.description}
                        </div>
                        {(activity.detail || activity.amount) && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#6B7280",
                              lineHeight: 1.4,
                              fontFamily: "Inter, sans-serif",
                              marginTop: "1px",
                            }}
                          >
                            {activity.amount && (
                              <span className="font-medium">
                                ${activity.amount.toFixed(2)}
                              </span>
                            )}
                            {activity.amount && activity.detail && (
                              <span> · </span>
                            )}
                            {activity.detail}
                          </div>
                        )}
                      </div>
                      <div
                        className="text-right whitespace-nowrap flex-shrink-0"
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "#9CA3AF",
                          fontFamily: "Inter, sans-serif",
                          lineHeight: 1.5,
                        }}
                      >
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
