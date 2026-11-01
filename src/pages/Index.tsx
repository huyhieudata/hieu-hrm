import { Link, useNavigate } from "react-router-dom";
import { CalendarRange, LayoutGrid, Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import EmployeeHome from "@/pages/me/EmployeeHome";
import { PageHeader } from "@/components/common/page-header";
import { HomeWidgetGrid } from "@/components/home-widgets/home-widget-grid";
import { Button } from "@/components/ui/button";
import { displayName, useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";

const AdminDashboard = () => {
  const { profile, user } = useAuth();
  const { activeCompany, role, can } = useCompany();
  const navigate = useNavigate();
  const firstName =
    displayName(profile, user?.email).split(" ").slice(-1)[0] ?? "bạn";
  const canManageEmployees = can("employees.manage");
  const canConfigure = role === "owner" || role === "admin" || role === "hr";

  const now = new Date();
  const dateValue = now.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateLabel = `${dateValue.charAt(0).toUpperCase()}${dateValue.slice(1)}`;
  const hour = Number(
    now.toLocaleString("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hour12: false,
    }),
  );
  const greeting =
    hour < 12
      ? "Chào buổi sáng"
      : hour < 18
        ? "Chào buổi chiều"
        : "Chào buổi tối";
  const monthLabel = `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Bảng điều khiển"
        title={`${greeting}, ${firstName}`}
        description={
          activeCompany
            ? `Tình hình nhân sự của ${activeCompany.name} hôm nay, ${dateLabel}.`
            : `Tình hình nhân sự hôm nay, ${dateLabel}.`
        }
        actions={
          <>
            <span className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12.5px] text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              {monthLabel}
            </span>
            {canConfigure && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden h-9 gap-2 text-[12.5px] sm:flex"
              >
                <Link to="/cai-dat/widget-trang-chu">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Tùy chỉnh widget
                </Link>
              </Button>
            )}
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
      <HomeWidgetGrid surface="desktop" />
    </AppShell>
  );
};

const Dashboard = () => {
  const { role } = useCompany();
  if (role === "employee") return <EmployeeHome />;
  return <AdminDashboard />;
};

export default Dashboard;
