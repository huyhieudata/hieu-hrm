import type { ReactNode } from "react";
import { Bell, ChevronLeft, ScanLine, Search } from "lucide-react";

import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  variant?: "bar" | "hero";
  compact?: boolean;
  back?: boolean;
  onBack?: () => void;
  onNotify?: () => void;
  onSearch?: () => void;
  onScan?: () => void;
  notifyDot?: boolean;
  companyName?: string;
  personName?: string;
  personMeta?: string;
  initials?: string;
}

const IconButton = ({
  label,
  onClick,
  children,
  light,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  light?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      "relative flex h-11 w-11 items-center justify-center rounded-full",
      light ? "bg-white/10 text-white" : "text-foreground",
    )}
  >
    {children}
  </button>
);

export const MobileHeader = ({
  title,
  variant = "bar",
  compact = false,
  back,
  onBack,
  onNotify,
  onSearch,
  onScan,
  notifyDot,
  companyName,
  personName,
  personMeta,
  initials,
}: MobileHeaderProps) => {
  if (variant === "hero") {
    return (
      <header className={cn("bg-home-header relative overflow-hidden rounded-b-[28px] text-white", compact ? "pb-5" : "pb-24")}>
        <div className="pointer-events-none absolute -right-14 -top-10 h-52 w-52 rounded-full bg-white/[0.07]" />
        <div className="relative z-[1] pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between px-5 pt-2">
            <p className="min-w-0 truncate font-display text-[22px] font-bold tracking-tight">{companyName || "ONHRM"}</p>
            <div className="flex items-center gap-1">
              {onScan ? (
                <IconButton label="Quét QR chấm công" onClick={onScan} light>
                  <ScanLine className="h-5 w-5" strokeWidth={1.8} />
                </IconButton>
              ) : null}
              {onSearch ? (
                <IconButton label="Tìm chức năng" onClick={onSearch} light>
                  <Search className="h-5 w-5" strokeWidth={1.8} />
                </IconButton>
              ) : null}
              <IconButton label="Tin tức và thông báo" onClick={onNotify} light>
                <Bell className="h-5 w-5" strokeWidth={1.8} />
                {notifyDot ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-orange ring-2 ring-brand-navy" /> : null}
              </IconButton>
            </div>
          </div>
          {personName ? (
            <div className="flex items-center gap-3 px-5 pb-1 pt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-[16px] font-bold text-brand-navy ring-2 ring-white/40">
                {initials || "NV"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold">{personName}</p>
                {personMeta ? <p className="mt-0.5 truncate text-[13px] text-white/70">{personMeta}</p> : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-card pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-md items-center gap-1 px-3">
        {back ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className="-ml-1 flex h-11 w-11 items-center justify-center rounded-full text-foreground"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}
        <h1 className={cn("min-w-0 flex-1 truncate font-display font-bold tracking-tight", back ? "text-[18px]" : "px-2 text-[24px]")}>
          {title || "ONHRM"}
        </h1>
        {onNotify ? (
          <IconButton label="Tin tức và thông báo" onClick={onNotify}>
            <Bell className="h-5 w-5" />
            {notifyDot ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-orange" /> : null}
          </IconButton>
        ) : null}
      </div>
    </header>
  );
};
