import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const SELF_EDITABLE_FIELDS: { name: string; label: string; type?: "tel" | "email" | "textarea"; section: string }[] = [
  { name: "phone", label: "Điện thoại", type: "tel", section: "Liên hệ" },
  { name: "personal_email", label: "Email cá nhân", type: "email", section: "Liên hệ" },
  { name: "permanent_address", label: "Địa chỉ thường trú", type: "textarea", section: "Liên hệ" },
  { name: "current_address", label: "Địa chỉ tạm trú / hiện tại", type: "textarea", section: "Liên hệ" },
  { name: "emergency_contact_name", label: "Người liên hệ khẩn cấp", section: "Liên hệ khẩn cấp" },
  { name: "emergency_contact_relation", label: "Quan hệ", section: "Liên hệ khẩn cấp" },
  { name: "emergency_contact_phone", label: "SĐT khẩn cấp", type: "tel", section: "Liên hệ khẩn cấp" },
  { name: "bank_name", label: "Ngân hàng", section: "Ngân hàng" },
  { name: "bank_account", label: "Số tài khoản", section: "Ngân hàng" },
  { name: "bank_branch", label: "Chi nhánh", section: "Ngân hàng" },
];

export const FIELD_LABEL: Record<string, string> = {
  ...Object.fromEntries(SELF_EDITABLE_FIELDS.map((f) => [f.name, f.label])),
  national_id: "Số CCCD",
  national_id_issue_date: "Ngày cấp CCCD",
  national_id_issue_place: "Nơi cấp CCCD",
  tax_code: "MST",
  insurance_number: "Số sổ BHXH",
  date_of_birth: "Ngày sinh",
};

export interface ChangeRequest {
  id: string;
  company_id: string;
  employee_id: string;
  changes: Record<string, string | null>;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  employees?: { full_name: string | null; code: string | null } | null;
}

export const listChangeRequests = async (companyId: string, opts: { employeeId?: string; pendingOnly?: boolean } = {}) => {
  let query = db
    .from("employee_change_requests")
    .select("id, company_id, employee_id, changes, status, note, review_note, reviewed_at, created_at, employees(full_name, code)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (opts.employeeId) query = query.eq("employee_id", opts.employeeId);
  if (opts.pendingOnly) query = query.eq("status", "pending");
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "Không tải được đề nghị cập nhật.");
  return (data ?? []) as ChangeRequest[];
};

export const submitChangeRequest = async (companyId: string, changes: Record<string, string | null>, note?: string) => {
  const { error } = await db.rpc("submit_employee_change_request", { p_company: companyId, p_changes: changes, p_note: note ?? null });
  if (error) throw new Error(error.message ?? "Không gửi được đề nghị.");
};

export const cancelChangeRequest = async (id: string) => {
  const { error } = await db.rpc("cancel_employee_change_request", { p_id: id });
  if (error) throw new Error(error.message ?? "Không huỷ được đề nghị.");
};

export const reviewChangeRequest = async (id: string, approve: boolean, note?: string) => {
  const { error } = await db.rpc("review_employee_change_request", { p_id: id, p_approve: approve, p_note: note ?? null });
  if (error) throw new Error(error.message ?? "Không duyệt được đề nghị.");
};

export interface SensitiveAuditRow {
  id: string;
  fields: string[];
  actor_name: string | null;
  source: string;
  created_at: string;
}

export const listSensitiveAudit = async (employeeId: string) => {
  const { data, error } = await db
    .from("employee_sensitive_audit")
    .select("id, fields, actor_name, source, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message ?? "Không tải được nhật ký.");
  return (data ?? []) as SensitiveAuditRow[];
};

/** Cảnh báo trùng CCCD / email trong công ty (chỉ owner/admin/HR nhận được kết quả). */
export const findEmployeeDuplicates = async (
  companyId: string,
  values: { national_id?: unknown; work_email?: unknown; personal_email?: unknown },
  excludeId?: string | null,
) => {
  const emails = [values.work_email, values.personal_email].map((v) => (v ? String(v) : "")).filter(Boolean);
  const checks = [
    { nid: values.national_id ? String(values.national_id) : null, email: null as string | null },
    ...emails.map((email) => ({ nid: null as string | null, email })),
  ].filter((c) => c.nid || c.email);
  const results = await Promise.all(
    checks.map(async (c) => {
      const { data } = await db.rpc("employee_duplicate_check", {
        p_company: companyId,
        p_national_id: c.nid,
        p_email: c.email,
        p_exclude: excludeId ?? null,
      });
      return (data ?? []) as { kind: string; full_name: string; code: string }[];
    }),
  );
  return results.flat();
};
