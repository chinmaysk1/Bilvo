import {
  Home,
  FileText,
  CreditCard,
  Users,
  Menu,
  X,
  BarChart3,
  Link2,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export function BilvoSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: Home,
      href: "/protected/dashboard",
    },
    {
      id: "utilities",
      label: "Utilities",
      icon: Link2,
      href: "/protected/dashboard/utilities",
    },
    {
      id: "bills",
      label: "Bills",
      icon: FileText,
      href: "/protected/dashboard/bills",
    },
    {
      id: "insights",
      label: "Insights",
      icon: BarChart3,
      href: "/protected/dashboard/insights",
    },
    {
      id: "payments",
      label: "Payments",
      icon: CreditCard,
      href: "/protected/dashboard/payments",
    },
    {
      id: "household",
      label: "Household",
      icon: Users,
      href: "/protected/dashboard/household",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/protected/dashboard") {
      return router.pathname === "/protected/dashboard";
    }
    return router.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-xl bg-white border shadow-sm hover:bg-gray-50 transition-colors"
        style={{ borderColor: "var(--border)" }}
      >
        {isMobileOpen ? (
          <X className="h-4 w-4" style={{ color: "var(--gray-900)" }} />
        ) : (
          <Menu className="h-4 w-4" style={{ color: "var(--gray-900)" }} />
        )}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/10 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className="hidden lg:flex flex-col w-[180px] h-screen bg-white border-l fixed right-0 top-0 z-40"
        style={{ borderColor: "var(--border-light)" }}
      >
        {/* Logo */}
        <div
          className="p-6 border-b"
          style={{ borderColor: "var(--border-light)" }}
        >
          <Link
            href="/protected/dashboard"
            className="flex items-center gap-2.5 group"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
              style={{ backgroundColor: "var(--bilvo-green)" }}
            >
              <span
                className="text-white"
                style={{ fontSize: "16px", fontWeight: 700 }}
              >
                B
              </span>
            </div>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--gray-900)",
              }}
            >
              Bilvo
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-5">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
                  style={{
                    backgroundColor: active
                      ? "var(--bilvo-green)"
                      : "transparent",
                    color: active ? "white" : "var(--gray-500)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "var(--gray-50)";
                      e.currentTarget.style.color = "var(--gray-900)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--gray-500)";
                    }
                  }}
                >
                  <Icon
                    className="h-5 w-5 flex-shrink-0"
                    strokeWidth={2}
                    style={{ color: active ? "white" : "var(--gray-400)" }}
                  />
                  <span
                    style={{ fontSize: "14px", fontWeight: active ? 600 : 500 }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="p-5 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--gray-400)",
              textAlign: "center",
            }}
          >
            © 2025 Bilvo
          </div>
        </div>
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`lg:hidden flex flex-col w-80 h-screen bg-white border-l fixed right-0 top-0 z-40 transition-transform duration-300 shadow-lg ${
          isMobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ borderColor: "var(--border)" }}
      >
        {/* Logo */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: "var(--border-light)" }}
        >
          <Link
            href="/protected/dashboard"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-2.5 group"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--bilvo-green)" }}
            >
              <span
                className="text-white"
                style={{ fontSize: "14px", fontWeight: 700 }}
              >
                B
              </span>
            </div>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--gray-900)",
              }}
            >
              Bilvo
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-5">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                  style={{
                    backgroundColor: active
                      ? "var(--bilvo-green-bg)"
                      : "transparent",
                    color: active ? "var(--bilvo-green)" : "var(--gray-500)",
                  }}
                >
                  {active && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                      style={{ backgroundColor: "var(--bilvo-green)" }}
                    />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  <span
                    style={{ fontSize: "15px", fontWeight: active ? 600 : 500 }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--gray-400)",
              textAlign: "center",
            }}
          >
            © 2025 Bilvo
          </div>
        </div>
      </aside>
    </>
  );
}
