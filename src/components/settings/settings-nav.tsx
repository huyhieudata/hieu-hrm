import { NavLink } from "react-router-dom";

import { useCompany } from "@/lib/company-provider";
import { usePlatformAdmin } from "@/lib/platform";
import { buildSettingsGroups } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

export const useSettingsGroups = () => {
  const { canDo, canManageModule, role } = useCompany();
  const { isPlatformAdmin } = usePlatformAdmin();
  return buildSettingsGroups({ canDo, canManageModule, isPlatformAdmin, role });
};

/** Điều hướng trái của module CÀI ĐẶT (desktop: cột trái; mobile: thanh cuộn ngang). */
export const SettingsNav = () => {
  const groups = useSettingsGroups();
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors lg:min-h-0",
      isActive ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  return (
    <>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:hidden">
        <NavLink to="/cai-dat" end className={linkCls}>Tổng quan</NavLink>
        {groups.flatMap((g) => g.items).map((i) => (
          <NavLink key={i.to} to={i.to} className={linkCls}>{i.label}</NavLink>
        ))}
      </nav>
      <aside className="sticky top-20 hidden w-60 shrink-0 self-start lg:block">
        <p className="mb-2 px-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-orange">Cài đặt</p>
        <NavLink to="/cai-dat" end className={linkCls}>Tổng quan</NavLink>
        {groups.map((g) => (
          <div key={g.label} className="mt-3">
            <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase text-muted-foreground/80">{g.label}</p>
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} className={linkCls}>
                <i.icon className="h-4 w-4 shrink-0" />
                {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
    </>
  );
};
