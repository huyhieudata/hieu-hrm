import { Lock, Power } from "lucide-react";

import { cn } from "@/lib/utils";

import { EMPLOYEE_TABS, type MobileTab } from "./employee-tabs";
import type { PunchMode } from "./use-my-day";

interface MobileTabBarProps {
  tabs?: MobileTab[];
  activeId: string;
  punch?: PunchMode;
  badges?: Partial<Record<string, boolean>>;
  onSelect: (id: string) => void;
  onPunch?: () => void;
}

const tabButtonClass = (active: boolean) =>
  cn(
    "flex h-[52px] min-h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[11px]",
    active ? "bg-primary-subtle font-bold text-brand-navy" : "font-medium text-muted-foreground",
  );

export const MobileTabBar = ({
  tabs = EMPLOYEE_TABS,
  activeId,
  punch = "ready",
  badges,
  onSelect,
  onPunch,
}: MobileTabBarProps) => {
  const pivot = tabs.findIndex((tab) => tab.featured);
  const left = pivot < 0 ? tabs : tabs.slice(0, pivot);
  const featured = pivot < 0 ? null : tabs[pivot];
  const right = pivot < 0 ? [] : tabs.slice(pivot + 1);
  const balanced = !!featured && left.length > 0 && left.length === right.length;
  const columns = left.length + right.length + (featured ? 1 : 0);
  const blocked = punch === "blocked";

  const renderTab = (tab: MobileTab) => {
    const Icon = tab.icon;
    const active = tab.id === activeId;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onSelect(tab.id)}
        aria-current={active ? "page" : undefined}
        className={tabButtonClass(active)}
      >
        <span className="relative flex">
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
          {badges?.[tab.id] ? (
            <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border-2 border-card bg-brand-orange" />
          ) : null}
        </span>
        <span className="whitespace-nowrap">{tab.label}</span>
      </button>
    );
  };

  const punchButton = featured ? (
    <div className={cn("relative min-w-0 self-stretch", balanced ? "h-full" : "h-full w-[72px] shrink-0")}>
      <button
        type="button"
        data-checkin-fab=""
        onClick={onPunch}
        aria-label={blocked ? "Chấm công đang bị chặn" : punch === "in" ? "Ra ca" : "Vào ca"}
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-[calc(50%+26px)] items-center justify-center rounded-full border-4 border-card text-white",
          punch === "in" && "bg-brand-navy shadow-glow-navy",
          punch === "ready" && "bg-brand-orange shadow-primary-glow",
          blocked && "bg-muted-foreground shadow-mobile",
        )}
      >
        {blocked ? <Lock className="h-6 w-6" strokeWidth={2.2} /> : <Power className="h-6 w-6" strokeWidth={2.2} />}
      </button>
    </div>
  ) : null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(12px,env(safe-area-inset-bottom))]"
      aria-label="Điều hướng nhân viên"
    >
      <div
        className={cn(
          "shadow-tab pointer-events-auto mx-auto h-16 max-w-md items-center rounded-full bg-card px-1.5",
          balanced ? "grid" : "flex",
        )}
        style={balanced ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {balanced ? (
          <>
            {left.map(renderTab)}
            {punchButton}
            {right.map(renderTab)}
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center">{left.map(renderTab)}</div>
            {punchButton}
            <div className="flex min-w-0 flex-1 items-center">{right.map(renderTab)}</div>
          </>
        )}
      </div>
    </nav>
  );
};
