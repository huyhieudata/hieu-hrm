import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

import { CheckInButton, type CheckInButtonMode } from "@/components/attendance/CheckInButton";
import { CheckInSteps, type CheckStepItem, type CheckStepState } from "@/components/attendance/CheckInSteps";
import { GeofenceStatus, type GeofenceTone } from "@/components/attendance/GeofenceStatus";
import { PermissionHelpSheet } from "@/components/attendance/PermissionHelpSheet";
import { DeviceStatusCard } from "@/components/devices/DeviceStatusCard";
import { EmptyState } from "@/components/mobile/EmptyState";
import { ShiftCard } from "@/components/mobile/ShiftCard";
import { Badge } from "@/components/ui/badge";
import { useGeofence, type GeofenceReading } from "@/hooks/useGeolocation";
import {
  ATTENDANCE_STATUS_LABELS,
  formatTime,
  isWorkingDay,
  type AttendanceRecord,
  type WorkShift,
} from "@/lib/attendance";
import { mapsUrl, type AttendancePolicy, type EmployeeDevice } from "@/lib/attendance-verify";
import type { EmployeeRecord } from "@/lib/employee-records";

export interface PunchFlash {
  action: "in" | "out";
  at: string | null;
  flags: string[];
}

interface SessionRow {
  session: string;
  label: string;
  windowLabel: string;
}

interface EmployeeCheckInViewProps {
  loading: boolean;
  me: EmployeeRecord | null;
  policy: AttendancePolicy | null;
  device: EmployeeDevice | null;
  deviceName: string;
  step: string | null;
  records: AttendanceRecord[];
  todayRecords: AttendanceRecord[];
  sessionRows: SessionRow[];
  shift: WorkShift | null;
  shiftRangeLabel: string;
  today: string;
  busySession: string | null;
  cameraOpen: boolean;
  companyId: string | null;
  punchFlash: PunchFlash | null;
  /** Skip the live GPS read and render a fixed state. */
  geoOverride?: GeofenceReading | null;
  onPunch: (session: string, action: "in" | "out") => void;
  onDismissFlash: () => void;
}

const statusVariant = (status: string) =>
  status === "on_time" ? "success" : status === "late" ? "warning" : status === "absent" ? "destructive" : "muted";

const deviceState = (device: EmployeeDevice | null, required: boolean): CheckStepState => {
  if (!required) return "ok";
  if (!device) return "bad";
  if (device.status === "approved") return "ok";
  if (device.status === "pending") return "warn";
  return "bad";
};

const deviceNote = (device: EmployeeDevice | null, required: boolean) => {
  if (!required) return "Công ty không khoá theo thiết bị";
  if (!device) return "Máy này chưa đăng ký";
  if (device.status === "approved") return `${device.device_name ?? "Đã duyệt"} · đã duyệt`;
  if (device.status === "pending") return "Chờ HR duyệt — nút chấm công đang khoá";
  if (device.status === "rejected") return device.device_name ? `${device.device_name} · bị từ chối` : "Bị từ chối";
  return "Thiết bị đã ngừng dùng";
};

export const EmployeeCheckInView = ({
  loading,
  me,
  policy,
  device,
  deviceName,
  step,
  records,
  todayRecords,
  sessionRows,
  shift,
  shiftRangeLabel,
  today,
  busySession,
  cameraOpen,
  companyId,
  punchFlash,
  geoOverride = null,
  onPunch,
  onDismissFlash,
}: EmployeeCheckInViewProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState(sessionRows[0]?.session ?? "morning");
  const [helpDismissed, setHelpDismissed] = useState(false);
  const activeSession = sessionRows.some((row) => row.session === session) ? session : sessionRows[0]?.session ?? "morning";
  const record = todayRecords.find((item) => item.session === activeSession) ?? null;
  const action: "in" | "out" = record?.check_in && !record.check_out ? "out" : "in";
  const finished = Boolean(record?.check_in && record?.check_out);
  const offDay = Boolean(shift && !isWorkingDay(shift, today));
  // Server chặn cứng: luôn bắt buộc đúng thiết bị đã duyệt, GPS đủ chính xác và trong bán kính.
  const requireDevice = true;
  const requireGps = true;
  const liveGeo = useGeofence(geoOverride || offDay ? null : companyId, policy?.max_accuracy_m ?? 150);
  const geo = geoOverride ?? liveGeo;

  const deviceBlocked = requireDevice && device?.status !== "approved";
  const zoneBlocked = geo.hasZones && geo.outside;
  const accuracyBlocked = requireGps && geo.weak && !zoneBlocked;
  const waitingZone = !geoOverride && Boolean(companyId) && (geo.phase === "idle" || geo.phase === "loading");
  const gpsUnknownBlocked =
    geo.hasZones && (geo.phase === "denied" || geo.phase === "error" || geo.phase === "loading" || geo.phase === "idle");
  const noZones = !geoOverride && geo.phase === "ready" && !geo.hasZones;
  const blocked = deviceBlocked || zoneBlocked || accuracyBlocked || gpsUnknownBlocked || waitingZone || noZones;
  const busy = busySession === activeSession || Boolean(step);

  // Máy chủ không còn chấp nhận lượt chấm kèm cờ ngoài vùng/sai thiết bị; lượt thành công luôn hợp lệ.
  const hardFlag = false;

  const steps = useMemo<CheckStepItem[]>(() => {
    const gpsState: CheckStepState = step?.includes("GPS")
      ? "loading"
      : geo.phase === "loading"
        ? "loading"
        : zoneBlocked || noZones
          ? "bad"
          : accuracyBlocked
            ? "warn"
            : geo.phase === "denied" || geo.phase === "error"
              ? "bad"
              : geo.phase === "ready" && geo.hasZones
                ? "ok"
                : "idle";
    const selfieState: CheckStepState = cameraOpen ? "active" : punchFlash && !hardFlag ? "ok" : policy?.require_photo ? "idle" : "ok";
    return [
      {
        id: "selfie",
        icon: "camera",
        label: "Ảnh selfie",
        note: cameraOpen
          ? "Đặt khuôn mặt vào khung, đủ sáng"
          : policy?.require_photo
            ? action === "out"
              ? "Ra ca cũng cần selfie theo cấu hình công ty"
              : "Mở camera trước sau khi có GPS"
            : "Không bắt buộc ảnh",
        state: selfieState,
      },
      {
        id: "gps",
        icon: "pin",
        label: "Vị trí GPS",
        note: geo.message ?? "Chờ",
        state: gpsState,
      },
      {
        id: "device",
        icon: "phone",
        label: "Thiết bị",
        note: deviceNote(device, requireDevice),
        state: deviceState(device, requireDevice),
      },
    ];
  }, [accuracyBlocked, action, cameraOpen, device, geo.hasZones, geo.message, geo.phase, hardFlag, policy?.require_photo, punchFlash, requireDevice, step, zoneBlocked, noZones]);

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const mode: CheckInButtonMode = busy ? "busy" : blocked || finished || offDay ? "locked" : action === "out" ? "out" : "in";
  const buttonLabel = busy ? "ĐANG XỬ LÝ" : finished ? "ĐÃ XONG" : offDay ? "NGHỈ" : action === "out" ? "RA CA" : "VÀO CA";
  const hint = busy ? "Vui lòng chờ" : blocked ? "Đã khoá" : action === "out" && !finished ? "Giữ 1 giây" : undefined;

  const tone: GeofenceTone = zoneBlocked
    ? "outside"
    : accuracyBlocked
      ? "weak"
      : geo.phase === "denied"
        ? "denied"
        : geo.phase === "loading"
          ? "loading"
          : geo.phase === "ready" && geo.hasZones && !geo.outside
            ? "inside"
            : "idle";

  if (loading) {
    return <div className="shadow-mobile h-48 animate-pulse rounded-3xl bg-card" />;
  }

  if (!me) {
    return (
      <EmptyState
        emoji="📱"
        title="Tài khoản chưa gắn hồ sơ nhân sự"
        description="Liên hệ HR để gắn hồ sơ nhân viên với tài khoản đăng nhập. Bạn vẫn xem được các tab khác."
      />
    );
  }

  const history = [...records].sort((a, b) => (a.work_date === b.work_date ? a.session.localeCompare(b.session) : b.work_date.localeCompare(a.work_date)));

  return (
    <div className="space-y-3">
      <ShiftCard name={shift?.name ?? "Chưa phân ca"} range={shiftRangeLabel} dateLabel={dateLabel} />

      {offDay ? (
        <EmptyState
          emoji="🏖️"
          title="Hôm nay bạn không có ca"
          description="Nghỉ ngơi nhé. Nút chấm công được ẩn vì hôm nay không phải ngày làm của ca này."
          action={
            <Link to="/toi/bang-cong" className="text-[13px] font-bold text-primary">
              Xem bảng công tháng
            </Link>
          }
        />
      ) : null}

      {punchFlash && !hardFlag ? (
        <section className="shadow-mobile rounded-3xl bg-card px-4 py-5 text-center">
          <p className="text-[18px]">🎉 ✨ 🎊</p>
          <div className="bg-gradient-ok mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-glow">
            <Check className="h-10 w-10" />
          </div>
          <p className="mt-3 font-display text-[18px] font-extrabold">{actionLabel(punchFlash.action)} thành công</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {formatTime(punchFlash.at)}
            {geo.location ? ` · ${geo.location.name}` : ""}
            {geo.distanceM != null ? ` · cách ${geo.distanceM} m` : ""}
          </p>
          <button type="button" onClick={onDismissFlash} className="touch-target mt-3 text-[13px] font-bold text-primary">
            Xem lịch sử hôm nay
          </button>
        </section>
      ) : null}

      {noZones ? (
        <section className="rounded-3xl bg-destructive-subtle px-4 py-3 text-[13px] text-destructive">
          <p className="font-bold">Chưa thể chấm công</p>
          <p className="mt-1 leading-5">Công ty chưa khai báo địa điểm chấm công. Liên hệ HR để thiết lập trước khi chấm.</p>
        </section>
      ) : null}

      <CheckInSteps steps={steps} />

      {tone === "outside" || tone === "weak" || tone === "denied" ? (
        <GeofenceStatus
          tone={tone}
          placeName={geo.location?.name}
          distanceM={geo.distanceM}
          radiusM={geo.radiusM}
          accuracyM={geo.fix?.accuracy}
          maxAccuracyM={policy?.max_accuracy_m}
          message={geo.message}
          onRetry={geo.refresh}
          onCreateRequest={tone === "outside" ? () => navigate("/don-tu") : undefined}
          onOpenMap={
            geo.fix
              ? () => {
                  const fix = geo.fix;
                  if (!fix) return;
                  window.open(mapsUrl(fix.latitude, fix.longitude), "_blank", "noopener,noreferrer");
                }
              : undefined
          }
        />
      ) : geo.hasZones && tone === "inside" ? (
        <GeofenceStatus tone="inside" placeName={geo.location?.name} message={geo.message} />
      ) : geo.phase === "loading" ? (
        <GeofenceStatus tone="loading" message="Đang xác định vị trí…" />
      ) : null}

      {deviceBlocked ? (
        <DeviceStatusCard
          name={device?.device_name ?? (deviceName || "Điện thoại này")}
          detail={device ? [device.platform, device.model, device.browser].filter(Boolean).join(" · ") : "Chưa gửi đăng ký"}
          status={device?.status ?? "unregistered"}
          current
          note={
            device?.status === "pending"
              ? "Sai máy hoặc máy chưa được duyệt thì không chấm công được. Vui lòng chờ HR duyệt."
              : device?.status === "rejected"
                ? "Yêu cầu bị từ chối. Gửi lại đăng ký hoặc liên hệ HR. Nút chấm công vẫn khoá."
                : "Đăng ký đúng điện thoại đã được HR duyệt. Máy khác bị chặn hoàn toàn."
          }
          actionLabel={device?.status === "pending" ? undefined : "Đăng ký thiết bị / liên hệ HR"}
          onAction={device?.status === "pending" ? undefined : () => navigate("/toi/thiet-bi")}
        />
      ) : null}

      {sessionRows.length > 1 && !offDay ? (
        <div className="flex gap-2">
          {sessionRows.map((row) => (
            <button
              key={row.session}
              type="button"
              onClick={() => setSession(row.session)}
              className={`touch-target flex-1 rounded-2xl text-[12px] font-bold ${
                row.session === activeSession ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-mobile"
              }`}
            >
              {row.label}
            </button>
          ))}
        </div>
      ) : null}

      {!offDay ? (
        <CheckInButton
          mode={mode}
          label={buttonLabel}
          hint={hint}
          onPress={() => {
            if (blocked || finished) return;
            onPunch(activeSession, action);
          }}
        />
      ) : null}

      {record ? (
        <div className="shadow-mobile flex items-center justify-between rounded-3xl bg-card px-4 py-3 text-[13px]">
          <span>
            Vào {formatTime(record.check_in)} · Ra {formatTime(record.check_out)}
          </span>
          <Badge variant={statusVariant(record.status)}>{ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}</Badge>
        </div>
      ) : null}

      <section id="lich-su" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold">Lịch sử tháng này</h2>
          <Link to="/toi/bang-cong" className="text-[12px] font-bold text-primary">
            Bảng công
          </Link>
        </div>
        {history.length === 0 ? (
          <EmptyState emoji="🗓️" title="Chưa có lần chấm công" description="Lần chấm hợp lệ sẽ hiện ở đây." />
        ) : (
          history.slice(0, 8).map((item) => (
            <div key={item.id} className="shadow-mobile flex items-center justify-between gap-2 rounded-2xl bg-card px-3 py-2.5">
              <div>
                <p className="text-[13px] font-bold">
                  {new Date(`${item.work_date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  <span className="ml-1 font-medium text-muted-foreground">{item.session === "afternoon" ? "Chiều" : "Sáng"}</span>
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {formatTime(item.check_in)} – {formatTime(item.check_out)}
                </p>
              </div>
              <Badge variant={statusVariant(item.status)}>{ATTENDANCE_STATUS_LABELS[item.status] ?? item.status}</Badge>
            </div>
          ))
        )}
      </section>

      <PermissionHelpSheet
        open={geo.phase === "denied" && !helpDismissed}
        kind="location"
        onClose={() => setHelpDismissed(true)}
        onRetry={() => {
          setHelpDismissed(false);
          geo.refresh();
        }}
      />
    </div>
  );
};

const actionLabel = (action: "in" | "out") => (action === "in" ? "Vào ca" : "Ra ca");
