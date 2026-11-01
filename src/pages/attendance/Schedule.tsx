import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, FileDown, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/lib/company-provider";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/utils";
import {
  currentMonthIso,
  formatTime,
  isWorkingDay,
  listRecordsBetween,
  listRows,
  resolveShift,
  type AttendanceRecord,
  type ShiftAssignment,
  type WorkShift,
} from "@/lib/attendance";

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const Schedule = () => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [month, setMonth] = useState(currentMonthIso());
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const monthStart = `${month}-01`;
  const daysInMonth = useMemo(() => {
    const [year, monthValue] = month.split("-").map(Number);
    return new Date(year, monthValue, 0).getDate();
  }, [month]);
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const dates = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`),
    [daysInMonth, month],
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [people, shiftRows, assignmentRows, recordRows] = await Promise.all([
        listEmployees(companyId),
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listRows<ShiftAssignment>("shift_assignments", companyId, "created_at"),
        listRecordsBetween(companyId, monthStart, monthEnd),
      ]);
      setEmployees(people);
      setShifts(shiftRows);
      setAssignments(assignmentRows);
      setRecords(recordRows);
    } catch (error) {
      toast.error("Không tải được lịch làm việc", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, monthEnd, monthStart]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Nhân sự đang làm việc hoặc đã nghỉ việc trong tháng đang chọn. */
  const monthEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (employee.hire_date && employee.hire_date > monthEnd) return false;
        if (employee.status === "resigned") {
          // Đã nghỉ việc: chỉ xuất hiện ở tháng có ngày nghỉ việc.
          if (!employee.resignation_date) return false;
          if (employee.resignation_date < monthStart) return false;
        } else if (employee.resignation_date && employee.resignation_date < monthStart) {
          return false;
        }
        return true;
      }),
    [employees, monthEnd, monthStart],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return monthEmployees;
    return monthEmployees.filter((employee) =>
      `${employee.full_name} ${employee.code} ${employee.department ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [monthEmployees, query]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => {
      const key = `${record.employee_id}|${record.work_date}`;
      map.set(key, [...(map.get(key) ?? []), record]);
    });
    return map;
  }, [records]);

  const shiftOf = (employee: EmployeeRecord, date: string) =>
    resolveShift(employee, assignments, shifts, date);

  const shortTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "—");

  const workingHours = (shift: WorkShift) => `${shortTime(shift.start_time)}–${shortTime(shift.end_time)}`;

  /** Ngày cuối cùng còn hiển thị lịch: nghỉ việc thì dừng sau ngày nghỉ việc. */
  const lastWorkingDate = (employee: EmployeeRecord) =>
    employee.status === "resigned" ? (employee.resignation_date ?? "") : employee.resignation_date;

  const cellValues = (employee: EmployeeRecord) =>
    dates.map((date) => {
      const cutoff = lastWorkingDate(employee);
      if (employee.hire_date && date < employee.hire_date) return "";
      if (cutoff && date > cutoff) return "";
      if (employee.status === "resigned" && !cutoff) return "";
      const shift = shiftOf(employee, date);
      if (!shift || !isWorkingDay(shift, date)) return "";
      const list = recordMap.get(`${employee.id}|${date}`) ?? [];
      const checkIns = list
        .filter((record) => record.check_in)
        .map((record) => `${record.session === "afternoon" ? "chiều" : "sáng"} ${formatTime(record.check_in)}`)
        .join(", ");
      return `${workingHours(shift)}${checkIns ? ` · vào ${checkIns}` : ""}`;
    });

  const exportRows = () =>
    filtered.map((employee) => [
      employee.code,
      employee.full_name,
      employee.department ?? "",
      ...cellValues(employee),
    ]);

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    ...dates.map((date, index) => `${index + 1} ${WEEKDAY_SHORT[new Date(`${date}T00:00:00`).getDay()]}`),
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Lịch làm việc"
        description="Bảng lịch làm việc theo tháng: giờ làm việc theo ca và giờ check-in thực tế của từng nhân sự."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportExcel(`lich-lam-viec-${month}`, exportHeaders, exportRows(), `Lịch làm việc ${month}`)
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportPdf(
                  `Lịch làm việc tháng ${month}`,
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> Tháng
          </label>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-[12.5px] text-foreground shadow-xs outline-none focus:border-primary"
          />
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm nhân viên…"
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[220px]"
            />
          </label>
        </div>
        <span className="text-[11.5px] text-muted-foreground">
          {filtered.length} nhân sự đang làm việc hoặc đã nghỉ trong tháng {month}
        </span>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch làm việc…
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-[210px] bg-muted/40 px-4 py-2.5 text-left font-semibold">
                    Nhân sự
                  </th>
                  {dates.map((date, index) => {
                    const weekday = new Date(`${date}T00:00:00`).getDay();
                    const weekend = weekday === 0 || weekday === 6;
                    return (
                      <th
                        key={date}
                        className={`w-[86px] px-1 py-2 text-center font-semibold ${weekend ? "text-muted-foreground/60" : ""}`}
                      >
                        <span className="block text-[11px]">{WEEKDAY_SHORT[weekday]}</span>
                        <span className="block text-[11px] text-foreground/80">{index + 1}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id} className="border-t border-border/50">
                    <td className="sticky left-0 z-10 bg-card px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[11px] font-semibold text-primary-subtle-foreground">
                          {employee.full_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-medium text-foreground">
                            {employee.full_name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {employee.code}
                            {employee.department ? ` · ${employee.department}` : ""}
                          </span>
                        </span>
                      </div>
                    </td>
                    {dates.map((date) => {
                      const cutoff = lastWorkingDate(employee);
                      const afterResignation = employee.status === "resigned" && (!cutoff || date > cutoff);
                      const notHiredYet = !!(employee.hire_date && date < employee.hire_date);
                      if (afterResignation || notHiredYet) {
                        return <td key={date} className="bg-muted/10 px-1 py-2" aria-label="Không có lịch" />;
                      }

                      const shift = shiftOf(employee, date);
                      const working = shift ? isWorkingDay(shift, date) : false;
                      const list = recordMap.get(`${employee.id}|${date}`) ?? [];
                      const checkIns = list.filter((record) => record.check_in);
                      const late = list.some((record) => record.status === "late");

                      if (!working || !shift) {
                        return (
                          <td
                            key={date}
                            className="bg-muted/10 px-1 py-2 text-center text-[11px] text-muted-foreground/50"
                          >
                            Nghỉ
                          </td>
                        );
                      }

                      return (
                        <td key={date} className="px-1 py-1.5 text-center align-top">
                          <span className="block rounded-[5px] bg-muted/40 px-1 py-1">
                            <span className="block text-[11px] font-medium text-foreground/80">
                              {workingHours(shift)}
                            </span>
                            <span
                              className={`mt-0.5 block text-[11px] font-semibold ${
                                checkIns.length === 0 ? "text-muted-foreground/60" : late ? "text-warning" : "text-success"
                              }`}
                            >
                              {checkIns.length === 0
                                ? "—"
                                : checkIns.map((record) => formatTime(record.check_in)).join(" / ")}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <p className="px-5 py-12 text-center text-[12.5px] text-muted-foreground">
              Không có nhân sự đang làm việc hoặc nghỉ việc trong tháng {month}.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-success" /> Giờ check-in thực tế
            </span>
            <span>
              Ô hiển thị: giờ làm việc theo ca · giờ check-in · “Nghỉ” là ngày không thuộc ca
            </span>
          </div>
        </Card>
      )}
    </AppShell>
  );
};

export default Schedule;
