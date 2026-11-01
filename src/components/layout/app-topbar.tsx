import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  Download,
  Building2,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { LogoMark } from "@/components/brand/logo";
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
import { useCompany } from "@/lib/company-provider";
import { ROLE_LABELS } from "@/lib/roles";

const routeMeta: Record<string, { group: string; label: string }> = {
  "/": { group: "Không gian làm việc", label: "Bảng điều khiển" },
  "/toi": { group: "Của tôi", label: "Hồ sơ cá nhân" },
  "/toi/ho-so": { group: "Của tôi", label: "Thông tin cá nhân" },
  "/toi/thiet-bi": { group: "Của tôi", label: "Thiết bị chấm công" },
  "/toi/cham-cong": { group: "Của tôi", label: "Chấm công của tôi" },
  "/nghi-phep": { group: "Nghỉ phép", label: "Nghỉ phép" },
  "/toi/bang-cong": { group: "Của tôi", label: "Bảng công của tôi" },
  "/toi/phieu-luong": { group: "Của tôi", label: "Phiếu lương" },
  "/toi/tin-tuc": { group: "Của tôi", label: "Tin tức" },
  "/tin-tuc": { group: "Tổng quan", label: "Tin nội bộ" },
  "/employees": { group: "Nhân sự", label: "Hồ sơ nhân viên" },
  "/employees/:id": { group: "Nhân sự", label: "Hồ sơ nhân viên 360°" },
  "/bao-hiem": { group: "Nhân sự", label: "Bảo hiểm xã hội" },
  "/hoi-nhap": { group: "Quản lý nhân sự", label: "Hội nhập" },
  "/hop-dong": { group: "Quản lý nhân sự", label: "Hợp đồng" },
  "/tai-san": { group: "Quản lý nhân sự", label: "Tài sản" },
  "/tinh-luong": { group: "Tính lương", label: "Kỳ lương" },
  "/cai-dat/tham-so-luong": { group: "Cài đặt", label: "Tham số lương" },
  "/cai-dat/mau-hop-dong": { group: "Cài đặt", label: "Mẫu hợp đồng" },
  "/cai-dat/he-thong/workspace": { group: "Cài đặt", label: "Workspace" },
  "/cai-dat/he-thong/goi-dich-vu": { group: "Cài đặt", label: "Gói dịch vụ" },
  "/cai-dat/he-thong/phan-quyen": { group: "Cài đặt", label: "Phân quyền" },
  "/don-tu": { group: "Đơn từ", label: "Danh sách đơn" },
  "/cai-dat/loai-don": { group: "Cài đặt", label: "Loại đơn" },
  "/cai-dat/chinh-sach-phep": { group: "Cài đặt", label: "Quỹ phép & chính sách" },
  "/cai-dat/quy-trinh-duyet": { group: "Cài đặt", label: "Quy trình duyệt" },
  "/cham-cong": { group: "Chấm công", label: "Chấm công" },
  "/cham-cong/bang-cong": { group: "Chấm công", label: "Bảng công" },
  "/cham-cong/lich-lam-viec": { group: "Chấm công", label: "Lịch làm việc" },
  "/cai-dat/ca-lam-viec": { group: "Cài đặt", label: "Ca làm việc" },
  "/cham-cong/phan-ca": { group: "Chấm công", label: "Phân ca" },
  "/cai-dat/cham-cong": { group: "Cài đặt", label: "Cài đặt chấm công" },
  "/cai-dat/thiet-bi-cham-cong": { group: "Cài đặt", label: "Thiết bị chấm công" },
  "/cai-dat/bieu-mau-danh-gia": { group: "Cài đặt", label: "Biểu mẫu đánh giá" },
  "/hoach-dinh/dinh-bien": { group: "Hoạch định", label: "Định biên nhân sự" },
  "/tuyen-dung": { group: "Tuyển dụng", label: "Tổng quan tuyển dụng" },
  "/tuyen-dung/mo-ta": { group: "Tuyển dụng", label: "Mô tả công việc" },
  "/tuyen-dung/chien-dich": { group: "Tuyển dụng", label: "Chiến dịch tuyển dụng" },
  "/tuyen-dung/ung-vien": { group: "Tuyển dụng", label: "Ứng viên" },
  "/tuyen-dung/lich-hen": { group: "Tuyển dụng", label: "Lịch hẹn phỏng vấn" },
  "/cai-dat": { group: "Cài đặt", label: "Cài đặt" },
  "/cai-dat/email": { group: "Cài đặt", label: "Email" },
  "/cai-dat/widget-trang-chu": { group: "Cài đặt", label: "Widget trang chủ" },
  "/cai-dat/co-cau-to-chuc": { group: "Cài đặt", label: "Cơ cấu tổ chức" },
  "/cai-dat/thanh-vien": { group: "Cài đặt", label: "Thành viên & quyền" },
  "/cai-dat/checklist-hoi-nhap": { group: "Cài đặt", label: "Checklist hội nhập" },
  "/cai-dat/checklist-ho-so": { group: "Cài đặt", label: "Checklist hồ sơ nhân sự" },
};

interface AppTopbarProps {
  onOpenSidebar: () => void;
}

export const AppTopbar = ({ onOpenSidebar }: AppTopbarProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { activeCompany, role } = useCompany();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const meta = (() => {
    if (pathname.startsWith("/employees/")) return { group: "Nhân sự", label: "Hồ sơ nhân viên 360°" };
    if (pathname.startsWith("/tuyen-dung/ung-vien/")) return { group: "Tuyển dụng", label: "Hồ sơ ứng viên" };
    if (pathname === "/") return routeMeta["/"];
    const matched = Object.entries(routeMeta)
      .filter(([path]) => pathname === path || pathname.startsWith(`${path}/`))
      .sort((a, b) => b[0].length - a[0].length)[0];
    return matched?.[1] ?? routeMeta["/"];
  })();

  const name = displayName(profile, user?.email);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2.5 px-4 sm:h-16 sm:gap-3 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Mở menu điều hướng"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted touch:h-11 touch:w-11 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <LogoMark className="h-8 w-8 rounded-[10px]" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-4 text-foreground">{meta.label}</p>
            <p className="truncate text-[11px] leading-3 text-muted-foreground">{meta.group}</p>
          </div>
        </div>

        <div className="hidden min-w-0 shrink-0 items-center gap-2 whitespace-nowrap text-[12.5px] xl:flex">
          <span className="shrink-0 text-muted-foreground">{meta.group}</span>
          <span className="text-border">/</span>
          <span className="truncate font-semibold text-foreground">{meta.label}</span>
          {activeCompany && (
            <>
              <span className="text-border">·</span>
              <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {activeCompany.name}
              </span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <form
            className="group relative hidden md:block"
            onSubmit={(event) => {
              event.preventDefault();
              const query = searchValue.trim();
              navigate(query ? `/employees?q=${encodeURIComponent(query)}` : "/employees");
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Tìm nhân viên, mã NV, phòng ban…"
              aria-label="Tìm nhân viên toàn hệ thống"
              className="h-9 w-[210px] rounded-md border border-border bg-card pl-9 pr-16 text-[13px] text-foreground shadow-xs outline-none transition-all duration-200 placeholder:text-muted-foreground/80 hover:border-primary/30 focus:w-[280px] focus:border-primary focus:shadow-focus xl:w-[280px] xl:focus:w-[320px]"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </form>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Thông báo"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors touch:h-11 touch:w-11 hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
              >
                <Bell className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px] rounded-lg p-0 shadow-overlay">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Thông báo</p>
              </div>
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-[12.5px] font-medium text-foreground">Chưa có thông báo mới</p>
                <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                  Các hoạt động của đội ngũ sẽ xuất hiện tại đây.
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-muted focus-visible:shadow-focus"
              >
                <Avatar name={name} size="md" className="ring-0" />
                <span className="hidden text-left lg:block">
                  <span className="block max-w-[160px] truncate text-[12.5px] font-semibold leading-4 text-foreground">
                    {name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {role ? ROLE_LABELS[role] : "Chưa có vai trò"}
                  </span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] rounded-lg shadow-overlay">
              <DropdownMenuLabel className="flex items-center gap-2.5 py-2.5">
                <Avatar name={name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-foreground">{name}</span>
                  <span className="block truncate text-[11px] font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" onSelect={() => navigate("/cong-ty")}>
                <Building2 className="h-4 w-4" /> Chuyển công ty
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5"
                onSelect={() => window.dispatchEvent(new CustomEvent("onhrm:install"))}
              >
                <Download className="h-4 w-4" /> Cài ứng dụng ONHRM
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2.5 text-destructive focus:bg-destructive-subtle focus:text-destructive"
                onSelect={() => void handleSignOut()}
              >
                <LogOut className="h-4 w-4" /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
