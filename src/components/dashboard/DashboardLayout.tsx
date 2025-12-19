// components/dashboard/DashboardLayout.tsx
import { ReactNode, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { BilvoHeader } from "./BilvoHeader";
import { BilvoSidebar } from "./BilvoSidebar";
import { BilvoFooter } from "./BilvoFooter";
import { HouseholdSummary } from "@/interfaces/household";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [household, setHousehold] = useState<HouseholdSummary | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(true);

  // Generate user initials from name
  const getUserInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleLogoClick = () => {
    router.push("/protected/dashboard");
  };

  useEffect(() => {
    // don't fetch until we know session state
    if (status !== "authenticated") {
      setHouseholdLoading(false);
      return;
    }

    const loadHousehold = async () => {
      try {
        const res = await fetch("/api/household/data");
        if (!res.ok) {
          // likely user not in household yet; that's fine
          setHousehold(null);
          return;
        }
        const data = await res.json();

        const { household: h, currentUserId } = data as {
          household: {
            id: string;
            name: string;
            address: string;
            adminId: string;
          };
          currentUserId: string;
        };

        setHousehold({
          id: h.id,
          name: h.name,
          address: h.address,
          isAdmin: h.adminId === currentUserId,
        });
      } catch (err) {
        console.error("Failed to load household for layout:", err);
        setHousehold(null);
      } finally {
        setHouseholdLoading(false);
      }
    };

    loadHousehold();
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row">
      {/* MAIN CONTENT (left side) */}
      <div className="order-1 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <BilvoHeader
          userName={session?.user?.name}
          userInitials={getUserInitials(session?.user?.name)}
          onLogout={handleLogout}
          onLogoClick={handleLogoClick}
          householdName={household?.name}
          householdAddress={household?.address}
          isHouseholdAdmin={household?.isAdmin}
        />

        {/* Page content (scrollable area) */}
        <main className="flex-1 px-6 lg:px-8 py-6 lg:mr-[50px] lg:ml-[50px]">
          {children}
        </main>

        {/* Footer */}
        <BilvoFooter />
      </div>

      {/* SIDEBAR (right side) */}
      <div className="w-[180px] shrink-0 order-2">
        <BilvoSidebar />
      </div>
    </div>
  );
}
