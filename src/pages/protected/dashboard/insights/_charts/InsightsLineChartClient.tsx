import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TrendPoint = { month: string; amount: number };

const LineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-lg px-3 py-2">
        <p className="text-xs text-[#111827]" style={{ fontWeight: 600 }}>
          {label}
        </p>
        <p className="text-xs text-[#16A34A]" style={{ fontWeight: 600 }}>
          ${Number(payload[0].value || 0).toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function InsightsLineChartClient({
  trendData,
}: {
  trendData: TrendPoint[];
}) {
  return (
    <div className="flex-1" style={{ minHeight: "140px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={trendData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E5E7EB"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6B7280", fontSize: 12 }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<LineTooltip />} />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#16A34A"
            strokeWidth={2.5}
            dot={{ fill: "#16A34A", r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
