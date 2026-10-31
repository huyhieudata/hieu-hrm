import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, MapPinOff } from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-panel px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50 mask-fade-b" />
      <div className="pointer-events-none absolute -top-20 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-[440px] rounded-xl border border-border bg-card/90 p-8 text-center shadow-overlay backdrop-blur-sm">
        <div className="flex justify-center">
          <LogoMark className="h-12 w-12 rounded-[14px]" />
        </div>
        <p className="mt-6 font-display text-[52px] font-semibold leading-none tracking-[-0.04em] text-foreground">
          404
        </p>
        <h1 className="mt-2 font-display text-[18px] font-semibold text-foreground">
          Không tìm thấy trang này
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
          Đường dẫn này không tồn tại hoặc bạn không có quyền truy cập. Quay lại bảng điều khiển để
          tiếp tục làm việc.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="w-full gap-2 sm:w-auto">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Về bảng điều khiển
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/login">Đăng nhập lại</Link>
          </Button>
        </div>
        <div className="mt-7 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-[10.5px] text-muted-foreground">
          <MapPinOff className="h-3 w-3" />
          ONHRM · Mã lỗi 404
        </div>
      </div>

      <div className="relative mt-6">
        <Logo />
      </div>
    </div>
  );
};

export default NotFound;
