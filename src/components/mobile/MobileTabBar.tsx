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

export const MobileTabBar = ({
  tabs = EMPLOYEE_TABS,
  activeId,
  punch = "ready",
  badges,
  onSelect,
  onPunch,
}: MobileTabBarProps) => (
  <nav
    className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(12px,env(safe-area-inset-bottom))]"
    aria-label="Điều hướng nhân viên"
  >
    <div className="shadow-tab pointer-events-auto mx-auto flex h-16 max-w-md items-center rounded-full bg-card px-1.5">
      {tabs.map((tab) => {
        if (tab.featured) {
          const blocked = punch === "blocked";
          return (
            <div key={tab.id} className="flex w-[72px] justify-center">
              <button
                type="button"
                onClick={onPunch}
                aria-label={blocked ? "Chấm công đang bị chặn" : punch === "in" ? "Ra ca" : "Vào ca"}
                className={cn(
                  "-mt-[26px] flex h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-card text-white",
                  punch === "in" && "bg-brand-navy shadow-glow-navy",
                  punch === "ready" && "bg-brand-orange shadow-primary-glow",
                  blocked && "bg-muted-foreground shadow-mobile",
                )}
              >
                {blocked ? <Lock className="h-6 w-6" strokeWidth={2.2} /> : <Power className="h-6 w-6" strokeWidth={2.2} />}
              </button>
            </div>
          );
        }
        const Icon = tab.icon;
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[52px] min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px]",
              active ? "bg-primary-subtle font-bold text-brand-navy" : "font-medium text-muted-foreground",
            )}
          >
            <span className="relative flex">
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.9} />
              {badges?.[tab.id] ? (
                <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border-2 border-card bg-brand-orange" />
              ) : null}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
