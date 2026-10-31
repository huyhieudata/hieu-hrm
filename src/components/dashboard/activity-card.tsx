import { Activity } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DashboardActivity } from "@/lib/dashboard";

export const ActivityCard = ({ activities }: { activities: DashboardActivity[] }) => (
  <Card className="col-span-1 overflow-hidden">
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div>
        <h3 className="text-[15px] font-semibold leading-6 text-foreground">Hoạt động gần đây</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Nhật ký thay đổi trong hệ thống</p>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-info-subtle text-info">
        <Activity className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
    </div>

    {activities.length === 0 ? (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-[12.5px] font-medium text-foreground">Chưa có hoạt động</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Thao tác trên hồ sơ, tuyển dụng và hội nhập sẽ xuất hiện tại đây.
        </p>
      </div>
    ) : (
      <ul className="px-5 pb-2">
        {activities.map((item, index) => (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-2">
            {index !== activities.length - 1 && (
              <span className="absolute left-[17px] top-9 h-[calc(100%-20px)] w-px bg-border" />
            )}
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary">
              <Activity className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[12.5px] font-medium leading-5 text-foreground">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Card>
);
