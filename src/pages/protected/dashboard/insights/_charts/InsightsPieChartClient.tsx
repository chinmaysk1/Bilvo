import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type SpendingItem = {
  name: string;
  value: number;
  color: string;
  icon: any;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-lg px-3 py-2">
        <p className="text-xs text-[#111827]" style={{ fontWeight: 600 }}>
          {payload[0].payload.name}
        </p>
        <p className="text-xs text-[#6B7280]">
          ${Number(payload[0].value || 0).toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function InsightsPieChartClient({
  spendingData,
}: {
  spendingData: SpendingItem[];
}) {
  return (
    <div className="flex-1 flex items-center gap-4">
      <div
        className="flex-shrink-0"
        style={{ width: "140px", height: "140px" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={spendingData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={64}
              dataKey="value"
              nameKey="name"
            >
              {spendingData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 space-y-1.5">
        {spendingData.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <Icon
                  className="h-3 w-3 flex-shrink-0"
                  style={{ color: item.color }}
                />
                <span
                  className="text-[12px] text-[#111827]"
                  style={{ fontWeight: 500 }}
                >
                  {item.name}
                </span>
              </div>
              <span
                className="text-[12px] text-[#111827]"
                style={{ fontWeight: 600 }}
              >
                ${item.value.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
