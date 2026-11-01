import { Bell, FileText, Home, ScanFace, User, type LucideIcon } from "lucide-react";

export interface MobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
  featured?: boolean;
}

export const EMPLOYEE_TABS: MobileTab[] = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "checkin", label: "Chấm công", icon: ScanFace, featured: true },
  { id: "requests", label: "Đơn từ", icon: FileText },
  { id: "news", label: "Tin tức", icon: Bell },
  { id: "me", label: "Cá nhân", icon: User },
];
