import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  Clock,
  FileText,
  Fingerprint,
  Pin,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listHomeNews, type NewsPost } from "@/lib/news";
import {
  loadAppInstallStatus,
  type AppInstallStatus,
} from "@/lib/app-installs";
import type {
  HomeSummary,
  WidgetAudience,
  WidgetKey,
  WidgetSize,
  WidgetSurface,
} from "@/lib/home-widgets";
import { Metric, WidgetEmpty, WidgetError, WidgetFrame } from "./widget-frame";

export interface WidgetProps {
  surface: WidgetSurface;
  size: WidgetSize;
  summary: HomeSummary;
  companyId: string;
  audience: WidgetAudience;
}

const VN_TZ = "Asia/Ho_Chi_Minh";
const fmtDate = (value: string | null | undefined) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      })
    : "—";
const daysFromToday = (value: string, today: string) =>
  Math.round(
    (new Date(`${value}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      86_400_000,
  );

const REQUEST_STATUS: Record<
  string,
  { label: string; variant: "warning" | "success" | "destructive" | "muted" }
> = {
  pending: { label: "Chờ duyệt", variant: "warning" },
  approved: { label: "Đã duyệt", variant: "success" },
  rejected: { label: "Từ chối", variant: "destructive" },
  cancelled: { label: "Đã huỷ", variant: "muted" },
};

const ClockWidget = ({ surface, size }: WidgetProps) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = now.toLocaleTimeString("vi-VN", {
    timeZone: VN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("vi-VN", {
    timeZone: VN_TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <section
      className={
        surface === "mobile"
          ? "shadow-mobile flex h-full flex-col justify-center rounded-3xl bg-gradient-to-br from-brand-navy to-brand-navy/80 p-4 text-white"
          : "flex h-full flex-col justify-center rounded-xl bg-gradient-to-br from-brand-navy to-brand-navy/80 p-5 text-white shadow-sm"
      }
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/70">
        <Clock className="h-3.5 w-3.5" /> Giờ Việt Nam (UTC+7)
      </p>
      <p
        className={`font-display font-extrabold tabular-nums tracking-tight ${size === "lg" ? "text-[44px]" : "text-[34px]"}`}
      >
        {time}
      </p>
      <p className="text-[13px] capitalize text-white/85">{date}</p>
      <span className="mt-2 h-1 w-10 rounded-full bg-brand-orange" />
    </section>
  );
};

const AttendanceTodayWidget = ({ surface, summary, audience }: WidgetProps) => {
  const a = summary.attendance_today;
  if (audience === "employee") {
    const mine = a.mine;
    return (
      <WidgetFrame
        surface={surface}
        emoji="✅"
        title="Chấm công hôm nay"
        to="/cham-cong"
        linkLabel="Chấm công"
      >
        <p className="text-[14px] font-bold">
          {mine?.open
            ? "Đang trong ca"
            : mine?.checked_in
              ? "Đã chấm công"
              : "Bạn chưa chấm công"}
        </p>
        {a.rejected > 0 ? (
          <p className="mt-1 text-[12px] text-destructive">
            {a.rejected} lượt bị từ chối hôm nay
            {a.rejected_out_of_zone
              ? ` (${a.rejected_out_of_zone} ngoài vùng)`
              : ""}
            .
          </p>
        ) : null}
      </WidgetFrame>
    );
  }
  return (
    <WidgetFrame
      surface={surface}
      emoji="✅"
      title="Tình hình chấm công hôm nay"
      subtitle={`${a.total} nhân sự trong phạm vi`}
      to="/cham-cong/nhat-ky"
      linkLabel="Nhật ký"
    >
      {a.total === 0 ? (
        <WidgetEmpty text="Chưa có nhân sự trong phạm vi của bạn." />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric
            label="Đã chấm"
            value={`${a.present}/${a.total}`}
            tone="success"
          />
          <Metric label="Đi muộn" value={a.late} tone="warning" />
          <Metric label="Chưa chấm/vắng" value={a.absent} tone="danger" />
          <Metric label="Nghỉ phép" value={a.on_leave} tone="info" />
          <Metric label="Đang trong ca" value={a.open} />
          <Metric
            label="Bị từ chối (ngoài vùng)"
            value={`${a.rejected} (${a.rejected_out_of_zone})`}
            tone={a.rejected ? "danger" : "default"}
          />
        </div>
      )}
    </WidgetFrame>
  );
};

const MonthOverviewWidget = ({ surface, summary, audience }: WidgetProps) => {
  const m = summary.month_overview;
  const monthLabel = `Tháng ${Number(m.month_start.slice(5, 7))}/${m.month_start.slice(0, 4)}`;
  const mine = audience === "employee";
  return (
    <WidgetFrame
      surface={surface}
      emoji="📅"
      title="Tổng quan ngày công"
      subtitle={`${monthLabel} · ${m.workdays_elapsed} ngày làm việc đã qua`}
      to={mine ? "/toi/bang-cong" : "/cham-cong/bang-cong"}
      linkLabel="Bảng công"
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric
          label={mine ? "Ngày đi làm" : "Lượt ngày công"}
          value={m.worked_days}
          tone="success"
        />
        <Metric label="Đi muộn" value={m.late} tone="warning" />
        <Metric label="Về sớm" value={m.early_leave} />
        <Metric
          label="Nghỉ phép (ngày)"
          value={Number(m.leave_days)}
          tone="info"
        />
      </div>
    </WidgetFrame>
  );
};

const RequestsWidget = ({ surface, summary, audience }: WidgetProps) => {
  const r = summary.requests;
  const mine = audience === "employee";
  return (
    <WidgetFrame
      surface={surface}
      emoji="📝"
      title={mine ? "Đơn từ của tôi" : "Đơn từ chờ duyệt"}
      subtitle={
        mine
          ? `${r.my_pending} đơn đang chờ duyệt`
          : `${r.pending} đơn cần xử lý`
      }
      to="/don-tu"
      linkLabel={mine ? "Tạo đơn" : "Xử lý"}
    >
      {r.items.length === 0 ? (
        <WidgetEmpty
          emoji="🎉"
          text={mine ? "Bạn chưa có đơn nào." : "Không có đơn nào chờ duyệt."}
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {r.items.map((item) => {
            const st = REQUEST_STATUS[item.status] ?? {
              label: item.status,
              variant: "muted" as const,
            };
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {mine ? (item.type_name ?? "Đơn từ") : item.employee_name}
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {mine ? "" : `${item.type_name ?? "Đơn từ"} · `}
                    {fmtDate(item.start_date)}
                    {item.end_date && item.end_date !== item.start_date
                      ? ` – ${fmtDate(item.end_date)}`
                      : ""}
                  </p>
                </div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
};

const NewsWidget = ({ surface, size, companyId, audience }: WidgetProps) => {
  const [posts, setPosts] = useState<NewsPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listHomeNews(companyId)
      .then((items) => !cancelled && setPosts(items))
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setPosts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  const limit = size === "lg" ? 4 : size === "md" ? 3 : 2;
  return (
    <WidgetFrame
      surface={surface}
      emoji="📰"
      title="Bản tin nội bộ"
      to={audience === "employee" ? "/toi/tin-tuc" : "/tin-tuc"}
      linkLabel="Tất cả"
    >
      {posts === null ? (
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ) : failed ? (
        <WidgetEmpty emoji="📭" text="Không tải được bản tin." />
      ) : posts.length === 0 ? (
        <WidgetEmpty emoji="📭" text="Chưa có tin nội bộ mới." />
      ) : (
        <ul
          className={
            size === "lg" && surface === "desktop"
              ? "grid gap-3 sm:grid-cols-2"
              : "space-y-2"
          }
        >
          {posts.slice(0, limit).map((post) => (
            <li key={post.id} className="rounded-xl bg-muted/40 px-3 py-2">
              <p className="flex items-center gap-1 text-[13px] font-semibold leading-5">
                {post.pinned ? (
                  <Pin className="h-3 w-3 shrink-0 text-brand-orange" />
                ) : null}
                <span className="line-clamp-2">{post.title}</span>
              </p>
              {post.summary ? (
                <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
                  {post.summary}
                </p>
              ) : null}
              {post.published_at ? (
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  {new Date(post.published_at).toLocaleDateString("vi-VN")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
};

const BirthdaysWidget = ({ surface, summary }: WidgetProps) => {
  const month = Number(summary.today.slice(5, 7));
  return (
    <WidgetFrame
      surface={surface}
      emoji="🎂"
      title="Sinh nhật trong tháng"
      subtitle={`Tháng ${month}`}
    >
      {summary.birthdays.length === 0 ? (
        <WidgetEmpty emoji="🎈" text="Tháng này chưa có sinh nhật nào." />
      ) : (
        <ul className="space-y-1.5">
          {summary.birthdays.slice(0, 8).map((person) => (
            <li
              key={person.id}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 ${person.is_today ? "bg-accent text-brand-orange" : "bg-muted/40"}`}
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">
                  {person.name}
                </p>
                {person.department ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {person.department}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-[12px] font-bold">
                {person.is_today
                  ? "Hôm nay 🎉"
                  : `${String(person.day).padStart(2, "0")}/${String(month).padStart(2, "0")}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
};

const QUICK_LINKS: Record<
  WidgetAudience,
  { to: string; label: string; icon: typeof FileText; tile: string }[]
> = {
  employee: [
    {
      to: "/cham-cong",
      label: "Chấm công",
      icon: Fingerprint,
      tile: "bg-primary-subtle text-primary",
    },
    {
      to: "/don-tu",
      label: "Tạo đơn",
      icon: FileText,
      tile: "bg-accent text-brand-orange",
    },
    {
      to: "/toi/bang-cong",
      label: "Bảng công",
      icon: CalendarDays,
      tile: "bg-info-subtle text-info",
    },
    {
      to: "/toi/phieu-luong",
      label: "Phiếu lương",
      icon: Wallet,
      tile: "bg-success-subtle text-success",
    },
    {
      to: "/toi/tin-tuc",
      label: "Thông báo",
      icon: Bell,
      tile: "bg-warning-subtle text-warning",
    },
  ],
  manager: [
    {
      to: "/don-tu",
      label: "Duyệt đơn",
      icon: FileText,
      tile: "bg-accent text-brand-orange",
    },
    {
      to: "/cham-cong/bang-cong",
      label: "Bảng công",
      icon: CalendarDays,
      tile: "bg-info-subtle text-info",
    },
    {
      to: "/employees",
      label: "Nhân sự",
      icon: Users,
      tile: "bg-primary-subtle text-primary",
    },
    {
      to: "/cham-cong",
      label: "Chấm công",
      icon: Fingerprint,
      tile: "bg-success-subtle text-success",
    },
  ],
  admin: [
    {
      to: "/employees?new=1",
      label: "Thêm nhân viên",
      icon: Users,
      tile: "bg-primary-subtle text-primary",
    },
    {
      to: "/don-tu",
      label: "Duyệt đơn",
      icon: FileText,
      tile: "bg-accent text-brand-orange",
    },
    {
      to: "/cham-cong/bang-cong",
      label: "Bảng công",
      icon: CalendarDays,
      tile: "bg-info-subtle text-info",
    },
    {
      to: "/tinh-luong",
      label: "Tính lương",
      icon: Wallet,
      tile: "bg-success-subtle text-success",
    },
    {
      to: "/tin-tuc",
      label: "Đăng tin",
      icon: Bell,
      tile: "bg-warning-subtle text-warning",
    },
  ],
};

const QuickLinksWidget = ({ surface, audience }: WidgetProps) => {
  const links = QUICK_LINKS[audience].slice(0, surface === "mobile" ? 4 : 5);
  return (
    <WidgetFrame surface={surface} emoji="⚡" title="Lối tắt nhanh">
      <div
        className={
          surface === "mobile"
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
        }
      >
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className="flex min-h-[64px] flex-col justify-between rounded-2xl bg-muted/40 p-3 hover:bg-muted"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${link.tile}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[12.5px] font-bold">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </WidgetFrame>
  );
};

const PeopleChangesWidget = ({ surface, summary }: WidgetProps) => {
  const data = summary.people_changes;
  if (!data) return null;
  const empty =
    data.new_hires.length === 0 && data.probation_ending.length === 0;
  return (
    <WidgetFrame
      surface={surface}
      emoji="🧑‍💼"
      title="Nhân sự mới & thử việc"
      to="/employees"
      linkLabel="Nhân sự"
    >
      {empty ? (
        <WidgetEmpty text="Không có nhân sự mới hay sắp hết thử việc." />
      ) : (
        <div className="space-y-3">
          {data.new_hires.length > 0 ? (
            <div>
              <p className="mb-1 text-[11.5px] font-bold uppercase text-muted-foreground">
                Mới vào làm (30 ngày)
              </p>
              {data.new_hires.map((p) => (
                <Link
                  key={p.id}
                  to={`/employees/${p.id}`}
                  className="flex justify-between py-1 text-[13px] hover:underline"
                >
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="text-muted-foreground">
                    {fmtDate(p.hire_date)}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          {data.probation_ending.length > 0 ? (
            <div>
              <p className="mb-1 text-[11.5px] font-bold uppercase text-muted-foreground">
                Sắp hết thử việc
              </p>
              {data.probation_ending.map((p) => (
                <Link
                  key={p.id}
                  to={`/employees/${p.id}`}
                  className="flex justify-between py-1 text-[13px] hover:underline"
                >
                  <span className="truncate font-semibold">{p.name}</span>
                  <Badge variant="warning">
                    còn {daysFromToday(p.probation_end_date, summary.today)}{" "}
                    ngày
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </WidgetFrame>
  );
};

const ContractsWidget = ({ surface, summary }: WidgetProps) => {
  const rows = summary.contracts_expiring;
  if (!rows) return null;
  return (
    <WidgetFrame
      surface={surface}
      emoji="📄"
      title="Hợp đồng sắp hết hạn"
      subtitle="Trong 45 ngày tới"
      to="/hop-dong"
      linkLabel="Hợp đồng"
    >
      {rows.length === 0 ? (
        <WidgetEmpty emoji="👌" text="Không có hợp đồng sắp hết hạn." />
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((c) => {
            const left = daysFromToday(c.end_date, summary.today);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{c.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {c.contract_no ? `${c.contract_no} · ` : ""}hết hạn{" "}
                    {fmtDate(c.end_date)}
                  </p>
                </div>
                <Badge variant={left <= 15 ? "destructive" : "warning"}>
                  {left} ngày
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
};

const InterviewsWidget = ({ surface, summary }: WidgetProps) => {
  const rows = summary.interviews;
  if (!rows) return null;
  return (
    <WidgetFrame
      surface={surface}
      emoji="🎯"
      title="Phỏng vấn sắp tới"
      to="/tuyen-dung/lich-hen"
      linkLabel="Lịch hẹn"
    >
      {rows.length === 0 ? (
        <WidgetEmpty emoji="🗓️" text="Chưa có lịch phỏng vấn sắp tới." />
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((i) => (
            <li key={i.id} className="py-2">
              <Link
                to={`/tuyen-dung/ung-vien/${i.candidate_id}`}
                className="block hover:underline"
              >
                <p className="truncate text-[13px] font-semibold">
                  {i.candidate_name}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {new Date(i.scheduled_at).toLocaleString("vi-VN", {
                    timeZone: VN_TZ,
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {i.position_applied ? ` · ${i.position_applied}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
};

const DepartmentsWidget = ({ surface, summary }: WidgetProps) => {
  const rows = summary.departments;
  if (!rows) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <WidgetFrame
      surface={surface}
      emoji="🏢"
      title="Nhân sự theo phòng ban"
      subtitle={`${summary.scope_size} người đang làm`}
    >
      {rows.length === 0 ? (
        <WidgetEmpty text="Chưa có dữ liệu phòng ban." />
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map((d) => (
            <li key={d.name}>
              <div className="flex justify-between text-[12.5px]">
                <span className="truncate font-semibold">{d.name}</span>
                <span className="text-muted-foreground">{d.count}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-brand-navy to-brand-orange"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
};

const AppInstallsWidget = ({ surface, companyId, audience }: WidgetProps) => {
  const [rows, setRows] = useState<AppInstallStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    loadAppInstallStatus(companyId)
      .then((data) => alive && setRows(data))
      .catch(
        (err: unknown) =>
          alive && setError(err instanceof Error ? err.message : "Lỗi"),
      );
    return () => {
      alive = false;
    };
  }, [companyId, nonce]);
  if (audience === "employee") return null;
  const installed = rows?.filter((r) => r.installed).length ?? 0;
  const total = rows?.length ?? 0;
  const pct = total ? Math.round((installed / total) * 100) : 0;
  return (
    <WidgetFrame
      surface={surface}
      emoji="📲"
      title="Tỷ lệ cài app"
      subtitle="Đã mở app đã cài ít nhất 1 lần"
      to="/members"
      linkLabel="Chi tiết"
    >
      {error ? (
        <WidgetError message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !rows ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : total === 0 ? (
        <WidgetEmpty text="Chưa có thành viên." />
      ) : (
        <div>
          <p className="font-display text-[28px] font-extrabold">
            {installed}/{total}{" "}
            <span className="text-[14px] text-muted-foreground">({pct}%)</span>
          </p>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-navy to-brand-orange"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </WidgetFrame>
  );
};

export const WIDGET_COMPONENTS: Record<
  WidgetKey,
  (props: WidgetProps) => ReactElement | null
> = {
  clock: ClockWidget,
  attendance_today: AttendanceTodayWidget,
  month_overview: MonthOverviewWidget,
  requests: RequestsWidget,
  news: NewsWidget,
  birthdays: BirthdaysWidget,
  quick_links: QuickLinksWidget,
  people_changes: PeopleChangesWidget,
  contracts_expiring: ContractsWidget,
  interviews: InterviewsWidget,
  departments: DepartmentsWidget,
  app_installs: AppInstallsWidget,
};
