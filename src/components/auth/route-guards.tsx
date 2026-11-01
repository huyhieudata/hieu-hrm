import { toast } from "sonner";
import { canEnterStaffPath } from "@/lib/staff-routes";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { BootSkeleton } from "@/components/layout/page-suspense";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { fetchMustChangePassword } from "@/lib/employee-accounts";
import { ForcePasswordChange } from "@/components/auth/force-password-change";
import { MfaGate } from "@/components/auth/mfa";
import { usePlatformAdmin } from "@/lib/platform";

export const FullPageLoader = ({ label = "Đang tải không gian làm việc…" }: { label?: string }) => (
  <BootSkeleton label={label} />
);

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const { pathname, search } = useLocation();
  const userId = session?.user.id ?? null;
  const [mustChange, setMustChange] = useState<{ id: string; value: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchMustChangePassword(userId)
      .then((value) => alive && setMustChange({ id: userId, value }))
      .catch(() => alive && setMustChange({ id: userId, value: false }));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading || (userId && mustChange?.id !== userId)) return <FullPageLoader />;

  if (!session) {
    const redirect = `${pathname}${search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (mustChange?.value && userId)
    return <ForcePasswordChange onDone={() => setMustChange({ id: userId, value: false })} />;

  return <MfaGate>{children}</MfaGate>;
};

export const RequireCompany = ({ children }: { children: ReactNode }) => {
  const { memberships, loading } = useCompany();

  if (loading) return <FullPageLoader label="Đang mở công ty của bạn…" />;
  if (memberships.length === 0) return <Navigate to="/cong-ty" replace />;

  return <>{children}</>;
};

/** Chặn vai trò Nhân viên vào khu quản trị (/employees, /cham-cong, /cai-dat…) ⇒ về /toi. */
export const RequireStaffPath = ({ children }: { children: ReactNode }) => {
  const { role, canManageModule, loading } = useCompany();
  const { pathname } = useLocation();
  if (loading) return <FullPageLoader label="Đang kiểm tra quyền truy cập…" />;
  if (!canEnterStaffPath(pathname, role, canManageModule)) return <DeniedRedirect />;
  return <>{children}</>;
};

export const RequireModule = ({ moduleKey, children }: { moduleKey: string; children: ReactNode }) => {
  const { canDo, loading } = useCompany();
  if (loading) return <FullPageLoader label="Đang kiểm tra quyền truy cập…" />;
  if (!canDo(moduleKey, "view")) return <DeniedRedirect />;
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
  if (!can(permission)) return <DeniedRedirect />;
  return <>{children}</>;
};

/** Trang quản trị nền tảng (/cai-dat/he-thong/*, /quan-tri): chỉ quản trị viên nền tảng. */
export const RequirePlatformAdmin = ({ children }: { children: ReactNode }) => {
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  if (loading) return <FullPageLoader label="Đang kiểm tra quyền truy cập…" />;
  if (!isPlatformAdmin) return <DeniedRedirect />;
  return <>{children}</>;
};

/** Chặn trang thống nhất: toast + về trang chủ theo vai trò (Nhân viên ⇒ /toi, còn lại ⇒ /). */
const DeniedRedirect = () => {
  const { role } = useCompany();
  useEffect(() => {
    toast.error("Bạn không có quyền truy cập trang này", { id: "no-access", duration: 6000 });
  }, []);
  return <Navigate to={role === "employee" ? "/toi" : "/"} replace />;
};
