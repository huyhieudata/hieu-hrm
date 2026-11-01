import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { HomeWidgetGrid } from "@/components/home-widgets/home-widget-grid";
import { EmptyState } from "@/components/mobile/EmptyState";
import { ShiftCard } from "@/components/mobile/ShiftCard";
import { Badge } from "@/components/ui/badge";
import { useAuth, displayName } from "@/lib/auth-provider";
import {
  findMyEmployee,
  formatTime,
  isWorkingDay,
  listRecordsBetween,
  listRows,
  resolveShift,
  todayIso,
  type AttendanceRecord,
  type ShiftAssignment,
  type WorkShift,
} from "@/lib/attendance";
import { useCompany } from "@/lib/company-provider";
import { isIosDevice, isStandalone } from "@/lib/pwa";
import { getErrorMessage } from "@/lib/utils";

const greetingFor = (date: Date) =>
  date.getHours() < 12
    ? "Chào buổi sáng"
    : date.getHours() < 18
      ? "Chào buổi chiều"
      : "Chào buổi tối";

const short = (value: string | null | undefined) =>
  value ? value.slice(0, 5) : "—";

const EmployeeHome = () => {
  const { user, profile } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [shift, setShift] = useState<WorkShift | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const today = todayIso();

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const employee = await findMyEmployee(companyId, user.id);
      setName(employee?.full_name || displayName(profile, user.email));
      if (!employee) {
        setShift(null);
        setRecords([]);
        return;
      }
      const [shifts, assignments, rows] = await Promise.all([
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listRows<ShiftAssignment>("shift_assignments", companyId, "created_at"),
        listRecordsBetween(companyId, today, today),
      ]);
      setShift(resolveShift(employee, assignments, shifts, today));
      setRecords(rows.filter((row) => row.employee_id === employee.id));
    } catch (error) {
      toast.error("Không tải được trang chủ", {
        description: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, profile, today, user?.email, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const first = (name || "bạn").trim().split(/\s+/).slice(-1)[0];
  const open = records.find((row) => row.check_in && !row.check_out);
  const done =
    records.length > 0 && records.every((row) => row.check_in && row.check_out);
  const offDay = Boolean(shift && !isWorkingDay(shift, today));
  const range = useMemo(() => {
    if (!shift) return "Chưa phân ca";
    if (shift.shift_type === "single")
      return `${short(shift.morning_start || shift.start_time)} – ${short(shift.morning_end || shift.end_time)}`;
    return `${short(shift.morning_start || shift.start_time)} – ${short(shift.afternoon_end || shift.end_time)}`;
  }, [shift]);
  const dateLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <AppShell>
      <p className="font-display text-[22px] font-extrabold tracking-tight">
        {greetingFor(new Date())}, {first} 👋
      </p>
      {loading ? (
        <div className="h-28 animate-pulse rounded-3xl bg-card" />
      ) : (
        <ShiftCard
          name={shift?.name ?? "Ca làm việc"}
          range={range}
          dateLabel={dateLabel}
        />
      )}

      {offDay ? (
        <EmptyState
          emoji="🏖️"
          title="Hôm nay bạn không có ca"
          description="Nghỉ ngơi nhé. Nút chấm công được ẩn."
        />
      ) : (
        <section className="shadow-mobile rounded-3xl bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-bold">
              {done
                ? "Đã xong ca"
                : open
                  ? `Đang trong ca · vào ${formatTime(open.check_in)}`
                  : "Chưa vào ca"}
            </p>
            <Badge variant={done ? "success" : open ? "info" : "warning"}>
              {done ? "Đủ" : open ? "Trong ca" : "Cần chấm"}
            </Badge>
          </div>
          <Link
            to="/cham-cong"
            className="bg-gradient-primary mt-3 flex min-h-12 items-center justify-center rounded-2xl text-[14px] font-bold text-white shadow-glow"
          >
            {done ? "Xem chấm công" : open ? "Ra ca" : "Vào ca ngay"}
          </Link>
        </section>
      )}

      <HomeWidgetGrid surface="mobile" />

      {!isStandalone() ? (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("onhrm:install"))}
          className="bg-gradient-primary w-full rounded-3xl px-4 py-3 text-left text-white shadow-glow"
        >
          <p className="text-[14px] font-extrabold">
            Thêm ONHRM ra màn hình chính
          </p>
          <p className="mt-0.5 text-[12px] text-white/80">
            {isIosDevice()
              ? "Chia sẻ › Thêm vào Màn hình chính"
              : "Cài như ứng dụng, mở nhanh khi vào ca"}
          </p>
        </button>
      ) : null}
    </AppShell>
  );
};

export default EmployeeHome;
