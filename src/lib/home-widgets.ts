import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type WidgetSurface = "desktop" | "mobile";
export type WidgetSize = "sm" | "md" | "lg";
export type WidgetAudience = "admin" | "manager" | "employee";

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
  sm: "Nhỏ",
  md: "Vừa",
  lg: "Lớn",
};
export const WIDGET_AUDIENCE_LABELS: Record<WidgetAudience, string> = {
  admin: "Admin/HR",
  manager: "Quản lý",
  employee: "Nhân viên",
};
export const SURFACE_LABELS: Record<WidgetSurface, string> = {
  desktop: "Máy tính (giao diện quản trị)",
  mobile: "Điện thoại nhân viên (/m)",
};

export type WidgetKey =
  | "clock"
  | "news"
  | "month_overview"
  | "requests"
  | "attendance_today"
  | "birthdays"
  | "people_changes"
  | "contracts_expiring"
  | "quick_links"
  | "interviews"
  | "departments";

export interface WidgetDefinition {
  key: WidgetKey;
  label: string;
  description: string;
  emoji: string;
  defaultSize: WidgetSize;
  audiences: WidgetAudience[];
  /** Chỉ có ý nghĩa với quản lý trở lên (nhân viên không có dữ liệu). */
  managersOnly?: boolean;
}

export const WIDGET_LIBRARY: WidgetDefinition[] = [
  {
    key: "clock",
    label: "Đồng hồ ngày giờ",
    description: "Giờ Việt Nam, thứ, ngày tháng.",
    emoji: "🕒",
    defaultSize: "sm",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "attendance_today",
    label: "Tình hình chấm công hôm nay",
    description:
      "Đã chấm, đi muộn, vắng, nghỉ phép, lượt bị từ chối (ngoài vùng).",
    emoji: "✅",
    defaultSize: "md",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "month_overview",
    label: "Tổng quan ngày công",
    description: "Ngày công tháng này: đi làm, đi muộn, về sớm, nghỉ phép.",
    emoji: "📅",
    defaultSize: "md",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "requests",
    label: "Đơn từ",
    description: "Đơn chờ duyệt (quản lý) hoặc đơn của tôi (nhân viên).",
    emoji: "📝",
    defaultSize: "md",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "news",
    label: "Bản tin nội bộ",
    description: "Tin mới, tin ghim từ module Tin tức.",
    emoji: "📰",
    defaultSize: "lg",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "birthdays",
    label: "Sinh nhật trong tháng",
    description: "Đồng nghiệp có sinh nhật tháng này.",
    emoji: "🎂",
    defaultSize: "md",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "quick_links",
    label: "Lối tắt nhanh",
    description: "Nút đi nhanh tới chấm công, đơn từ, bảng công…",
    emoji: "⚡",
    defaultSize: "md",
    audiences: ["admin", "manager", "employee"],
  },
  {
    key: "people_changes",
    label: "Nhân sự mới / sắp hết thử việc",
    description: "Vào làm 30 ngày qua, hết thử việc trong 30 ngày tới.",
    emoji: "🧑‍💼",
    defaultSize: "md",
    audiences: ["admin", "manager"],
    managersOnly: true,
  },
  {
    key: "contracts_expiring",
    label: "Hợp đồng sắp hết hạn",
    description: "Hợp đồng hết hạn trong 45 ngày tới.",
    emoji: "📄",
    defaultSize: "md",
    audiences: ["admin", "manager"],
    managersOnly: true,
  },
  {
    key: "interviews",
    label: "Lịch phỏng vấn sắp tới",
    description: "Ứng viên có lịch phỏng vấn (cần quyền tuyển dụng).",
    emoji: "🎯",
    defaultSize: "md",
    audiences: ["admin", "manager"],
    managersOnly: true,
  },
  {
    key: "departments",
    label: "Nhân sự theo phòng ban",
    description: "Số nhân sự đang làm theo phòng ban.",
    emoji: "🏢",
    defaultSize: "md",
    audiences: ["admin", "manager"],
    managersOnly: true,
  },
];

export const WIDGET_BY_KEY = new Map(
  WIDGET_LIBRARY.map((item) => [item.key, item]),
);

export interface WidgetConfigItem {
  widget_key: WidgetKey;
  enabled: boolean;
  size: WidgetSize;
  audiences: WidgetAudience[];
}

const DEFAULT_ORDER: Record<
  WidgetSurface,
  { key: WidgetKey; enabled: boolean; size?: WidgetSize }[]
> = {
  desktop: [
    { key: "clock", enabled: true, size: "sm" },
    { key: "attendance_today", enabled: true, size: "md" },
    { key: "requests", enabled: true, size: "md" },
    { key: "news", enabled: true, size: "lg" },
    { key: "month_overview", enabled: true, size: "md" },
    { key: "birthdays", enabled: true, size: "md" },
    { key: "people_changes", enabled: true, size: "md" },
    { key: "contracts_expiring", enabled: true, size: "md" },
    { key: "interviews", enabled: true, size: "md" },
    { key: "departments", enabled: true, size: "md" },
    { key: "quick_links", enabled: false, size: "md" },
  ],
  mobile: [
    { key: "quick_links", enabled: true },
    { key: "month_overview", enabled: true },
    { key: "requests", enabled: true },
    { key: "news", enabled: true },
    { key: "birthdays", enabled: true },
    { key: "clock", enabled: false },
    { key: "attendance_today", enabled: false },
  ],
};

export const defaultWidgetConfig = (
  surface: WidgetSurface,
): WidgetConfigItem[] => {
  const listed = DEFAULT_ORDER[surface].map(({ key, enabled, size }) => {
    const def = WIDGET_BY_KEY.get(key)!;
    return {
      widget_key: key,
      enabled,
      size: size ?? def.defaultSize,
      audiences: [...def.audiences],
    };
  });
  const rest = WIDGET_LIBRARY.filter(
    (def) => !listed.some((item) => item.widget_key === def.key),
  ).map((def) => ({
    widget_key: def.key,
    enabled: false,
    size: def.defaultSize,
    audiences: [...def.audiences],
  }));
  return [...listed, ...rest];
};

interface WidgetRow {
  widget_key: string;
  enabled: boolean;
  sort_order: number;
  size: WidgetSize;
  audiences: WidgetAudience[];
}

/** Đọc cấu hình đã lưu; chưa cấu hình thì trả mặc định. Widget mới thêm vào thư viện được nối cuối (tắt). */
export const loadWidgetConfig = async (
  companyId: string,
  surface: WidgetSurface,
): Promise<{ items: WidgetConfigItem[]; customized: boolean }> => {
  const { data, error } = await db
    .from("home_widget_settings")
    .select("widget_key, enabled, sort_order, size, audiences")
    .eq("company_id", companyId)
    .eq("surface", surface)
    .order("sort_order", { ascending: true });
  if (error)
    throw new Error(error.message ?? "Không tải được cấu hình widget.");
  const rows = ((data ?? []) as WidgetRow[]).filter((row) =>
    WIDGET_BY_KEY.has(row.widget_key as WidgetKey),
  );
  if (rows.length === 0)
    return { items: defaultWidgetConfig(surface), customized: false };
  const items: WidgetConfigItem[] = rows.map((row) => ({
    widget_key: row.widget_key as WidgetKey,
    enabled: row.enabled,
    size: row.size,
    audiences: row.audiences,
  }));
  WIDGET_LIBRARY.forEach((def) => {
    if (!items.some((item) => item.widget_key === def.key)) {
      items.push({
        widget_key: def.key,
        enabled: false,
        size: def.defaultSize,
        audiences: [...def.audiences],
      });
    }
  });
  return { items, customized: true };
};

export const saveWidgetConfig = async (
  companyId: string,
  surface: WidgetSurface,
  items: WidgetConfigItem[],
) => {
  const { error } = await db.rpc("save_home_widgets", {
    p_company: companyId,
    p_surface: surface,
    p_items: items,
  });
  if (error)
    throw new Error(error.message ?? "Không lưu được cấu hình widget.");
};

export const resetWidgetConfig = async (
  companyId: string,
  surface: WidgetSurface,
) => {
  const { error } = await db.rpc("reset_home_widgets", {
    p_company: companyId,
    p_surface: surface,
  });
  if (error) throw new Error(error.message ?? "Không khôi phục được mặc định.");
};

export const audienceForRole = (
  role: Role | null | undefined,
): WidgetAudience =>
  role === "owner" || role === "admin" || role === "hr"
    ? "admin"
    : role === "manager"
      ? "manager"
      : "employee";

export const visibleWidgets = (
  items: WidgetConfigItem[],
  audience: WidgetAudience,
) => items.filter((item) => item.enabled && item.audiences.includes(audience));

export interface PersonRow {
  id: string;
  name: string;
  department: string | null;
}

export interface HomeSummary {
  role: WidgetAudience;
  today: string;
  scope_size: number;
  attendance_today: {
    total: number;
    present: number;
    late: number;
    open: number;
    on_leave: number;
    absent: number;
    rejected: number;
    rejected_out_of_zone: number;
    rejected_people: number;
    mine: { checked_in: boolean | null; open: boolean | null } | null;
  };
  month_overview: {
    month_start: string;
    month_end: string;
    worked_days: number;
    late: number;
    early_leave: number;
    absent: number;
    leave_days: number;
    workdays_elapsed: number;
  };
  requests: {
    pending: number;
    my_pending: number;
    items: {
      id: string;
      employee_name: string;
      type_name: string | null;
      start_date: string | null;
      end_date: string | null;
      status: string;
      created_at: string;
    }[];
  };
  birthdays: (PersonRow & { day: number; is_today: boolean })[];
  people_changes: {
    new_hires: (PersonRow & { hire_date: string })[];
    probation_ending: (PersonRow & { probation_end_date: string })[];
  } | null;
  contracts_expiring:
    | {
        id: string;
        employee_id: string;
        name: string;
        contract_no: string | null;
        end_date: string;
      }[]
    | null;
  interviews:
    | {
        id: string;
        candidate_id: string;
        candidate_name: string;
        position_applied: string | null;
        scheduled_at: string;
        mode: string | null;
        interviewer: string | null;
      }[]
    | null;
  departments: { name: string; count: number }[] | null;
}

/** Một lần gọi RPC cho mọi widget (tránh N+1); phạm vi dữ liệu do máy chủ quyết theo vai trò. */
export const loadHomeSummary = async (
  companyId: string,
): Promise<HomeSummary> => {
  const { data, error } = await db.rpc("home_dashboard_summary", {
    p_company: companyId,
  });
  if (error)
    throw new Error(error.message ?? "Không tải được dữ liệu trang chủ.");
  return data as HomeSummary;
};
