import {
  Building2, CalendarClock, ClipboardCheck, Clock, FileCog, FolderOpen, GitBranch, KeyRound, LayoutGrid,
  ListChecks, Mail, MailCheck, Network, PackagePlus, ScrollText, ServerCog, Settings2, ShieldCheck, Smartphone,
  Calculator, Workflow,
} from "lucide-react";

import type { Role } from "@/lib/roles";

export interface SettingsItem {
  label: string;
  to: string;
  icon: typeof Mail;
  description: string;
  /** URL cũ ⇒ redirect sang `to`. */
  legacy?: string[];
}
export interface SettingsGroup {
  label: string;
  items: SettingsItem[];
}

interface Args {
  canDo: (moduleKey: string, action: "view" | "create" | "edit" | "delete") => boolean;
  canManageModule: (moduleKey: string) => boolean;
  isPlatformAdmin: boolean;
  role: Role | null;
}

const hrLike = (role: Role | null) => role === "owner" || role === "admin" || role === "hr";

/** Toàn bộ trang cấu hình gom về module CÀI ĐẶT (/cai-dat). Quyền giữ nguyên như trước khi gom. */
export const buildSettingsGroups = ({ canDo, canManageModule, isPlatformAdmin, role }: Args): SettingsGroup[] => {
  const pick = (list: (SettingsItem | false)[]) => list.filter(Boolean) as SettingsItem[];
  return [
    {
      label: "Tổ chức",
      items: pick([
        canDo("settings", "view") && { label: "Cơ cấu tổ chức", to: "/cai-dat/co-cau-to-chuc", icon: Network, description: "Phòng ban, chức danh, sơ đồ" },
        hrLike(role) && canDo("members", "view") && { label: "Thành viên & quyền", to: "/cai-dat/thanh-vien", icon: ShieldCheck, description: "Tài khoản, vai trò, lời mời", legacy: ["/thanh-vien"] },
        canDo("settings", "view") && { label: "Widget trang chủ", to: "/cai-dat/widget-trang-chu", icon: LayoutGrid, description: "Bố cục trang chủ sau đăng nhập" },
        canDo("settings", "view") && { label: "Checklist hội nhập", to: "/cai-dat/checklist-hoi-nhap", icon: ListChecks, description: "Việc cần làm khi nhận người mới" },
        canDo("settings", "view") && { label: "Checklist hồ sơ", to: "/cai-dat/checklist-ho-so", icon: FolderOpen, description: "Giấy tờ bắt buộc của hồ sơ" },
        (role === "owner" || role === "admin") && { label: "Nhật ký hoạt động", to: "/cai-dat/nhat-ky-hoat-dong", icon: ScrollText, description: "Ai đã làm gì, xem/xuất dữ liệu" },
        canDo("contracts", "view") && { label: "Mẫu hợp đồng", to: "/cai-dat/mau-hop-dong", icon: ScrollText, description: "Mẫu Word/PDF hợp đồng lao động" },
      ]),
    },
    {
      label: "Chấm công",
      items: pick([
        canManageModule("attendance") && { label: "Cài đặt chấm công", to: "/cai-dat/cham-cong", icon: Settings2, description: "Vị trí, bán kính, ảnh, giờ làm", legacy: ["/cham-cong/cai-dat"] },
        canManageModule("attendance") && { label: "Thiết bị chấm công", to: "/cai-dat/thiet-bi-cham-cong", icon: Smartphone, description: "Duyệt / đổi máy của nhân viên", legacy: ["/cham-cong/thiet-bi"] },
        canManageModule("shifts") && { label: "Ca làm việc", to: "/cai-dat/ca-lam-viec", icon: Clock, description: "Khai báo ca", legacy: ["/cham-cong/ca-lam-viec"] },
      ]),
    },
    {
      label: "Đơn từ & nghỉ phép",
      items: pick([
        canManageModule("requests") && { label: "Loại đơn", to: "/cai-dat/loai-don", icon: FileCog, description: "Danh mục đơn từ", legacy: ["/don-tu/loai-don"] },
        hrLike(role) && canManageModule("requests") && { label: "Quy trình duyệt", to: "/cai-dat/quy-trinh-duyet", icon: GitBranch, description: "Các bước phê duyệt", legacy: ["/don-tu/quy-trinh-duyet"] },
        hrLike(role) && { label: "Lịch làm việc & ngày lễ", to: "/cai-dat/lich-lam-viec", icon: CalendarClock, description: "T2–T6/T2–T7, ngày lễ khi tính ngày nghỉ" },
        hrLike(role) && canDo("leave", "view") && { label: "Chính sách nghỉ phép", to: "/cai-dat/chinh-sach-phep", icon: CalendarClock, description: "Quỹ phép & chính sách", legacy: ["/don-tu/chinh-sach-phep"] },
      ]),
    },
    {
      label: "Lương & đánh giá",
      items: pick([
        canDo("payroll", "view") && { label: "Tham số lương", to: "/cai-dat/tham-so-luong", icon: Calculator, description: "Thuế, bảo hiểm, lương cơ sở", legacy: ["/tinh-luong/tham-so"] },
        canDo("evaluations", "view") && { label: "Biểu mẫu đánh giá", to: "/cai-dat/bieu-mau-danh-gia", icon: ClipboardCheck, description: "Tiêu chí đánh giá", legacy: ["/danh-gia/bieu-mau"] },
      ]),
    },
    {
      label: "Email",
      items: hrLike(role)
        ? [
            { label: "Mẫu email", to: "/cai-dat/email/mau", icon: Mail, description: "Soạn mẫu, biến động, gửi thử" },
            { label: "Luồng tự động", to: "/cai-dat/email/luong-tu-dong", icon: Workflow, description: "Sự kiện, điều kiện, người nhận" },
            { label: "Nhật ký gửi", to: "/cai-dat/email/nhat-ky", icon: ScrollText, description: "Hàng đợi & kết quả gửi" },
            { label: "Cấu hình gửi mail", to: "/cai-dat/email/cau-hinh", icon: MailCheck, description: "Máy chủ gửi, kiểm tra" },
          ]
        : [],
    },
    {
      label: "Quản trị hệ thống",
      items: isPlatformAdmin
        ? [
            { label: "Workspace", to: "/cai-dat/he-thong/workspace", icon: ServerCog, description: "Các công ty trên nền tảng", legacy: ["/quan-tri"] },
            { label: "Gói dịch vụ", to: "/cai-dat/he-thong/goi-dich-vu", icon: PackagePlus, description: "Gói & module", legacy: ["/quan-tri/goi-dich-vu"] },
            { label: "Phân quyền", to: "/cai-dat/he-thong/phan-quyen", icon: KeyRound, description: "Nhóm quyền hệ thống", legacy: ["/quan-tri/phan-quyen"] },
          ]
        : [],
    },
  ].filter((g) => g.items.length > 0);
};

export const SETTINGS_ICON = Building2;
