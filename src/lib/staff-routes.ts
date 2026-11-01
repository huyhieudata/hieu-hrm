import type { Role } from "@/lib/roles";

/** Khu quản trị: vai trò Nhân viên không được vào (trừ khi được cấp quyền quản lý module tương ứng).
 *  Đây chỉ là lớp giao diện — RLS ở DB vẫn là lớp bảo vệ thật. */
const STAFF_PREFIXES: { prefix: string; module: string | null }[] = [
  { prefix: "/employees", module: "employees" },
  { prefix: "/cham-cong", module: "attendance" },
  { prefix: "/cai-dat", module: null },
];

export const isStaffPath = (path: string) =>
  STAFF_PREFIXES.some(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));

/** Trang trong khu quản trị nhưng nhân viên vẫn dùng (chỉ đọc lịch của mình). */
const EMPLOYEE_ALLOWED = ["/cham-cong/lich-lam-viec"];

export const canEnterStaffPath = (path: string, role: Role | null, canManageModule: (key: string) => boolean) => {
  if (role !== "employee") return true;
  if (EMPLOYEE_ALLOWED.includes(path)) return true;
  const hit = STAFF_PREFIXES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));
  if (!hit) return true;
  return hit.module ? canManageModule(hit.module) : false;
};
