import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
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
import { EmployeeCheckInView, type PunchFlash } from "@/pages/me/EmployeeCheckInView";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MyDeviceCard } from "@/components/attendance/my-device-card";
import { SelfieCameraDialog } from "@/components/attendance/selfie-camera-dialog";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  ATTENDANCE_METHOD_LABELS,
  ATTENDANCE_STATUS_LABELS,
  checkinWindows,
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
  type AttendanceRecord,
  type ShiftAssignment,
  type WorkShift,
} from "@/lib/attendance";
import type { EmployeeRecord } from "@/lib/employee-records";
import {
  FLAG_LABELS,
  describeDevice,
  getDeviceHash,
  getGpsFix,
  getPolicy,
  isMobileDevice,
  listLocations,
  listMyDevices,
  punchAttendance,
  uploadAttendancePhoto,
  type AttendancePolicy,
  type EmployeeDevice,
  type GpsFix,
} from "@/lib/attendance-verify";

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
  const { activeCompany, role } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [me, setMe] = useState<EmployeeRecord | null>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [activeLocationCount, setActiveLocationCount] = useState<number | null>(null);
  const [device, setDevice] = useState<EmployeeDevice | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [camera, setCamera] = useState<{ session: string; action: "in" | "out"; gps: GpsFix | null } | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySession, setBusySession] = useState<string | null>(null);
  const [punchFlash, setPunchFlash] = useState<PunchFlash | null>(null);

  const today = todayIso();
  const monthStart = `${currentMonthIso()}-01`;

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const employee = await findMyEmployee(companyId, user.id);
      setMe(employee);
      const [shiftRows, assignmentRows, policyRow, locationRows, info, hash] = await Promise.all([
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listRows<ShiftAssignment>("shift_assignments", companyId, "created_at"),
        getPolicy(companyId),
        listLocations(companyId),
        describeDevice(),
        getDeviceHash(),
      ]);
      setShifts(shiftRows);
      setAssignments(assignmentRows);
      setPolicy(policyRow);
      setActiveLocationCount(locationRows.filter((location) => location.active).length);
      setDeviceName(info.suggestedName);
      if (employee) {
        const devices = await listMyDevices(employee.id);
        setDevice(devices.find((item) => item.device_hash === hash) ?? null);
      } else {
        setDevice(null);
      }

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

  const finishPunch = async (session: string, action: "in" | "out", gps: GpsFix | null, photo: Blob | null) => {
    if (!me || !companyId) return;
    setBusySession(session);
    try {
      let photoPath: string | null = null;
      if (photo) {
        setStep("Đang tải ảnh lên…");
        photoPath = await uploadAttendancePhoto(companyId, me.id, photo);
      }
      setStep("Đang xác thực…");
      const result = await punchAttendance({ companyId, action, session, gps, photoPath });
      if (result.ok === false) {
        toast.error("Chấm công bị từ chối", { description: result.reason });
        return;
      }
      const record = result.record as { check_in?: string; check_out?: string; flags?: string[] };
      const rawFlags = record.flags ?? [];
      const flags = rawFlags.map((flag) => FLAG_LABELS[flag] ?? flag);
      const at = action === "in" ? record.check_in : record.check_out;
      setPunchFlash({ action, at: at ?? null, flags: rawFlags });
      toast.success(action === "in" ? "Đã chấm công vào" : "Đã chấm công ra", {
        description: [formatTime(at ?? null), ...flags].join(" · "),
      });
      await load();
    } catch (error) {
      toast.error("Không chấm công được", { description: getErrorMessage(error) });
    } finally {
      setBusySession(null);
      setStep(null);
    }
  };

  const handlePunch = async (session: string, action: "in" | "out") => {
    if (!me || !companyId || !policy) return;
    setPunchFlash(null);
    const existing = todayRecords.find((record) => record.session === session);
    if (action === "in" && existing?.check_in) {
      toast.error("Buổi này bạn đã chấm công vào rồi.");
      return;
    }
    if (action === "out" && !existing?.check_in) return;
    if (device?.status !== "approved") {
      const description = !device
        ? "Điện thoại này chưa được đăng ký. Hãy đăng ký máy ở mục Thiết bị bên dưới; máy đổi mới cần HR duyệt."
        : device.status === "pending"
          ? "Điện thoại này đang chờ HR duyệt, chưa thể chấm công."
          : device.status === "rejected"
            ? "Điện thoại này đã bị HR từ chối. Liên hệ HR."
            : "Điện thoại này đã bị thu hồi quyền chấm công. Liên hệ HR.";
      toast.error("Không thể chấm công trên thiết bị này", { description });
      return;
    }
    if (activeLocationCount === 0) {
      toast.error("Chưa có địa điểm chấm công", {
        description: "Công ty chưa khai báo địa điểm chấm công. Liên hệ HR để thiết lập trước khi chấm.",
      });
      return;
    }
    setBusySession(session);
    let gps: GpsFix | null = null;
    try {
      setStep("Đang lấy vị trí GPS…");
      gps = await getGpsFix();
      if (gps.accuracy > policy.max_accuracy_m) {
        toast.error("GPS chưa đủ chính xác", {
          description: `Sai số ±${Math.round(gps.accuracy)} m (cần ≤ ${policy.max_accuracy_m} m). Bật định vị chính xác, ra chỗ thoáng rồi thử lại.`,
        });
        setBusySession(null);
        setStep(null);
        return;
      }
    } catch (error) {
      toast.error("Không lấy được vị trí GPS", {
        description: `${getErrorMessage(error)} Hãy bật định vị và cho phép trình duyệt truy cập vị trí.`,
      });
      setBusySession(null);
      setStep(null);
      return;
    }
    setStep(null);
    if (policy.require_photo) {
      setCamera({ session, action, gps });
      return;
    }
    await finishPunch(session, action, gps, null);
  };

  const short = (value: string | null | undefined) => (value ? value.slice(0, 5) : "—");
  const shiftRangeLabel = !myShift
    ? "Chưa phân ca"
    : myShift.shift_type === "single"
      ? `${short(myShift.morning_start ?? myShift.start_time)}–${short(myShift.morning_end ?? myShift.end_time)}`
      : `Sáng ${short(myShift.morning_start ?? myShift.start_time)}–${short(myShift.morning_end)} · Chiều ${short(
          myShift.afternoon_start,
        )}–${short(myShift.afternoon_end ?? myShift.end_time)}`;

  const employeeView = (
    <EmployeeCheckInView
      loading={loading}
      me={me}
      policy={policy}
      device={device}
      deviceName={deviceName}
      step={step}
      records={records}
      todayRecords={todayRecords}
      sessionRows={sessionRows}
      shift={myShift}
      shiftRangeLabel={shiftRangeLabel}
      today={today}
      busySession={busySession}
      cameraOpen={!!camera}
      companyId={companyId}
      punchFlash={punchFlash}
      onPunch={(session, action) => void handlePunch(session, action)}
      onDismissFlash={() => setPunchFlash(null)}
    />
  );

  return (
    <AppShell>
      {role === "employee" ? (
        employeeView
      ) : (
      <>
      <PageHeader
        eyebrow="Chấm công"
        title="Chấm công"
        description="Chấm công vào/ra theo từng buổi bằng ảnh selfie, vị trí GPS và điện thoại đã đăng ký; xem lịch sử trong tháng."
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Công tháng này
              </p>
              <p className="mt-1 font-display text-[22px] font-semibold text-foreground">
                {formatCredit(Number(stats.credit.toFixed(2)))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Ngày đã chấm
              </p>
              <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{stats.workedDays}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
                          <p className="text-[11px] text-muted-foreground">Hợp lệ {row.windowLabel}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Vào</p>
                            <p className="text-[13px] font-semibold text-foreground">
                              {formatTime(record?.check_in ?? null)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Ra</p>
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

              {step && (
                <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {step}
                </p>
              )}

              {policy && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <Badge variant={policy.require_photo ? "subtle" : "muted"} className="gap-1">
                    <Camera className="h-3 w-3" /> {policy.require_photo ? "Bắt buộc ảnh" : "Không cần ảnh"}
                  </Badge>
                  <Badge variant="subtle" className="gap-1">
                    <MapPin className="h-3 w-3" /> Trong bán kính văn phòng
                  </Badge>
                  <Badge variant="subtle" className="gap-1">
                    <Smartphone className="h-3 w-3" /> Đúng điện thoại đã duyệt
                  </Badge>
                </div>
              )}

              {policy && !isMobileDevice() && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Bạn đang dùng máy tính. Nên đăng ký và chấm công bằng điện thoại cá nhân.
                </p>
              )}

              {policy && activeLocationCount === 0 && (
                <p className="mt-2 rounded-md bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                  Công ty chưa khai báo địa điểm chấm công nên chưa thể chấm. Liên hệ HR.
                </p>
              )}

              {companyId && policy && (
                <MyDeviceCard
                  companyId={companyId}
                  device={device}
                  required
                  suggestedName={deviceName}
                  onChanged={() => void load()}
                />
              )}

              {myShift && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
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
      </>
      )}
      <SelfieCameraDialog
        open={!!camera}
        title={camera?.action === "out" ? "Chụp ảnh chấm công ra" : "Chụp ảnh chấm công vào"}
        onCancel={() => {
          setCamera(null);
          setBusySession(null);
        }}
        onConfirm={(photo) => {
          const current = camera;
          setCamera(null);
          if (current) void finishPunch(current.session, current.action, current.gps, photo);
        }}
      />
    </AppShell>
  );
};

export default CheckIn;
