import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarRange,
  Download,
  Loader2,
  Plus,
  UserCheck,
  Users,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { AttendanceToday } from "@/components/dashboard/attendance-today";
import { BirthdaysCard } from "@/components/dashboard/birthdays-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { DepartmentBreakdown } from "@/components/dashboard/department-breakdown";
import { HeadcountChart } from "@/components/dashboard/headcount-chart";
import { LeaveApprovals, type DashboardLeaveItem } from "@/components/dashboard/leave-approvals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { todayIso } from "@/lib/attendance";
import { displayName, useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard";
import { exportExcel } from "@/lib/export-utils";
import { currency } from "@/lib/format";
import { REQUEST_CATEGORY_LABELS } from "@/lib/requests";
import { getErrorMessage } from "@/lib/utils";

const STATUS_PRIORITY: Record<string, number> = {
  absent: 4,
  late: 3,
  early_leave: 3,
  leave: 2,
  on_time: 1,
};

const percentChange = (current: number, before: number | undefined) =>
  before && before > 0 ? Math.round(((current - before) / before) * 1000) / 10 : undefined;

const secondLast = (values: number[]) => (values.length >= 2 ? values[values.length - 2] : undefined);

const Dashboard = () => {
  const { profile, user } = useAuth();
  const { activeCompany, role, can } = useCompany();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const firstName = displayName(profile, user?.email).split(" ").slice(-1)[0] ?? "bạn";
  const companyId = activeCompany?.id ?? null;
  const canViewPayroll = can("payroll.view");
  const canManageEmployees = can("employees.manage");

  const now = new Date();
  const dateValue = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateLabel = `${dateValue.charAt(0).toUpperCase()}${dateValue.slice(1)}`;
  const greeting = now.getHours() < 12 ? "Chào buổi sáng" : now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const monthLabel = `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const dashboard = await loadDashboardData(companyId);
      setData(dashboard);
    } catch (error) {
      toast.error("Không tải được bảng điều khiển", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const employees = data?.employees ?? [];
    const todayValue = todayIso();
    const activeEmployees = employees.filter(
      (employee) =>
        employee.status !== "resigned" &&
        (!employee.resignation_date || employee.resignation_date > todayValue),
    );
    const activeIds = new Set(activeEmployees.map((employee) => employee.id));
    const todayRecords = (data?.todayRecords ?? []).filter((record) => activeIds.has(record.employee_id));
    const requests = data?.requests ?? [];

    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const statusByEmployee = new Map<string, string>();
    const forgot = new Set<string>();
    const present = new Set<string>();

    todayRecords.forEach((record) => {
      if (record.check_in) present.add(record.employee_id);
      if (record.check_in && !record.check_out) forgot.add(record.employee_id);
      const current = statusByEmployee.get(record.employee_id);
      const next = record.status;
      if (!current || (STATUS_PRIORITY[next] ?? 0) > (STATUS_PRIORITY[current] ?? 0)) {
        statusByEmployee.set(record.employee_id, next);
      }
    });

    const countStatus = (status: string) =>
      Array.from(statusByEmployee.values()).filter((value) => value === status).length;

    const pendingRequests = requests.filter((request) => request.status === "pending");
    const latestPeriod = data?.latestPeriod ?? null;

    const leaveItems: DashboardLeaveItem[] = pendingRequests.map((request) => {
      const employee = employeeById.get(request.employee_id);
      const type = data?.requestTypes.find((item) => item.id === request.request_type_id);
      return {
        id: request.id,
        name: employee?.full_name ?? "Nhân sự",
        typeName: type?.name ?? REQUEST_CATEGORY_LABELS[type?.category ?? ""] ?? "Đơn từ",
        startDate: request.start_date,
        endDate: request.end_date,
        days: Number(request.leave_days) || 0,
        reason: request.reason,
      };
    });

    return {
      total: activeEmployees.length,
      present: present.size,
      onTime: countStatus("on_time"),
      late: countStatus("late"),
      absent: countStatus("absent"),
      forgot: forgot.size,
      pending: pendingRequests.length,
      leaveItems,
      latestPeriod,
    };
  }, [data]);

  const headcountSeries = data?.headcountTrend.map((item) => item.count) ?? [0, 0];
  const presentSeries = data?.presentTrend ?? [0, 0];
  const pendingSeries = data?.pendingTrend ?? [0, 0];
  const payrollSeries = data?.payrollTrend ?? [0, 0];

  const previousHeadcount =
    data && data.headcountTrend.length >= 2 ? data.headcountTrend[data.headcountTrend.length - 2].count : undefined;
  const headcountDelta = percentChange(metrics.total, previousHeadcount);
  const presentDelta = percentChange(metrics.present, secondLast(presentSeries));
  const payrollDelta = percentChange(data?.latestPayrollNet ?? 0, secondLast(payrollSeries));
  const newToday = pendingSeries.length > 0 ? pendingSeries[pendingSeries.length - 1] : 0;
  const notificationSuffix =
    role !== "employee" && metrics.pending > 0 ? ` Bạn có ${metrics.pending} đơn từ cần xử lý.` : "";

  const handleExport = () => {
    if (!data) return;
    exportExcel(
      `tong-quan-nhan-su-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      ["Chỉ số", "Giá trị"],
      [
        ["Tổng nhân sự", metrics.total],
        ["Có mặt hôm nay", metrics.present],
        ["Đúng giờ", metrics.onTime],
        ["Đi muộn", metrics.late],
        ["Vắng mặt", metrics.absent],
        ["Đơn chờ duyệt", metrics.pending],
        [
          "Thực nhận kỳ gần nhất",
          canViewPayroll && data.latestPeriod ? currency(data.latestPayrollNet, false) : "—",
        ],
        ...data.departments.map((department) => [`Phòng ban · ${department.name}`, department.count]),
      ],
      "Tổng quan nhân sự",
    );
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Bảng điều khiển"
        title={`${greeting}, ${firstName}`}
        description={
          activeCompany
            ? `Tình hình nhân sự của ${activeCompany.name} hôm nay, ${dateLabel}.${notificationSuffix}`
            : `Tình hình nhân sự hôm nay, ${dateLabel}.`
        }
        actions={
          <>
            {canViewPayroll ? (
              <Button asChild variant="outline" size="sm" className="h-9 gap-2 text-[12.5px]">
                <Link to="/tinh-luong">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                  {monthLabel}
                </Link>
              </Button>
            ) : (
              <span className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12.5px] text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                {monthLabel}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 text-[12.5px] sm:flex"
              disabled={!data}
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              Xuất báo cáo
            </Button>
            {canManageEmployees && (
              <Button
                size="sm"
                className="h-9 gap-1.5 text-[12.5px]"
                onClick={() => navigate("/employees?new=1")}
              >
                <Plus className="h-4 w-4" />
                Thêm nhân viên
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải bảng điều khiển…
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Nhân sự đang làm việc"
              value={String(metrics.total)}
              unit="người"
              delta={headcountDelta}
              deltaLabel="so với tháng trước"
              icon={Users}
              tone="primary"
              data={headcountSeries}
              style={{ animationDelay: "0ms" }}
              className="animate-fade-up"
            />
            <StatCard
              label="Có mặt hôm nay"
              value={String(metrics.present)}
              unit={`/ ${metrics.total}`}
              delta={presentDelta}
              deltaLabel="so với hôm qua"
              icon={UserCheck}
              tone="teal"
              data={presentSeries}
              className="animate-fade-up animation-delay-100"
            />
            <StatCard
              label="Đơn từ chờ xử lý"
              value={String(metrics.pending)}
              unit="đơn"
              deltaLabel={`${newToday} đơn tạo hôm nay`}
              icon={CalendarClock}
              tone="amber"
              data={pendingSeries}
              className="animate-fade-up animation-delay-200"
            />
            <StatCard
              label="Thực nhận kỳ gần nhất"
              value={
                canViewPayroll && data?.latestPeriod
                  ? currency(data.latestPayrollNet, true)
                  : "—"
              }
              delta={canViewPayroll ? payrollDelta : undefined}
              deltaLabel={
                !canViewPayroll
                  ? "Không có quyền xem lương"
                  : data?.latestPeriod
                    ? "so với kỳ trước"
                    : "Chưa có kỳ lương"
              }
              icon={Wallet}
              tone="violet"
              data={payrollSeries}
              className="animate-fade-up animation-delay-300"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <HeadcountChart data={data?.headcountTrend ?? []} />
            <DepartmentBreakdown departments={data?.departments ?? []} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AttendanceToday
              dateLabel={dateLabel}
              total={metrics.total}
              present={metrics.present}
              onTime={metrics.onTime}
              late={metrics.late}
              absent={metrics.absent}
              forgot={metrics.forgot}
            />
            <LeaveApprovals items={metrics.leaveItems} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BirthdaysCard birthdays={data?.birthdays ?? []} />
            <ActivityCard activities={data?.activity ?? []} />
          </div>
        </>
      )}
    </AppShell>
  );
};

export default Dashboard;
