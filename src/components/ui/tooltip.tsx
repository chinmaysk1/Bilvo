import * as React from "react";

type TooltipContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextType>({
  open: false,
  setOpen: () => {},
});

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) => {
  const { setOpen } = React.useContext(TooltipContext);

  const handleMouseEnter = () => setOpen(true);
  const handleMouseLeave = () => setOpen(false);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    });
  }

  return (
    <button
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(({ children, className = "", ...props }, ref) => {
  const { open } = React.useContext(TooltipContext);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-[999] pointer-events-auto rounded-md box-border px-4 py-2 text-xs shadow-[0_2px_6px_rgba(0,0,0,0.2)] animate-in fade-in-0 zoom-in-95 bg-[#1ABC54] text-white min-w-[220px] w-auto max-w-sm text-left ${className}`}
      style={{
        backgroundColor: "#1ABC54",
        color: "white",
      }}
      {...props}
    >
      {children}
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-2.5 h-2.5 bg-[#1ABC54] rotate-45 translate-y-[-5px]" />
    </div>
  );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
