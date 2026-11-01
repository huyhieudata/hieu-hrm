import { Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, type AppInstallStatus } from "@/lib/app-installs";
import { cn } from "@/lib/utils";

const formatWhen = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

export const AppInstallCell = ({ status }: { status?: AppInstallStatus }) => {
  if (!status)
    return <span className="text-[11px] text-muted-foreground">—</span>;
  if (!status.installed) return <Badge variant="muted">Chưa cài</Badge>;
  return (
    <div>
      <Badge variant="success">
        Đã cài ·{" "}
        {status.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")}
      </Badge>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Mở gần nhất{" "}
        {formatWhen(status.last_opened_at ?? status.first_installed_at)}
      </p>
    </div>
  );
};

interface SummaryProps {
  installed: number;
  total: number;
  onlyMissing: boolean;
  onToggle: (value: boolean) => void;
}

export const AppInstallSummary = ({
  installed,
  total,
  onlyMissing,
  onToggle,
}: SummaryProps) => {
  const pct = total ? Math.round((installed / total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-card px-4 py-2.5 text-[12px]">
      <Smartphone className="h-4 w-4 text-primary" />
      <span>
        Đã cài app: <b>{installed}</b>/{total} ({pct}%)
      </span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-success" style={{ width: `${pct}%` }} />
      </div>
      <button
        type="button"
        onClick={() => onToggle(!onlyMissing)}
        className={cn(
          "rounded-full border px-3 py-1 text-[11.5px] font-semibold",
          onlyMissing
            ? "border-primary bg-primary-subtle text-primary"
            : "border-border text-muted-foreground",
        )}
      >
        Chưa cài app ({total - installed})
      </button>
      <span className="text-[11px] text-muted-foreground">
        Chỉ ghi nhận khi người dùng đã mở app đã cài ít nhất 1 lần.
      </span>
    </div>
  );
};
