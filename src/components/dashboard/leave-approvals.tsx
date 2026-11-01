import { Link } from "react-router-dom";
import { CalendarDays, Check, ChevronRight } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { Card } from "@/components/ui/card";

export interface DashboardLeaveItem {
  id: string;
  name: string;
  typeName: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
}

const shortDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export const LeaveApprovals = ({ items }: { items: DashboardLeaveItem[] }) => (
  <Card className="col-span-1 flex flex-col overflow-hidden lg:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold leading-6 text-foreground">Đơn từ chờ xử lý</h3>
          <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-subtle px-1.5 text-[11px] font-semibold text-primary-subtle-foreground">
            {items.length}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Theo dõi các đơn đang chờ phản hồi
        </p>
      </div>
      <Link
        to="/don-tu"
        className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px] font-semibold text-primary transition-colors hover:bg-primary-subtle"
      >
        Xem và duyệt
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>

    {items.length === 0 ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-14 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-subtle text-success">
          <Check className="h-5 w-5" />
        </span>
        <p className="text-[13px] font-semibold text-foreground">Không có đơn nào đang chờ</p>
        <p className="text-[12px] text-muted-foreground">Mọi đơn từ đã được phản hồi.</p>
      </div>
    ) : (
      <ul className="divide-y divide-border/80">
        {items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <Link
              to="/don-tu"
              className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
            >
              <Avatar name={item.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-foreground">{item.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.typeName}
                  {item.reason ? ` · ${item.reason}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {shortDate(item.startDate)}
                {item.endDate !== item.startDate ? ` – ${shortDate(item.endDate)}` : ""}
                {item.days > 0 && (
                  <span className="ml-1 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                    {item.days} ngày
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </Card>
);
