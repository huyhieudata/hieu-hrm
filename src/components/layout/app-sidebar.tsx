/* eslint-disable react-refresh/only-export-components */
import { canEnterStaffPath } from "@/lib/staff-routes";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  Wallet,
  Briefcase,
  LayoutDashboard,
  Fingerprint,
  LogOut,
  ChevronsUpDown,
  Check,
  Plus,
  ShieldCheck,
  Building2,
  Megaphone,
  Newspaper,
  ClipboardCheck,
  FileText,
  CalendarClock,
  UserPlus,
  LayoutGrid,
  Network,
  ListChecks,
  HeartPulse,
  FolderOpen,
  Target,
  Clock,
  CalendarRange,
  Settings2,
  Table2,
  FileCog,
  CalendarCheck,
  GitBranch,
  FileSignature,
  Calculator,
  ServerCog,
  PackagePlus,
  KeyRound,
  Laptop,
  MapPinned,
  Smartphone,
  UserRound,
  ClipboardList,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/common/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayName, useAuth } from "@/lib/auth-provider";
import { companyInitials, useCompany } from "@/lib/company-provider";
import { usePlatformAdmin } from "@/lib/platform";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { buildSettingsGroups } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  to?: string;
  icon: typeof Users;
  badge?: string;
  soon?: boolean;
  /** Only highlight when the path matches exactly. */
  exact?: boolean;
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}

interface NavBuilderArgs {
  canDo: (
    moduleKey: string,
    action: "view" | "create" | "edit" | "delete",
  ) => boolean;
  canManageModule: (moduleKey: string) => boolean;
  isPlatformAdmin: boolean;
  role: Role | null;
}

export const buildNavGroups = ({
  canDo,
  canManageModule,
  isPlatformAdmin,
  role,
}: NavBuilderArgs) => {
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Tổng quan",
      items: [
        {
          label: "Bảng điều khiển",
          to: "/",
          icon: LayoutDashboard,
          exact: true,
        },
        canDo("news", "view") && {
          label: "Tin nội bộ",
          to: "/tin-tuc",
          icon: Newspaper,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Của tôi",
      items: [
        { label: "Chấm công của tôi", to: "/toi/cham-cong", icon: Fingerprint },
        { label: "Thiết bị chấm công", to: "/toi/thiet-bi", icon: Smartphone },
        { label: "Bảng công của tôi", to: "/toi/bang-cong", icon: CalendarDays },
        { label: "Phiếu lương", to: "/toi/phieu-luong", icon: Wallet },
        { label: "Khảo sát", to: "/toi/khao-sat", icon: ClipboardList },
        { label: "Tài liệu nội bộ", to: "/toi/tai-lieu", icon: FolderOpen },
        { label: "Hồ sơ cá nhân", to: "/toi", icon: UserRound, exact: true },
      ] as NavItem[],
    },
    {
      label: "Quản lý nhân sự",
      items: [
        canDo("onboarding", "view") && {
          label: "Hội nhập",
          to: "/hoi-nhap",
          icon: UserPlus,
        },
        canDo("employees", "view") && {
          label: "Hồ sơ nhân viên",
          to: "/employees",
          icon: Users,
        },
        canManageModule("leave") && {
          label: "Nghỉ phép",
          to: "/nghi-phep",
          icon: CalendarDays,
        },
        canDo("contracts", "view") && {
          label: "Hợp đồng",
          to: "/hop-dong",
          icon: FileSignature,
        },
        canDo("assets", "view") && {
          label: "Tài sản",
          to: "/tai-san",
          icon: Laptop,
        },
        canDo("insurance", "view") && {
          label: "Bảo hiểm",
          to: "/bao-hiem",
          icon: HeartPulse,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Tuyển dụng",
      items: [
        canDo("recruitment", "view") && {
          label: "Tổng quan tuyển dụng",
          to: "/tuyen-dung",
          icon: Briefcase,
          exact: true,
        },
        canDo("recruitment", "view") && {
          label: "Mô tả công việc",
          to: "/tuyen-dung/mo-ta",
          icon: FileText,
        },
        canDo("recruitment", "view") && {
          label: "Chiến dịch",
          to: "/tuyen-dung/chien-dich",
          icon: Megaphone,
        },
        canDo("recruitment", "view") && {
          label: "Ứng viên",
          to: "/tuyen-dung/ung-vien",
          icon: Users,
        },
        canDo("recruitment", "view") && {
          label: "Lịch hẹn phỏng vấn",
          to: "/tuyen-dung/lich-hen",
          icon: CalendarClock,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Tính lương",
      items: [
        canDo("payroll", "view") && {
          label: "Kỳ lương",
          to: "/tinh-luong",
          icon: Calculator,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Chấm công",
      items: [
        canDo("attendance", "view") && {
          label: "Chấm công",
          to: "/cham-cong",
          icon: Fingerprint,
          exact: true,
        },
        canDo("attendance", "view") && {
          label: "Bảng công",
          to: "/cham-cong/bang-cong",
          icon: Table2,
        },
        canDo("attendance", "view") && {
          label: "Lịch làm việc",
          to: "/cham-cong/lich-lam-viec",
          icon: CalendarDays,
        },
        canManageModule("shifts") && {
          label: "Phân ca",
          to: "/cham-cong/phan-ca",
          icon: CalendarRange,
        },
        canManageModule("attendance") && {
          label: "Chi tiết chấm công",
          to: "/cham-cong/nhat-ky",
          icon: MapPinned,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Đơn từ",
      items: [
        canDo("requests", "view") && {
          label: "Danh sách đơn",
          to: "/don-tu",
          icon: FileText,
          exact: true,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Hoạch định",
      items: [
        canDo("planning", "view") && {
          label: "Định biên nhân sự",
          to: "/hoach-dinh/dinh-bien",
          icon: Target,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Cài đặt",
      items: [
        buildSettingsGroups({ canDo, canManageModule, isPlatformAdmin, role })
          .length > 0 && {
          label: "Cài đặt",
          to: "/cai-dat",
          icon: Settings2,
        },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: "Mở rộng",
      items: [{ label: "Đánh giá hiệu suất", icon: Star, soon: true }],
    },
  ].filter((group) => group.items.length > 0);
  // Vai trò Nhân viên: ẩn menu quản trị (Hồ sơ nhân viên, Chấm công quản lý, Cài đặt).
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.to || canEnterStaffPath(item.to, role ?? null, canManageModule)) }))
    .filter((group) => group.items.length > 0);
};

export const AppSidebar = ({
  collapsed,
  onToggleCollapse,
  onNavigate,
  mobile = false,
}: AppSidebarProps) => {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const {
    activeCompany,
    memberships,
    setActiveCompany,
    role,
    can,
    canDo,
    canManageModule,
  } = useCompany();
  const { isPlatformAdmin } = usePlatformAdmin();
  const isCollapsed = collapsed && !mobile;

  const name = displayName(profile, user?.email);

  const groups = buildNavGroups({
    canDo,
    canManageModule,
    isPlatformAdmin,
    role,
  });

  const handleSignOut = async () => {
    await signOut();
    onNavigate?.();
    navigate("/login", { replace: true });
  };

  const switchCompany = (companyId: string) => {
    if (companyId === activeCompany?.id) {
      onNavigate?.();
      return;
    }
    setActiveCompany(companyId);
    onNavigate?.();
    navigate("/");
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-expo",
        isCollapsed ? "w-[84px]" : "w-[268px]",
      )}
    >
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-3" : "justify-between px-5",
        )}
      >
        <Logo collapsed={isCollapsed} />
        {!mobile && !isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Thu gọn thanh điều hướng"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {!mobile && isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Mở rộng thanh điều hướng"
            className="absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:text-primary"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className={cn("pt-4", isCollapsed ? "px-3" : "px-4")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex w-full items-center gap-3 rounded-md border border-border bg-muted/50 text-left transition-colors hover:border-primary/25 hover:bg-primary-subtle",
                isCollapsed ? "justify-center p-2" : "p-2.5",
              )}
              aria-label="Chuyển công ty"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand text-[13px] font-semibold text-white shadow-primary-glow">
                {companyInitials(activeCompany?.name)}
              </span>
              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {activeCompany?.name ?? "Chưa chọn công ty"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {activeCompany?.industry ??
                        (role ? ROLE_LABELS[role] : "Chưa có vai trò")}
                    </span>
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[252px]">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Công ty của bạn
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {memberships.map((membership) => (
              <DropdownMenuItem
                key={membership.id}
                className="gap-2.5 py-2"
                onSelect={() => switchCompany(membership.company_id)}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-primary-subtle text-[11px] font-semibold text-primary-subtle-foreground">
                  {companyInitials(membership.company.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-foreground">
                    {membership.company.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {ROLE_LABELS[membership.role]}
                  </span>
                </span>
                {membership.company_id === activeCompany?.id && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 text-[12.5px]"
              onSelect={() => navigate("/cong-ty")}
            >
              <Building2 className="h-4 w-4" /> Danh sách công ty
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 text-[12.5px]"
              onSelect={() => navigate("/cong-ty")}
            >
              <Plus className="h-4 w-4" /> Tạo công ty mới
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              {!isCollapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <>
                      <Icon
                        className="h-[17px] w-[17px] shrink-0"
                        strokeWidth={1.9}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                      {!isCollapsed && item.soon && (
                        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Sắp có
                        </span>
                      )}
                    </>
                  );

                  if (item.soon || !item.to) {
                    return (
                      <li key={item.label}>
                        <span
                          aria-disabled
                          className={cn(
                            "flex cursor-not-allowed items-center gap-3 rounded-sm px-3 py-[9px] text-[13px] font-medium text-muted-foreground/70",
                            isCollapsed && "justify-center px-0",
                          )}
                          title={isCollapsed ? item.label : undefined}
                        >
                          {content}
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={item.label}>
                      <NavLink
                        to={item.to}
                        end={item.exact ?? item.to === "/"}
                        onClick={onNavigate}
                        title={isCollapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-sm px-3 py-[9px] text-[13px] font-medium transition-all duration-150",
                            isCollapsed && "justify-center px-0",
                            isActive
                              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/80 hover:bg-muted hover:text-foreground",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={cn(
                                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-opacity",
                                isActive ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {content}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 space-y-3 border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-md p-1.5",
            isCollapsed ? "flex-col" : "border border-border bg-card",
          )}
        >
          <div className="relative">
            <Avatar name={name} size="md" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-foreground">
                {name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {role ? ROLE_LABELS[role] : "Chưa có công ty"}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Đăng xuất"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] text-muted-foreground/80">
            <span>Phiên bản 1.0.0</span>
            <Badge variant="success" className="px-1.5 py-0 text-[11px]">
              Đã kết nối
            </Badge>
          </div>
        )}
      </div>
    </aside>
  );
};
