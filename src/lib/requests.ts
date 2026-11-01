import { cached } from "@/lib/query-cache";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const REQUEST_CATEGORY_LABELS: Record<string, string> = {
  late: "Đi muộn",
  early_leave: "Về sớm",
  leave: "Nghỉ phép",
  remote: "Làm từ xa",
  attendance_fix: "Sửa chấm công",
  outside: "Ra ngoài",
  other: "Khác",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã huỷ",
};

export const REQUEST_SESSION_LABELS: Record<string, string> = {
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  full_day: "Cả ngày",
};

export const requestStatusTone = (status: string) =>
  status === "approved" ? "success" : status === "pending" ? "warning" : status === "rejected" ? "destructive" : "muted";

export interface RequestType {
  id: string;
  company_id: string;
  name: string;
  category: string;
  deduct_leave: boolean;
  requires_attachment: boolean;
  max_days: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface EmployeeRequest {
  id: string;
  company_id: string;
  employee_id: string;
  request_type_id: string;
  start_date: string;
  end_date: string;
  session: string | null;
  start_time: string | null;
  end_time: string | null;
  leave_days: number;
  reason: string | null;
  attachment_url: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

type RequestTable = "request_types" | "requests";

export const listRequestTypes = (companyId: string, onlyActive = false): Promise<RequestType[]> =>
  cached(`requestTypes:${companyId}:${onlyActive}`, 60_000, () => listRequestTypesRaw(companyId, onlyActive)).then((rows) => [...rows]);

const listRequestTypesRaw = async (companyId: string, onlyActive: boolean): Promise<RequestType[]> => {
  let query = db.from("request_types").select("*").eq("company_id", companyId);
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được loại đơn.");
  return (data ?? []) as RequestType[];
};

export const listRequests = async (companyId: string): Promise<EmployeeRequest[]> => {
  const { data, error } = await db
    .from("requests")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được đơn từ.");
  return (data ?? []) as EmployeeRequest[];
};

export const createRequestRow = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("requests").insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được đơn.");
  return data.id as string;
};

export const updateRequestRow = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("requests").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được đơn.");
};

export const deleteRequestRow = async (id: string) => {
  const { error } = await db.from("requests").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được đơn.");
};

export const createRequestType = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("request_types").insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được loại đơn.");
  return data.id as string;
};

export const updateRequestType = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("request_types").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được loại đơn.");
};

export const deleteRequestType = async (id: string) => {
  const { error } = await db.from("request_types").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được loại đơn.");
};

export const REQUEST_CATEGORY_ORDER = [
  "leave",
  "late",
  "early_leave",
  "remote",
  "outside",
  "attendance_fix",
  "other",
];

export const leaveDays = (start: string, end: string, session: string | null) => {
  const days = listDates(start, end).length;
  const factor = !session || session === "full_day" ? 1 : 0.5;
  return Number((days * factor).toFixed(1));
};

/** Số ngày phép đã trừ trong năm (chỉ đơn nghỉ có trừ phép và đã duyệt). */
export const usedLeaveDays = (
  requests: EmployeeRequest[],
  types: RequestType[],
  employeeId: string,
  year: number,
) => {
  const deductTypeIds = new Set(types.filter((type) => type.deduct_leave).map((type) => type.id));
  return requests
    .filter(
      (request) =>
        request.employee_id === employeeId &&
        request.status === "approved" &&
        deductTypeIds.has(request.request_type_id) &&
        request.start_date.slice(0, 4) === String(year),
    )
    .reduce((total, request) => total + Number(request.leave_days ?? 0), 0);
};

export const listDates = (start: string, end: string) => {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last && dates.length < 62) {
    dates.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const toIso = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

/** Sửa chấm công: cập nhật hoặc tạo lượt chấm theo giờ được duyệt. */
export const applyAttendanceFix = async (request: EmployeeRequest) => {
  const session = !request.session || request.session === "full_day" ? "morning" : request.session;
  const { data: existing } = await db
    .from("attendance_records")
    .select("id")
    .eq("employee_id", request.employee_id)
    .eq("work_date", request.start_date)
    .eq("session", session)
    .maybeSingle();

  const values: Record<string, unknown> = {
    check_in: request.start_time ? toIso(request.start_date, request.start_time) : null,
    check_out: request.end_time ? toIso(request.start_date, request.end_time) : null,
    status: "on_time",
  };

  if (existing?.id) {
    const { error } = await db.from("attendance_records").update(values).eq("id", existing.id);
    if (error) throw new Error(error.message ?? "Không cập nhật được bảng công.");
    return;
  }

  const { error } = await db.from("attendance_records").insert({
    ...values,
    company_id: request.company_id,
    employee_id: request.employee_id,
    work_date: request.start_date,
    session,
  });
  if (error) throw new Error(error.message ?? "Không ghi được bảng công.");
};

export const requestTypeByCategory = (types: RequestType[], category: string) =>
  types.find((type) => type.category === category) ?? null;
