import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Smartphone,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  ATTENDANCE_METHOD_LABELS,
  ATTENDANCE_STATUS_LABELS,
  checkinWindows,
  createRow,
  currentMonthIso,
  dayCredit,
  findMyEmployee,
  formatCredit,
  formatTime,
  listRecordsBetween,
  listRows,
  resolveShift,
  shiftRange,
  shiftWindowLabel,
  todayIso,
  updateRow,
  type AttendanceRecord,
  type AttendanceSetting,
  type ShiftAssignment,
  type WorkShift,
} from "@/lib/attendance";
import type { EmployeeRecord } from "@/lib/employee-records";

const methodIcon = (method: string | null) => {
  if (method === "wifi") return Wifi;
  if (method === "gps") return MapPin;
  return Smartphone;
};

const statusTone = (status: string) =>
  status === "on_time" ? "success" : status === "late" ? "warning" : status === "absent" ? "destructive" : "muted";

interface SessionRow {
  session: string;
  label: string;
  windowLabel: string;
}

const CheckIn = () => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [me, setMe] = useState<EmployeeRecord | null>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [settings, setSettings] = useState<AttendanceSetting[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [method, setMethod] = useState("phone");
  const [loading, setLoading] = useState(true);
  const [busySession, setBusySession] = useState<string | null>(null);

  const today = todayIso();
  const monthStart = `${currentMonthIso()}-01`;

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const employee = await findMyEmployee(companyId, user.id);
      setMe(employee);
      const [shiftRows, assignmentRows, settingRows] = await Promise.all([
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listRows<ShiftAssignment>("shift_assignments", companyId, "created_at"),
        listRows<AttendanceSetting>("attendance_settings", companyId, "created_at"),
      ]);
      setShifts(shiftRows);
      setAssignments(assignmentRows);
      setSettings(settingRows.filter((row) => row.active));

      if (employee) {
        const rows = await listRecordsBetween(companyId, monthStart, today);
        setRecords(rows.filter((record) => record.employee_id === employee.id));
      } else {
        setRecords([]);
      }
    } catch (error) {
      toast.error("Không tải được dữ liệu chấm công", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, monthStart, today, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const myShift = useMemo(
    () => (me ? resolveShift(me, assignments, shifts, today) : null),
    [assignments, me, shifts, today],
  );

  const todayRecords = useMemo(
    () => records.filter((record) => record.work_date === today),
    [records, today],
  );

  const allowedMethods = useMemo(() => {
    const relevant = settings.find(
      (setting) =>
        (setting.scope_type === "employee" && setting.scope_value === me?.code) ||
        (setting.scope_type === "position" && setting.scope_value === me?.position) ||
        (setting.scope_type === "department" && setting.scope_value === me?.department) ||
        setting.scope_type === "company",
    );
    const methods = relevant?.methods?.length ? relevant.methods : ["phone"];
    return methods;
  }, [me?.code, me?.department, me?.position, settings]);

  useEffect(() => {
    if (allowedMethods.length > 0 && !allowedMethods.includes(method)) {
      setMethod(allowedMethods[0]);
    }
  }, [allowedMethods, method]);

  const sessionRows = useMemo<SessionRow[]>(() => {
    if (!myShift) return [{ session: "morning", label: "Cả ngày", windowLabel: "Chưa phân ca" }];
    const windows = checkinWindows(myShift, today);
    return windows.map((window) => ({
      session: window.session,
      label:
        myShift.shift_type === "single"
          ? "Cả ngày"
          : window.session === "morning"
            ? "Buổi sáng"
            : "Buổi chiều",
      windowLabel: `${window.from.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}–${window.to.toLocaleTimeString(
        "vi-VN",
        { hour: "2-digit", minute: "2-digit" },
      )}`,
    }));
  }, [myShift, today]);

  const stats = useMemo(() => {
    const byDate = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => {
      byDate.set(record.work_date, [...(byDate.get(record.work_date) ?? []), record]);
    });

    let credit = 0;
    let workedDays = 0;
    let lateDays = 0;

    byDate.forEach((dayRecords, date) => {
      const shift = me ? resolveShift(me, assignments, shifts, date) : null;
      credit += dayCredit(dayRecords, shift);
      if (dayRecords.some((record) => record.check_in)) workedDays += 1;
      if (dayRecords.some((record) => record.status === "late")) lateDays += 1;
    });

    return { credit, workedDays, lateDays };
  }, [assignments, me, records, shifts]);

  const missingCheckout = useMemo(() => {
    if (!myShift) return false;
    const shiftEnd = shiftRange(myShift, today).end;
    return new Date() > shiftEnd && todayRecords.some((record) => record.check_in && !record.check_out);
  }, [myShift, today, todayRecords]);

  const handlePunch = async (session: string, action: "in" | "out") => {
    if (!me || !companyId) return;
    const existing = todayRecords.find((record) => record.session === session);
    setBusySession(session);
    try {
      if (action === "in") {
        if (existing?.check_in) {
          toast.error("Buổi này bạn đã chấm công vào rồi.");
          return;
        }
        const now = new Date();
        const window = myShift ? checkinWindows(myShift, today).find((item) => item.session === session) ?? null : null;

        if (myShift && !window) {
          toast.error("Ca làm việc không có khung chấm công cho buổi này.");
          return;
        }
        if (window && (now < window.from || now > window.to)) {
          toast.error("Ngoài khung giờ chấm công hợp lệ", {
            description: `Buổi này chỉ ghi nhận từ ${window.from.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })} đến ${window.to.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`,
          });
          return;
        }

        await createRow("attendance_records", {
          company_id: companyId,
          employee_id: me.id,
          work_date: today,
          session,
          check_in: now.toISOString(),
          method,
          shift_id: myShift?.id ?? null,
          status: window && now > window.lateAfter ? "late" : "on_time",
        });
        toast.success("Đã chấm công vào", {
          description: `${formatTime(now.toISOString())} · ${ATTENDANCE_METHOD_LABELS[method] ?? method}`,
        });
      } else {
        if (!existing?.check_in) return;
        const now = new Date();
        const outStatus =
          myShift && now < shiftRange(myShift, today).end
            ? existing.status === "late"
              ? "late"
              : "early_leave"
            : existing.status;
        await updateRow("attendance_records", existing.id, {
          check_out: now.toISOString(),
          status: outStatus,
        });
        toast.success("Đã chấm công ra", { description: formatTime(now.toISOString()) });
      }
      await load();
    } catch (error) {
      toast.error("Không chấm công được", { description: getErrorMessage(error) });
    } finally {
      setBusySession(null);
    }
  };

  const short = (value: string | null | undefined) => (value ? value.slice(0, 5) : "—");
  const shiftRangeLabel = !myShift
    ? "Chưa phân ca"
    : myShift.shift_type === "single"
      ? `${short(myShift.morning_start ?? myShift.start_time)}–${short(myShift.morning_end ?? myShift.end_time)}`
      : `Sáng ${short(myShift.morning_start ?? myShift.start_time)}–${short(myShift.morning_end)} · Chiều ${short(
          myShift.afternoon_start,
        )}–${short(myShift.afternoon_end ?? myShift.end_time)}`;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Chấm công"
        description="Chấm công vào/ra theo từng buổi bằng GPS, Wi-Fi hoặc điện thoại; xem lịch sử chấm công trong tháng."
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </Card>
      ) : !me ? (
        <Card className="p-10 text-center">
          <Smartphone className="mx-auto h-7 w-7 text-muted-foreground/70" />
          <p className="mt-2 text-[13.5px] font-semibold text-foreground">Tài khoản chưa gắn hồ sơ nhân sự</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-muted-foreground">
            Hồ sơ nhân sự của bạn cần được liên kết với tài khoản đăng nhập. Liên hệ quản trị viên để gắn trong Hồ sơ
            nhân viên.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Công tháng này
              </p>
              <p className="mt-1 font-display text-[22px] font-semibold text-foreground">
                {formatCredit(Number(stats.credit.toFixed(2)))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Ngày đã chấm
              </p>
              <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{stats.workedDays}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Ngày đi muộn
              </p>
              <p className={`mt-1 font-display text-[22px] font-semibold ${stats.lateDays ? "text-warning" : "text-foreground"}`}>
                {stats.lateDays}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Hôm nay · {new Date().toLocaleDateString("vi-VN")}
                  </p>
                  <h2 className="mt-1 font-display text-[18px] font-semibold text-foreground">{me.full_name}</h2>
                  <p className="text-[12px] text-muted-foreground">
                    {me.code}
                    {me.position ? ` · ${me.position}` : ""}
                    {me.department ? ` · ${me.department}` : ""}
                  </p>
                </div>
                <Badge variant="subtle" className="gap-1">
                  <Clock className="h-3 w-3" /> {shiftRangeLabel}
                </Badge>
              </div>

              {missingCheckout && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-[11px] text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Bạn chưa chấm công ra. Hãy chấm công ra để được ghi nhận đủ công; nếu quên, hệ thống áp dụng số
                    công quên check-out của ca.
                  </span>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {sessionRows.map((row) => {
                  const record = todayRecords.find((item) => item.session === row.session);
                  const busy = busySession === row.session;
                  return (
                    <div
                      key={row.session}
                      className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[12.5px] font-semibold text-foreground">{row.label}</p>
                          <p className="text-[10.5px] text-muted-foreground">Hợp lệ {row.windowLabel}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">Vào</p>
                            <p className="text-[13px] font-semibold text-foreground">
                              {formatTime(record?.check_in ?? null)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">Ra</p>
                            <p className="text-[13px] font-semibold text-foreground">
                              {formatTime(record?.check_out ?? null)}
                            </p>
                          </div>
                          {record && (
                            <Badge variant={statusTone(record.status)}>
                              {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 flex-1 gap-1.5 text-[11.5px]"
                          onClick={() => void handlePunch(row.session, "in")}
                          disabled={busy || !!record?.check_in}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                          {record?.check_in ? "Đã chấm vào" : "Chấm vào"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1 gap-1.5 text-[11.5px]"
                          onClick={() => void handlePunch(row.session, "out")}
                          disabled={busy || !record?.check_in || !!record?.check_out}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          {record?.check_out ? "Đã chấm ra" : "Chấm ra"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-[11.5px] font-medium text-foreground">Hình thức chấm công</p>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedMethods.map((item) => (
                      <SelectItem key={item} value={item}>
                        {ATTENDANCE_METHOD_LABELS[item] ?? item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {myShift && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-[10.5px] text-muted-foreground">
                  <span>Khung hợp lệ: {shiftWindowLabel(myShift)}</span>
                  <span className="text-border">·</span>
                  <span>
                    Muộn sau {short(myShift.late_after)}
                    {myShift.late_after_pm ? ` / ${short(myShift.late_after_pm)}` : ""}
                  </span>
                  <span className="text-border">·</span>
                  <span>{formatCredit(Number(myShift.work_credit ?? 1))} công/ngày</span>
                </div>
              )}
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-border/70 px-5 py-4">
                <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" /> Lịch sử chấm công
                </h3>
                <p className="text-[11.5px] text-muted-foreground">Trong tháng này</p>
              </div>
              {records.length === 0 ? (
                <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">
                  Chưa có dữ liệu chấm công.
                </p>
              ) : (
                <ul className="max-h-[480px] divide-y divide-border/60 overflow-y-auto">
                  {[...records]
                    .sort((a, b) =>
                      a.work_date === b.work_date
                        ? a.session.localeCompare(b.session)
                        : b.work_date.localeCompare(a.work_date),
                    )
                    .map((record) => {
                    const Icon = methodIcon(record.method);
                    return (
                      <li key={record.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-muted text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-foreground">
                            {new Date(`${record.work_date}T00:00:00`).toLocaleDateString("vi-VN", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              {record.session === "afternoon" ? "Chiều" : me && myShift?.shift_type === "single" ? "Cả ngày" : "Sáng"}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Vào {formatTime(record.check_in)} · Ra {formatTime(record.check_out)}
                            {record.method ? ` · ${ATTENDANCE_METHOD_LABELS[record.method] ?? record.method}` : ""}
                          </p>
                        </div>
                        <Badge variant={statusTone(record.status)}>
                          {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default CheckIn;
