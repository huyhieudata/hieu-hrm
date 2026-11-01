import { Briefcase, Home, LayoutGrid, Newspaper, type LucideIcon } from "lucide-react";

export interface MobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
  featured?: boolean;
}

export const EMPLOYEE_TABS: MobileTab[] = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "work", label: "Công việc", icon: Briefcase },
  { id: "punch", label: "Chấm công", icon: Home, featured: true },
  { id: "internal", label: "Nội bộ", icon: Newspaper },
  { id: "apps", label: "Ứng dụng", icon: LayoutGrid },
];
