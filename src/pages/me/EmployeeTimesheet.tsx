import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/mobile/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-provider";
import {
  ATTENDANCE_STATUS_LABELS,
  currentMonthIso,
  findMyEmployee,
  todayIso,
  formatTime,
  listRecordsBetween,
  type AttendanceRecord,
} from "@/lib/attendance";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";

const CELL: Record<string, string> = {
  ok: "bg-success-subtle text-success",
  warn: "bg-warning-subtle text-warning",
  bad: "bg-destructive-subtle text-destructive",
  n: "bg-muted text-muted-foreground",
  today: "bg-gradient-primary text-white",
};

const EmployeeTimesheet = () => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [month, setMonth] = useState(currentMonthIso());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const monthEnd = useMemo(() => {
    const [year, monthValue] = month.split("-").map(Number);
    const last = new Date(year, monthValue, 0).getDate();
    return `${month}-${String(last).padStart(2, "0")}`;
  }, [month]);

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const employee = await findMyEmployee(companyId, user.id);
      if (!employee) {
        setRecords([]);
        return;
      }
      const rows = await listRecordsBetween(companyId, `${month}-01`, monthEnd);
      setRecords(rows.filter((row) => row.employee_id === employee.id));
    } catch (error) {
      toast.error("Không tải được bảng công", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, month, monthEnd, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => map.set(record.work_date, [...(map.get(record.work_date) ?? []), record]));
    return map;
  }, [records]);

  const days = Number(monthEnd.slice(-2));
  const today = todayIso();
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  const shiftMonth = (delta: number) => {
    const [year, monthValue] = month.split("-").map(Number);
    const next = new Date(year, monthValue - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  const list = [...records].sort((a, b) => b.work_date.localeCompare(a.work_date) || a.session.localeCompare(b.session));

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <button type="button" className="touch-target rounded-2xl bg-card px-3 text-[13px] font-bold shadow-mobile" onClick={() => shiftMonth(-1)}>
          Tháng trước
        </button>
        <p className="font-display text-[15px] font-extrabold capitalize">{label}</p>
        <button type="button" className="touch-target rounded-2xl bg-card px-3 text-[13px] font-bold shadow-mobile" onClick={() => shiftMonth(1)}>
          Tháng sau
        </button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-card" />
      ) : (
        <section className="shadow-mobile rounded-3xl bg-card p-3">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const iso = `${month}-${String(day).padStart(2, "0")}`;
              const dayRecords = byDay.get(iso) ?? [];
              const status = dayRecords.some((row) => row.status === "absent" || (row.check_in && !row.check_out))
                ? "bad"
                : dayRecords.some((row) => row.status === "late" || row.status === "early_leave")
                  ? "warn"
                  : dayRecords.some((row) => row.check_in)
                    ? "ok"
                    : "n";
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-bold ${isToday ? CELL.today : CELL[status]}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="success">Đủ công</Badge>
        <Badge variant="warning">Muộn / sớm</Badge>
        <Badge variant="destructive">Thiếu</Badge>
      </div>

      {list.length === 0 && !loading ? (
        <EmptyState emoji="🗓️" title="Tháng này chưa có công" description="Các lần chấm công hợp lệ sẽ hiện theo ngày." />
      ) : (
        list.map((record) => (
          <article key={record.id} className="shadow-mobile flex items-center justify-between gap-2 rounded-2xl bg-card px-3 py-2.5">
            <div>
              <p className="text-[13px] font-bold">
                {new Date(`${record.work_date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} ·{" "}
                {formatTime(record.check_in)}–{formatTime(record.check_out)}
              </p>
              <p className="text-[12px] text-muted-foreground">{record.session === "afternoon" ? "Buổi chiều" : "Buổi sáng"}</p>
            </div>
            <Badge variant={record.status === "on_time" ? "success" : record.status === "late" ? "warning" : "destructive"}>
              {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
            </Badge>
          </article>
        ))
      )}
    </AppShell>
  );
};

export default EmployeeTimesheet;
