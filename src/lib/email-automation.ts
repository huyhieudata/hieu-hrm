import DOMPurify from "dompurify";

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type EventKey =
  | "employee_created" | "invite_sent" | "employee_joined" | "birthday" | "contract_expiring"
  | "probation_ending" | "request_approved" | "request_rejected" | "late_threshold" | "attendance_reminder";

export const COMMON_VARS = [
  ["ten_nhan_vien", "Tên nhân viên"], ["ma_nhan_vien", "Mã nhân viên"], ["email_nhan_vien", "Email nhân viên"],
  ["phong_ban", "Phòng ban"], ["chuc_danh", "Chức danh"], ["ten_quan_ly", "Quản lý trực tiếp"],
  ["ngay_vao_lam", "Ngày vào làm"], ["ten_cong_ty", "Tên công ty"], ["ngay", "Ngày hôm nay"],
  ["link_app", "Link ứng dụng"], ["ten_nguoi_nhan", "Tên người nhận"],
] as const;

export interface EventDef {
  key: EventKey;
  label: string;
  kind: "instant" | "daily";
  vars: [string, string][];
  offsetLabel?: string;
  threshold?: boolean;
}

export const EVENTS: EventDef[] = [
  { key: "employee_created", label: "Tạo hồ sơ nhân viên", kind: "instant", vars: [] },
  { key: "invite_sent", label: "Gửi lời mời tham gia", kind: "instant", vars: [["link_loi_moi", "Link lời mời"], ["han_loi_moi", "Hạn lời mời"], ["vai_tro", "Vai trò"]] },
  { key: "employee_joined", label: "Nhân viên tham gia (liên kết tài khoản)", kind: "instant", vars: [] },
  { key: "birthday", label: "Sinh nhật", kind: "daily", vars: [["ngay_sinh", "Ngày sinh"], ["tuoi", "Tuổi"]], offsetLabel: "Gửi trước (ngày)" },
  { key: "contract_expiring", label: "Hợp đồng sắp hết hạn", kind: "daily", vars: [["so_hop_dong", "Số hợp đồng"], ["loai_hop_dong", "Loại hợp đồng"], ["ngay_het_han", "Ngày hết hạn"], ["so_ngay_con_lai", "Số ngày còn lại"]], offsetLabel: "Trước hạn X ngày" },
  { key: "probation_ending", label: "Sắp hết thử việc", kind: "daily", vars: [["ngay_het_thu_viec", "Ngày hết thử việc"]], offsetLabel: "Trước X ngày" },
  { key: "request_approved", label: "Đơn từ được duyệt", kind: "instant", vars: [["loai_don", "Loại đơn"], ["tu_ngay", "Từ ngày"], ["den_ngay", "Đến ngày"], ["ly_do", "Lý do"], ["ghi_chu_duyet", "Ghi chú duyệt"]] },
  { key: "request_rejected", label: "Đơn từ bị từ chối", kind: "instant", vars: [["loai_don", "Loại đơn"], ["tu_ngay", "Từ ngày"], ["den_ngay", "Đến ngày"], ["ly_do", "Lý do"], ["ghi_chu_duyet", "Lý do từ chối"]] },
  { key: "late_threshold", label: "Đi muộn quá N lần/tháng", kind: "instant", vars: [["so_lan_di_muon", "Số lần đi muộn"], ["thang", "Tháng"]], threshold: true },
  { key: "attendance_reminder", label: "Nhắc chấm công (chưa chấm vào)", kind: "daily", vars: [] },
];
export const eventDef = (k: string | null | undefined) => EVENTS.find((e) => e.key === k);
export const varsFor = (k: string | null | undefined): [string, string][] => [
  ...(COMMON_VARS as unknown as [string, string][]),
  ...(eventDef(k)?.vars ?? EVENTS.flatMap((e) => e.vars)),
];

export const SAMPLE_VARS: Record<string, string> = {
  ten_nhan_vien: "Nguyễn Văn A", ma_nhan_vien: "NV001", email_nhan_vien: "a@congty.vn", phong_ban: "Kinh doanh",
  chuc_danh: "Chuyên viên", ten_quan_ly: "Trần Thị B", ngay_vao_lam: "01/11/2026", ten_cong_ty: "Công ty mẫu",
  ngay: new Date().toLocaleDateString("vi-VN"), link_app: "https://hieu-hrm.vercel.app", ten_nguoi_nhan: "Nguyễn Văn A",
  link_loi_moi: "https://hieu-hrm.vercel.app/tham-gia/mau", han_loi_moi: "15/11/2026", vai_tro: "Nhân viên",
  ngay_sinh: "01/11", tuoi: "30", so_hop_dong: "HD-001", loai_hop_dong: "Xác định thời hạn", ngay_het_han: "30/11/2026",
  so_ngay_con_lai: "30", ngay_het_thu_viec: "30/11/2026", loai_don: "Nghỉ phép", tu_ngay: "03/11/2026",
  den_ngay: "04/11/2026", ly_do: "Việc gia đình", ghi_chu_duyet: "Đồng ý", so_lan_di_muon: "3", thang: "11/2026",
};

export const sanitizeEmailHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "style", "data-email-button"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
  });

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const renderTemplate = (tpl: string, vars: Record<string, string>, html = true) =>
  tpl.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, k: string) => (html ? esc(vars[k] ?? "") : (vars[k] ?? "")));

export interface EmailTemplate {
  id: string; company_id: string; code: string; name: string; event_key: string | null;
  subject: string; body_html: string; active: boolean; is_default: boolean; updated_at: string;
}
export interface EmailRule {
  id: string; company_id: string; name: string; event_key: EventKey;
  conditions: { departments?: string[]; positions?: string[]; contract_types?: string[]; employment_types?: string[] };
  recipients: { employee?: boolean; manager?: boolean; hr?: boolean; emails?: string[] };
  offset_days: number; threshold: number; delay_minutes: number; send_hour: number;
  template_id: string | null; active: boolean;
}
export interface EmailLog {
  id: string; created_at: string; to_email: string; subject: string | null; status: string; error: string | null; event_key: string | null;
}
export interface EmailQueueRow {
  id: string; created_at: string; scheduled_at: string; to_email: string; status: string; error: string | null; event_key: string; attempts: number;
}

export const listTemplates = async (companyId: string): Promise<EmailTemplate[]> => {
  const { data, error } = await db.from("email_templates").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data ?? [];
};
export const saveTemplate = async (t: Partial<EmailTemplate> & { company_id: string }) => {
  const row = { ...t, body_html: sanitizeEmailHtml(t.body_html ?? "") };
  delete (row as Partial<EmailTemplate>).updated_at;
  const q = t.id ? db.from("email_templates").update(row).eq("id", t.id) : db.from("email_templates").insert(row);
  const { error } = await q;
  if (error) throw error;
};
export const deleteTemplate = async (id: string) => {
  const { error } = await db.from("email_templates").delete().eq("id", id);
  if (error) throw error;
};
export const listRules = async (companyId: string): Promise<EmailRule[]> => {
  const { data, error } = await db.from("email_rules").select("*").eq("company_id", companyId).order("created_at");
  if (error) throw error;
  return data ?? [];
};
export const saveRule = async (r: Partial<EmailRule> & { company_id: string }) => {
  const q = r.id ? db.from("email_rules").update(r).eq("id", r.id) : db.from("email_rules").insert(r);
  const { error } = await q;
  if (error) throw error;
};
export const deleteRule = async (id: string) => {
  const { error } = await db.from("email_rules").delete().eq("id", id);
  if (error) throw error;
};
export const listLogs = async (companyId: string): Promise<EmailLog[]> => {
  const { data, error } = await db.from("email_logs").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
};
export const listQueue = async (companyId: string): Promise<EmailQueueRow[]> => {
  const { data, error } = await db.from("email_queue").select("id, created_at, scheduled_at, to_email, status, error, event_key, attempts")
    .eq("company_id", companyId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
};
export const retryQueue = async (id: string) => {
  const { error } = await db.rpc("email_retry", { p_queue: id });
  if (error) throw error;
};
export const runDailyNow = async (companyId: string): Promise<number> => {
  const { data, error } = await db.rpc("email_run_daily_now", { p_company: companyId });
  if (error) throw error;
  return data ?? 0;
};
export const invokeMailer = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("send-queued-emails", { body });
  if (error) return { error: error.message } as Record<string, unknown>;
  return data as Record<string, unknown>;
};
