// pages/protected/dashboard/activity/index.tsx
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  FileText,
  CreditCard,
  DollarSign,
  UserPlus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Activity } from "@/interfaces/activity";

interface ActivityPageProps {
  activities: Activity[];
}

export default function ActivityPage({
  activities: initialActivities,
}: ActivityPageProps) {
  const [activities] = useState(initialActivities);
  const [filter, setFilter] = useState<string>("all");

  const filteredActivities = activities.filter((activity) => {
    if (filter === "all") return true;
    return activity.type === filter;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "bill_uploaded":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "bill_paid":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "payment_method_added":
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      case "autopay_enabled":
      case "autopay_disabled":
        return <DollarSign className="w-5 h-5 text-amber-600" />;
      case "member_joined":
        return <UserPlus className="w-5 h-5 text-indigo-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case "bill_uploaded":
        return "bg-blue-100";
      case "bill_paid":
        return "bg-green-100";
      case "payment_method_added":
        return "bg-purple-100";
      case "autopay_enabled":
      case "autopay_disabled":
        return "bg-amber-100";
      case "member_joined":
        return "bg-indigo-100";
      default:
        return "bg-gray-100";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const activityTypes = [
    { value: "all", label: "All Activity" },
    { value: "bill_uploaded", label: "Bills" },
    { value: "bill_paid", label: "Payments" },
    { value: "payment_method_added", label: "Payment Methods" },
    { value: "autopay_enabled", label: "Autopay" },
    { value: "member_joined", label: "Members" },
  ];

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="text-gray-600 mt-1">
          View all household activity and transactions
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow mb-6 p-1 flex gap-1 overflow-x-auto">
        {activityTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value)}
            className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors ${
              filter === type.value
                ? "bg-green-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg shadow">
        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No activity found</p>
            <p className="text-sm mt-1">
              Activity will appear here as you use the app
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity) => (
              <div
                key={activity.id}
                className="p-6 flex items-start gap-4 hover:bg-gray-50"
              >
                <div
                  className={`p-2 rounded-lg ${getActivityBgColor(
                    activity.type
                  )}`}
                >
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {activity.description}
                      </p>
                      {activity.detail && (
                        <p className="text-sm text-gray-600 mt-0.5">
                          {activity.detail}
                        </p>
                      )}
                      {activity.source && (
                        <p className="text-xs text-gray-500 mt-1">
                          Source: {activity.source}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {activity.amount && (
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(activity.amount)}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Stats */}
      {activities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Bills</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activities.filter((a) => a.type === "bill_uploaded").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Payments Made</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activities.filter((a) => a.type === "bill_paid").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Methods</p>
                <p className="text-2xl font-bold text-gray-900">
                  {
                    activities.filter((a) => a.type === "payment_method_added")
                      .length
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Fetch activities from the dashboard API
    const response = await fetch(`${baseUrl}/api/dashboard`, {
      headers: {
        Cookie: context.req.headers.cookie || "",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          redirect: {
            destination: "/onboarding",
            permanent: false,
          },
        };
      }
      throw new Error("Failed to fetch activities");
    }

    const data = await response.json();

    return {
      props: {
        activities: data.recentActivity || [],
      },
    };
  } catch (error) {
    console.error("Error loading activity:", error);
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }
};
