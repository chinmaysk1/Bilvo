// components/dashboard/DashboardLayout.tsx
import { ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import {
  Home,
  FileText,
  BarChart3,
  CreditCard,
  Users,
  ChevronDown,
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const navigation = [
    {
      name: "Overview",
      href: "/dashboard",
      icon: Home,
      current: router.pathname === "/dashboard",
    },
    {
      name: "Bills",
      href: "/dashboard/bills",
      icon: FileText,
      current: router.pathname === "/dashboard/bills",
    },
    {
      name: "Insights",
      href: "/dashboard/insights",
      icon: BarChart3,
      current: router.pathname === "/dashboard/insights",
    },
    {
      name: "Payments",
      href: "/dashboard/payments",
      icon: CreditCard,
      current: router.pathname === "/dashboard/payments",
    },
    {
      name: "Household",
      href: "/dashboard/household",
      icon: Users,
      current: router.pathname === "/dashboard/household",
    },
  ];

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 rounded-lg w-10 h-10 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">B</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Bilvo</span>
              </div>
            </div>
            {/* Household Selector (Left) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Household:</span>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="font-medium text-gray-900">
                  123 Main Street, Apt 4B
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* User Menu (Right) */}
            <div className="flex items-center gap-4 ml-auto">
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-400 text-white font-semibold hover:bg-green-600 transition-colors"
              >
                {getInitials(session?.user?.name)}
              </button>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {session?.user?.name || "User"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-auto ml-10">{children}</main>
      </div>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 rounded-lg w-10 h-10 flex items-center justify-center">
              <span className="text-white text-lg font-bold">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Bilvo</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
            Navigation
          </div>
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    item.current
                      ? "bg-green-50 text-green-700 font-medium border-r-4 border-green-500"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </a>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            © 2025 Bilvo. All rights reserved.
          </div>
        </div>
      </aside>
    </div>
  );
}
