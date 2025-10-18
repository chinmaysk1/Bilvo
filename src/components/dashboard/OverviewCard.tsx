// components/dashboard/OverviewCard.tsx
import { TrendingUp } from "lucide-react";

interface OverviewCardProps {
  billsScheduled: number;
  totalHousehold: number;
  yourShare: number;
}

export default function OverviewCard({
  billsScheduled,
  totalHousehold,
  yourShare,
}: OverviewCardProps) {
  // Mock spending trend data (last 5 months)
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov"];
  const data = [420, 380, 450, 438, yourShare];
  const maxValue = Math.max(...data);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-100 rounded-lg p-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="font-semibold text-gray-900">Overview</h3>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-600">Bills scheduled</span>
          <span className="text-lg font-semibold text-gray-900">
            {billsScheduled}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-600">Total household</span>
          <span className="text-lg font-semibold text-gray-900">
            ${totalHousehold.toFixed(2)}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-600">Your share</span>
          <span className="text-2xl font-bold text-green-600">
            ${yourShare.toFixed(2)}
          </span>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
          Spending Trend
        </div>
        <div className="flex items-end justify-between h-16 gap-2">
          {data.map((value, index) => {
            const height = (value / maxValue) * 100;
            const isLast = index === data.length - 1;

            return (
              <div
                key={months[index]}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full relative">
                  <div
                    className={`w-full rounded-t transition-all ${
                      isLast ? "bg-green-500" : "bg-green-200"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{months[index]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
