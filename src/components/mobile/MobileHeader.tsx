import { Bell, ChevronLeft } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  hello?: boolean;
  back?: boolean;
  onBack?: () => void;
  onNotify?: () => void;
  notifyDot?: boolean;
}

export const MobileHeader = ({ title, hello, back, onBack, onNotify, notifyDot }: MobileHeaderProps) => (
  <header className="glass-bar sticky top-0 z-40 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
    <div className="mx-auto flex min-h-[var(--header-h)] w-full max-w-md items-center gap-2 px-3">
      {back ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại"
          className="touch-target flex h-10 w-10 items-center justify-center rounded-xl bg-card text-foreground shadow-mobile"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {hello ? <Logo size="sm" subtitle="" className="shrink-0" /> : null}
      <h1 className={cn("min-w-0 flex-1 truncate font-display text-[17px] font-extrabold tracking-tight text-foreground", hello && "sr-only")}>
        {title || "ONHRM"}
      </h1>
      <button
        type="button"
        onClick={onNotify}
        aria-label="Tin tức và thông báo"
        className="touch-target relative flex h-10 w-10 items-center justify-center rounded-xl bg-card text-foreground shadow-mobile"
      >
        <Bell className="h-[18px] w-[18px]" />
        {notifyDot ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-orange" /> : null}
      </button>
    </div>
  </header>
);
