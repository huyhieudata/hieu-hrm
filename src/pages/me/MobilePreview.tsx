import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Folder,
  LayoutGrid,
  Shield,
  Smartphone,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { CheckInButton } from "@/components/attendance/CheckInButton";
import { CheckInSteps, type CheckStepItem } from "@/components/attendance/CheckInSteps";
import { MobileShell, type MobileFrame } from "@/components/mobile/MobileShell";
import { NewsPoster } from "@/components/mobile/NewsPoster";
import { Segmented } from "@/components/mobile/Segmented";
import { ShiftStatusCard } from "@/components/mobile/ShiftStatusCard";
import { ShortcutGrid } from "@/components/mobile/ShortcutGrid";
import { EmployeeRequestsView } from "@/pages/me/EmployeeRequestsView";
import type { EmployeeRecord } from "@/lib/employee-records";
import type { EmployeeRequest, RequestType } from "@/lib/requests";

const screens = [
  "home",
  "home-in",
  "home-blocked",
  "work",
  "apps",
  "internal",
  "checkin",
  "checkin-blocked",
  "requests",
  "timesheet",
  "payslip",
  "profile",
] as const;
type Screen = (typeof screens)[number];
const isScreen = (value: string | null): value is Screen => screens.includes(value as Screen);

const me = { id: "e1", full_name: "Dương Văn Hiệu", code: "NV0123", department: "Phòng Kinh doanh", position: "Chuyên viên Kinh doanh" } as EmployeeRecord;
const types = [
  { id: "t1", name: "Nghỉ phép 1 ngày", category: "leave" },
  { id: "t2", name: "Đi muộn", category: "late" },
  { id: "t3", name: "Quên chấm công", category: "attendance_fix" },
] as RequestType[];
const sampleRequests = [
  { id: "r1", employee_id: "e1", request_type_id: "t1", start_date: "2026-11-12", end_date: "2026-11-12", leave_days: 1, status: "pending", reason: "Người duyệt: Trưởng phòng" },
  { id: "r2", employee_id: "e1", request_type_id: "t3", start_date: "2026-11-05", end_date: "2026-11-05", leave_days: 0, status: "approved", reason: "Vào ca 08:00" },
  { id: "r3", employee_id: "e1", request_type_id: "t2", start_date: "2026-10-28", end_date: "2026-10-28", leave_days: 0, status: "rejected", reason: "30 phút · Kẹt xe", decision_note: "Thiếu ảnh xác nhận." },
] as EmployeeRequest[];

const okSteps: CheckStepItem[] = [
  { id: "selfie", icon: "camera", label: "Ảnh khuôn mặt", note: "Đã chụp 07:57", state: "ok" },
  { id: "gps", icon: "pin", label: "Vị trí GPS", note: "Cách 32 m · cho phép 150 m", state: "ok" },
  { id: "device", icon: "phone", label: "Thiết bị", note: "iPhone 13 · đã đăng ký", state: "warn" },
];
const blockedSteps: CheckStepItem[] = [
  { id: "selfie", icon: "camera", label: "Ảnh khuôn mặt", note: "Đã chụp 07:57", state: "ok" },
  { id: "gps", icon: "pin", label: "Vị trí GPS", note: "Cách 1,2 km · cho phép 150 m", state: "bad" },
  { id: "device", icon: "phone", label: "Thiết bị", note: "iPhone 13 · đã đăng ký", state: "ok" },
];

/** Static gallery of the approved employee mobile UI. Sample copy only. */
const MobilePreview = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("man");
  const screen: Screen = isScreen(requested) ? requested : "home";
  const setScreen = (next: Screen) => setParams({ man: next });
  const [feed, setFeed] = useState("all");
  const [appQuery, setAppQuery] = useState("");

  const punch = screen === "home-in" ? "in" : screen === "home-blocked" || screen === "checkin-blocked" ? "blocked" : "ready";
  const variant = screen === "checkin" || screen === "checkin-blocked" ? "checkin" : screen.startsWith("home") ? "home" : "page";
  const tab = screen === "work" || screen === "requests" || screen === "timesheet" ? "work" : screen === "internal" ? "internal" : screen === "apps" || screen === "payslip" || screen === "profile" ? "apps" : "home";
  const title =
    screen === "work" ? "Công việc" : screen === "apps" ? "Ứng dụng" : screen === "internal" ? "Nội bộ" : screen === "requests" ? "Đơn từ" : screen === "timesheet" ? "Bảng công" : screen === "payslip" ? "Phiếu lương" : screen === "profile" ? "Cá nhân" : screen.startsWith("checkin") ? "Chấm công" : "Trang chủ";

  const frame: MobileFrame = {
    title,
    tab,
    variant,
    back: !screen.startsWith("home") && screen !== "work" && screen !== "apps" && screen !== "internal",
    punch,
    notifyDot: screen.startsWith("home"),
    companyName: "Công ty ABC",
    personName: "Dương Văn Hiệu",
    personMeta: "Chuyên viên Kinh doanh · Phòng KD",
    initials: "VH",
    badges: screen.startsWith("home") ? { work: true } : undefined,
    onBack: () =>
      setScreen(
        screen === "requests" || screen === "timesheet" ? "work" : screen === "payslip" || screen === "profile" ? "apps" : "home",
      ),
    onTab: (id) => setScreen(id === "work" ? "work" : id === "internal" ? "internal" : id === "apps" ? "apps" : "home"),
    onPunch: () => setScreen(punch === "blocked" ? "checkin-blocked" : "checkin"),
    onNotify: () => setScreen("internal"),
    onSearch: () => setScreen("apps"),
    onScan: () => setScreen("checkin"),
  };

  return (
    <MobileShell frame={frame}>
      {screen === "home" || screen === "home-in" || screen === "home-blocked" ? (
        <div>
          {screen === "home-blocked" ? (
            <ShiftStatusCard
              kind="blocked"
              shiftName="Ca hành chính"
              detail="Thiết bị này chưa được đăng ký cho tài khoản của bạn."
              primaryLabel="Đăng ký thiết bị"
              secondaryLabel="Liên hệ HR"
              onPrimary={() => setScreen("profile")}
              onSecondary={() => setScreen("internal")}
              month={{ worked: 14, planned: 22, onOpen: () => setScreen("timesheet") }}
            />
          ) : screen === "home-in" ? (
            <ShiftStatusCard
              kind="in"
              shiftName="Ca hành chính"
              chip="Vào 07:56"
              elapsed="03:24:10"
              expectedOut="17:30"
              month={{ worked: 15, planned: 22, onOpen: () => setScreen("timesheet") }}
            />
          ) : (
            <ShiftStatusCard
              kind="out"
              shiftName="Ca hành chính"
              range="08:00 – 17:30"
              chip="Chưa vào ca"
              meta="Văn phòng Quận 1 · trong bán kính 150 m"
              month={{ worked: 14, planned: 22, onOpen: () => setScreen("timesheet") }}
            />
          )}
          <ShortcutGrid
            items={[
              { label: "Đơn từ", icon: FileText, onClick: () => setScreen("requests") },
              { label: "Lịch làm việc", icon: CalendarDays, onClick: () => setScreen("work") },
              { label: "Bảng công", icon: CalendarDays, onClick: () => setScreen("timesheet") },
              { label: "Khảo sát", icon: ClipboardList, onClick: () => setScreen("apps") },
              { label: "Phiếu lương", icon: Wallet, onClick: () => setScreen("payslip") },
              { label: "Tài liệu", icon: Folder, onClick: () => setScreen("apps") },
              { label: "Tài khoản", icon: UserRound, onClick: () => setScreen("profile") },
              { label: "Tất cả", icon: LayoutGrid, onClick: () => setScreen("apps"), dot: true },
            ]}
          />
          <NewsPoster title="Điều chỉnh quy định chấm công từ 01/12/2026" meta="Phòng Nhân sự · 2 giờ trước" onAll={() => setScreen("internal")} />
        </div>
      ) : null}

      {screen === "work" ? <WorkSample onOpen={(next) => setScreen(next)} /> : null}
      {screen === "apps" ? <AppsSample query={appQuery} onQuery={setAppQuery} onOpen={(next) => setScreen(next)} /> : null}
      {screen === "internal" ? <InternalSample feed={feed} onFeed={setFeed} /> : null}
      {screen === "requests" ? (
        <EmployeeRequestsView loading={false} requests={sampleRequests} types={types} me={me} status="all" onStatus={() => undefined} remainingLeave={null} onCreate={() => undefined} />
      ) : null}
      {screen === "checkin" || screen === "checkin-blocked" ? (
        <div className="space-y-3">
          <div className="pt-2 text-center">
            <p className="font-display text-[40px] font-bold tabular tracking-tight">07:58</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Thứ Hai, 02/11/2026 · Ca hành chính 08:00</p>
          </div>
          <CheckInButton
            appearance="orb"
            mode={screen === "checkin-blocked" ? "locked" : "in"}
            label={screen === "checkin-blocked" ? "BỊ CHẶN" : "VÀO CA"}
            hint={screen === "checkin-blocked" ? "Bạn đang ở ngoài bán kính chấm công" : "Chạm để vào ca sau khi đã đủ 3 bước"}
            onPress={() => undefined}
          />
          <CheckInSteps variant="list" steps={screen === "checkin-blocked" ? blockedSteps : okSteps} />
          {screen === "checkin-blocked" ? (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
              <div className="mx-auto flex max-w-md flex-col gap-2">
                <button type="button" onClick={() => setScreen("requests")} className="flex h-12 items-center justify-center rounded-[14px] bg-brand-navy text-[15px] font-semibold text-white">
                  Tạo đơn quên chấm công
                </button>
                <button type="button" className="flex h-12 items-center justify-center rounded-[14px] bg-card text-[15px] font-semibold text-brand-navy ring-1 ring-border">
                  Thử lại vị trí
                </button>
              </div>
            </div>
          ) : (
            <p className="pt-2 text-center text-[13px] font-semibold text-brand-navy">Gặp sự cố? Liên hệ HR</p>
          )}
        </div>
      ) : null}
      {screen === "timesheet" ? <TimesheetSample /> : null}
      {screen === "payslip" ? <PayslipSample /> : null}
      {screen === "profile" ? <ProfileSample /> : null}
    </MobileShell>
  );
};

const WorkSample = ({ onOpen }: { onOpen: (screen: Screen) => void }) => (
  <div className="-mx-4">
    <section className="mb-2 bg-card px-5">
      <button type="button" onClick={() => onOpen("timesheet")} className="flex h-14 w-full items-center text-left text-[17px] font-bold">
        Lịch làm việc <span className="ml-auto text-muted-foreground">›</span>
      </button>
      <SampleRow label="Bảng công" value="14/22" onClick={() => onOpen("timesheet")} />
      <SampleRow label="Chấm công" hint="Chưa vào ca" onClick={() => onOpen("checkin")} />
      <SampleRow label="Ca hôm nay" hint="08:00 – 17:30" onClick={() => onOpen("checkin")} />
    </section>
    <section className="bg-card px-5">
      <div className="flex h-14 items-center gap-2 text-[17px] font-bold">
        Đơn từ <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
      </div>
      <SampleRow label="Tạo mới" onClick={() => onOpen("requests")} />
      <SampleRow label="Của tôi" count="3" onClick={() => onOpen("requests")} />
      <SampleRow label="Cần duyệt" count="2" hot onClick={() => onOpen("requests")} />
      <SampleRow label="Đã duyệt" count="8" onClick={() => onOpen("requests")} />
    </section>
  </div>
);

const SampleRow = ({ label, value, hint, count, hot, onClick }: { label: string; value?: string; hint?: string; count?: string; hot?: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex h-14 w-full items-center gap-3 border-t border-border text-left text-[15px] font-medium">
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
      <FileText className="h-4 w-4" />
    </span>
    <span className="flex-1">{label}</span>
    {value ? <span className="font-bold text-brand-navy">{value}</span> : null}
    {hint ? <span className="text-[13px] text-muted-foreground">{hint}</span> : null}
    {count ? <span className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] font-bold ${hot ? "bg-brand-orange text-white" : "bg-secondary"}`}>{count}</span> : null}
    <span className="text-muted-foreground">›</span>
  </button>
);

const APPS = [
  { label: "Tài khoản", icon: UserRound, screen: "profile" as Screen, group: "Của tôi" },
  { label: "Đơn từ", icon: FileText, screen: "requests" as Screen, group: "Của tôi" },
  { label: "Bảng công", icon: CalendarDays, screen: "timesheet" as Screen, group: "Của tôi" },
  { label: "Phiếu lương", icon: Wallet, screen: "payslip" as Screen, group: "Của tôi" },
  { label: "Lịch làm việc", icon: CalendarDays, screen: "work" as Screen, group: "Của tôi" },
  { label: "Thiết bị", icon: Smartphone, screen: "profile" as Screen, group: "Của tôi" },
  { label: "Tin nội bộ", icon: FileText, screen: "internal" as Screen, group: "Ứng dụng" },
  { label: "Khảo sát", icon: ClipboardList, screen: "apps" as Screen, group: "Ứng dụng" },
  { label: "Tài liệu", icon: Folder, screen: "apps" as Screen, group: "Ứng dụng" },
  { label: "Danh bạ", icon: Users, screen: "apps" as Screen, group: "Ứng dụng" },
  { label: "Tài sản", icon: Folder, screen: "apps" as Screen, group: "Ứng dụng" },
  { label: "Bảo hiểm", icon: Shield, screen: "apps" as Screen, group: "Ứng dụng" },
];

const AppsSample = ({ query, onQuery, onOpen }: { query: string; onQuery: (value: string) => void; onOpen: (screen: Screen) => void }) => {
  const needle = query.trim().toLocaleLowerCase("vi");
  const visible = APPS.filter((item) => item.label.toLocaleLowerCase("vi").includes(needle));
  return (
    <div>
      <label className="shadow-card-soft flex h-12 items-center gap-2.5 rounded-full bg-card px-4 text-muted-foreground ring-1 ring-border">
        <span className="text-[15px]">⌕</span>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm kiếm ứng dụng..." className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" />
      </label>
      {visible.length === 0 ? <p className="py-8 text-center text-[13px] text-muted-foreground">Không có mục nào khớp.</p> : null}
      {["Của tôi", "Ứng dụng"].map((group) => {
        const items = visible.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <section key={group}>
            <h2 className="mb-3 mt-5 px-1 text-[13px] font-bold tracking-wide text-muted-foreground">
              {group.toLocaleUpperCase("vi")} {items.length}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} type="button" onClick={() => onOpen(item.screen)} className="shadow-card-soft flex h-[108px] flex-col items-center justify-center gap-2.5 rounded-[20px] bg-card">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-brand-navy">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const InternalSample = ({ feed, onFeed }: { feed: string; onFeed: (value: string) => void }) => (
  <div className="space-y-3">
    <Segmented
      label="Nội bộ"
      value={feed}
      onChange={onFeed}
      options={[
        { value: "all", label: "Tất cả" },
        { value: "alerts", label: "Thông báo", count: 2 },
        { value: "news", label: "Tin tức" },
      ]}
    />
    {feed !== "news" ? (
      <div>
        {[
          ["Đơn nghỉ phép 12/11 đã được duyệt", "Trưởng phòng KD · 10 phút"],
          ["Phiếu lương tháng 10 đã có", "Kế toán · 1 giờ"],
          ["Lịch làm việc tuần 46 đã cập nhật", "Nhân sự · Hôm qua"],
        ].map(([title, meta]) => (
          <article key={title} className="flex items-start gap-3 border-t border-border py-3.5 first:border-t-0">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-orange" />
            <div>
              <p className="text-[14px] font-semibold">{title}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{meta}</p>
            </div>
          </article>
        ))}
      </div>
    ) : null}
    {feed !== "alerts" ? <NewsPoster hideAll title="Điều chỉnh quy định chấm công từ 01/12/2026" meta="Phòng Nhân sự · 2 giờ trước" /> : null}
  </div>
);

const TimesheetSample = () => {
  const marks: Record<number, string> = { 2: "ok", 3: "ok", 4: "late", 5: "ok", 6: "ok", 9: "ok", 10: "ok", 11: "ok", 12: "ok", 13: "ok", 16: "ok", 17: "ok", 18: "ok", 19: "ok", 20: "leave", 23: "ok", 25: "ok", 26: "ok", 27: "ok" };
  return (
    <div className="space-y-3">
      <p className="text-center font-display text-[16px] font-bold">Tháng 11/2026</p>
      <section className="shadow-card-soft grid grid-cols-4 rounded-[20px] bg-card py-4 text-center">
        {[
          ["15", "Ngày công"],
          ["1", "Đi muộn"],
          ["1", "Nghỉ phép"],
          ["6", "Còn lại"],
        ].map(([value, label], index) => (
          <div key={label} className={index ? "border-l border-border" : ""}>
            <b className="block text-[20px]">{value}</b>
            <span className="text-[12px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </section>
      <section className="shadow-card-soft rounded-[20px] bg-card p-3">
        <div className="grid grid-cols-7 gap-1.5">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((name) => (
            <div key={name} className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">{name}</div>
          ))}
          {Array.from({ length: 6 }, (_, index) => (
            <div key={`lead-${index}`} className="h-9" />
          ))}
          {Array.from({ length: 30 }, (_, index) => {
            const day = index + 1;
            const kind = marks[day];
            const tone = kind === "ok" ? "bg-primary-subtle text-brand-navy" : kind === "late" ? "bg-accent text-accent-foreground" : kind === "leave" ? "bg-secondary" : "text-muted-foreground";
            return (
              <div key={day} className={`flex h-9 items-center justify-center rounded-[10px] text-[13px] font-medium ${tone} ${day === 24 ? "ring-2 ring-brand-navy" : ""}`}>
                {day}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const PayslipSample = () => (
  <div className="space-y-3">
    <p className="text-center font-display text-[16px] font-bold">Tháng 10/2026</p>
    <section className="bg-brand-navy relative overflow-hidden rounded-[20px] px-5 py-5 text-white">
      <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border-[12px] border-brand-orange/50" />
      <p className="text-[13px] text-white/75">Thực nhận</p>
      <p className="mt-1 font-display text-[30px] font-bold tracking-tight">18.450.000 <small className="text-[16px]">đ</small></p>
      <p className="mt-2 text-[12px] text-white/80">Đã chuyển khoản 05/11/2026</p>
    </section>
    <section className="shadow-card-soft rounded-[20px] bg-card px-4 py-2 text-[14px]">
      <p className="pt-2 text-[13px] font-bold text-muted-foreground">Thu nhập</p>
      {[
        ["Lương cơ bản", "15.000.000"],
        ["Phụ cấp ăn trưa", "730.000"],
        ["Phụ cấp xăng xe", "500.000"],
        ["Thưởng KPI", "3.270.000"],
      ].map(([label, value]) => (
        <div key={label} className="flex h-10 items-center justify-between border-b border-border">
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <p className="pt-3 text-[13px] font-bold text-muted-foreground">Khấu trừ</p>
      <div className="flex h-10 items-center justify-between">
        <span>BHXH, BHYT, BHTN</span>
        <b className="text-destructive">-1.050.000</b>
      </div>
    </section>
  </div>
);

const ProfileSample = () => (
  <div className="-mx-4">
    <section className="flex items-center gap-4 bg-card px-5 py-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-[20px] font-bold text-brand-navy">VH</div>
      <div>
        <p className="text-[18px] font-bold">Dương Văn Hiệu</p>
        <p className="text-[13px] text-muted-foreground">NV0123 · Chuyên viên Kinh doanh</p>
        <p className="text-[13px] text-muted-foreground">Phòng Kinh doanh · Văn phòng Q1</p>
      </div>
    </section>
    <section className="mt-2 bg-card px-5">
      {["Thông tin cá nhân", "Thiết bị", "Giao diện tối"].map((label) => (
        <div key={label} className="flex h-14 items-center gap-3 border-t border-border text-[15px] font-medium first:border-t-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="flex-1">{label}</span>
          {label === "Thiết bị" ? <span className="rounded-full bg-success-subtle px-2 py-0.5 text-[12px] font-semibold text-success">Đã đăng ký</span> : null}
          <span className="text-muted-foreground">›</span>
        </div>
      ))}
      <div className="flex h-14 items-center gap-3 border-t border-border text-[15px] font-semibold text-destructive">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive-subtle">
          <UserRound className="h-4 w-4" />
        </span>
        Đăng xuất
      </div>
    </section>
    <p className="py-4 text-center text-[12px] text-muted-foreground">ONHRM · bản xem trước</p>
  </div>
);

export default MobilePreview;
