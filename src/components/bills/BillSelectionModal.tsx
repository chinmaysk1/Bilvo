// Component to add to your bills page

import { Calendar, Droplet, Flame, Trash2, Wifi, Zap } from "lucide-react";
import { useState } from "react";
import { FoundBill } from "@/interfaces/bills";

export default function BillSelectionModal({
  foundBills,
  onClose,
  onImport,
  memberCount,
}: {
  foundBills: FoundBill[];
  onClose: () => void;
  onImport: (selectedBills: any[]) => void;
  memberCount: number;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(foundBills.map((b) => b.id))
  );
  const [isImporting, setIsImporting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const toggleBill = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === foundBills.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(foundBills.map((b) => b.id)));
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const billsToImport = foundBills.filter((b) => selectedIds.has(b.id));

      const res = await fetch("/api/bills/import-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bills: billsToImport,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to import bills");
      }

      const { bills } = await res.json();
      onImport(bills);
    } catch (error) {
      console.error("Error importing bills:", error);
      alert("Failed to import selected bills");
    } finally {
      setIsImporting(false);
    }
  };

  const getBillerIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "internet":
        return <Wifi className="w-4 h-4" />;
      case "water":
        return <Droplet className="w-4 h-4" />;
      case "waste":
        return <Trash2 className="w-4 h-4" />;
      case "gas":
        return <Flame className="w-4 h-4" />;
      case "electricity":
        return <Zap className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getIconBgColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "internet":
        return "bg-purple-100 text-purple-600";
      case "water":
        return "bg-blue-100 text-blue-600";
      case "waste":
        return "bg-gray-100 text-gray-600";
      case "gas":
        return "bg-red-100 text-red-600";
      case "electricity":
        return "bg-yellow-100 text-yellow-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Select Bills to Import
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-gray-600">
            Found {foundBills.length} potential bill(s) in your Gmail. Select
            which ones to import.
          </p>
        </div>

        {/* Bills List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {foundBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => toggleBill(bill.id)}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedIds.has(bill.id)
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(bill.id)}
                      onChange={() => toggleBill(bill.id)}
                      className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </div>

                  {/* Icon */}
                  <div
                    className={`p-2 rounded-lg ${getIconBgColor(
                      bill.billerType
                    )}`}
                  >
                    {getBillerIcon(bill.billerType)}
                  </div>

                  {/* Bill Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {bill.biller}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {bill.billerType}
                        </p>
                        {bill.from && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            From: {bill.from}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(bill.amount)}
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          {formatCurrency(bill.amount / memberCount)} your share
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Due {formatDate(bill.dueDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleAll}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                {selectedIds.size === foundBills.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
              <span className="text-sm text-gray-600">
                {selectedIds.size} of {foundBills.length} selected
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedIds.size === 0 || isImporting}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Importing...
                  </>
                ) : (
                  `Import ${selectedIds.size} Bill${
                    selectedIds.size !== 1 ? "s" : ""
                  }`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
