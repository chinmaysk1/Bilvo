// components/dashboard/HouseholdCard.tsx
import { Users } from "lucide-react";

interface HouseholdCardProps {
  household: {
    id: string;
    name: string;
    address: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
    }>;
  };
}

export default function HouseholdCard({ household }: HouseholdCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const colors = [
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-purple-100 rounded-lg p-2">
          <Users className="w-5 h-5 text-purple-600" />
        </div>
        <h3 className="font-semibold text-gray-900">Household</h3>
      </div>

      <div className="bg-green-50 rounded-lg p-4 mb-4">
        <div className="text-sm font-medium text-gray-900 mb-1">
          {household.address}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-green-700">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            All active
          </span>
          <span className="text-gray-500">·</span>
          <span className="text-gray-600">
            {household.members.length} bills
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {household.members.slice(0, 3).map((member, index) => (
            <div
              key={member.id}
              className={`w-8 h-8 rounded-full ${
                colors[index % colors.length]
              } flex items-center justify-center text-white text-xs font-semibold border-2 border-white`}
              title={member.name || member.email}
            >
              {getInitials(member.name || member.email)}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center w-12 h-12">
          <svg className="w-full h-full" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray="125.6"
              strokeDashoffset="0"
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Equal 33% split among members
      </div>
    </div>
  );
}
