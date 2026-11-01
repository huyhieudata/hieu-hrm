import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";
import { useKeyboardOpen } from "@/components/mobile/use-keyboard-open";
import { useMyDay, type PunchMode } from "@/components/mobile/use-my-day";
import { cn } from "@/lib/utils";

export interface MobileFrame {
  title: string;
  tab: string;
  variant?: "home" | "page" | "checkin";
  back?: boolean;
  punch?: PunchMode;
  notifyDot?: boolean;
  companyName?: string;
  personName?: string;
  personMeta?: string;
  initials?: string;
  badges?: Partial<Record<string, boolean>>;
  onBack?: () => void;
  onTab?: (id: string) => void;
  onPunch?: () => void;
  onNotify?: () => void;
  onSearch?: () => void;
  onScan?: () => void;
}

const TAB_ROUTES: Record<string, string> = {
  home: "/",
  work: "/cong-viec",
  internal: "/toi/tin-tuc",
  apps: "/ung-dung",
};

interface ScreenMeta {
  title: string;
  tab: string;
  variant: "home" | "page" | "checkin";
  back?: boolean;
}

const screenMeta = (pathname: string): ScreenMeta => {
  const checkin = pathname === "/cham-cong" || pathname.startsWith("/toi/cham-cong");
  if (pathname === "/" || pathname === "/m") return { title: "Trang chủ", tab: "home", variant: "home" };
  if (pathname.startsWith("/cong-viec")) return { title: "Công việc", tab: "work", variant: "page" };
  if (pathname.startsWith("/ung-dung")) return { title: "Ứng dụng", tab: "apps", variant: "page" };
  if (pathname.startsWith("/toi/tin-tuc") || pathname.startsWith("/tin-tuc"))
    return { title: "Nội bộ", tab: "internal", variant: "page" };
  if (checkin) return { title: "Chấm công", tab: "home", variant: "checkin", back: true };
  if (pathname.startsWith("/don-tu")) return { title: "Đơn từ", tab: "work", variant: "page", back: true };
  if (pathname.startsWith("/toi/bang-cong") || pathname.startsWith("/cham-cong/bang-cong"))
    return { title: "Bảng công", tab: "work", variant: "page", back: true };
  if (pathname.startsWith("/toi/quet-qr")) return { title: "Quét QR chấm công", tab: "home", variant: "page", back: true };
  if (pathname.startsWith("/toi/khao-sat")) return { title: "Khảo sát", tab: "apps", variant: "page", back: true };
  if (pathname.startsWith("/toi/tai-lieu")) return { title: "Tài liệu", tab: "apps", variant: "page", back: true };
  if (pathname.startsWith("/toi/danh-gia")) return { title: "Đánh giá của tôi", tab: "apps", variant: "page", back: true };
  if (pathname.startsWith("/toi/phieu-luong")) return { title: "Phiếu lương", tab: "apps", variant: "page", back: true };
  if (pathname.startsWith("/toi/ho-so")) return { title: "Thông tin cá nhân", tab: "apps", variant: "page", back: true };
  if (pathname.startsWith("/toi/thiet-bi") || pathname === "/cai-dat/thiet-bi-cham-cong")
    return { title: "Thiết bị", tab: "apps", variant: "page", back: true };
  if (pathname === "/toi") return { title: "Cá nhân", tab: "apps", variant: "page", back: true };
  if (pathname.startsWith("/cham-cong/lich")) return { title: "Lịch làm việc", tab: "work", variant: "page", back: true };
  return { title: "ONHRM", tab: "home", variant: "page", back: true };
};

interface MobileShellProps {
  children: ReactNode;
  /** Override route-derived chrome. Used by the visual preview. */
  frame?: MobileFrame;
}

export const MobileShell = ({ children, frame }: MobileShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const live = useMyDay(!frame);
  const keyboard = useKeyboardOpen();
  const meta = frame
    ? {
        title: frame.title,
        tab: frame.tab,
        variant: frame.variant ?? (frame.tab === "home" && !frame.back ? "home" : "page"),
        back: frame.back,
      }
    : screenMeta(pathname);
  const hideTabs = meta.variant === "checkin" || keyboard;

  useEffect(() => {
    if (frame) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [frame, pathname]);

  const onTab = (id: string) => {
    if (id === "punch") {
      if (frame?.onPunch) frame.onPunch();
      else navigate("/cham-cong");
      return;
    }
    if (frame?.onTab) {
      frame.onTab(id);
      return;
    }
    const to = TAB_ROUTES[id];
    if (to) navigate(to);
  };

  const onBack = () => {
    if (frame?.onBack) {
      frame.onBack();
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const onNotify = () => {
    if (frame?.onNotify) {
      frame.onNotify();
      return;
    }
    navigate("/toi/tin-tuc");
  };

  const onSearch = () => {
    if (frame?.onSearch) {
      frame.onSearch();
      return;
    }
    navigate("/ung-dung");
  };

  const onScan = () => {
    if (frame?.onScan) {
      frame.onScan();
      return;
    }
    navigate("/toi/quet-qr");
  };

  return (
    <div
      className="employee-canvas font-display relative min-h-[100dvh] w-full overflow-x-clip text-foreground"
      style={{ "--fixed-bar-offset": hideTabs ? "0px" : "calc(var(--tabbar-h) + env(safe-area-inset-bottom))" } as CSSProperties}
    >
      {meta.variant === "home" ? (
        <MobileHeader
          variant="hero"
          title={meta.title}
          companyName={frame?.companyName ?? live.companyName}
          personName={frame?.personName ?? live.fullName}
          personMeta={frame?.personMeta ?? live.personMeta}
          initials={frame?.initials ?? live.initials}
          notifyDot={frame?.notifyDot}
          onNotify={onNotify}
          onSearch={onSearch}
          onScan={onScan}
        />
      ) : (
        <MobileHeader
          title={meta.title}
          back={meta.back}
          notifyDot={frame?.notifyDot}
          onBack={onBack}
          onNotify={meta.variant === "checkin" ? undefined : onNotify}
        />
      )}
      <main
        className={cn(
          "mx-auto w-full max-w-md",
          meta.variant === "home" ? "-mt-20 px-4" : "px-4 pt-4",
          hideTabs ? "pb-[calc(168px+env(safe-area-inset-bottom))]" : "pb-[calc(var(--tabbar-h)+var(--tabbar-bump)+40px+env(safe-area-inset-bottom))]",
        )}
      >
        <div key={frame ? meta.tab + meta.title : pathname}>{children}</div>
      </main>
      {hideTabs ? null : (
        <MobileTabBar
          activeId={meta.tab}
          punch={frame?.punch ?? live.punch}
          badges={frame?.badges}
          onSelect={onTab}
          onPunch={() => onTab("punch")}
        />
      )}
    </div>
  );
};
