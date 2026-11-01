import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { useKeyboardOpen } from "@/components/mobile/use-keyboard-open";
import { useTableCards } from "@/components/mobile/use-table-cards";
import { useDeviceMode } from "@/hooks/use-device-mode";

import { MobileShell } from "@/components/mobile/MobileShell";
import { displayName, useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { SettingsNav } from "@/components/settings/settings-nav";

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

  const mode = useDeviceMode();
  if (mode === "mobile") {
    if (role === "employee") return <MobileShell>{children}</MobileShell>;
    return <AdminMobileShell>{children}</AdminMobileShell>;
  }

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
            "absolute inset-y-0 left-0 transition-transform duration-300 ease-expo",
            mobileOpen ? "translate-x-0 shadow-overlay" : "-translate-x-full shadow-none",
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
        <main className="flex-1 px-4 pb-12 pt-5 sm:px-6 lg:pb-12 lg:pt-6 xl:px-8">
          <div key={pathname} className="mx-auto w-full max-w-[1440px] space-y-6 animate-fade-up">
            {pathname === "/cai-dat" || pathname.startsWith("/cai-dat/") ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
                <SettingsNav />
                <div className="min-w-0 flex-1 space-y-6">{children}</div>
              </div>
            ) : pathname === "/toi" || pathname.startsWith("/toi/") ? (
              <div className="mx-auto w-full max-w-2xl space-y-3 pt-2">{children}</div>
            ) : (
              children
            )}
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

    </div>
  );
};

const mobileTitle = (pathname: string) => {
  if (pathname === "/") return "";
  if (pathname === "/toi") return "Hồ sơ cá nhân";
  if (pathname.startsWith("/toi/ho-so")) return "Thông tin cá nhân";
  if (pathname.startsWith("/toi/cham-cong")) return "Chấm công của tôi";
  if (pathname.startsWith("/toi/thiet-bi")) return "Thiết bị chấm công";
  if (pathname.startsWith("/toi/bang-cong")) return "Bảng công của tôi";
  if (pathname.startsWith("/toi/phieu-luong")) return "Phiếu lương";
  if (pathname.startsWith("/toi/tin-tuc")) return "Tin tức";
  if (pathname.startsWith("/toi/khao-sat")) return "Khảo sát";
  if (pathname.startsWith("/toi/tai-lieu")) return "Tài liệu";
  if (pathname.startsWith("/toi/quet-qr")) return "Quét QR chấm công";
  if (pathname.startsWith("/hoi-nhap")) return "Hội nhập";
  if (pathname.startsWith("/hop-dong")) return "Hợp đồng";
  if (pathname.startsWith("/nghi-phep")) return "Nghỉ phép";
  if (pathname.startsWith("/bao-hiem")) return "Bảo hiểm";
  if (pathname.startsWith("/tai-san")) return "Tài sản";
  if (pathname.startsWith("/hoach-dinh")) return "Hoạch định";
  if (pathname.startsWith("/danh-gia")) return "Đánh giá";
  if (pathname.startsWith("/employees")) return "Nhân sự";
  if (pathname.startsWith("/cham-cong")) return "Chấm công";
  if (pathname.startsWith("/don-tu")) return "Duyệt đơn";
  if (pathname.startsWith("/tin-tuc")) return "Thông báo";
  if (pathname.startsWith("/cai-dat")) return "Cài đặt";
  if (pathname.startsWith("/tinh-luong")) return "Tính lương";
  if (pathname.startsWith("/tuyen-dung")) return "Tuyển dụng";
  if (pathname.startsWith("/cong-viec")) return "Công việc";
  if (pathname.startsWith("/ung-dung")) return "Ứng dụng";
  return "ONHRM";
};

const ROOT_TABS = ["/", "/employees", "/cham-cong", "/don-tu", "/tin-tuc"];

/** Giao diện app cho admin/HR/quản lý trên điện thoại: header gọn, bảng thành thẻ, tab bar dưới. */
const AdminMobileShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  useTableCards(mainRef);
  const keyboard = useKeyboardOpen();
  const { profile, user } = useAuth();
  const { activeCompany, role, canDo } = useCompany();
  const title = mobileTitle(pathname);
  const isRoot = ROOT_TABS.includes(pathname);
  const home = pathname === "/";
  const inSettings = pathname === "/cai-dat" || pathname.startsWith("/cai-dat/");
  const hideTabs = keyboard || pathname.startsWith("/toi/cham-cong");
  const name = displayName(profile, user?.email);

  return (
    <div
      className="employee-canvas font-display relative min-h-[100dvh] w-full overflow-x-clip text-foreground"
      style={{ "--fixed-bar-offset": hideTabs ? "0px" : "calc(var(--tabbar-h) + env(safe-area-inset-bottom))" } as CSSProperties}
    >
      <MobileHeader
        variant={home ? "hero" : "bar"}
        compact
        title={title || "ONHRM"}
        back={!isRoot && !home}
        companyName={activeCompany?.name ?? "ONHRM"}
        personName={home ? name : undefined}
        personMeta={home && role ? ROLE_LABELS[role] : undefined}
        initials={home ? initials(name) : undefined}
        onBack={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        onNotify={() => navigate("/tin-tuc")}
        onScan={home ? () => navigate("/toi/quet-qr") : undefined}
        onSearch={home ? () => navigate(canDo("employees", "view") ? "/employees" : "/tin-tuc") : undefined}
      />
      <main
        ref={mainRef}
        className={cn(
          "mobile-cards mx-auto w-full max-w-2xl px-3 pt-4",
          hideTabs ? "pb-[calc(24px+env(safe-area-inset-bottom))]" : "pb-[calc(var(--tabbar-h)+var(--tabbar-bump)+24px+env(safe-area-inset-bottom))]",
        )}
      >
        <div key={pathname} className="animate-fade-up space-y-4">
          {inSettings ? (
            <div className="flex flex-col gap-4">
              <SettingsNav />
              <div className="min-w-0 space-y-4">{children}</div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      {hideTabs ? null : <MobileNav />}
    </div>
  );
};
