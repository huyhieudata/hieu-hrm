import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarDays, ChevronRight, CircleAlert, CircleCheck, Clock, FileText, Plus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { useMyDay } from "@/components/mobile/use-my-day";
import { useDeviceMode } from "@/hooks/use-device-mode";
import { useAuth } from "@/lib/auth-provider";
import { findMyEmployee } from "@/lib/attendance";
import { useCompany } from "@/lib/company-provider";
import { listRequests, type EmployeeRequest } from "@/lib/requests";
import { cn, getErrorMessage } from "@/lib/utils";

const EmployeeWork = () => {
  const mode = useDeviceMode();
  const { role, loading } = useCompany();
  if (mode !== "mobile") return <Navigate to="/" replace />;
  if (!loading && role && role !== "employee") return <Navigate to="/" replace />;
  return (
    <AppShell>
      <WorkBody />
    </AppShell>
  );
};

const WorkBody = () => {
  const { user } = useAuth();
  const { activeCompany, can, canDo } = useCompany();
  const day = useMyDay();
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompany?.id || !user?.id) return;
    try {
      const employee = await findMyEmployee(activeCompany.id, user.id);
      const rows = await listRequests(activeCompany.id);
      setRequests(employee ? rows.filter((row) => row.employee_id === employee.id) : []);
    } catch (error) {
      toast.error("Không tải được đơn", { description: getErrorMessage(error) });
      setRequests([]);
    } finally {
      setReady(true);
    }
  }, [activeCompany?.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.filter((row) => row.status === "pending").length;
  const approved = requests.filter((row) => row.status === "approved").length;
  const punchLabel = day.deviceBlocked ? "Bị chặn" : day.open ? "Đang trong ca" : day.done ? "Đã xong ca" : day.offDay ? "Không có ca" : "Chưa vào ca";
  const schedule = canDo("attendance", "view") ? "/cham-cong/lich-lam-viec" : undefined;

  return (
    <div className="-mx-4">
      <section className="mb-2 bg-card px-5">
        {schedule ? (
          <Link to={schedule} className="flex h-14 items-center text-[17px] font-bold">
            Lịch làm việc
            <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
          </Link>
        ) : (
          <div className="flex h-14 items-center text-[17px] font-bold">Lịch làm việc</div>
        )}
        <Row to="/toi/bang-cong" icon={CalendarDays} label="Bảng công" value={day.plannedDays > 0 ? `${day.workedDays}/${day.plannedDays}` : day.workedDays ? String(day.workedDays) : "—"} />
        <Row to="/cham-cong" icon={Clock} label="Chấm công" hint={punchLabel} />
        <Row to="/cham-cong" icon={Clock} label="Ca hôm nay" hint={day.shift ? day.range : "Chưa phân ca"} />
      </section>
      <section className="mb-2 bg-card px-5">
        <div className="flex h-14 items-center gap-2 text-[17px] font-bold">
          Đơn từ
          {pending > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" /> : null}
        </div>
        <Row to="/don-tu?tao=1" icon={Plus} label="Tạo mới" />
        <Row to="/don-tu" icon={FileText} label="Của tôi" count={ready ? requests.length : undefined} />
        {can("leave.approve") ? <Row to="/don-tu" icon={CircleAlert} label="Cần duyệt" count={pending} hot={pending > 0} /> : null}
        <Row to="/don-tu" icon={CircleCheck} label="Đã duyệt" count={ready ? approved : undefined} />
      </section>
    </div>
  );
};

const Row = ({
  to,
  icon: Icon,
  label,
  value,
  hint,
  count,
  hot,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  value?: string;
  hint?: string;
  count?: number;
  hot?: boolean;
}) => (
  <Link to={to} className="flex h-14 items-center gap-3 border-t border-border text-[15px] font-medium">
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
      <Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span>
    {value ? <span className="text-[14px] font-bold text-brand-navy">{value}</span> : null}
    {hint ? <span className="max-w-[46%] truncate text-[13px] text-muted-foreground">{hint}</span> : null}
    {count != null ? (
      <span
        className={cn(
          "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] font-bold",
          hot ? "bg-brand-orange text-white" : "bg-secondary text-foreground",
        )}
      >
        {count}
      </span>
    ) : null}
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </Link>
);

export default EmployeeWork;
