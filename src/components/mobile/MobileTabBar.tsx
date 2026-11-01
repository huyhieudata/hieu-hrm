import { cn } from "@/lib/utils";

import { EMPLOYEE_TABS, type MobileTab } from "./employee-tabs";

interface MobileTabBarProps {
  tabs?: MobileTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const MobileTabBar = ({ tabs = EMPLOYEE_TABS, activeId, onSelect }: MobileTabBarProps) => (
  <nav
    className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(10px,env(safe-area-inset-bottom))]"
    aria-label="Điều hướng nhân viên"
  >
    <div className="glass-bar pointer-events-auto mx-auto flex max-w-md items-end rounded-3xl px-1 pt-1 shadow-glow">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={active ? "page" : undefined}
            className="flex min-h-12 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 text-[10px] font-semibold"
          >
            {tab.featured ? (
              <span
                className={cn(
                  "bg-gradient-primary -mt-[18px] flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-glow",
                  active && "ring-2 ring-brand-orange/70 ring-offset-2 ring-offset-transparent",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
            ) : (
              <span
                className={cn(
                  "flex h-8 items-center justify-center rounded-full px-3 transition-colors duration-200",
                  active ? "bg-primary-subtle text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.9} />
              </span>
            )}
            <span className={active ? "font-extrabold text-primary" : "text-muted-foreground"}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
