import { useSearchParams } from "react-router-dom";
import { Bell, CalendarDays, ChevronRight, FileText, Moon, Smartphone, User, Wallet, type LucideIcon } from "lucide-react";

import { CheckInButton } from "@/components/attendance/CheckInButton";
import { CheckInSteps, type CheckStepItem } from "@/components/attendance/CheckInSteps";
import { GeofenceStatus } from "@/components/attendance/GeofenceStatus";
import { DeviceStatusCard } from "@/components/devices/DeviceStatusCard";
import { MobileShell } from "@/components/mobile/MobileShell";
import { ShiftCard } from "@/components/mobile/ShiftCard";
import { Badge } from "@/components/ui/badge";
import { EmployeeRequestsView } from "@/pages/me/EmployeeRequestsView";
import type { EmployeeRecord } from "@/lib/employee-records";
import type { EmployeeRequest, RequestType } from "@/lib/requests";

const screens = ["home", "checkin", "zone", "device", "pending", "register", "requests", "profile"] as const;
type Screen = (typeof screens)[number];

const isScreen = (value: string | null): value is Screen => screens.includes(value as Screen);

const me = {
  id: "e1",
  full_name: "Nguyễn An",
  code: "NV0001",
  department: "Phòng Kinh doanh",
} as EmployeeRecord;

const types = [
  { id: "t1", name: "Nghỉ phép năm", category: "leave" },
  { id: "t2", name: "Đi muộn", category: "late" },
  { id: "t3", name: "Quên chấm công", category: "attendance_fix" },
] as RequestType[];

const sampleRequests = [
  { id: "r1", employee_id: "e1", request_type_id: "t1", start_date: "2026-11-05", end_date: "2026-11-06", leave_days: 2, status: "pending", reason: "Việc gia đình" },
  { id: "r2", employee_id: "e1", request_type_id: "t2", start_date: "2026-10-28", end_date: "2026-10-28", leave_days: 0, status: "approved", reason: null },
  { id: "r3", employee_id: "e1", request_type_id: "t3", start_date: "2026-10-21", end_date: "2026-10-21", leave_days: 0, status: "rejected", reason: null, decision_note: "Thiếu ảnh xác nhận." },
] as EmployeeRequest[];

const QUICK: { label: string; icon: LucideIcon; tile: string; next: Screen }[] = [
  { label: "Tạo đơn", icon: FileText, tile: "bg-accent text-brand-orange", next: "requests" },
  { label: "Bảng công", icon: CalendarDays, tile: "bg-info-subtle text-info", next: "profile" },
  { label: "Phiếu lương", icon: Wallet, tile: "bg-success-subtle text-success", next: "profile" },
  { label: "Thông báo", icon: Bell, tile: "bg-warning-subtle text-warning", next: "home" },
];

const PROFILE_LINKS: { label: string; icon: LucideIcon }[] = [
  { label: "Thông tin cá nhân", icon: User },
  { label: "Bảng công", icon: CalendarDays },
  { label: "Phiếu lương", icon: Wallet },
  { label: "Thiết bị của tôi", icon: Smartphone },
];

/** Static gallery of the employee mobile UI. Same components as the live screens, sample copy only. */
const MobilePreview = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("man");
  const screen: Screen = isScreen(requested) ? requested : "home";
  const setScreen = (next: Screen) => setParams({ man: next });
  const tab =
    screen === "checkin" || screen === "zone" || screen === "device" || screen === "pending"
      ? "checkin"
      : screen === "requests"
        ? "requests"
        : screen === "profile" || screen === "register"
          ? "me"
          : "home";
  const title =
    screen === "home" ? "Trang chủ" : screen === "requests" ? "Đơn từ" : screen === "profile" ? "Cá nhân" : screen === "register" ? "Đăng ký thiết bị" : "Chấm công";

  const blockedDevice = screen === "device" || screen === "pending";
  const outside = screen === "zone";
  const steps: CheckStepItem[] = [
    { id: "selfie", icon: "camera", label: "Ảnh selfie", note: outside ? "Đã chụp" : "Chạm nút để mở camera trước", state: outside ? "ok" : "active" },
    { id: "gps", icon: "pin", label: "Vị trí GPS", note: outside ? "Ngoài vùng" : blockedDevice ? "Chờ" : "Trong vùng · cách 18 m", state: outside ? "bad" : blockedDevice ? "idle" : "ok" },
    {
      id: "device",
      icon: "phone",
      label: "Thiết bị",
      note: screen === "pending" ? "Chờ HR duyệt" : screen === "device" ? "Máy này chưa đăng ký" : "iPhone 13 · đã duyệt",
      state: screen === "pending" ? "warn" : screen === "device" ? "bad" : "ok",
    },
  ];

  return (
    <MobileShell
      frame={{
        title,
        tab,
        hello: screen === "home",
        back: screen === "register",
        onBack: () => setScreen("device"),
        onTab: (id) => setScreen(id === "checkin" ? "checkin" : id === "requests" ? "requests" : id === "me" ? "profile" : "home"),
        onNotify: () => setScreen("home"),
      }}
    >
      {screen === "home" ? (
        <div className="space-y-3">
          <p className="font-display text-[22px] font-extrabold tracking-tight">Chào buổi sáng, An 👋</p>
          <ShiftCard name="Ca hành chính" range="08:00 – 17:30" dateLabel="Thứ Hai 02/11" time="08:42" />
          <section className="shadow-mobile rounded-3xl bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold">Chưa vào ca</p>
              <Badge variant="warning">Cần chấm</Badge>
            </div>
            <button type="button" onClick={() => setScreen("checkin")} className="bg-gradient-primary mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl text-[14px] font-bold text-white">
              Vào ca ngay
            </button>
          </section>
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} type="button" onClick={() => setScreen(action.next)} className="shadow-mobile flex min-h-[72px] flex-col justify-between rounded-3xl bg-card p-3 text-left">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${action.tile}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-bold">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {screen === "requests" ? (
        <EmployeeRequestsView
          loading={false}
          requests={sampleRequests}
          types={types}
          me={me}
          status="all"
          onStatus={() => undefined}
          remainingLeave={8.5}
          onCreate={() => undefined}
        />
      ) : null}

      {screen === "profile" ? (
        <div className="space-y-3">
          <div className="pt-2 text-center">
            <div className="bg-gradient-primary mx-auto flex h-16 w-16 items-center justify-center rounded-full p-[3px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-card font-display text-[18px] font-extrabold text-primary">NA</div>
            </div>
            <p className="mt-2 font-display text-[16px] font-extrabold">Nguyễn An</p>
            <p className="text-[12px] text-muted-foreground">NV0001 · Phòng Kinh doanh</p>
          </div>
          <section className="shadow-mobile rounded-3xl bg-card px-2">
            {PROFILE_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex min-h-12 items-center gap-3 px-2 text-[14px] font-semibold">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
            <div className="flex min-h-12 items-center gap-3 px-2 text-[14px] font-semibold">
              <Moon className="h-4 w-4 text-primary" />
              <span className="flex-1">Giao diện tối</span>
            </div>
          </section>
          <p className="py-2 text-center text-[14px] font-bold text-destructive">Đăng xuất</p>
        </div>
      ) : null}

      {screen === "register" ? (
        <div className="space-y-3">
          <div className="text-center text-[40px]">📱</div>
          <DeviceStatusCard name="iPhone 13" detail="iOS · Safari · Mã …A9F3" status="unregistered" current note="Máy này chưa có trong danh sách đã đăng ký." />
          <section className="shadow-mobile space-y-2 rounded-3xl bg-card p-4">
            <p className="text-[12px] font-semibold text-muted-foreground">Đặt tên gợi nhớ</p>
            <div className="min-h-11 rounded-2xl bg-background px-3 py-3 text-[14px]">Điện thoại cá nhân</div>
            <div className="bg-gradient-primary flex min-h-12 items-center justify-center rounded-2xl text-[14px] font-bold text-white">Gửi yêu cầu đăng ký</div>
          </section>
        </div>
      ) : null}

      {screen === "checkin" || screen === "zone" || screen === "device" || screen === "pending" ? (
        <div className="space-y-3">
          <ShiftCard name="Ca hành chính" range="08:00 – 17:30" dateLabel="Thứ Hai 02/11" time="08:42" />
          <CheckInSteps steps={steps} />
          {outside ? (
            <GeofenceStatus
              tone="outside"
              placeName="Văn phòng Q1"
              distanceM={420}
              radiusM={100}
              message="Bạn đang ngoài vùng chấm công."
              onCreateRequest={() => setScreen("requests")}
            />
          ) : null}
          {screen === "device" ? (
            <DeviceStatusCard
              name="Điện thoại này"
              status="unregistered"
              current
              note="Đăng ký đúng điện thoại đã được HR duyệt. Máy khác bị chặn hoàn toàn."
              actionLabel="Đăng ký thiết bị / liên hệ HR"
              onAction={() => setScreen("register")}
            />
          ) : null}
          {screen === "pending" ? (
            <DeviceStatusCard
              name="iPhone 13"
              detail="iOS · Safari"
              status="pending"
              current
              note="Sai máy hoặc máy chưa được duyệt thì không chấm công được. Không có chế độ chấm kèm cảnh báo."
            />
          ) : null}
          <CheckInButton mode={outside || blockedDevice ? "locked" : "in"} label="VÀO CA" hint={outside || blockedDevice ? "Đã khoá" : "pulse · 08:00"} onPress={() => undefined} />
        </div>
      ) : null}
    </MobileShell>
  );
};

export default MobilePreview;
