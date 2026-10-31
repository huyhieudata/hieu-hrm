import { supabase } from "@/integrations/supabase/client";
import { listRecordsBetween, type AttendanceRecord } from "@/lib/attendance";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { listPayrollItems, listPayrollPeriods, type PayrollItem, type PayrollPeriod } from "@/lib/payroll";
import { listRequestTypes, listRequests, type EmployeeRequest, type RequestType } from "@/lib/requests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export interface DashboardBirthday {
  id: string;
  name: string;
  department: string | null;
  email: string | null;
  day: string;
  month: string;
  daysUntil: number;
  isToday: boolean;
}

export interface DashboardDepartment {
  name: string;
  count: number;
}

export interface DashboardActivity {
  id: string;
  title: string;
  meta: string;
  createdAt: string;
}

export interface DashboardData {
  employees: EmployeeRecord[];
  attendanceWeek: AttendanceRecord[];
  todayRecords: AttendanceRecord[];
  requests: EmployeeRequest[];
  requestTypes: RequestType[];
  latestPeriod: PayrollPeriod | null;
  latestPayrollNet: number;
  payrollTrend: number[];
  headcountTrend: { month: string; count: number }[];
  presentTrend: number[];
  pendingTrend: number[];
  departments: DashboardDepartment[];
  birthdays: DashboardBirthday[];
  activity: DashboardActivity[];
}

const MONTH_SHORT = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

const safe = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

export const loadDashboardData = async (companyId: string): Promise<DashboardData> => {
  const today = new Date();
  const todayValue = isoDate(today);
  const weekStart = isoDate(addDays(today, -6));

  const [employees, attendanceWeek, requests, requestTypes, periods, payrollItems, activityRows] = await Promise.all([
    safe(listEmployees(companyId), [] as EmployeeRecord[]),
    safe(listRecordsBetween(companyId, weekStart, todayValue), [] as AttendanceRecord[]),
    safe(listRequests(companyId), [] as EmployeeRequest[]),
    safe(listRequestTypes(companyId), [] as RequestType[]),
    safe(listPayrollPeriods(companyId), [] as PayrollPeriod[]),
    safe(listPayrollItems(companyId), [] as PayrollItem[]),
    safe(
      db
        .from("activity_logs")
        .select("id, summary, actor_name, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(6)
        .then(
          (result: {
            data: { id: string; summary: string; actor_name: string | null; created_at: string }[] | null;
          }) => result.data ?? [],
        ),
      [] as { id: string; summary: string; actor_name: string | null; created_at: string }[],
    ),
  ]);

  const activeEmployees = employees.filter(
    (employee) =>
      employee.status !== "resigned" &&
      (!employee.resignation_date || employee.resignation_date > todayValue),
  );
  const todayRecords = attendanceWeek.filter((record) => record.work_date === todayValue);
  const presentTrend = Array.from({ length: 7 }, (_, index) => {
    const date = isoDate(addDays(today, index - 6));
    const ids = new Set(
      attendanceWeek
        .filter((record) => record.work_date === date && record.check_in)
        .map((record) => record.employee_id),
    );
    return ids.size;
  });

  const pendingTrend = Array.from({ length: 7 }, (_, index) => {
    const date = isoDate(addDays(today, index - 6));
    return requests.filter((request) => isoDate(new Date(request.created_at)) === date).length;
  });

  const headcountTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index) + 1, 0);
    const isCurrentMonth = date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    const monthEnd = isCurrentMonth ? todayValue : isoDate(date);
    const count = employees.filter((employee) => {
      if (employee.hire_date && employee.hire_date > monthEnd) return false;
      if (employee.resignation_date && employee.resignation_date <= monthEnd) return false;
      return true;
    }).length;
    return { month: MONTH_SHORT[date.getMonth()], count };
  });

  const departmentCounts = new Map<string, number>();
  activeEmployees.forEach((employee) => {
    const name = employee.department?.trim() || "Chưa xếp phòng ban";
    departmentCounts.set(name, (departmentCounts.get(name) ?? 0) + 1);
  });
  const departments = Array.from(departmentCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const birthdays = activeEmployees
    .filter((employee) => employee.date_of_birth)
    .map((employee) => {
      const source = new Date(`${employee.date_of_birth}T00:00:00`);
      if (Number.isNaN(source.getTime())) return null;
      const next = new Date(today.getFullYear(), source.getMonth(), source.getDate());
      if (next.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
        next.setFullYear(today.getFullYear() + 1);
      }
      const daysUntil = Math.round(
        (new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime() -
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
          86_400_000,
      );
      if (daysUntil > 30) return null;
      return {
        id: employee.id,
        name: employee.full_name,
        department: employee.department,
        email: employee.work_email ?? employee.personal_email,
        day: pad(source.getDate() === 0 ? 1 : source.getDate()),
        month: pad(source.getMonth() + 1),
        daysUntil,
        isToday: daysUntil === 0,
      };
    })
    .filter((item): item is DashboardBirthday => item !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  const orderedPeriods = [...periods].sort((a, b) => b.year - a.year || b.month - a.month);
  const latestPeriod = orderedPeriods[0] ?? null;
  const netForPeriod = (periodId: string) =>
    payrollItems.filter((item) => item.period_id === periodId).reduce((sum, item) => sum + Number(item.net_salary), 0);
  const latestPayrollNet = latestPeriod ? netForPeriod(latestPeriod.id) : 0;
  const payrollTrend = orderedPeriods
    .slice(0, 6)
    .reverse()
    .map((period) => netForPeriod(period.id));

  return {
    employees,
    attendanceWeek,
    requests,
    requestTypes,
    latestPeriod,
    latestPayrollNet,
    payrollTrend: payrollTrend.length >= 2 ? payrollTrend : [0, ...payrollTrend],
    headcountTrend,
    presentTrend,
    pendingTrend,
    todayRecords,
    departments,
    birthdays,
    activity: (activityRows ?? []).map((row) => ({
      id: row.id,
      title: row.summary,
      meta: `${row.actor_name ?? "Hệ thống"} · ${new Date(row.created_at).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      createdAt: row.created_at,
    })),
  };
};
