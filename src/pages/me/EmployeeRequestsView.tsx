import { CalendarDays, Clock, FileText, PenLine, Plus } from "lucide-react";

import { EmptyState } from "@/components/mobile/EmptyState";
import { Badge } from "@/components/ui/badge";
import type { EmployeeRecord } from "@/lib/employee-records";
import {
  REQUEST_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  requestStatusTone,
  type EmployeeRequest,
  type RequestType,
} from "@/lib/requests";

const ICONS = {
  leave: CalendarDays,
  late: Clock,
  early_leave: Clock,
  attendance_fix: PenLine,
  other: FileText,
} as const;

interface EmployeeRequestsViewProps {
  loading: boolean;
  requests: EmployeeRequest[];
  types: RequestType[];
  me: EmployeeRecord | null;
  status: string;
  onStatus: (status: string) => void;
  remainingLeave?: number | null;
  onCreate: () => void;
}

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
];

const formatRange = (request: EmployeeRequest) => {
  const start = new Date(`${request.start_date}T00:00:00`).toLocaleDateString("vi-VN");
  if (request.start_date === request.end_date) return start;
  const end = new Date(`${request.end_date}T00:00:00`).toLocaleDateString("vi-VN");
  return `${start} – ${end}`;
};

export const EmployeeRequestsView = ({
  loading,
  requests,
  types,
  me,
  status,
  onStatus,
  remainingLeave,
  onCreate,
}: EmployeeRequestsViewProps) => {
  const typeById = new Map(types.map((type) => [type.id, type]));
  const mine = requests.filter((request) => !me || request.employee_id === me.id);
  const visible = mine.filter((request) => status === "all" || request.status === status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <button key={filter.value} type="button" onClick={() => onStatus(filter.value)}>
            <Badge variant={status === filter.value ? "default" : "muted"}>{filter.label}</Badge>
          </button>
        ))}
      </div>

      {remainingLeave != null ? (
        <p className="rounded-2xl bg-info-subtle px-3 py-2 text-[12.5px] font-semibold text-info">Phép còn {remainingLeave} ngày</p>
      ) : null}

      {loading ? <div className="h-24 animate-pulse rounded-3xl bg-card" /> : null}

      {!loading && visible.length === 0 ? (
        <EmptyState
          emoji="📝"
          title={mine.length === 0 ? "Bạn chưa có đơn nào" : "Không có đơn ở bộ lọc này"}
          description="Tạo đơn nghỉ phép, đi muộn, về sớm hoặc quên chấm công."
          action={
            <button type="button" onClick={onCreate} className="text-[13px] font-bold text-primary">
              Tạo đơn
            </button>
          }
        />
      ) : null}

      {visible.map((request) => {
        const type = typeById.get(request.request_type_id);
        const category = type?.category ?? "other";
        const Icon = ICONS[category as keyof typeof ICONS] ?? FileText;
        return (
          <article key={request.id} className="shadow-mobile rounded-3xl bg-card px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 text-[14px] font-bold">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{type?.name ?? REQUEST_CATEGORY_LABELS[category] ?? "Đơn"}</span>
              </p>
              <Badge variant={requestStatusTone(request.status) as "success" | "warning" | "destructive" | "muted"}>
                {REQUEST_STATUS_LABELS[request.status] ?? request.status}
              </Badge>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {formatRange(request)}
              {request.leave_days ? ` · ${request.leave_days} ngày` : ""}
            </p>
            {request.reason ? <p className="mt-1 line-clamp-2 text-[12.5px] text-foreground/80">{request.reason}</p> : null}
            {request.decision_note ? <p className="mt-1 text-[12px] text-muted-foreground">HR: {request.decision_note}</p> : null}
          </article>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        aria-label="Tạo đơn"
        className="bg-gradient-primary fixed bottom-[calc(var(--tabbar-h)+22px+env(safe-area-inset-bottom))] right-[max(1rem,calc(50%-13.25rem))] z-40 flex h-[52px] w-[52px] items-center justify-center rounded-[20px] text-white shadow-glow"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};
