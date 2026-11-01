import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet,
  MapPinned, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import EmployeeTimesheet from "@/pages/me/EmployeeTimesheet";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/lib/company-provider";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import {
  ATTENDANCE_STATUS_LABELS,
  currentMonthIso,
  dayCredit,
  formatCredit,
  formatTime,
  listRecordsBetween,
  listRows,
  type AttendanceRecord,
  type WorkShift,
} from "@/lib/attendance";
import { todayIso as todayIsoForLink } from "@/lib/attendance";
import {
  listDates,
  listRequests,
  listRequestTypes,
  type EmployeeRequest,
  type RequestType,
} from "@/lib/requests";
import { getErrorMessage } from "@/lib/utils";

const STATUS_SYMBOL: Record<string, string> = {
  on_time: "✓",
  late: "M",
  early_leave: "S",
  absent: "V",
  leave: "P",
  holiday: "L",
};

const REMOTE_SYMBOL = "X";

const currentMonth = currentMonthIso;

const Timesheet = () => {
  const { activeCompany, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const monthStart = `${month}-01`;
  const monthEnd = useMemo(() => {
    const [year, monthValue] = month.split("-").map(Number);
    const lastDay = new Date(year, monthValue, 0).getDate();
    return `${month}-${String(lastDay).padStart(2, "0")}`;
  }, [month]);
  const daysInMonth = Number(monthEnd.slice(-2));

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [people, attendance, shiftRows, requestRows, typeRows] = await Promise.all([
        listEmployees(companyId),
        listRecordsBetween(companyId, monthStart, monthEnd),
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listRequests(companyId),
        listRequestTypes(companyId),
      ]);
      setEmployees(people);
      setRecords(attendance);
      setShifts(shiftRows);
      setRequests(requestRows);
      setRequestTypes(typeRows);
    } catch (error) {
      toast.error("Không tải được bảng công", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, monthEnd, monthStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (employee.hire_date && employee.hire_date > monthEnd) return false;
        if (employee.resignation_date && employee.resignation_date < monthStart) return false;
        return true;
      }),
    [employees, monthEnd, monthStart],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return activeEmployees;
    return activeEmployees.filter((employee) =>
      `${employee.full_name} ${employee.code} ${employee.department ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [activeEmployees, query]);

  const shiftById = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);

  const recordsByDay = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => {
      const key = `${record.employee_id}|${record.work_date}`;
      map.set(key, [...(map.get(key) ?? []), record]);
    });
    return map;
  }, [records]);

  const typeById = useMemo(() => new Map(requestTypes.map((type) => [type.id, type])), [requestTypes]);

  const requestsByDay = useMemo(() => {
    const map = new Map<string, EmployeeRequest[]>();
    requests
      .filter((request) => request.status === "approved")
      .forEach((request) => {
        listDates(request.start_date, request.end_date).forEach((date) => {
          if (date < monthStart || date > monthEnd) return;
          const key = `${request.employee_id}|${date}`;
          map.set(key, [...(map.get(key) ?? []), request]);
        });
      });
    return map;
  }, [monthEnd, monthStart, requests]);

  const requestCategory = (request: EmployeeRequest) =>
    typeById.get(request.request_type_id)?.category ?? "other";

  const dayRecords = (employeeId: string, day: number) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return recordsByDay.get(`${employeeId}|${date}`) ?? [];
  };

  const dayRequests = (employeeId: string, day: number) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return requestsByDay.get(`${employeeId}|${date}`) ?? [];
  };

  /** Trạng thái ưu tiên cho ô ngày: vắng > muộn > nghỉ > đúng giờ. */
  const dayStatus = (list: AttendanceRecord[]) => {
    if (list.length === 0) return null;
    if (list.some((record) => record.status === "absent")) return "absent";
    if (list.some((record) => record.status === "late")) return "late";
    if (list.every((record) => record.status === "leave")) return "leave";
    return list[0].status;
  };

  const dayShift = (list: AttendanceRecord[]) => {
    const shiftId = list.find((record) => record.shift_id)?.shift_id;
    return shiftId ? shiftById.get(shiftId) ?? null : null;
  };

  const dayInfo = (employeeId: string, day: number) => {
    const list = dayRecords(employeeId, day);
    const requestList = dayRequests(employeeId, day);
    const status = dayStatus(list);
    const leave = requestList.find((request) => requestCategory(request) === "leave");
    const remote = requestList.find((request) => requestCategory(request) === "remote");
    const notes = requestList
      .map((request) => `${typeById.get(request.request_type_id)?.name ?? "Đơn"}${request.start_time ? ` ${request.start_time.slice(0, 5)}` : ""}`)
      .join(", ");

    if (status) {
      return {
        symbol: STATUS_SYMBOL[status] ?? "•",
        tone: status,
        title: `${list
          .map(
            (record) =>
              `${record.session === "afternoon" ? "Chiều" : "Sáng"} ${formatTime(record.check_in)}–${formatTime(
                record.check_out,
              )}`,
          )
          .join(" · ")} · ${ATTENDANCE_STATUS_LABELS[status] ?? status}${notes ? ` · ${notes}` : ""}`,
        credit: dayCredit(list, dayShift(list)),
        label: null as string | null,
      };
    }

    if (leave) {
      return {
        symbol: STATUS_SYMBOL.leave,
        tone: "leave",
        title: `Nghỉ phép đã duyệt · ${
          typeById.get(leave.request_type_id)?.deduct_leave ? `trừ ${leave.leave_days} ngày phép` : "không trừ phép"
        }${leave.reason ? ` · ${leave.reason}` : ""}`,
        credit: 0,
        label: "Nghỉ phép",
      };
    }
    if (remote) {
      return {
        symbol: REMOTE_SYMBOL,
        tone: "leave",
        title: `Làm từ xa đã duyệt${remote.reason ? ` · ${remote.reason}` : ""}`,
        credit: 1,
        label: "Làm từ xa",
      };
    }

    return { symbol: null, tone: "", title: notes, credit: 0, label: null as string | null };
  };

  const totalsFor = (employeeId: string) => {
    const totals = { work: 0, late: 0, absent: 0, leave: 0 };
    Array.from({ length: daysInMonth }, (_, index) => index + 1).forEach((day) => {
      const list = dayRecords(employeeId, day);
      const requestList = dayRequests(employeeId, day);
      const info = dayInfo(employeeId, day);
      totals.work += info.credit;
      if (list.some((record) => record.status === "late")) totals.late += 1;
      if (list.some((record) => record.status === "absent")) totals.absent += 1;
      if (requestList.some((request) => requestCategory(request) === "leave") || list.some((record) => record.status === "leave")) {
        totals.leave += 1;
      }
    });
    return totals;
  };

  const exportRows = () =>
    filtered.map((employee) => {
      const totals = totalsFor(employee.id);
      return [
        employee.code,
        employee.full_name,
        employee.department ?? "",
        ...Array.from({ length: daysInMonth }, (_, index) => {
          const info = dayInfo(employee.id, index + 1);
          return info.label ?? info.symbol ?? "";
        }),
        Number(totals.work.toFixed(2)),
        totals.late,
        totals.absent,
        totals.leave,
      ];
    });

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    ...Array.from({ length: daysInMonth }, (_, index) => String(index + 1)),
    "Công",
    "Muộn",
    "Vắng",
    "Phép",
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Bảng công"
        description="Bảng công chi tiết theo tháng; đơn nghỉ phép, làm từ xa và sửa chấm công đã duyệt được cập nhật vào bảng."
        actions={
          <>
            {canManageModule("attendance") && (
              <Button asChild variant="outline" className="h-9 gap-1.5 text-[12.5px]">
                <Link to={`/cham-cong/nhat-ky?from=${month}-01&to=${todayIsoForLink().startsWith(month) ? todayIsoForLink() : `${month}-28`}`}>
                  <MapPinned className="h-3.5 w-3.5" /> Chi tiết ảnh/GPS
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => exportExcel(`bang-cong-${month}`, exportHeaders, exportRows(), `Bảng công ${month}`)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportPdf(`Bảng công tháng ${month}`, activeCompany?.name ?? "Công ty", exportHeaders, exportRows())
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
          {Object.entries(STATUS_SYMBOL).map(([status, symbol]) => (
            <span key={status} className="inline-flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-muted font-semibold text-foreground">
                {symbol}
              </span>
              {ATTENDANCE_STATUS_LABELS[status]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-info-subtle font-semibold text-info">
              {REMOTE_SYMBOL}
            </span>
            Làm từ xa
          </span>
        </div>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải bảng công…
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-[210px] bg-muted/40 px-4 py-2.5 text-left font-semibold">
                    Nhân sự
                  </th>
                  {Array.from({ length: daysInMonth }, (_, index) => (
                    <th key={index} className="w-[26px] px-0.5 py-2.5 text-center font-semibold">
                      {index + 1}
                    </th>
                  ))}
                  <th className="w-[42px] px-1 py-2.5 text-center font-semibold">Công</th>
                  <th className="w-[42px] px-1 py-2.5 text-center font-semibold">Muộn</th>
                  <th className="w-[42px] px-1 py-2.5 text-center font-semibold">Vắng</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => {
                  const totals = totalsFor(employee.id);
                  return (
                    <tr key={employee.id} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2">
                        <p className="truncate text-[12px] font-medium text-foreground">{employee.full_name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {employee.code}
                          {employee.department ? ` · ${employee.department}` : ""}
                        </p>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, index) => {
                        const info = dayInfo(employee.id, index + 1);
                        return (
                          <td key={index} className="px-0.5 py-2 text-center">
                            {info.symbol ? (
                              <span
                                title={`${info.title} · ${formatCredit(info.credit)} công`}
                                className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-0.5 text-[10px] font-semibold ${
                                  info.tone === "late"
                                    ? "bg-warning-subtle text-warning"
                                    : info.tone === "absent"
                                      ? "bg-destructive-subtle text-destructive"
                                      : info.tone === "leave"
                                        ? "bg-info-subtle text-info"
                                        : "bg-success-subtle text-success"
                                }`}
                              >
                                {info.symbol}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 py-2 text-center font-semibold text-foreground">
                        {totals.work ? formatCredit(Number(totals.work.toFixed(2))) : ""}
                      </td>
                      <td className="px-1 py-2 text-center text-warning">{totals.late || ""}</td>
                      <td className="px-1 py-2 text-center text-destructive">{totals.absent || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">
              Không có nhân sự đang làm việc trong tháng {month}.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-[11.5px] text-muted-foreground">
            <span>
              {filtered.length} nhân sự · tháng {month}
            </span>
            <span className="text-[10.5px]">Công = hệ số ca; nghỉ phép đã duyệt = 0 công; làm từ xa = 1 công</span>
          </div>
        </Card>
      )}
    </AppShell>
  );
};

const TimesheetPage = () => {
  const { role } = useCompany();
  if (role === "employee") return <EmployeeTimesheet />;
  return <Timesheet />;
};

export default TimesheetPage;
