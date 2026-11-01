import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { EMPLOYEE_TABS } from "@/components/mobile/employee-tabs";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";

export interface MobileFrame {
  title: string;
  tab: string;
  hello?: boolean;
  back?: boolean;
  notifyDot?: boolean;
  onBack?: () => void;
  onTab?: (id: string) => void;
  onNotify?: () => void;
}

const TAB_ROUTES: Record<string, string> = {
  home: "/",
  checkin: "/cham-cong",
  requests: "/don-tu",
  news: "/toi/tin-tuc",
  me: "/toi",
};

interface ScreenMeta {
  title: string;
  tab: string;
  hello?: boolean;
  back?: boolean;
}

const screenMeta = (pathname: string): ScreenMeta => {
  if (pathname === "/" || pathname === "/m") return { title: "Trang chủ", tab: "home", hello: true };
  if (pathname.startsWith("/toi/thiet-bi") || pathname === "/cai-dat/thiet-bi-cham-cong")
    return { title: "Thiết bị của tôi", tab: "me", back: true };
  if (pathname.startsWith("/toi/bang-cong") || pathname.startsWith("/cham-cong/bang-cong"))
    return { title: "Bảng công", tab: "me", back: true };
  if (pathname.startsWith("/toi/phieu-luong")) return { title: "Phiếu lương", tab: "me", back: true };
  if (pathname.startsWith("/toi/ho-so")) return { title: "Thông tin cá nhân", tab: "me", back: true };
  if (pathname === "/toi") return { title: "Cá nhân", tab: "me" };
  if (pathname.startsWith("/cham-cong")) return { title: "Chấm công", tab: "checkin" };
  if (pathname.startsWith("/don-tu")) return { title: "Đơn từ", tab: "requests" };
  if (pathname.startsWith("/toi/tin-tuc") || pathname.startsWith("/tin-tuc")) return { title: "Tin tức", tab: "news" };
  return { title: "ONHRM", tab: "home", back: true };
};

interface MobileShellProps {
  children: ReactNode;
  /** Override route-derived chrome. Used by the visual preview. */
  frame?: MobileFrame;
}

export const MobileShell = ({ children, frame }: MobileShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const meta = frame ?? screenMeta(pathname);

  useEffect(() => {
    if (frame) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [frame, pathname]);

  const onTab = (id: string) => {
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
    else navigate("/toi");
  };

  const onNotify = () => {
    if (frame?.onNotify) {
      frame.onNotify();
      return;
    }
    navigate("/toi/tin-tuc");
  };

  return (
    <div className="employee-canvas relative min-h-[100dvh] w-full text-foreground">
      <MobileHeader
        title={meta.hello ? "" : meta.title}
        hello={meta.hello}
        back={meta.back}
        notifyDot={frame?.notifyDot}
        onBack={onBack}
        onNotify={onNotify}
      />
      <main className="mx-auto w-full max-w-md px-4 pb-[calc(var(--tabbar-h)+28px+env(safe-area-inset-bottom))] pt-4">
        <div key={frame ? meta.tab + meta.title : pathname} className="animate-fade-up space-y-3">
          {children}
        </div>
      </main>
      <MobileTabBar tabs={EMPLOYEE_TABS} activeId={meta.tab} onSelect={onTab} />
    </div>
  );
};
