import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listActivity, type ActivityLog } from "@/lib/activity";
import { formatDateTime } from "@/lib/recruitment";

const actionMeta = (action: string) => {
  switch (action) {
    case "created":
      return { icon: Plus, tone: "bg-success-subtle text-success" };
    case "status_changed":
      return { icon: ArrowLeftRight, tone: "bg-info-subtle text-info" };
    case "deleted":
      return { icon: Trash2, tone: "bg-destructive-subtle text-destructive" };
    default:
      return { icon: Pencil, tone: "bg-primary-subtle text-primary-subtle-foreground" };
  }
};

interface ActivityTimelineProps {
  entityType: "candidate" | "employee";
  entityId: string;
  title?: string;
}

export const ActivityTimeline = ({ entityType, entityId, title = "Lịch sử hoạt động" }: ActivityTimelineProps) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await listActivity(entityType, entityId));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div>
          <h3 className="text-[13.5px] font-semibold text-foreground">{title}</h3>
          <p className="text-[11.5px] text-muted-foreground">
            {logs.length} hoạt động · ghi nhận tự động
          </p>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch sử…
        </div>
      ) : logs.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Clock className="mx-auto h-5 w-5 text-muted-foreground/70" />
          <p className="mt-2 text-[12.5px] text-muted-foreground">Chưa có hoạt động nào được ghi nhận.</p>
        </div>
      ) : (
        <ol className="relative px-5 py-4">
          <span className="absolute bottom-6 left-[35px] top-6 w-px bg-border" aria-hidden />
          {logs.map((log) => {
            const meta = actionMeta(log.action);
            const Icon = meta.icon;
            return (
              <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span
                  className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${meta.tone}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium leading-5 text-foreground">{log.summary}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(log.created_at)}
                    {log.actor_name ? ` · ${log.actor_name}` : " · Hệ thống"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
};
