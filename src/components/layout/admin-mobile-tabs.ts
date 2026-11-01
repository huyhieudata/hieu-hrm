import { Bell, FileText, Fingerprint, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

import type { Role } from "@/lib/roles";
import { canEnterStaffPath } from "@/lib/staff-routes";

export interface AdminMobileTab {
  to: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

/**
 * Tab hai bên nút chấm công. "Thêm" luôn được ghép cuối bên phải ở thanh nav,
 * nên thanh cân khi left.length === right.length + 1 (cùng số tab mỗi bên).
 * Tin báo chỉ được kéo vào khi thiếu một tab — nếu đã đủ 2 | 2 thì để chuông header và sheet Thêm.
 */
export const buildAdminMobileTabs = (
  canDo: (moduleKey: string, action: "view" | "create" | "edit" | "delete") => boolean,
  role: Role | null,
  canManageModule: (moduleKey: string) => boolean,
): { left: AdminMobileTab[]; right: AdminMobileTab[] } => {
  const allow = (tab: AdminMobileTab | null): tab is AdminMobileTab =>
    !!tab && canEnterStaffPath(tab.to, role, canManageModule);

  const home: AdminMobileTab = {
    to: "/",
    label: "Trang chủ",
    icon: LayoutDashboard,
    match: (path) => path === "/",
  };
  const people: AdminMobileTab | null = canDo("employees", "view")
    ? { to: "/employees", label: "Nhân sự", icon: Users, match: (path) => path.startsWith("/employees") }
    : canDo("attendance", "view")
      ? { to: "/cham-cong", label: "Chấm công", icon: Fingerprint, match: (path) => path.startsWith("/cham-cong") }
      : null;
  const approve: AdminMobileTab | null = canDo("requests", "view")
    ? { to: "/don-tu", label: "Duyệt", icon: FileText, match: (path) => path.startsWith("/don-tu") }
    : null;
  const news: AdminMobileTab = {
    to: "/tin-tuc",
    label: "Tin báo",
    icon: Bell,
    match: (path) => path.startsWith("/tin-tuc"),
  };

  const left: AdminMobileTab[] = [home, people].filter(allow);
  const right: AdminMobileTab[] = [approve].filter(allow);

  // Bên phải còn nút Thêm, nên bên trái cần hơn đúng một tab.
  if (allow(news)) {
    if (left.length < right.length + 1) left.push(news);
    else if (left.length > right.length + 1) right.push(news);
  }

  return { left, right };
};
