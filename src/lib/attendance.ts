import { supabase } from "@/integrations/supabase/client";
import { EMPLOYEE_PUBLIC_COLUMNS, withSensitiveFields, type EmployeeRecord } from "@/lib/employee-records";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const ATTENDANCE_METHOD_LABELS: Record<string, string> = {
  gps: "GPS",
  wifi: "Wi-Fi",
  phone: "Điện thoại",
  web: "Trình duyệt",
};

export const SCOPE_TYPE_LABELS: Record<string, string> = {
  company: "Toàn công ty",
  department: "Bộ phận / phòng ban",
  position: "Vị trí / chức danh",
  employee: "Cá nhân",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  on_time: "Đúng giờ",
  late: "Đi muộn",
  early_leave: "Về sớm",
  absent: "Vắng mặt",
  leave: "Nghỉ phép",
  holiday: "Ngày lễ",
};

export const WORK_DAY_LABELS: Record<string, string> = {
  mon: "T2",
  tue: "T3",
  wed: "T4",
  thu: "T5",
  fri: "T6",
  sat: "T7",
  sun: "CN",
};

export const WORK_DAY_PRESETS: Record<string, string[]> = {
  "T2 – T6": ["mon", "tue", "wed", "thu", "fri"],
  "T2 – T7": ["mon", "tue", "wed", "thu", "fri", "sat"],
  "Cả tuần": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
};

export const presetFromDays = (days: string[] | null | undefined) => {
  const value = days ?? [];
  const match = Object.entries(WORK_DAY_PRESETS).find(
    ([, preset]) => preset.length === value.length && preset.every((day) => value.includes(day)),
  );
  return match?.[0] ?? "T2 – T6";
};

export const scopeLabel = (type: string, value: string | null) => {
  const base = SCOPE_TYPE_LABELS[type] ?? type;
  return value ? `${base} · ${value}` : base;
};

/* ------------------------------- Types -------------------------------- */

export interface WorkShift {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  start_time: string;
  end_time: string;
  break_minutes: number;
  late_grace_minutes: number;
  work_days: string[];
  shift_type: string;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  valid_checkin_from: string;
  valid_checkin_to: string;
  late_after: string;
  valid_checkin_from_pm: string | null;
  valid_checkin_to_pm: string | null;
  late_after_pm: string | null;
  work_credit: number;
  forgot_checkout_credit: number;
  color: string | null;
  active: boolean;
  created_at: string;
}

export interface AttendanceSetting {
  id: string;
  company_id: string;
  name: string;
  methods: string[];
  scope_type: string;
  scope_value: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_radius_meters: number | null;
  wifi_ssid: string | null;
  active: boolean;
  created_at: string;
}

export interface ShiftAssignment {
  id: string;
  company_id: string;
  shift_id: string;
  scope_type: string;
  scope_value: string | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  company_id: string;
  employee_id: string;
  work_date: string;
  session: string;
  check_in: string | null;
  check_out: string | null;
  method: string | null;
  shift_id: string | null;
  status: string;
  note: string | null;
}

type AttendanceTable = "work_shifts" | "attendance_settings" | "shift_assignments" | "attendance_records";

export const listRows = async <T>(
  table: AttendanceTable,
  companyId: string,
  orderColumn = "created_at",
  ascending = false,
): Promise<T[]> => {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("company_id", companyId)
    .order(orderColumn, { ascending });
  if (error) throw new Error(error.message ?? "Không tải được dữ liệu chấm công.");
  return (data ?? []) as T[];
};

export const createRow = async (table: AttendanceTable, values: Record<string, unknown>) => {
  const { data, error } = await db.from(table).insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không lưu được dữ liệu.");
  return data.id as string;
};

export const createRows = async (table: AttendanceTable, values: Record<string, unknown>[]) => {
  const { error } = await db.from(table).insert(values);
  if (error) throw new Error(error.message ?? "Không lưu được dữ liệu.");
};

export const updateRow = async (table: AttendanceTable, id: string, values: Record<string, unknown>) => {
  const { error } = await db.from(table).update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được dữ liệu.");
};

export const deleteRow = async (table: AttendanceTable, id: string) => {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được dữ liệu.");
};

/* ----------------------------- Helpers ------------------------------ */

export const normalizeTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "08:00");

export const shiftRange = (shift: { start_time: string; end_time?: string }, date: string) => {
  const start = new Date(`${date}T${normalizeTime(shift.start_time)}:00`);
  const end = new Date(`${date}T${normalizeTime(shift.end_time ?? "17:30")}:00`);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
};

/** Most specific assignment wins: employee → position → department → company. */
export const resolveShift = (
  employee: Pick<EmployeeRecord, "id" | "code" | "department" | "position">,
  assignments: ShiftAssignment[],
  shifts: WorkShift[],
  date: string,
): WorkShift | null => {
  const inRange = assignments.filter((assignment) => {
    if (assignment.effective_from && assignment.effective_from > date) return false;
    if (assignment.effective_to && assignment.effective_to < date) return false;
    return true;
  });

  const findShift = (assignment: ShiftAssignment | undefined) =>
    assignment ? shifts.find((shift) => shift.id === assignment.shift_id && shift.active) ?? null : null;

  const employeeAssignment = inRange.find(
    (assignment) => assignment.scope_type === "employee" && assignment.scope_value === employee.code,
  );
  if (employeeAssignment) return findShift(employeeAssignment);

  const positionAssignment = inRange.find(
    (assignment) => assignment.scope_type === "position" && assignment.scope_value === employee.position,
  );
  if (positionAssignment) return findShift(positionAssignment);

  const departmentAssignment = inRange.find(
    (assignment) => assignment.scope_type === "department" && assignment.scope_value === employee.department,
  );
  if (departmentAssignment) return findShift(departmentAssignment);

  const companyAssignment = inRange.find((assignment) => assignment.scope_type === "company");
  return findShift(companyAssignment);
};

export const timeOn = (date: string, value: string) => new Date(`${date}T${normalizeTime(value)}:00`);

export type CheckinSession = "morning" | "afternoon";

export interface CheckinWindow {
  session: CheckinSession;
  from: Date;
  to: Date;
  lateAfter: Date;
}

export const SESSION_LABELS: Record<CheckinSession, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
};

export const SHIFT_TYPE_LABELS: Record<string, string> = {
  office: "Hành chính",
  single: "Ca đơn",
  custom: "Tùy chọn",
};

export const checkinWindows = (shift: WorkShift, date: string): CheckinWindow[] => {
  const windows: CheckinWindow[] = [
    {
      session: "morning",
      from: timeOn(date, shift.valid_checkin_from),
      to: timeOn(date, shift.valid_checkin_to),
      lateAfter: timeOn(date, shift.late_after),
    },
  ];

  if (shift.valid_checkin_from_pm && shift.valid_checkin_to_pm && shift.late_after_pm) {
    windows.push({
      session: "afternoon",
      from: timeOn(date, shift.valid_checkin_from_pm),
      to: timeOn(date, shift.valid_checkin_to_pm),
      lateAfter: timeOn(date, shift.late_after_pm),
    });
  }

  return windows.filter((window) => window.to >= window.from);
};

export const matchCheckinWindow = (shift: WorkShift, date: string, at: Date) =>
  checkinWindows(shift, date).find((window) => at >= window.from && at <= window.to) ?? null;

export const isWithinCheckinWindow = (shift: WorkShift, date: string, at: Date) =>
  !!matchCheckinWindow(shift, date, at);

export const isLateCheckIn = (shift: WorkShift, date: string, at: Date) => {
  const window = matchCheckinWindow(shift, date, at);
  return window ? at > window.lateAfter : false;
};

export const shiftWindowLabel = (shift: WorkShift) => {
  const time = (value: string | null | undefined) => (value ? value.slice(0, 5) : "—");
  const morning = `Sáng ${time(shift.valid_checkin_from)}–${time(shift.valid_checkin_to)}`;
  if (!shift.valid_checkin_from_pm || !shift.valid_checkin_to_pm) return morning;
  return `${morning} · Chiều ${time(shift.valid_checkin_from_pm)}–${time(shift.valid_checkin_to_pm)}`;
};

/** Công ghi nhận cho một bản ghi: quên check-out dùng hệ số riêng. */
export const creditForRecord = (
  record: { check_out: string | null },
  shift: Pick<WorkShift, "work_credit" | "forgot_checkout_credit"> | null | undefined,
) => {
  if (!record.check_out) return Number(shift?.forgot_checkout_credit ?? 0);
  return Number(shift?.work_credit ?? 1);
};

export const dayCredit = (
  records: { check_in: string | null; check_out: string | null }[],
  shift: Pick<WorkShift, "work_credit" | "forgot_checkout_credit"> | null | undefined,
) => {
  if (!records.length) return 0;
  if (!records.some((record) => record.check_in)) return 0;
  if (records.some((record) => record.check_in && !record.check_out)) {
    return Number(shift?.forgot_checkout_credit ?? 0);
  }
  return Number(shift?.work_credit ?? 1);
};

export const formatCredit = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

export const assignmentAppliesToEmployee = (
  assignment: Pick<ShiftAssignment, "scope_type" | "scope_value">,
  employee: Pick<EmployeeRecord, "code" | "department" | "position">,
) => {
  if (assignment.scope_type === "company") return true;
  if (assignment.scope_type === "employee") return assignment.scope_value === employee.code;
  if (assignment.scope_type === "department") return assignment.scope_value === employee.department;
  if (assignment.scope_type === "position") return assignment.scope_value === employee.position;
  return false;
};

export const assignmentTargets = (
  assignment: Pick<ShiftAssignment, "scope_type" | "scope_value">,
  employees: EmployeeRecord[],
) => employees.filter((employee) => assignmentAppliesToEmployee(assignment, employee));

const overlapsRange = (
  a: { effective_from: string | null; effective_to: string | null },
  b: { effective_from: string | null; effective_to: string | null },
) => {
  const aStart = a.effective_from ?? "0000-01-01";
  const aEnd = a.effective_to ?? "9999-12-31";
  const bStart = b.effective_from ?? "0000-01-01";
  const bEnd = b.effective_to ?? "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
};

export interface ShiftConflict {
  employee: EmployeeRecord;
  shiftName: string;
}

/** Một nhân sự chỉ được một ca trong cùng khoảng thời gian. */
export const findShiftConflicts = (
  candidate: Pick<ShiftAssignment, "scope_type" | "scope_value" | "effective_from" | "effective_to">,
  employees: EmployeeRecord[],
  assignments: ShiftAssignment[],
  shifts: WorkShift[],
  ignoreIds: string[] = [],
): ShiftConflict[] => {
  const affected = assignmentTargets(candidate, employees).filter((employee) => employee.status !== "resigned");
  const conflicts: ShiftConflict[] = [];

  affected.forEach((employee) => {
    const clash = assignments.find(
      (assignment) =>
        !ignoreIds.includes(assignment.id) &&
        overlapsRange(assignment, candidate) &&
        assignment.scope_type === candidate.scope_type &&
        (candidate.scope_type === "company" || assignment.scope_value === candidate.scope_value) &&
        assignmentAppliesToEmployee(assignment, employee),
    );
    if (clash) {
      const shift = shifts.find((item) => item.id === clash.shift_id);
      conflicts.push({ employee, shiftName: shift?.name ?? "ca khác" });
    }
  });

  return conflicts;
};

export const isWorkingDay = (shift: WorkShift, date: string) => {
  const dayIndex = new Date(`${date}T00:00:00`).getDay();
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return shift.work_days.includes(map[dayIndex]);
};

export const findMyEmployee = async (companyId: string, userId: string): Promise<EmployeeRecord | null> => {
  const { data, error } = await db
    .from("employees")
    .select(EMPLOYEE_PUBLIC_COLUMNS)
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Không tìm thấy hồ sơ nhân sự.");
  if (!data) return null;
  const [record] = await withSensitiveFields([data as EmployeeRecord]);
  return record as EmployeeRecord;
};

export const listRecordsBetween = async (
  companyId: string,
  from: string,
  to: string,
): Promise<AttendanceRecord[]> => {
  const { data, error } = await db
    .from("attendance_records")
    .select("*")
    .eq("company_id", companyId)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được bảng công.");
  return (data ?? []) as AttendanceRecord[];
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Local (device timezone) ISO date, avoids UTC shifting around midnight. */
export const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const currentMonthIso = () => todayIso().slice(0, 7);

export const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

export const minutesLate = (
  shift: Pick<WorkShift, "start_time" | "late_grace_minutes">,
  date: string,
  checkIn: Date,
) => {
  const { start } = shiftRange(shift, date);
  const diff = Math.round((checkIn.getTime() - start.getTime()) / 60000);
  return diff > (shift.late_grace_minutes ?? 0) ? diff : 0;
};
