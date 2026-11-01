import { Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DEVICE_STATUS_LABELS, type DeviceStatus } from "@/lib/attendance-verify";

export type DeviceCardStatus = DeviceStatus | "unregistered";

const VARIANT: Record<DeviceCardStatus, "success" | "warning" | "destructive" | "muted"> = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
  revoked: "muted",
  unregistered: "destructive",
};

interface DeviceStatusCardProps {
  name: string;
  detail?: string;
  status: DeviceCardStatus;
  note?: string;
  current?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export const DeviceStatusCard = ({ name, detail, status, note, current, actionLabel, onAction }: DeviceStatusCardProps) => {
  const label = status === "unregistered" ? "Chưa đăng ký" : status === "revoked" ? "Ngừng dùng" : DEVICE_STATUS_LABELS[status];
  const surface =
    status === "approved"
      ? "bg-success-subtle"
      : status === "pending"
        ? "bg-warning-subtle"
        : status === "rejected" || status === "unregistered"
          ? "bg-destructive-subtle"
          : "bg-card";

  return (
    <article className={`shadow-mobile rounded-3xl px-4 py-3 ${surface}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-[14px] font-bold text-foreground">
          <Smartphone className="h-4 w-4 shrink-0" />
          <span className="truncate">{name}</span>
        </p>
        <Badge variant={VARIANT[status]}>{label}</Badge>
      </div>
      {detail ? <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p> : null}
      {current ? <p className="mt-1 text-[12px] font-semibold text-foreground">Thiết bị này</p> : null}
      {note ? <p className="mt-1 text-[12.5px] leading-5 text-foreground/80">{note}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="touch-target mt-2 text-[13px] font-bold text-primary">
          {actionLabel}
        </button>
      ) : null}
    </article>
  );
};
