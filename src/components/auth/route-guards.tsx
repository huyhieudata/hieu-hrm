import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";

export const FullPageLoader = ({ label = "Đang tải không gian làm việc…" }: { label?: string }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
    <LogoMark className="h-11 w-11 animate-pulse rounded-[12px]" />
    <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </p>
  </div>
);

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const { pathname, search } = useLocation();

  if (loading) return <FullPageLoader />;

  if (!session) {
    const redirect = `${pathname}${search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <>{children}</>;
};

export const RequireCompany = ({ children }: { children: ReactNode }) => {
  const { memberships, loading } = useCompany();

  if (loading) return <FullPageLoader label="Đang mở công ty của bạn…" />;
  if (memberships.length === 0) return <Navigate to="/cong-ty" replace />;

  return <>{children}</>;
};

export const RequireModule = ({ moduleKey, children }: { moduleKey: string; children: ReactNode }) => {
  const { canDo, loading } = useCompany();
  if (loading) return <FullPageLoader label="Đang kiểm tra quyền truy cập…" />;
  if (!canDo(moduleKey, "view")) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const RequirePermission = ({
  permission,
  children,
}: {
  permission: Parameters<ReturnType<typeof useCompany>["can"]>[0];
  children: ReactNode;
}) => {
  const { can, loading } = useCompany();
  if (loading) return <FullPageLoader label="Đang kiểm tra quyền truy cập…" />;
  if (!can(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
};
