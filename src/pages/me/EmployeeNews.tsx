import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Newspaper } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/mobile/EmptyState";
import { NewsPoster } from "@/components/mobile/NewsPoster";
import { Segmented } from "@/components/mobile/Segmented";
import { Badge } from "@/components/ui/badge";
import { useDeviceMode } from "@/hooks/use-device-mode";
import { useAuth } from "@/lib/auth-provider";
import { findMyEmployee } from "@/lib/attendance";
import { useCompany } from "@/lib/company-provider";
import { isVisibleOnHome, listNewsPosts, type NewsPost } from "@/lib/news";
import { listRequests, REQUEST_STATUS_LABELS, type EmployeeRequest } from "@/lib/requests";
import { getErrorMessage } from "@/lib/utils";

type Feed = "all" | "alerts" | "news";

const relative = (value: string) => {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(value).toLocaleDateString("vi-VN");
};

/** News plus request decisions. There is no separate notification table. */
const EmployeeNews = () => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const mobile = useDeviceMode() === "mobile";
  const [feed, setFeed] = useState<Feed>(mobile ? "all" : "alerts");
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const employee = await findMyEmployee(companyId, user.id);
      const [postResult, requestResult] = await Promise.allSettled([
        listNewsPosts(companyId),
        listRequests(companyId),
      ]);
      if (postResult.status === "fulfilled") {
        setPosts(postResult.value.filter((post) => isVisibleOnHome(post) || post.status === "published"));
        setNewsError(null);
      } else {
        setPosts([]);
        setNewsError(getErrorMessage(postResult.reason));
      }
      if (requestResult.status === "fulfilled" && employee) {
        setRequests(requestResult.value.filter((request) => request.employee_id === employee.id && request.status !== "pending"));
      } else {
        setRequests([]);
      }
    } catch (error) {
      toast.error("Không tải được tin tức", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const alerts = useMemo(
    () => [...requests].sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at)),
    [requests],
  );

  if (mobile) {
    const showAlerts = feed === "all" || feed === "alerts";
    const showNews = feed === "all" || feed === "news";
    return (
      <AppShell>
        <div className="space-y-4">
          <Segmented
            label="Nội bộ"
            value={feed}
            onChange={(value) => setFeed(value as Feed)}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "alerts", label: "Thông báo", count: alerts.length || undefined },
              { value: "news", label: "Tin tức" },
            ]}
          />
          {loading ? <div className="h-28 animate-pulse rounded-[20px] bg-card" /> : null}
          {!loading && showAlerts && alerts.length === 0 && feed === "alerts" ? (
            <EmptyState emoji="🔔" title="Không có thông báo mới" description="Kết quả duyệt đơn của bạn hiện ở đây." />
          ) : null}
          {!loading && showAlerts
            ? alerts.map((request) => (
                <article key={request.id} className="flex items-start gap-3 border-t border-border py-3.5 first:border-t-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
                    <Check className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">Đơn {REQUEST_STATUS_LABELS[request.status] ?? request.status}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {request.decision_note || "Phòng Nhân sự"} · {relative(request.decided_at ?? request.created_at)}
                    </p>
                  </div>
                </article>
              ))
            : null}
          {!loading && showNews && newsError ? (
            <EmptyState emoji="📭" title="Chưa mở được tin nội bộ" description="Tài khoản chưa được cấp quyền xem tin, hoặc bài chưa phát hành." />
          ) : null}
          {!loading && showNews && !newsError && posts.length === 0 && feed === "news" ? (
            <EmptyState emoji="📭" title="Chưa có tin" description="Khi HR đăng tin, bài sẽ hiện ở đây." />
          ) : null}
          {!loading && showNews && !newsError && feed === "all" && posts[0] ? (
            <NewsPoster hideAll title={posts[0].title} meta={[posts[0].author_name, posts[0].published_at ? relative(posts[0].published_at) : null].filter(Boolean).join(" · ")} />
          ) : null}
          {!loading && showNews && !newsError && feed === "news"
            ? posts.map((post) => (
                <article key={post.id} className="flex items-start gap-3 border-t border-border py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
                    <Newspaper className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">{post.title}</p>
                    {post.summary ? <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{post.summary}</p> : null}
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {[post.author_name, post.published_at ? relative(post.published_at) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </article>
              ))
            : null}
          {!loading && feed === "all" && alerts.length === 0 && posts.length === 0 ? (
            <EmptyState emoji="🔔" title="Chưa có nội dung" description="Thông báo duyệt đơn và tin nội bộ sẽ hiện ở đây." />
          ) : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex gap-2">
        <button type="button" onClick={() => setFeed("alerts")}>
          <Badge variant={feed === "alerts" ? "default" : "muted"}>Thông báo · {alerts.length}</Badge>
        </button>
        <button type="button" onClick={() => setFeed("news")}>
          <Badge variant={feed === "news" ? "default" : "muted"}>Tin nội bộ</Badge>
        </button>
      </div>

      {loading ? <div className="h-28 animate-pulse rounded-3xl bg-card" /> : null}

      {!loading && feed === "alerts" && alerts.length === 0 ? (
        <EmptyState emoji="🔔" title="Không có thông báo mới" description="Kết quả duyệt đơn của bạn hiện ở đây. Tin nội bộ nằm ở tab bên cạnh." />
      ) : null}

      {!loading && feed === "alerts"
        ? alerts.map((request) => (
            <article key={request.id} className="shadow-mobile rounded-3xl bg-card px-3 py-3">
              <div className="flex items-start gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success-subtle text-success">
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">Đơn {REQUEST_STATUS_LABELS[request.status] ?? request.status}</p>
                  <p className="text-[12px] text-muted-foreground">{relative(request.decided_at ?? request.created_at)}</p>
                </div>
                {request.status === "approved" ? <span className="mt-1 h-2 w-2 rounded-full bg-brand-orange" /> : null}
              </div>
              {request.decision_note ? <p className="mt-2 text-[12.5px] text-muted-foreground">{request.decision_note}</p> : null}
            </article>
          ))
        : null}

      {!loading && feed === "news" && newsError ? (
        <EmptyState emoji="📭" title="Chưa mở được tin nội bộ" description="Tài khoản chưa được cấp quyền xem tin, hoặc bài chưa phát hành. Liên hệ HR nếu cần." />
      ) : null}

      {!loading && feed === "news" && !newsError && posts.length === 0 ? (
        <EmptyState emoji="📭" title="Hết tin mới" description="Bạn đã xem tất cả tin đang phát hành." />
      ) : null}

      {!loading && feed === "news" && !newsError
        ? posts.map((post) => (
            <article key={post.id} className="shadow-mobile overflow-hidden rounded-3xl bg-card">
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt="" className="h-28 w-full object-cover" />
              ) : (
                <div className="bg-gradient-primary flex h-16 items-center px-4 text-white">
                  <Newspaper className="h-5 w-5" />
                </div>
              )}
              <div className="px-3 py-3">
                <p className="text-[14px] font-bold">{post.title}</p>
                {post.summary ? <p className="mt-1 line-clamp-3 text-[12.5px] leading-5 text-muted-foreground">{post.summary}</p> : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {[post.author_name, post.published_at ? new Date(post.published_at).toLocaleDateString("vi-VN") : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </article>
          ))
        : null}
    </AppShell>
  );
};

export default EmployeeNews;
