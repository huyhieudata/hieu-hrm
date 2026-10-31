import { supabase } from "@/integrations/supabase/client";
import type { Permission } from "@/lib/roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface PermissionOption {
  value: Permission;
  label: string;
  group: string;
}

export type CrudAction = "view" | "create" | "edit" | "delete";

export interface PermissionModule {
  key: string;
  label: string;
  /** Bỏ trống với module mới không có quyền vai trò cũ tương ứng (vd. news). */
  legacyView?: Permission;
  legacyManage?: Permission;
}

export const CRUD_ACTIONS: { key: CrudAction; label: string }[] = [
  { key: "view", label: "Xem" },
  { key: "create", label: "Tạo" },
  { key: "edit", label: "Sửa" },
  { key: "delete", label: "Xoá" },
];

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "employees", label: "Hồ sơ nhân sự", legacyView: "employees.view", legacyManage: "employees.manage" },
  { key: "assets", label: "Tài sản & bàn giao", legacyView: "employees.view", legacyManage: "employees.manage" },
  { key: "onboarding", label: "Hội nhập", legacyView: "employees.view", legacyManage: "employees.manage" },
  { key: "contracts", label: "Hợp đồng lao động", legacyView: "employees.view", legacyManage: "employees.manage" },
  { key: "insurance", label: "Bảo hiểm", legacyView: "employees.view", legacyManage: "employees.manage" },
  { key: "attendance", label: "Chấm công & bảng công", legacyView: "attendance.view", legacyManage: "attendance.manage" },
  { key: "shifts", label: "Ca làm việc & phân ca", legacyView: "attendance.view", legacyManage: "attendance.manage" },
  { key: "requests", label: "Đơn từ", legacyView: "leave.view", legacyManage: "leave.approve" },
  { key: "leave", label: "Quỹ phép & chính sách phép", legacyView: "leave.view", legacyManage: "employees.manage" },
  { key: "payroll", label: "Tính lương", legacyView: "payroll.view", legacyManage: "payroll.manage" },
  { key: "recruitment", label: "Tuyển dụng", legacyView: "recruitment.view", legacyManage: "recruitment.manage" },
  { key: "planning", label: "Hoạch định & định biên", legacyView: "employees.view", legacyManage: "employees.manage" },
  { key: "news", label: "Truyền thông nội bộ" },
  { key: "members", label: "Thành viên & quyền", legacyView: "members.view", legacyManage: "members.manage" },
  { key: "settings", label: "Cấu hình công ty", legacyView: "employees.view", legacyManage: "employees.manage" },
];

export const SPECIAL_PERMISSION_OPTIONS: { value: Permission; label: string }[] = [
  { value: "company.manage", label: "Quản trị công ty" },
  { value: "members.invite", label: "Mời thành viên" },
  { value: "members.manage", label: "Quản lý thành viên" },
  { value: "leave.approve", label: "Duyệt đơn từ" },
];

export const permissionKey = (moduleKey: string, action: CrudAction) => `${moduleKey}.${action}`;

export const modulePermissionKeys = (moduleKey: string) =>
  CRUD_ACTIONS.map((action) => permissionKey(moduleKey, action.key));

const LEGACY_PERMISSIONS = new Set<string>([
  "company.manage",
  "members.view",
  "members.invite",
  "members.manage",
  "employees.view",
  "employees.manage",
  "recruitment.view",
  "recruitment.manage",
  "attendance.view",
  "attendance.manage",
  "leave.view",
  "leave.approve",
  "payroll.view",
  "payroll.manage",
]);

/**
 * Chỉ các module có quyền legacy riêng mới được suy ra quyền "manage".
 * Các module dùng chung employees.manage (hợp đồng, bảo hiểm, cấu hình…)
 * không được bật quyền quản lý nhân sự khi chỉ được cấp quyền ở module đó.
 */
const LEGACY_WRITE_MODULES = new Set(["employees", "attendance", "payroll", "recruitment"]);

/** Mở rộng quyền CRUD thành quyền vai trò cũ để giao diện hiện có hiểu được. */
export const toLegacyPermissions = (keys: string[]): Permission[] => {
  const result = new Set<Permission>();
  keys.forEach((key) => {
    if (LEGACY_PERMISSIONS.has(key)) result.add(key as Permission);
  });
  PERMISSION_MODULES.forEach((module) => {
    const own = modulePermissionKeys(module.key);
    if (module.legacyView && keys.includes(own[0])) result.add(module.legacyView);
    if (module.legacyManage && LEGACY_WRITE_MODULES.has(module.key) && own.slice(1).some((key) => keys.includes(key))) {
      result.add(module.legacyManage);
    }
  });
  return Array.from(result);
};

/** Chuyển quyền cũ đã lưu sang lựa chọn CRUD khi mở biểu mẫu. */
export const expandLegacyPermissions = (permissions: string[]): string[] => {
  const result = new Set<string>();
  SPECIAL_PERMISSION_OPTIONS.forEach((option) => {
    if (permissions.includes(option.value)) result.add(option.value);
  });
  permissions.forEach((permission) => {
    if (!LEGACY_PERMISSIONS.has(permission) && permission.includes(".")) result.add(permission);
  });
  PERMISSION_MODULES.forEach((module) => {
    // leave.approve là quyền duyệt riêng, không mở toàn bộ quyền tạo/sửa/xoá đơn.
    if (module.key === "requests" && permissions.includes("leave.approve")) return;
    const own = modulePermissionKeys(module.key);
    if (module.legacyView && permissions.includes(module.legacyView)) result.add(own[0]);
    if (module.legacyManage && permissions.includes(module.legacyManage)) {
      result.add(own[1]);
      result.add(own[2]);
      result.add(own[3]);
    }
  });
  return Array.from(result);
};

export const PERMISSION_OPTIONS: PermissionOption[] = [
  { value: "employees.view", label: "Xem hồ sơ nhân sự", group: "Nhân sự" },
  { value: "employees.manage", label: "Quản lý hồ sơ nhân sự", group: "Nhân sự" },
  { value: "attendance.view", label: "Xem chấm công / bảng công", group: "Chấm công" },
  { value: "attendance.manage", label: "Quản lý ca, phân ca, cấu hình chấm công", group: "Chấm công" },
  { value: "leave.view", label: "Xem đơn từ, quỹ phép", group: "Đơn từ" },
  { value: "leave.approve", label: "Duyệt đơn từ", group: "Đơn từ" },
  { value: "payroll.view", label: "Xem bảng lương", group: "Lương" },
  { value: "payroll.manage", label: "Quản lý bảng lương", group: "Lương" },
  { value: "recruitment.view", label: "Xem tuyển dụng", group: "Tuyển dụng" },
  { value: "recruitment.manage", label: "Quản lý tuyển dụng", group: "Tuyển dụng" },
  { value: "members.view", label: "Xem thành viên & quyền", group: "Quản trị" },
  { value: "members.invite", label: "Mời thành viên", group: "Quản trị" },
  { value: "members.manage", label: "Quản lý thành viên & quyền", group: "Quản trị" },
  { value: "company.manage", label: "Quản trị công ty", group: "Quản trị" },
];

export const permissionLabel = (value: string) => {
  const special = SPECIAL_PERMISSION_OPTIONS.find((option) => option.value === value);
  if (special) return special.label;
  const legacy = PERMISSION_OPTIONS.find((option) => option.value === value);
  if (legacy) return legacy.label;
  const [moduleKey, actionKey] = value.split(".");
  const module = PERMISSION_MODULES.find((item) => item.key === moduleKey);
  if (module) {
    const action = CRUD_ACTIONS.find((item) => item.key === actionKey);
    if (action) return `${module.label} · ${action.label}`;
  }
  return value;
};

export interface PermissionGroup {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  permissions: Permission[];
  created_at: string;
}

export interface EmployeePermissionRecord {
  employee_id: string;
  company_id: string;
  group_id: string | null;
  permissions: Permission[];
  denied_permissions: Permission[];
}

export const listPermissionGroups = async (companyId?: string): Promise<PermissionGroup[]> => {
  let query = db.from("permission_groups").select("*").order("name", { ascending: true });
  if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  else query = query.is("company_id", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "Không tải được nhóm quyền.");
  return (data ?? []) as PermissionGroup[];
};

export const createPermissionGroup = async (values: Record<string, unknown>) => {
  const { error } = await db.from("permission_groups").insert(values);
  if (error) throw new Error(error.message ?? "Không tạo được nhóm quyền.");
};

export const updatePermissionGroup = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("permission_groups").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được nhóm quyền.");
};

export const deletePermissionGroup = async (id: string) => {
  const { error } = await db.from("permission_groups").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được nhóm quyền.");
};

export const getEmployeePermissions = async (employeeId: string): Promise<EmployeePermissionRecord | null> => {
  const { data, error } = await db
    .from("employee_permissions")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Không tải được quyền của nhân sự.");
  return (data ?? null) as EmployeePermissionRecord | null;
};

export const saveEmployeePermissions = async (values: {
  employee_id: string;
  company_id: string;
  group_id: string | null;
  permissions: Permission[];
  denied_permissions?: Permission[];
}) => {
  const { error } = await db
    .from("employee_permissions")
    .upsert({ ...values, updated_at: new Date().toISOString() }, { onConflict: "employee_id" });
  if (error) throw new Error(error.message ?? "Không lưu được quyền của nhân sự.");
};
