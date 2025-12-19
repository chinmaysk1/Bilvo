import { Avatar, AvatarFallback } from "../ui/avatar";
import { CheckCircle2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface BilvoHeaderProps {
  userName?: string | null;
  userInitials?: string;
  onLogout?: () => void;
  onLogoClick?: () => void;
  householdName?: string;
  householdAddress?: string;
  isHouseholdAdmin?: boolean;
}

export function BilvoHeader({
  userName = "User",
  userInitials = "U",
  onLogout,
  onLogoClick,
  householdName,
  householdAddress,
  isHouseholdAdmin,
}: BilvoHeaderProps) {
  return (
    <header
      className="border-b bg-white"
      style={{ borderColor: "var(--border-light)" }}
    >
      <div className="flex h-16 items-center justify-between px-8">
        {/* Logo and Household */}
        <div className="flex items-center gap-6">
          <button
            onClick={onLogoClick}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
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
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--gray-900)",
                lineHeight: 1.2,
              }}
            >
              Bilvo
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-gray-50">
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--gray-400)",
                  }}
                >
                  Household:
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--gray-900)",
                  }}
                >
                  {householdName}
                </span>
                <ChevronDown
                  className="h-4 w-4"
                  style={{ color: "var(--gray-400)" }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="start">
              <DropdownMenuItem className="flex items-center justify-between">
                <span>
                  {householdName}{" "}
                  <span className="text-xs text-gray-500">
                    ({householdAddress})
                  </span>
                </span>
                <CheckCircle2
                  className="h-4 w-4"
                  style={{ color: "var(--bilvo-green)" }}
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem style={{ color: "#00B948" }}>
                <span>+ Add Household</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Side - Profile */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                <Avatar
                  className="h-9 w-9"
                  style={{ backgroundColor: "#FBBF24" }}
                >
                  <AvatarFallback
                    className="text-white"
                    style={{
                      backgroundColor: "#FBBF24",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--gray-900)",
                  }}
                >
                  {userName}
                </span>
                <ChevronDown
                  className="h-4 w-4"
                  style={{ color: "var(--gray-400)" }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
