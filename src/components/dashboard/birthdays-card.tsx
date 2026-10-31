import { Link } from "react-router-dom";
import { Cake, PartyPopper } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { Card } from "@/components/ui/card";
import type { DashboardBirthday } from "@/lib/dashboard";

export const BirthdaysCard = ({ birthdays }: { birthdays: DashboardBirthday[] }) => (
  <Card className="col-span-1 overflow-hidden">
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div>
        <h3 className="text-[15px] font-semibold leading-6 text-foreground">Sinh nhật sắp tới</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">30 ngày tới tại công ty</p>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-chart-5/12 text-chart-5">
        <PartyPopper className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
    </div>

    {birthdays.length === 0 ? (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <Cake className="h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-[12.5px] font-medium text-foreground">Chưa có sinh nhật nào</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Cập nhật ngày sinh trong hồ sơ nhân viên để nhận nhắc nhở.
        </p>
      </div>
    ) : (
      <ul className="divide-y divide-border/80 px-2">
        {birthdays.map((person) => (
          <li key={person.id} className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted/50">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[10px] border border-border bg-muted/50">
              <span className="tabular font-display text-[14px] font-semibold leading-4 text-foreground">
                {person.day}
              </span>
              <span className="text-[9px] uppercase leading-3 text-muted-foreground">Th{person.month}</span>
            </div>
            <Avatar name={person.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{person.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {person.department ?? "Chưa xếp phòng ban"} ·{" "}
                {person.isToday ? "Hôm nay" : `${person.daysUntil} ngày nữa`}
              </p>
            </div>
            {person.email && (
              <a
                href={`mailto:${person.email}?subject=${encodeURIComponent(`Chúc mừng sinh nhật ${person.name}`)}`}
                className="flex h-8 items-center gap-1 rounded-sm border border-border bg-card px-2.5 text-[11px] font-semibold text-muted-foreground opacity-0 transition-all hover:border-primary/30 hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Cake className="h-3.5 w-3.5" />
                Chúc
              </a>
            )}
          </li>
        ))}
      </ul>
    )}

    <div className="border-t border-border bg-muted/30 px-5 py-3">
      <Link
        to="/employees"
        className="flex w-full items-center justify-between text-[11.5px] font-semibold text-primary hover:underline"
      >
        <span>Xem hồ sơ nhân sự</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  </Card>
);
