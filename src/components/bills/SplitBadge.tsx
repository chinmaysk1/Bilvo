import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Scale, Calculator } from "lucide-react";

interface SplitBadgeProps {
  label: string;
  tooltip: string;
  isEqual: boolean;
  variant?: "default" | "compact";
}

export function SplitBadge({
  label,
  tooltip,
  isEqual,
  variant = "default",
}: SplitBadgeProps) {
  const Icon = isEqual ? Scale : Calculator;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge
              className={`text-xs border-0 ${
                isEqual
                  ? "bg-[#E8FFF2] text-[#008a4b]"
                  : "bg-gray-100 text-gray-700"
              }`}
              style={{ fontWeight: 600 }}
            >
              <Icon className="h-3 w-3 mr-1" />
              {variant === "compact" && isEqual
                ? `Equal (${label.split(" ")[1]})`
                : label}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
