import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Download,
  Fingerprint,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Users,
  X,
  FileText,
} from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { Avatar } from "@/components/common/avatar";
import { buildNavGroups, type NavItem } from "@/components/layout/app-sidebar";
import { useAuth, displayName } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { usePlatformAdmin } from "@/lib/platform";
import { isStandalone } from "@/lib/pwa";
import { cn } from "@/lib/utils";

interface PrimaryTab {
  to: string;
  label: string;
  icon: typeof Users;
  match: (pathname: string) => boolean;
}

const isRouteActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

export const MobileNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { activeCompany, role, canDo, canManageModule } = useCompany();
  const { isPlatformAdmin } = usePlatformAdmin();
  const [moreOpen, setMoreOpen] = useState(false);
  const standalone = isStandalone();

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  const groups = useMemo(
    () => buildNavGroups({ canDo, canManageModule, isPlatformAdmin, role }),
    [canDo, canManageModule, isPlatformAdmin, role],
  );

  // Tab theo vai trò: Trang chủ, Nhân sự (hoặc Chấm công), Duyệt đơn, Thông báo, Thêm.
  const primary = useMemo<PrimaryTab[]>(() => {
    const tabs: PrimaryTab[] = [
      { to: "/", label: "Trang chủ", icon: LayoutDashboard, match: (path) => path === "/" },
    ];
    if (canDo("employees", "view"))
      tabs.push({ to: "/employees", label: "Nhân sự", icon: Users, match: (path) => path.startsWith("/employees") });
    else if (canDo("attendance", "view"))
      tabs.push({ to: "/cham-cong", label: "Chấm công", icon: Fingerprint, match: (path) => path.startsWith("/cham-cong") });
    if (canDo("requests", "view"))
      tabs.push({ to: "/don-tu", label: "Duyệt đơn", icon: FileText, match: (path) => path.startsWith("/don-tu") });
    tabs.push({ to: "/tin-tuc", label: "Thông báo", icon: Bell, match: (path) => path.startsWith("/tin-tuc") });
    return tabs;
  }, [canDo]);

  const name = displayName(profile, user?.email);
  const navItems = groups
    .flatMap((group) => group.items)
    .filter((item): item is NavItem & { to: string } => Boolean(item.to));

  const go = (to: string) => {
    setMoreOpen(false);
    navigate(to);
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
        aria-label="Điều hướng di động"
      >
        <div
          className="mx-auto grid max-w-md items-stretch px-1 pt-1.5"
          style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}
        >
          {primary.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            return (
              <button
                key={tab.to}
                type="button"
                onClick={() => go(tab.to)}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors"
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200",
                    active
                      ? "bg-primary-subtle text-primary shadow-xs"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={active ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {tab.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-label="Mở tất cả tính năng"
            className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium"
          >
            <span
              className={cn(
                "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                moreOpen ? "bg-primary-subtle text-primary" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </span>
            <span className="text-muted-foreground">Thêm</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Tất cả tính năng">
          <div
            className="absolute inset-0 bg-overlay/50 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-overlay animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-[26px] border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2.5">
                <LogoMark className="h-9 w-9 rounded-[11px]" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {activeCompany?.name ?? "ONHRM"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Tất cả tính năng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Đóng"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-4 pt-4">
              {!standalone && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Ứng dụng
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      window.dispatchEvent(new CustomEvent("onhrm:install"));
                    }}
                    className="mt-2 flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary-subtle px-3 py-3 text-left"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Download className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-primary-subtle-foreground">
                        Thêm ONHRM ra màn hình chính
                      </span>
                      <span className="block text-[11px] leading-4 text-muted-foreground">
                        Mở nhanh như ứng dụng, không cần trình duyệt
                      </span>
                    </span>
                  </button>
                </div>
              )}

              {groups.map((group) => {
                const items = group.items.filter((item) => item.to);
                if (items.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const active = item.to ? isRouteActive(pathname, item.to) : false;
                        return (
                          <button
                            key={`${group.label}-${item.label}`}
                            type="button"
                            onClick={() => item.to && go(item.to)}
                            className={cn(
                              "flex min-h-[88px] flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-colors",
                              active
                                ? "border-primary/30 bg-primary-subtle"
                                : "border-border/70 bg-card hover:bg-muted/40",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg",
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Icon className="h-4 w-4" strokeWidth={1.9} />
                            </span>
                            <span className="line-clamp-2 text-[11px] font-medium leading-4 text-foreground">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-foreground">{name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signOut();
                    } finally {
                      navigate("/login", { replace: true });
                    }
                  }}
                  className="flex h-8 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[11px] font-semibold text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" /> Đăng xuất
                </button>
              </div>

              <p className="pb-1 text-center text-[11px] text-muted-foreground">
                {navItems.length} tính năng · ONHRM
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
