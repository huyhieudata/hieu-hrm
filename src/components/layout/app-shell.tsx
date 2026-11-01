import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { MobileShell } from "@/components/mobile/MobileShell";
import { useCompany } from "@/lib/company-provider";
import { cn } from "@/lib/utils";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileNav } from "./mobile-nav";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { role } = useCompany();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (role === "employee") return <MobileShell>{children}</MobileShell>;

  return (
    <div className="relative flex min-h-[100dvh] w-full bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[340px] bg-gradient-to-b from-primary/[0.05] via-primary/[0.02] to-transparent" />

      <div className="sticky top-0 z-40 hidden h-screen shrink-0 lg:block">
        <AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((prev) => !prev)} />
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[55] lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-overlay/45 backdrop-blur-[2px] transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 shadow-overlay transition-transform duration-300 ease-expo",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <AppSidebar
            mobile
            collapsed={false}
            onToggleCollapse={() => undefined}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <AppTopbar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:pb-12 lg:pt-6 xl:px-8">
          <div key={pathname} className="mx-auto w-full max-w-[1440px] space-y-6 animate-fade-up">
            {children}
          </div>
        </main>
        <footer className="hidden border-t border-border/60 px-4 py-5 sm:px-6 lg:block lg:pb-5 xl:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-2.5 text-[11px] text-muted-foreground sm:flex-row">
            <p className="text-center sm:text-left">© 2026 ONHRM · Nền tảng quản trị nhân sự cho doanh nghiệp Việt</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              <span className="transition-colors hover:text-foreground">Chính sách bảo mật</span>
              <span className="transition-colors hover:text-foreground">Điều khoản</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Hệ thống hoạt động bình thường
              </span>
            </div>
          </div>
        </footer>
      </div>

      <MobileNav />
    </div>
  );
};
