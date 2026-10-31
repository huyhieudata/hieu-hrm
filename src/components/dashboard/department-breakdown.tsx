import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/card";
import type { DashboardDepartment } from "@/lib/dashboard";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--info))",
  "hsl(var(--muted-foreground))",
];

export const DepartmentBreakdown = ({ departments }: { departments: DashboardDepartment[] }) => {
  const visible = [...departments]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));
  const rest = departments.slice(6).reduce((sum, item) => sum + item.count, 0);
  if (rest > 0) visible.push({ name: "Khác", count: rest, color: COLORS[6] });
  const total = departments.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="col-span-1 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
        <div>
          <h3 className="text-[15px] font-semibold leading-6 text-foreground">Cơ cấu phòng ban</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Phân bổ nhân sự theo bộ phận</p>
        </div>
        <Link
          to="/employees"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          aria-label="Xem chi tiết phòng ban"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12 text-center text-[12px] text-muted-foreground">
          Chưa có dữ liệu phòng ban.
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-1 h-[168px] w-full max-w-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={visible}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {visible.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular font-display text-[26px] font-semibold leading-8 text-foreground">
                {total}
              </span>
              <span className="text-[11px] text-muted-foreground">nhân sự</span>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2.5 px-5 pb-5 pt-3">
            {visible.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{item.name}</span>
                <span className="tabular text-[12px] font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
