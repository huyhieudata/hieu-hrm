import { CalendarDays, Clock, FileText, PenLine, Plus } from "lucide-react";

import { EmptyState } from "@/components/mobile/EmptyState";
import { Segmented } from "@/components/mobile/Segmented";
import { Badge } from "@/components/ui/badge";
import { useDeviceMode } from "@/hooks/use-device-mode";
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
  const mobile = useDeviceMode() === "mobile";
  const typeById = new Map(types.map((type) => [type.id, type]));
  const mine = requests.filter((request) => !me || request.employee_id === me.id);
  const visible = mine.filter((request) => status === "all" || request.status === status);
  const pendingCount = mine.filter((request) => request.status === "pending").length;

  if (mobile) {
    return (
      <div className="space-y-3">
        <Segmented
          label="Lọc đơn"
          value={status}
          onChange={onStatus}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "pending", label: "Chờ duyệt", count: pendingCount || undefined },
            { value: "approved", label: "Đã duyệt" },
            { value: "rejected", label: "Từ chối" },
          ]}
        />
        {remainingLeave != null ? <p className="px-1 text-[13px] font-semibold text-brand-navy">Phép còn {remainingLeave} ngày</p> : null}
        {loading ? <div className="h-24 animate-pulse rounded-[20px] bg-card" /> : null}
        {!loading && visible.length === 0 ? (
          <EmptyState
            emoji="📝"
            title={mine.length === 0 ? "Bạn chưa có đơn nào" : "Không có đơn ở bộ lọc này"}
            description="Tạo đơn nghỉ phép, đi muộn, về sớm hoặc quên chấm công."
          />
        ) : null}
        {visible.map((request) => {
          const type = typeById.get(request.request_type_id);
          const category = type?.category ?? "other";
          const Icon = ICONS[category as keyof typeof ICONS] ?? FileText;
          const tone = request.status === "approved" ? "ok" : request.status === "rejected" ? "bad" : "warn";
          return (
            <article key={request.id} className="shadow-card-soft flex gap-3 rounded-[20px] bg-card px-4 py-3.5">
              <span
                className={
                  tone === "ok"
                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success"
                    : tone === "bad"
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-subtle text-destructive"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-warning"
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold">{type?.name ?? "Đơn"}</p>
                  <span
                    className={
                      tone === "ok"
                        ? "inline-flex h-6 shrink-0 items-center rounded-full bg-success-subtle px-2 text-[12px] font-semibold text-success"
                        : tone === "bad"
                          ? "inline-flex h-6 shrink-0 items-center rounded-full bg-destructive-subtle px-2 text-[12px] font-semibold text-destructive"
                          : "inline-flex h-6 shrink-0 items-center rounded-full bg-accent px-2 text-[12px] font-semibold text-accent-foreground"
                    }
                  >
                    {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {formatRange(request)}
                  {request.leave_days ? ` · ${request.leave_days} ngày` : ""}
                  {request.reason ? ` · ${request.reason}` : ""}
                </p>
                {request.decision_note ? <p className="mt-1 text-[12px] text-muted-foreground">HR: {request.decision_note}</p> : null}
              </div>
            </article>
          );
        })}
        <button type="button" onClick={onCreate} className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-brand-orange text-[15px] font-semibold text-white">
          <Plus className="h-5 w-5" /> Tạo đơn mới
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <button key={filter.value} type="button" aria-pressed={status === filter.value} className="flex min-h-11 items-center" onClick={() => onStatus(filter.value)}>
            <Badge variant={status === filter.value ? "default" : "muted"} className="px-3 py-1.5 text-[12px]">{filter.label}</Badge>
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
