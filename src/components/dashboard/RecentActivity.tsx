// components/dashboard/RecentActivity.tsx
import { Clock, CheckCircle2, Upload, CreditCard, Mail } from "lucide-react";

interface Activity {
  id: string;
  type: string;
  description: string;
  amount?: number;
  detail?: string;
  source?: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "payment_success":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "bill_uploaded":
        return <Upload className="w-5 h-5 text-blue-600" />;
      case "payment_method_added":
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "payment_success":
        return "bg-green-100";
      case "bill_uploaded":
        return "bg-blue-100";
      case "payment_method_added":
        return "bg-purple-100";
      default:
        return "bg-gray-100";
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
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return (
        "Yesterday at " +
        date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    } else {
      return (
        date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " at " +
        date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    }
  };

  const groupActivitiesByDate = () => {
    const today: Activity[] = [];
    const yesterday: Activity[] = [];

    activities.forEach((activity) => {
      const date = new Date(activity.timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const isYesterday = date.toDateString() === yesterdayDate.toDateString();

      if (isToday) {
        today.push(activity);
      } else if (isYesterday) {
        yesterday.push(activity);
      }
    });

    return { today, yesterday };
  };

  const { today, yesterday } = groupActivitiesByDate();

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-1">
          <Clock className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
        </div>
        <p className="text-sm text-gray-600">Latest payments and updates</p>
      </div>

      <div className="p-6">
        {today.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Today</h3>
            <div className="space-y-4">
              {today.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div
                    className={`rounded-full p-2 ${getIconBg(activity.type)}`}
                  >
                    {getIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {activity.amount && (
                            <span className="text-sm font-semibold text-gray-900">
                              ${activity.amount.toFixed(2)} to {activity.detail}
                            </span>
                          )}
                          {!activity.amount && activity.detail && (
                            <span className="text-sm text-gray-600">
                              {activity.detail}
                            </span>
                          )}
                          {activity.source && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              <Mail className="w-3 h-3" />
                              {activity.source}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {yesterday.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Yesterday
            </h3>
            <div className="space-y-4">
              {yesterday.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div
                    className={`rounded-full p-2 ${getIconBg(activity.type)}`}
                  >
                    {getIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        {activity.detail && (
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.detail}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <a
            href="/dashboard/activity"
            className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
          >
            View Full Ledger →
          </a>
        </div>
      </div>
    </div>
  );
}
