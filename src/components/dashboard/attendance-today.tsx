import { CalendarClock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AttendanceTodayProps {
  dateLabel: string;
  total: number;
  present: number;
  onTime: number;
  late: number;
  absent: number;
  forgot: number;
}

const radius = 54;
const circumference = 2 * Math.PI * radius;

export const AttendanceToday = ({
  dateLabel,
  total,
  present,
  onTime,
  late,
  absent,
  forgot,
}: AttendanceTodayProps) => {
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  const metrics = [
    { label: "Đúng giờ", value: onTime, dot: "bg-success" },
    { label: "Đi muộn", value: late, dot: "bg-warning" },
    { label: "Vắng mặt", value: absent, dot: "bg-destructive" },
    { label: "Chưa check-out", value: forgot, dot: "bg-info" },
  ];

  return (
    <Card className="col-span-1 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
        <div>
          <h3 className="text-[15px] font-semibold leading-6 text-foreground">Chấm công hôm nay</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{dateLabel}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-2 py-1 text-[11px] font-semibold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Hôm nay
        </span>
      </div>

      <div className="flex items-center gap-3 px-5 pb-4 pt-3">
        <div className="relative h-[118px] w-[118px] shrink-0">
          <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
            <circle cx="66" cy="66" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
            <defs>
              <linearGradient id="attendanceGauge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" />
              </linearGradient>
            </defs>
            <circle
              cx="66"
              cy="66"
              r={radius}
              fill="none"
              stroke="url(#attendanceGauge)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percentage / 100)}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular font-display text-[26px] font-semibold leading-8 text-foreground">
              {percentage}%
            </span>
            <span className="text-[11px] text-muted-foreground">
              {present}/{total} có mặt
            </span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-2 gap-y-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <div className="flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", metric.dot)} />
                <span className="truncate whitespace-nowrap text-[11px] text-muted-foreground">
                  {metric.label}
                </span>
              </div>
              <p className="tabular mt-0.5 font-display text-[16px] font-semibold leading-5 text-foreground">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-border bg-muted/30 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Bảng công hôm nay
          </p>
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          {total === 0
            ? "Chưa có dữ liệu nhân sự để đối chiếu."
            : `${total - present} nhân sự chưa ghi nhận check-in trong ngày.`}
        </p>
        <Link
          to="/cham-cong/bang-cong"
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          Xem bảng chấm công
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
};
