import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  Loader2,
  Megaphone,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { RecruitmentShell } from "@/components/recruitment/module-shell";
import { CandidateStatusBadge } from "@/components/recruitment/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/lib/company-provider";
import {
  CAMPAIGN_STATUS_LABELS,
  INTERVIEW_STATUS_LABELS,
  PIPELINE_STAGES,
  campaignCountdown,
  formatDateTime,
  formatDay,
  listRows,
  statusMeta,
  type Campaign,
  type Candidate,
  type Interview,
  type JobDescription,
} from "@/lib/recruitment";
import { getErrorMessage } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  received: "Tiếp nhận",
  screening: "Sàng lọc",
  qualified: "Đạt hồ sơ",
  interview_scheduled: "Hẹn phỏng vấn",
  interview_attended: "Đã phỏng vấn",
  interview_passed: "Đạt phỏng vấn",
  offer_sent: "Gửi offer",
  offer_accepted: "Nhận offer",
  started: "Nhận việc",
};

const RecruitmentOverview = () => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [campaignRows, candidateRows, interviewRows, jobRows] = await Promise.all([
        listRows<Campaign>("recruitment_campaigns", companyId, "created_at"),
        listRows<Candidate>("candidates", companyId, "applied_at"),
        listRows<Interview>("candidate_interviews", companyId, "scheduled_at", true),
        listRows<JobDescription>("job_descriptions", companyId, "created_at"),
      ]);
      setCampaigns(campaignRows);
      setCandidates(candidateRows);
      setInterviews(interviewRows);
      setJobs(jobRows);
    } catch (error) {
      toast.error("Không tải được tổng quan tuyển dụng", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const candidateById = useMemo(() => new Map(candidates.map((row) => [row.id, row])), [candidates]);
  const campaignById = useMemo(() => new Map(campaigns.map((row) => [row.id, row])), [campaigns]);

  const openCampaigns = campaigns.filter((row) => row.status === "open");
  const activeCandidates = candidates.filter((row) => statusMeta(row.status).group !== "closed").length;
  const now = Date.now();
  const upcomingInterviews = interviews
    .filter((row) => row.status === "scheduled" && new Date(row.scheduled_at).getTime() >= now - 60 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const offersWaiting = candidates.filter((row) => row.status === "offer_sent").length;
  const started = candidates.filter((row) => row.status === "started").length;

  const funnel = PIPELINE_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage] ?? stage,
    count: candidates.filter((row) => row.status === stage).length,
  }));
  const funnelMax = Math.max(...funnel.map((item) => item.count), 1);
  const rejected = candidates.filter((row) => statusMeta(row.status).group === "closed").length;

  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Chiến dịch đang tuyển", value: openCampaigns.length, icon: Megaphone, tone: "text-primary" },
    { label: "Ứng viên đang xử lý", value: activeCandidates, icon: Users, tone: "text-foreground" },
    { label: "Phỏng vấn sắp tới", value: upcomingInterviews.length, icon: CalendarClock, tone: "text-info" },
    { label: "Offer chờ phản hồi", value: offersWaiting, icon: ClipboardCheck, tone: "text-warning" },
  ];

  return (
    <RecruitmentShell
      title="Tổng quan tuyển dụng"
      description="Nhu cầu tuyển, sức khoẻ pipeline và các buổi phỏng vấn sắp tới trong một màn hình."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-9 gap-1.5 text-[12.5px]">
            <Link to="/tuyen-dung/chien-dich">
              <Briefcase className="h-3.5 w-3.5" /> Chiến dịch
            </Link>
          </Button>
          <Button asChild className="h-9 gap-1.5 text-[12.5px]">
            <Link to="/tuyen-dung/ung-vien">
              <UserRound className="h-3.5 w-3.5" /> Ứng viên
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {item.label}
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className={`mt-2 font-display text-[24px] font-semibold ${item.tone}`}>{item.value}</p>
            </Card>
          );
        })}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tổng quan…
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="space-y-3 p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-foreground">Pipeline tuyển dụng</p>
              <span className="text-[11px] text-muted-foreground">{candidates.length} ứng viên</span>
            </div>
            <div className="space-y-2">
              {funnel.map((item) => (
                <div key={item.stage} className="flex items-center gap-2">
                  <span className="w-[104px] shrink-0 text-[11px] text-muted-foreground">{item.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/60">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-primary/85 px-1.5 text-[11px] font-semibold text-primary-foreground transition-all"
                      style={{ width: `${Math.max((item.count / funnelMax) * 100, item.count > 0 ? 8 : 0)}%` }}
                    >
                      {item.count > 0 ? item.count : ""}
                    </div>
                  </div>
                  <span className="tabular w-6 shrink-0 text-right text-[11px] text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>Đã nhận việc: <span className="font-semibold text-success">{started}</span></span>
              <span>Đã dừng: <span className="font-semibold text-destructive">{rejected}</span></span>
              <span>Tổng vị trí: {jobs.length}</span>
            </div>
          </Card>

          <Card className="space-y-2.5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-foreground">Phỏng vấn sắp tới</p>
              <Link to="/tuyen-dung/lich-hen" className="text-[11px] font-medium text-primary hover:underline">
                Xem lịch
              </Link>
            </div>
            {upcomingInterviews.length === 0 ? (
              <p className="py-6 text-center text-[11.5px] text-muted-foreground">Chưa có lịch phỏng vấn.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {upcomingInterviews.slice(0, 5).map((interview) => {
                  const candidate = candidateById.get(interview.candidate_id);
                  return (
                    <li key={interview.id} className="py-2">
                      <Link
                        to={candidate ? `/tuyen-dung/ung-vien/${candidate.id}` : "/tuyen-dung/lich-hen"}
                        className="text-[11.5px] font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {candidate?.full_name ?? "Ứng viên"}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(interview.scheduled_at)} · {interview.duration_minutes} phút
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {interview.interviewer ?? INTERVIEW_STATUS_LABELS[interview.status] ?? "Chưa có người phỏng vấn"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="space-y-2.5 p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-foreground">Chiến dịch đang mở</p>
              <Link to="/tuyen-dung/chien-dich" className="text-[11px] font-medium text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
            {openCampaigns.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11.5px] text-muted-foreground">Chưa có chiến dịch đang tuyển.</p>
                <Button asChild variant="outline" size="sm" className="mt-2 h-8 gap-1 text-[11.5px]">
                  <Link to="/tuyen-dung/chien-dich">
                    Tạo chiến dịch <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {openCampaigns.slice(0, 5).map((campaign) => {
                  const list = candidates.filter((row) => row.campaign_id === campaign.id);
                  const hired = list.filter(
                    (row) => row.status === "offer_accepted" || row.status === "started",
                  ).length;
                  const countdown = campaignCountdown(campaign);
                  return (
                    <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-foreground">{campaign.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {list.length} ứng viên · {hired}/{campaign.headcount} đã nhận
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={countdown.tone}>{countdown.label}</Badge>
                        <Badge variant="outline">{CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="space-y-2.5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-foreground">Ứng viên mới nhất</p>
            </div>
            {recentCandidates.length === 0 ? (
              <p className="py-6 text-center text-[11.5px] text-muted-foreground">Chưa có ứng viên.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {recentCandidates.map((candidate) => (
                  <li key={candidate.id} className="py-2">
                    <Link
                      to={`/tuyen-dung/ung-vien/${candidate.id}`}
                      className="text-[11.5px] font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {candidate.full_name}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {candidate.position_applied ?? "Chưa chọn vị trí"}
                      {candidate.campaign_id ? ` · ${campaignById.get(candidate.campaign_id)?.title ?? ""}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <CandidateStatusBadge status={candidate.status} />
                      <span className="text-[11px] text-muted-foreground">{formatDay(candidate.applied_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </RecruitmentShell>
  );
};

export default RecruitmentOverview;
