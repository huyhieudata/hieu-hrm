export type Role = "owner" | "admin" | "hr" | "manager" | "employee";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  hr: "Nhân sự",
  manager: "Quản lý",
  employee: "Nhân viên",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Toàn quyền với công ty, kể cả chuyển giao quyền sở hữu.",
  admin: "Quản lý thành viên, lời mời và toàn bộ cấu hình công ty.",
  hr: "Quản lý hồ sơ nhân sự, chấm công, nghỉ phép và bảng lương.",
  manager: "Theo dõi đội ngũ và duyệt nghỉ phép của nhân viên.",
  employee: "Xem thông tin của mình và gửi yêu cầu nghỉ phép.",
};

export const ROLE_ORDER: Role[] = ["owner", "admin", "hr", "manager", "employee"];

/** Roles an owner/admin can hand out from the team screen. */
export const ASSIGNABLE_ROLES: Role[] = ["admin", "hr", "manager", "employee"];

export type RoleBadgeVariant = "brand" | "subtle" | "info" | "warning" | "muted";

export const ROLE_BADGE: Record<Role, RoleBadgeVariant> = {
  owner: "brand",
  admin: "subtle",
  hr: "info",
  manager: "warning",
  employee: "muted",
};

export type Permission =
  | "company.manage"
  | "members.view"
  | "members.invite"
  | "members.manage"
  | "employees.view"
  | "employees.manage"
  | "recruitment.view"
  | "recruitment.manage"
  | "attendance.view"
  | "attendance.manage"
  | "leave.view"
  | "leave.approve"
  | "payroll.view"
  | "payroll.manage";

const ALL_PERMISSIONS: Permission[] = [
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
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  hr: [
    "members.view",
    "members.invite",
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
  ],
  manager: [
    "members.view",
    "employees.view",
    "recruitment.view",
    "attendance.view",
    "leave.view",
    "leave.approve",
  ],
  employee: ["employees.view", "attendance.view", "leave.view"],
};

export const permissionsForRole = (role: Role | null | undefined): Permission[] =>
  role ? ROLE_PERMISSIONS[role] : [];

export const can = (role: Role | null | undefined, permission: Permission): boolean =>
  role ? ROLE_PERMISSIONS[role].includes(permission) : false;

export const isManagerial = (role: Role | null | undefined): boolean =>
  role === "owner" || role === "admin";
