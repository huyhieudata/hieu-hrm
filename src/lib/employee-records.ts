import { supabase } from "@/integrations/supabase/client";

/**
 * The generated Database types are rewritten by the platform on every schema
 * change, so these generic record helpers use one narrow untyped handle rather
 * than repeating nine near-identical typed call sites.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const EMPLOYEE_DOCUMENT_BUCKET = "hr-documents";
export const EMPLOYEE_AVATAR_BUCKET = "avatars";
export const EMPLOYEE_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

export type EmployeeStatus = "pending" | "active" | "maternity" | "long_leave" | "resigned";

export interface EmployeeRecord {
  id: string;
  company_id: string;
  user_id: string | null;
  code: string;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  national_id: string | null;
  national_id_issue_date: string | null;
  national_id_issue_place: string | null;
  nationality: string | null;
  ethnicity: string | null;
  religion: string | null;
  marital_status: string | null;
  phone: string | null;
  personal_email: string | null;
  work_email: string | null;
  current_address: string | null;
  permanent_address: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  concurrent_positions: string | null;
  job_level: string | null;
  employment_type: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  probation_end_date: string | null;
  official_date: string | null;
  resignation_date: string | null;
  resignation_reason: string | null;
  manager_id: string | null;
  work_location: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  tax_code: string | null;
  insurance_number: string | null;
  dependents_count: number | null;
  education_level: string | null;
  major: string | null;
  school: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RecordBase {
  id: string;
  company_id: string;
  employee_id: string;
  created_at: string;
}

export interface WorkHistoryRecord extends RecordBase {
  event_type: string;
  title: string;
  department: string | null;
  position: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  decision_no: string | null;
  note: string | null;
}

export interface ContractRecord extends RecordBase {
  contract_no: string | null;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  position: string | null;
  department: string | null;
  base_salary: number | null;
  allowance: number | null;
  insurance_salary: number | null;
  work_location?: string | null;
  signed_date?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  status: string;
  note: string | null;
}

export interface CertificateRecord extends RecordBase {
  name: string;
  issuer: string | null;
  certificate_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  note: string | null;
}

export interface ContractAppendixRecord {
  id: string;
  company_id: string;
  contract_id: string;
  employee_id: string;
  appendix_no: string | null;
  change_type: string;
  effective_date: string;
  base_salary: number | null;
  insurance_salary: number | null;
  allowance: number | null;
  position: string | null;
  department: string | null;
  work_location: string | null;
  content: string | null;
  created_at: string;
}

export const APPENDIX_TYPE_LABELS: Record<string, string> = {
  salary: "Điều chỉnh lương",
  position: "Thay đổi chức danh",
  location: "Thay đổi địa điểm",
  other: "Khác",
};

/** Số ngày đến hạn (âm = đã quá hạn), null nếu không có ngày. */
export const daysUntil = (date: string | null | undefined) => {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

export interface SalaryRecord extends RecordBase {
  effective_date: string;
  end_date: string | null;
  base_salary: number;
  position_allowance: number | null;
  responsibility_allowance: number | null;
  other_allowance: number | null;
  insurance_salary: number | null;
  kpi_bonus: number | null;
  decision_no: string | null;
  note: string | null;
}

export interface InsuranceRecord extends RecordBase {
  insurance_type: string;
  insurance_number: string | null;
  start_date: string | null;
  end_date: string | null;
  salary_base: number | null;
  employee_rate: number | null;
  employer_rate: number | null;
  status: string;
  note: string | null;
}

export interface RewardRecord extends RecordBase {
  title: string;
  category: string;
  reward_date: string;
  amount: number | null;
  decision_no: string | null;
  description: string | null;
}

export interface DisciplineChecklistStep {
  key: string;
  label: string;
  completed: boolean;
  file_path: string | null;
  file_name: string | null;
}

export interface DisciplineRecord extends RecordBase {
  title: string;
  category: string;
  effective_date: string;
  record_no: string | null;
  incident_date: string | null;
  decision_no: string | null;
  description: string | null;
  additional_measures: string | null;
  checklist: DisciplineChecklistStep[] | null;
}

export interface TrainingRecord extends RecordBase {
  course_name: string;
  provider: string | null;
  category: string;
  start_date: string | null;
  end_date: string | null;
  cost: number | null;
  result: string | null;
  note: string | null;
}

export interface AssetRecord extends RecordBase {
  asset_code: string | null;
  name: string;
  category: string;
  serial_number: string | null;
  assigned_date: string;
  return_date: string | null;
  value: number | null;
  condition: string;
  status: string;
  note: string | null;
}

export interface DependentRecord extends RecordBase {
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  gender: string | null;
  national_id: string | null;
  tax_code: string | null;
  registered_for_deduction: boolean;
  effective_from: string | null;
  effective_to: string | null;
  note: string | null;
}

export const DEPENDENT_RELATION_LABELS: Record<string, string> = {
  spouse: "Vợ / Chồng",
  child: "Con",
  father: "Bố",
  mother: "Mẹ",
  sibling: "Anh / Chị / Em",
  other: "Khác",
};

export interface DebtRecord extends RecordBase {
  title: string;
  category: string;
  amount: number;
  settled_amount: number;
  due_date: string | null;
  status: string;
  note: string | null;
}

export interface DocumentRecord extends RecordBase {
  name: string;
  category: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  document_no?: string | null;
  expiry_date?: string | null;
}

/* ------------------------------------------------------------------ */
/* Option lists + labels                                              */
/* ------------------------------------------------------------------ */

export const EMPLOYEE_STATUS_META: Record<
  EmployeeStatus,
  { label: string; tone: "success" | "info" | "warning" | "muted" }
> = {
  pending: { label: "Chờ cập nhật", tone: "muted" },
  active: { label: "Đang làm việc", tone: "success" },
  maternity: { label: "Nghỉ thai sản", tone: "info" },
  long_leave: { label: "Nghỉ dài hạn", tone: "warning" },
  resigned: { label: "Đã nghỉ việc", tone: "muted" },
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  intern: "Thực tập sinh",
  contractor: "Cộng tác viên",
};

export const GENDER_LABELS: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export const MARITAL_LABELS: Record<string, string> = {
  single: "Độc thân",
  married: "Đã kết hôn",
  divorced: "Đã ly hôn",
  widowed: "Goá",
};

export const WORK_EVENT_LABELS: Record<string, string> = {
  onboarding: "Tiếp nhận",
  transfer: "Điều chuyển",
  promotion: "Bổ nhiệm",
  title_change: "Đổi chức danh",
  location_change: "Đổi địa điểm",
  maternity: "Nghỉ thai sản",
  leave: "Nghỉ dài hạn",
  return: "Quay lại làm việc",
  resignation: "Nghỉ việc",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  probation: "Thử việc",
  fixed_term: "Xác định thời hạn",
  indefinite: "Không xác định thời hạn",
  seasonal: "Thời vụ",
  service: "Hợp đồng dịch vụ",
  internship: "Thực tập",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  active: "Đang hiệu lực",
  expired: "Hết hạn",
  terminated: "Đã chấm dứt",
};

export const INSURANCE_TYPE_LABELS: Record<string, string> = {
  social: "BHXH",
  health: "BHYT",
  unemployment: "BHTN",
  accident: "BHTNLĐ - BNN",
};

export const INSURANCE_STATUS_LABELS: Record<string, string> = {
  active: "Đang đóng",
  paused: "Tạm dừng",
  closed: "Đã chốt",
};

export const REWARD_CATEGORY_LABELS: Record<string, string> = {
  bonus: "Thưởng",
  commendation: "Khen thưởng",
  award: "Vinh danh",
  certificate: "Bằng khen",
};

export const DISCIPLINE_CATEGORY_LABELS: Record<string, string> = {
  reminder: "Nhắc nhở",
  reprimand: "Khiển trách",
  salary_delay: "Kéo dài thời hạn nâng lương",
  demotion: "Cách chức",
  dismissal: "Sa thải",
};

/** Mandatory procedure steps for any discipline other than a reminder. */
export const DISCIPLINE_PROCEDURE_STEPS: { key: string; label: string }[] = [
  { key: "violation_record", label: "Biên bản ghi nhận vi phạm" },
  { key: "meeting_notice", label: "Thông báo họp xử lý kỷ luật" },
  { key: "meeting_minutes", label: "Biên bản họp xử lý kỷ luật" },
  { key: "decision", label: "Quyết định xử lý kỷ luật" },
  { key: "handover", label: "Biên bản bàn giao quyết định" },
];

export const TRAINING_CATEGORY_LABELS: Record<string, string> = {
  internal: "Đào tạo nội bộ",
  external: "Đào tạo bên ngoài",
  certification: "Chứng chỉ",
  orientation: "Định hướng",
};

export const TRAINING_RESULT_LABELS: Record<string, string> = {
  in_progress: "Đang học",
  passed: "Hoàn thành",
  failed: "Không đạt",
  cancelled: "Đã huỷ",
};

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  laptop: "Máy tính xách tay",
  monitor: "Màn hình",
  phone: "Điện thoại",
  vehicle: "Phương tiện",
  tool: "Công cụ làm việc",
  furniture: "Nội thất",
  other: "Khác",
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  assigned: "Đang sử dụng",
  returned: "Đã thu hồi",
  lost: "Mất",
  damaged: "Hư hỏng",
};

export const ASSET_CONDITION_LABELS: Record<string, string> = {
  new: "Mới",
  good: "Tốt",
  fair: "Khá",
  damaged: "Hư hỏng",
};

export const DEBT_CATEGORY_LABELS: Record<string, string> = {
  advance: "Tạm ứng lương",
  loan: "Vay cá nhân",
  penalty: "Bồi thường / phạt",
  equipment: "Tài sản hư hỏng",
  other: "Khác",
};

export const DEBT_STATUS_LABELS: Record<string, string> = {
  open: "Chưa tất toán",
  settled: "Đã tất toán",
  cancelled: "Đã huỷ",
};

export const debtOutstanding = (row: {
  amount: number | null;
  settled_amount: number | null;
  status: string;
}) => (row.status === "open" ? Math.max(Number(row.amount ?? 0) - Number(row.settled_amount ?? 0), 0) : 0);

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  contract: "Hợp đồng",
  identity: "Giấy tờ tuỳ thân",
  degree: "Bằng cấp",
  certificate: "Chứng chỉ",
  insurance: "Bảo hiểm",
  medical: "Hồ sơ y tế",
  cv: "CV / Sơ yếu lý lịch",
  photo: "Ảnh thẻ",
  other: "Khác",
};

export const DEPARTMENTS = [
  "Kỹ thuật",
  "Kinh doanh",
  "Vận hành",
  "Marketing",
  "Tài chính",
  "Nhân sự",
  "Chăm sóc khách hàng",
  "Pháp chế",
];

export const JOB_LEVELS = ["Nhân viên", "Chuyên viên", "Trưởng nhóm", "Trưởng phòng", "Giám đốc", "Ban điều hành"];

export const EDUCATION_LEVELS = ["Trung học", "Cao đẳng", "Đại học", "Thạc sĩ", "Tiến sĩ"];

export interface ContractHealth {
  state: "none" | "missing" | "expired" | "expiring" | "ok";
  label: string;
  shortLabel: string;
  days?: number;
  tone: "destructive" | "warning" | "success" | "muted";
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

/** Contract status for warnings: none / expired / expiring within 30 days / ok. */
export const contractHealth = (
  contracts: { status: string; end_date: string | null }[],
): ContractHealth => {
  if (contracts.length === 0) {
    return {
      state: "none",
      label: "Chưa có hợp đồng lao động trong hồ sơ",
      shortLabel: "Chưa có HĐ",
      tone: "destructive",
    };
  }

  const active = contracts.filter((contract) => contract.status === "active");
  if (active.length === 0) {
    return {
      state: "missing",
      label: "Không có hợp đồng đang hiệu lực",
      shortLabel: "HĐ hết hiệu lực",
      tone: "destructive",
    };
  }

  if (active.some((contract) => !contract.end_date)) {
    return { state: "ok", label: "Hợp đồng không xác định thời hạn", shortLabel: "Không thời hạn", tone: "success" };
  }

  const latest = active.reduce((best, contract) =>
    new Date(contract.end_date as string).getTime() > new Date(best.end_date as string).getTime()
      ? contract
      : best,
  );

  const days = Math.ceil((new Date(latest.end_date as string).getTime() - startOfToday()) / 86_400_000);

  if (days < 0) {
    return {
      state: "expired",
      label: `Hợp đồng đã hết hạn ${Math.abs(days)} ngày`,
      shortLabel: `HĐ quá hạn ${Math.abs(days)}n`,
      days,
      tone: "destructive",
    };
  }

  if (days <= 30) {
    return {
      state: "expiring",
      label: `Hợp đồng sắp hết hạn trong ${days} ngày`,
      shortLabel: `Sắp hết hạn ${days}n`,
      days,
      tone: "warning",
    };
  }

  return { state: "ok", label: `Hợp đồng còn ${days} ngày`, shortLabel: `Còn ${days}n`, days, tone: "success" };
};

export interface ContractSummaryRow {
  employee_id: string;
  status: string;
  end_date: string | null;
  contract_type: string;
  start_date: string | null;
}

export const listCompanyContractSummaries = async (companyId: string): Promise<ContractSummaryRow[]> => {
  const { data, error } = await db
    .from("employee_contracts")
    .select("employee_id, status, end_date, contract_type, start_date")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data ?? []) as ContractSummaryRow[];
};

export const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/* ------------------------------------------------------------------ */
/* Employee CRUD                                                      */
/* ------------------------------------------------------------------ */

/**
 * Cột nhạy cảm (CCCD, ngân hàng, MST) không còn SELECT trực tiếp được từ bảng employees.
 * Chỉ owner/admin/hr hoặc chính chủ đọc được qua RPC employee_sensitive_fields.
 */
export const SENSITIVE_EMPLOYEE_FIELDS = [
  "national_id",
  "national_id_issue_date",
  "national_id_issue_place",
  "bank_name",
  "bank_account",
  "bank_branch",
  "tax_code",
] as const;

export const EMPLOYEE_PUBLIC_COLUMNS = [
  "avatar_url",
  "code",
  "company_id",
  "concurrent_positions",
  "created_at",
  "created_by",
  "current_address",
  "date_of_birth",
  "department",
  "dependents_count",
  "education_level",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relation",
  "employment_type",
  "ethnicity",
  "full_name",
  "gender",
  "hire_date",
  "id",
  "insurance_number",
  "job_level",
  "major",
  "manager_id",
  "marital_status",
  "nationality",
  "notes",
  "official_date",
  "permanent_address",
  "personal_email",
  "phone",
  "position",
  "probation_end_date",
  "religion",
  "resignation_date",
  "resignation_reason",
  "school",
  "status",
  "updated_at",
  "user_id",
  "work_email",
  "work_location",
].join(", ");

type SensitiveRow = { employee_id: string } & Partial<Record<(typeof SENSITIVE_EMPLOYEE_FIELDS)[number], string | null>>;

const emptySensitive = Object.fromEntries(SENSITIVE_EMPLOYEE_FIELDS.map((field) => [field, null]));

/** Gắn các cột nhạy cảm mà người dùng hiện tại được phép xem; còn lại để null. */
export const withSensitiveFields = async <T extends { id: string; company_id: string }>(rows: T[]) => {
  if (rows.length === 0) return rows as (T & Record<(typeof SENSITIVE_EMPLOYEE_FIELDS)[number], string | null>)[];
  const { data, error } = await db.rpc("employee_sensitive_fields", {
    p_company: rows[0].company_id,
    p_employee: rows.length === 1 ? rows[0].id : null,
  });
  if (error) throw error;
  const byId = new Map(((data ?? []) as SensitiveRow[]).map((row) => [row.employee_id, row]));
  return rows.map((row) => {
    const extra = byId.get(row.id);
    const picked = extra
      ? Object.fromEntries(SENSITIVE_EMPLOYEE_FIELDS.map((field) => [field, extra[field] ?? null]))
      : emptySensitive;
    return { ...row, ...picked } as T & Record<(typeof SENSITIVE_EMPLOYEE_FIELDS)[number], string | null>;
  });
};

export const listEmployees = async (companyId: string): Promise<EmployeeRecord[]> => {
  const { data, error } = await db
    .from("employees")
    .select(EMPLOYEE_PUBLIC_COLUMNS)
    .eq("company_id", companyId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (await withSensitiveFields((data ?? []) as EmployeeRecord[])) as EmployeeRecord[];
};

export const getEmployee = async (employeeId: string): Promise<EmployeeRecord | null> => {
  const { data, error } = await db.from("employees").select(EMPLOYEE_PUBLIC_COLUMNS).eq("id", employeeId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [record] = await withSensitiveFields([data as EmployeeRecord]);
  return record as EmployeeRecord;
};

export const createEmployee = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("employees").insert(values).select("id").single();
  if (error) throw error;
  return data.id as string;
};

export const updateEmployee = async (employeeId: string, values: Record<string, unknown>) => {
  const { error } = await db.from("employees").update(values).eq("id", employeeId);
  if (error) throw error;
};

export const deleteEmployee = async (employeeId: string) => {
  // Remove stored HR documents first; the rows themselves are deleted by cascade.
  const { data: documents } = await db
    .from("employee_documents")
    .select("file_path")
    .eq("employee_id", employeeId);
  const paths = ((documents ?? []) as { file_path: string }[])
    .map((document) => document.file_path)
    .filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(EMPLOYEE_DOCUMENT_BUCKET).remove(paths);
  }

  const { error } = await db.from("employees").delete().eq("id", employeeId);
  if (error) throw error;
};

type RecordTable =
  | "employee_work_history"
  | "employee_contracts"
  | "employee_salary_records"
  | "employee_insurance_records"
  | "employee_rewards"
  | "employee_discipline_records"
  | "employee_training_records"
  | "employee_assets"
  | "employee_debts"
  | "employee_dependents"
  | "employee_documents"
  | "employee_contacts"
  | "employee_notes"
  | "employee_certificates";

export const fetchRecords = async <T>(
  table: RecordTable,
  employeeId: string,
  orderColumn = "created_at",
  ascending = false,
): Promise<T[]> => {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("employee_id", employeeId)
    .order(orderColumn, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
};

export const createRecord = async (table: RecordTable, values: Record<string, unknown>) => {
  const { data, error } = await db.from(table).insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không thêm được bản ghi.");
  return data.id as string;
};

export const updateRecord = async (table: RecordTable, id: string, values: Record<string, unknown>) => {
  const { error } = await db.from(table).update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được bản ghi.");
};

export const removeRecord = async (table: RecordTable, id: string) => {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được bản ghi.");
};

export const countRecords = async (table: RecordTable, employeeId: string): Promise<number> => {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId);
  if (error) throw error;
  return count ?? 0;
};

/* ------------------------------------------------------------------ */
/* Documents + storage                                                */
/* ------------------------------------------------------------------ */

export const uploadEmployeeAvatar = async (input: {
  companyId: string;
  employeeId: string;
  file: File;
}): Promise<string> => {
  if (!input.file.type.startsWith("image/")) {
    throw new Error("Chỉ hỗ trợ tệp ảnh (JPG, PNG, WEBP).");
  }
  if (input.file.size > 5 * 1024 * 1024) {
    throw new Error("Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.");
  }
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${input.companyId}/${input.employeeId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(EMPLOYEE_AVATAR_BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(EMPLOYEE_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadEmployeeDocument = async (input: {
  companyId: string;
  employeeId: string;
  file: File;
  name: string;
  category: string;
  expiryDate?: string | null;
  documentNo?: string | null;
}) => {
  const { companyId, employeeId, file, name, category } = input;

  if (file.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
    throw new Error("Tệp vượt quá 15MB. Vui lòng chọn tệp nhỏ hơn.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${companyId}/${employeeId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(EMPLOYEE_DOCUMENT_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

  if (uploadError) throw uploadError;

  const { error: insertError } = await db.from("employee_documents").insert({
    employee_id: employeeId,
    name,
    category,
    file_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    expiry_date: input.expiryDate || null,
    document_no: input.documentNo?.trim() || null,
  });

  if (insertError) {
    await supabase.storage.from(EMPLOYEE_DOCUMENT_BUCKET).remove([path]);
    throw insertError;
  }
};

export const uploadEmployeeFile = async (input: {
  companyId: string;
  employeeId: string;
  file: File;
}): Promise<string> => {
  if (input.file.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
    throw new Error("Tệp vượt quá 15MB. Vui lòng chọn tệp nhỏ hơn.");
  }
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${input.companyId}/${input.employeeId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(EMPLOYEE_DOCUMENT_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw error;
  return path;
};

export const getDocumentSignedUrl = async (filePath: string, downloadAs?: string) => {
  const { data, error } = await supabase.storage
    .from(EMPLOYEE_DOCUMENT_BUCKET)
    .createSignedUrl(filePath, 60 * 60, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data.signedUrl;
};

export const deleteEmployeeDocument = async (document: { id: string; file_path: string }) => {
  const { error } = await db.from("employee_documents").delete().eq("id", document.id);
  if (error) throw error;
  await supabase.storage.from(EMPLOYEE_DOCUMENT_BUCKET).remove([document.file_path]);
};

export const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

export const formatMonth = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};
