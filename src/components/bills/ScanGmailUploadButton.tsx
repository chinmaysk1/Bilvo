import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import BillSelectionModal from "@/components/bills/BillSelectionModal";
import { FoundBill } from "@/interfaces/bills";

interface ScanGmailUploadButtonProps {
  householdMemberCount: number;
  onBillsImported: (bills: any[]) => void;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ScanGmailUploadButton({
  householdMemberCount,
  onBillsImported,
  label = "Upload Bill",
  className,
  style,
}: ScanGmailUploadButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [foundBills, setFoundBills] = useState<FoundBill[]>([]);
  const [showModal, setShowModal] = useState(false);

  const handleClick = async () => {
    try {
      setIsScanning(true);

      const res = await fetch("/api/bills/scan-gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message =
          (errorData && errorData.error) ||
          "Unable to scan Gmail. Please try again.";
        toast.error("Failed to scan Gmail", { description: message });
        return;
      }

      const data = await res.json();

      const potentials: FoundBill[] = (data.potentialBills || []).map(
        (b: any) => ({
          id: b.id,
          biller: b.biller,
          billerType: b.billerType,
          amount: b.amount,
          dueDate: b.dueDate,
          subject: b.subject,
          from: b.from,
        })
      );

      if (!potentials.length) {
        toast.info("No new bills found in Gmail", {
          description:
            "We didn't find any bill-like emails in the last 90 days.",
        });
        return;
      }

      setFoundBills(potentials);
      setShowModal(true);
    } catch (error) {
      console.error("Error scanning Gmail:", error);
      toast.error("Failed to scan Gmail", {
        description:
          "Something went wrong while connecting to Gmail. Please try again.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <Button
        className={className}
        style={{
          fontWeight: 600,
          fontSize: "13px",
          backgroundColor: "#00B948",
          color: "#FFFFFF",
          border: "none",
          height: "36px",
          paddingLeft: "14px",
          paddingRight: "14px",
          ...style,
        }}
        onClick={handleClick}
        disabled={isScanning}
      >
        {isScanning ? (
          <>
            <svg
              className="h-3.5 w-3.5 mr-1.5 animate-spin"
              viewBox="0 0 24 24"
            >
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
            Scanning Gmail...
          </>
        ) : (
          <>
            <Upload
              className="h-3.5 w-3.5 mr-1.5"
              strokeWidth={2}
              style={{ opacity: 0.9 }}
            />
            {label}
          </>
        )}
      </Button>

      {showModal && foundBills.length > 0 && (
        <BillSelectionModal
          foundBills={foundBills}
          memberCount={householdMemberCount}
          onClose={() => setShowModal(false)}
          onImport={(importedBills: any[]) => {
            onBillsImported(importedBills);
            setShowModal(false);

            if (importedBills && importedBills.length > 0) {
              toast.success(
                `Imported ${importedBills.length} bill${
                  importedBills.length !== 1 ? "s" : ""
                }`,
                {
                  description:
                    "Your new bills have been added. You can now review and pay them.",
                }
              );
            }
          }}
        />
      )}
    </>
  );
}
