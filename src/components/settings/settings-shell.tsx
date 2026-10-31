import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Network } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { cn } from "@/lib/utils";
import { settingsTabs } from "./settings-tabs";

const tabs = settingsTabs;

interface SettingsShellProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  tabs?: { to: string; label: string; icon: typeof Network }[];
  children: ReactNode;
}

export const SettingsShell = ({
  title,
  description,
  eyebrow = "Cài đặt",
  actions,
  tabs: tabItems,
  children,
}: SettingsShellProps) => (
  <AppShell>
    <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
    <div className="scrollbar-slim flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1.5 shadow-xs">
      {(tabItems ?? tabs).map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-colors",
                isActive
                  ? "bg-primary-subtle text-primary-subtle-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </NavLink>
        );
      })}
    </div>
    {children}
  </AppShell>
);
