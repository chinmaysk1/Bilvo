import * as React from "react";
import { ChevronDown, Check } from "lucide-react";

type SelectContextType = {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
};

const SelectContext = React.createContext<SelectContextType | undefined>(
  undefined
);

const useSelectContext = () => {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within a Select");
  }
  return context;
};

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Select({
  value = "",
  onValueChange,
  children,
  disabled,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: onValueChange || (() => {}),
        open,
        setOpen,
        disabled,
      }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>(({ children, className = "", ...props }, ref) => {
  const { open, setOpen, disabled } = useSelectContext();

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => !disabled && setOpen(!open)}
      disabled={disabled}
      className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = useSelectContext();
  const [displayValue, setDisplayValue] = React.useState<string>("");

  React.useEffect(() => {
    // This will be set by SelectItem when it mounts
    const items = document.querySelectorAll("[data-select-item]");
    items.forEach((item) => {
      const itemValue = item.getAttribute("data-value");
      if (itemValue === value) {
        setDisplayValue(item.textContent || "");
      }
    });
  }, [value]);

  return <span>{displayValue || placeholder}</span>;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectContent({
  children,
  className = "",
}: SelectContentProps) {
  const { open, setOpen } = useSelectContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={`absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function SelectItem({
  value,
  children,
  className = "",
}: SelectItemProps) {
  const { value: selectedValue, onValueChange, setOpen } = useSelectContext();
  const isSelected = value === selectedValue;

  const handleClick = () => {
    onValueChange(value);
    setOpen(false);
  };

  return (
    <div
      data-select-item
      data-value={value}
      onClick={handleClick}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
        isSelected ? "bg-accent" : ""
      } ${className}`}
    >
      {children}
      {isSelected && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

export function SelectGroup({ children }: { children: React.ReactNode }) {
  return <div className="px-1 py-1.5">{children}</div>;
}

export function SelectLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
      {children}
    </div>
  );
}

export function SelectSeparator() {
  return <div className="-mx-1 my-1 h-px bg-muted" />;
}
