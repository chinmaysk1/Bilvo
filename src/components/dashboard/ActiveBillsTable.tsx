// components/dashboard/ActiveBillsTable.tsx
import {
  FileText,
  Mail,
  Upload,
  Wifi,
  Flame,
  Trash2,
  Zap,
  Droplet,
  MoreVertical,
} from "lucide-react";

interface Bill {
  id: string;
  source: string;
  biller: string;
  billerType: string;
  amount: number;
  yourShare: number;
  dueDate: string;
  scheduledCharge: string;
  status: string;
}

interface ActiveBillsTableProps {
  bills: Bill[];
}

export default function ActiveBillsTable({ bills }: ActiveBillsTableProps) {
  const getBillerIcon = (type: string) => {
    const iconClass = "w-4 h-4";
    switch (type.toLowerCase()) {
      case "internet":
        return <Wifi className={iconClass} />;
      case "gas":
        return <Flame className={iconClass} />;
      case "waste":
        return <Trash2 className={iconClass} />;
      case "electricity":
        return <Zap className={iconClass} />;
      case "water":
        return <Droplet className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  const getBillerColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "internet":
        return "bg-purple-100 text-purple-600";
      case "gas":
        return "bg-red-100 text-red-600";
      case "waste":
        return "bg-gray-100 text-gray-600";
      case "electricity":
        return "bg-yellow-100 text-yellow-600";
      case "water":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-6">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FileText className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Active Bills
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              Upcoming bills and payment schedule
            </p>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
            <Upload className="w-4 h-4" />
            Upload Bill
          </button>
        </div>
      </div>

      {/* Gmail Auto-import Banner */}
      <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-900">
            Gmail auto-import is <strong>ON</strong> — bills syncing
            automatically · Last sync Today 2:14 PM
          </span>
          <button className="text-green-600 hover:text-green-700">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Biller
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Your Share
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled Charge
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {bill.source === "Gmail" ? (
                      <Mail className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Upload className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-900">{bill.source}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${getBillerColor(
                        bill.billerType
                      )}`}
                    >
                      {getBillerIcon(bill.billerType)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {bill.biller}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${bill.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                  ${bill.yourShare.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(bill.dueDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(bill.scheduledCharge)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {bill.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
