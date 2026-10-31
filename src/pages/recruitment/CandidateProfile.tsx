import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  Upload,
  UserRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { buildCandidateFields } from "@/components/recruitment/candidate-fields";
import { CandidatePipeline } from "@/components/recruitment/pipeline-steps";
import { CandidateStatusBadge } from "@/components/recruitment/status-badge";
import { SendFormDialog } from "@/components/recruitment/send-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { displayName, useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { currency } from "@/lib/format";
import { downloadOfferLetter, printOfferLetter } from "@/lib/offer-letter";
import {
  CANDIDATE_SOURCE_LABELS,
  EVALUATION_RECOMMENDATION_LABELS,
  GENDER_LABELS,
  INTERVIEW_MODE_LABELS,
  INTERVIEW_STATUS_LABELS,
  MANUAL_CANDIDATE_STATUSES,
  OFFER_STATUS_LABELS,
  candidateStageIndex,
  createRow,
  deleteCandidateCvFile,
  deleteRow,
  ensureOnboardingRecord,
  evaluationAverage,
  formatDateTime,
  formatDay,
  getCandidate,
  getCandidateCvUrl,
  listRows,
  statusMeta,
  updateRow,
  uploadCandidateCv,
  type Campaign,
  type Candidate,
  type CandidateApplication,
  type CandidateComment,
  type CandidateEmail,
  type CandidateEvaluation,
  type CandidateOffer,
  type Interview,
  type OnboardingRecord,
} from "@/lib/recruitment";
import { cn, getErrorMessage } from "@/lib/utils";

const scoreOptions = [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} điểm` }));

const offerTone = (status: string) =>
  status === "accepted" ? "success" : status === "declined" ? "destructive" : status === "sent" ? "info" : "muted";

const interviewTone = (status: string) =>
  status === "completed"
    ? "success"
    : status === "cancelled"
      ? "muted"
      : status === "no_show"
        ? "destructive"
        : "info";

const CandidateProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompany, can, canManageModule } = useCompany();
  const { user, profile } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("recruitment");
  const authorName = displayName(profile, user?.email);

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [evaluations, setEvaluations] = useState<CandidateEvaluation[]>([]);
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [comments, setComments] = useState<CandidateComment[]>([]);
  const [emails, setEmails] = useState<CandidateEmail[]>([]);
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<CandidateOffer | null>(null);
  const [sendFormOpen, setSendFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    CandidateEvaluation | CandidateComment | Interview | CandidateOffer | null
  >(null);
  const [deleteKind, setDeleteKind] = useState<"evaluation" | "comment" | "interview" | "offer" | null>(null);
  const [deleteCandidateOpen, setDeleteCandidateOpen] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!companyId || !id) return;
    try {
      const [
        candidateRow,
        campaignRows,
        interviewRows,
        evaluationRows,
        offerRows,
        commentRows,
        emailRows,
        applicationRows,
        onboardingRows,
      ] = await Promise.all([
        getCandidate(id),
        listRows<Campaign>("recruitment_campaigns", companyId, "created_at"),
        listRows<Interview>("candidate_interviews", companyId, "scheduled_at", true),
        listRows<CandidateEvaluation>("candidate_evaluations", companyId, "created_at"),
        listRows<CandidateOffer>("candidate_offers", companyId, "created_at"),
        listRows<CandidateComment>("candidate_comments", companyId, "created_at"),
        listRows<CandidateEmail>("candidate_emails", companyId, "sent_at"),
        listRows<CandidateApplication>("candidate_applications", companyId, "applied_at"),
        listRows<OnboardingRecord>("onboarding_records", companyId, "created_at"),
      ]);

      if (!candidateRow || candidateRow.company_id !== companyId) {
        setCandidate(null);
        return;
      }
      setCandidate(candidateRow);
      setCampaigns(campaignRows);
      setInterviews(interviewRows.filter((row) => row.candidate_id === candidateRow.id));
      setEvaluations(evaluationRows.filter((row) => row.candidate_id === candidateRow.id));
      setOffers(offerRows.filter((row) => row.candidate_id === candidateRow.id));
      setComments(commentRows.filter((row) => row.candidate_id === candidateRow.id));
      setEmails(emailRows.filter((row) => row.candidate_id === candidateRow.id));
      setApplications(applicationRows.filter((row) => row.candidate_id === candidateRow.id));
      const onboarding = onboardingRows.find(
        (row) => row.candidate_id === candidateRow.id && row.status !== "cancelled",
      );
      setOnboardingId(onboarding?.id ?? null);
    } catch (error) {
      toast.error("Không tải được hồ sơ ứng viên", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const campaignById = useMemo(() => new Map(campaigns.map((row) => [row.id, row])), [campaigns]);
  const latestOffer = offers[0] ?? null;

  const editFields = useMemo(
    () => buildCandidateFields(campaigns).filter((field) => field.name !== "status"),
    [campaigns],
  );

  const evaluationFields: FieldDef[] = [
    { name: "technical_score", label: "Chuyên môn", type: "select", options: scoreOptions },
    { name: "communication_score", label: "Giao tiếp", type: "select", options: scoreOptions },
    { name: "culture_score", label: "Phù hợp văn hoá", type: "select", options: scoreOptions },
    { name: "attitude_score", label: "Thái độ", type: "select", options: scoreOptions },
    {
      name: "recommendation",
      label: "Đề xuất",
      type: "select",
      required: true,
      options: Object.entries(EVALUATION_RECOMMENDATION_LABELS).map(([value, label]) => ({ value, label })),
    },
    { name: "strengths", label: "Điểm mạnh", type: "textarea" },
    { name: "weaknesses", label: "Điểm cần cải thiện", type: "textarea" },
    { name: "note", label: "Ghi chú", type: "textarea" },
  ];

  const interviewFields: FieldDef[] = [
    { name: "scheduled_at", label: "Thời gian phỏng vấn", type: "datetime", required: true },
    { name: "duration_minutes", label: "Thời lượng (phút)", type: "number", placeholder: "60" },
    {
      name: "mode",
      label: "Hình thức",
      type: "select",
      options: Object.entries(INTERVIEW_MODE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      name: "status",
      label: "Trạng thái",
      type: "select",
      options: Object.entries(INTERVIEW_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
    { name: "location", label: "Địa điểm / liên kết", placeholder: "Phòng họp 2 hoặc link Google Meet" },
    { name: "interviewer", label: "Người phỏng vấn", placeholder: "Trần Quốc Bảo" },
    { name: "note", label: "Ghi chú", type: "textarea" },
  ];

  const offerFields: FieldDef[] = [
    { name: "position", label: "Vị trí", placeholder: candidate?.position_applied ?? "Backend Engineer" },
    { name: "department", label: "Phòng ban", placeholder: "Kỹ thuật" },
    { name: "base_salary", label: "Lương cơ bản", type: "currency" },
    { name: "allowance", label: "Phụ cấp", type: "currency" },
    { name: "onboarding_date", label: "Ngày nhận việc", type: "date" },
    { name: "response_deadline", label: "Hạn phản hồi", type: "date" },
    { name: "work_location", label: "Địa điểm làm việc", placeholder: "Hà Nội" },
    {
      name: "status",
      label: "Trạng thái offer",
      type: "select",
      options: Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
    { name: "other_benefits", label: "Quyền lợi khác", type: "textarea" },
    { name: "note", label: "Ghi chú", type: "textarea" },
  ];

  const rejectFields: FieldDef[] = [
    { name: "rejection_reason", label: "Lý do loại", type: "textarea", span: 2, required: true },
  ];

  const syncStatus = async (next: string, extra: Record<string, unknown> = {}) => {
    if (!candidate) return;
    setStatusBusy(true);
    try {
      await updateRow("candidates", candidate.id, { status: next, ...extra });
      toast.success(`Đã chuyển trạng thái: ${statusMeta(next).label}`);
      await load();
    } catch (error) {
      toast.error("Không cập nhật được trạng thái", { description: getErrorMessage(error) });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleStatusChange = (value: string) => {
    if (!candidate) return;
    if (value === "rejected") {
      setRejectOpen(true);
      return;
    }
    void syncStatus(value);
  };

  const handleEditCandidate = async (values: Record<string, string | number | null>) => {
    if (!candidate) throw new Error("Không tìm thấy ứng viên.");
    try {
      await updateRow("candidates", candidate.id, values);
      toast.success("Đã cập nhật hồ sơ ứng viên");
      setEditOpen(false);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const handleReject = async (values: Record<string, string | number | null>) => {
    if (!candidate) throw new Error("Không tìm thấy ứng viên.");
    try {
      await updateRow("candidates", candidate.id, {
        status: "rejected",
        rejection_reason: values.rejection_reason ?? null,
      });
      toast.success("Đã loại ứng viên");
      setRejectOpen(false);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const handleUploadCv = async (file?: File) => {
    if (!candidate || !file) return;
    setCvBusy(true);
    try {
      const path = await uploadCandidateCv({ companyId: candidate.company_id, candidateId: candidate.id, file });
      if (candidate.cv_path) await deleteCandidateCvFile(candidate.cv_path);
      await updateRow("candidates", candidate.id, { cv_path: path, cv_file_name: file.name });
      toast.success("Đã tải CV lên");
      await load();
    } catch (error) {
      toast.error("Không tải được CV", { description: getErrorMessage(error) });
    } finally {
      setCvBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openCv = async () => {
    if (!candidate?.cv_path) return;
    try {
      const url = await getCandidateCvUrl(candidate.cv_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Không mở được CV", { description: getErrorMessage(error) });
    }
  };

  const removeCv = async () => {
    if (!candidate?.cv_path) return;
    setCvBusy(true);
    try {
      await deleteCandidateCvFile(candidate.cv_path);
      await updateRow("candidates", candidate.id, { cv_path: null, cv_file_name: null });
      toast.success("Đã xoá CV");
      await load();
    } catch (error) {
      toast.error("Không xoá được CV", { description: getErrorMessage(error) });
    } finally {
      setCvBusy(false);
    }
  };

  const handleSaveEvaluation = async (values: Record<string, string | number | null>) => {
    if (!candidate) throw new Error("Không tìm thấy ứng viên.");
    try {
      await createRow("candidate_evaluations", {
        company_id: candidate.company_id,
        candidate_id: candidate.id,
        reviewer_id: user?.id ?? null,
        reviewer_name: authorName,
        technical_score: values.technical_score ? Number(values.technical_score) : null,
        communication_score: values.communication_score ? Number(values.communication_score) : null,
        culture_score: values.culture_score ? Number(values.culture_score) : null,
        attitude_score: values.attitude_score ? Number(values.attitude_score) : null,
        recommendation: values.recommendation ?? "hold",
        strengths: values.strengths ?? null,
        weaknesses: values.weaknesses ?? null,
        note: values.note ?? null,
      });
      toast.success("Đã lưu đánh giá");
      setEvaluationOpen(false);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const handleSaveInterview = async (values: Record<string, string | number | null>) => {
    if (!candidate) throw new Error("Không tìm thấy ứng viên.");
    const payload = {
      ...values,
      candidate_id: candidate.id,
      status: values.status ?? "scheduled",
      mode: values.mode ?? "onsite",
      duration_minutes: Number(values.duration_minutes ?? 60) || 60,
    };
    try {
      if (editingInterview) {
        await updateRow("candidate_interviews", editingInterview.id, payload);
        toast.success("Đã cập nhật lịch phỏng vấn");
      } else {
        await createRow("candidate_interviews", {
          ...payload,
          company_id: candidate.company_id,
          created_by: user?.id ?? null,
        });
        try {
          await createRow("candidate_emails", {
            company_id: candidate.company_id,
            candidate_id: candidate.id,
            subject: `Lịch phỏng vấn ${candidate.position_applied ?? ""}`.trim(),
            sent_to: candidate.email,
            template: "interview_invite",
            status: "sent",
            body: `Thời gian: ${formatDateTime(String(values.scheduled_at ?? ""))}`,
          });
        } catch {
          // Ghi lịch sử email là tuỳ chọn; không chặn việc tạo lịch phỏng vấn.
        }
        toast.success("Đã tạo lịch phỏng vấn");
      }
      const interviewStatus = String(values.status ?? "scheduled");
      const stage = candidateStageIndex(candidate.status);
      let next: string | null = null;
      if (interviewStatus === "scheduled" && stage >= 0 && stage < 3) next = "interview_scheduled";
      if (interviewStatus === "completed" && stage >= 0 && stage < 4) next = "interview_attended";
      if (interviewStatus === "no_show" && stage >= 0 && stage < 5) next = "interview_no_show";
      if (interviewStatus === "cancelled" && stage >= 0 && stage <= 3) next = "interview_declined";
      if (next && next !== candidate.status) await updateRow("candidates", candidate.id, { status: next });
      setInterviewOpen(false);
      setEditingInterview(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const syncOfferToCandidate = async (offer: CandidateOffer) => {
    if (!candidate) return;
    if (offer.status === "sent") {
      await updateRow("candidates", candidate.id, { status: "offer_sent" });
    }
    if (offer.status === "declined") {
      await updateRow("candidates", candidate.id, { status: "offer_declined" });
    }
    if (offer.status === "accepted") {
      await updateRow("candidates", candidate.id, {
        status: "offer_accepted",
        hired_salary: offer.base_salary,
        onboarding_date: offer.onboarding_date,
        work_location: offer.work_location,
        position_applied: offer.position ?? candidate.position_applied,
      });
      try {
        const recordId = await ensureOnboardingRecord({
          ...candidate,
          status: "offer_accepted",
          hired_salary: offer.base_salary,
          onboarding_date: offer.onboarding_date,
          work_location: offer.work_location,
          position_applied: offer.position ?? candidate.position_applied,
        });
        if (recordId) setOnboardingId(recordId);
      } catch {
        // Hồ sơ hội nhập có thể đã tồn tại; không chặn lưu offer.
      }
    }
  };

  const handleSaveOffer = async (values: Record<string, string | number | null>) => {
    if (!candidate) throw new Error("Không tìm thấy ứng viên.");
    const offerPayload = { ...values, status: values.status ?? "draft" };
    try {
      if (editingOffer) {
        await updateRow("candidate_offers", editingOffer.id, offerPayload);
        await syncOfferToCandidate({ ...editingOffer, ...offerPayload } as CandidateOffer);
      } else {
        const offerId = await createRow("candidate_offers", {
          ...offerPayload,
          company_id: candidate.company_id,
          candidate_id: candidate.id,
          created_by: user?.id ?? null,
        });
        await syncOfferToCandidate({
          id: offerId,
          company_id: candidate.company_id,
          candidate_id: candidate.id,
          position: (values.position as string) ?? null,
          department: (values.department as string) ?? null,
          base_salary: values.base_salary ? Number(values.base_salary) : null,
          allowance: values.allowance ? Number(values.allowance) : null,
          other_benefits: (values.other_benefits as string) ?? null,
          onboarding_date: (values.onboarding_date as string) ?? null,
          work_location: (values.work_location as string) ?? null,
          response_deadline: (values.response_deadline as string) ?? null,
          status: (values.status as string) ?? "draft",
          note: (values.note as string) ?? null,
          created_at: new Date().toISOString(),
        });
      }
      toast.success("Đã lưu offer");
      setOfferOpen(false);
      setEditingOffer(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const quickOfferStatus = async (offer: CandidateOffer, status: string) => {
    try {
      await updateRow("candidate_offers", offer.id, { status });
      await syncOfferToCandidate({ ...offer, status });
      toast.success(`Offer: ${OFFER_STATUS_LABELS[status] ?? status}`);
      await load();
    } catch (error) {
      toast.error("Không cập nhật được offer", { description: getErrorMessage(error) });
    }
  };

  const postComment = async () => {
    if (!candidate || !commentText.trim()) return;
    setPosting(true);
    try {
      await createRow("candidate_comments", {
        company_id: candidate.company_id,
        candidate_id: candidate.id,
        author_id: user?.id ?? null,
        author_name: authorName,
        content: commentText.trim(),
      });
      setCommentText("");
      await load();
    } catch (error) {
      toast.error("Không gửi được trao đổi", { description: getErrorMessage(error) });
    } finally {
      setPosting(false);
    }
  };

  const confirmDeleteRecord = async () => {
    if (!pendingDelete || !deleteKind) return;
    const table =
      deleteKind === "evaluation"
        ? "candidate_evaluations"
        : deleteKind === "comment"
          ? "candidate_comments"
          : deleteKind === "interview"
            ? "candidate_interviews"
            : "candidate_offers";
    try {
      await deleteRow(table, pendingDelete.id);
      toast.success("Đã xoá");
      setPendingDelete(null);
      setDeleteKind(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  const removeCandidate = async () => {
    if (!candidate) return;
    try {
      if (candidate.cv_path) await deleteCandidateCvFile(candidate.cv_path);
      await deleteRow("candidates", candidate.id);
      toast.success("Đã xoá ứng viên");
      navigate("/tuyen-dung/ung-vien");
    } catch (error) {
      toast.error("Không xoá được ứng viên", { description: getErrorMessage(error) });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Card className="flex items-center justify-center gap-2 p-20 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải hồ sơ ứng viên…
        </Card>
      </AppShell>
    );
  }

  if (!candidate) {
    return (
      <AppShell>
        <Card className="p-12 text-center">
          <UserRound className="mx-auto h-7 w-7 text-muted-foreground/70" />
          <p className="mt-3 font-display text-[18px] font-semibold text-foreground">Không tìm thấy ứng viên</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Hồ sơ có thể đã bị xoá hoặc thuộc công ty khác.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/tuyen-dung/ung-vien")}>
            Về danh sách ứng viên
          </Button>
        </Card>
      </AppShell>
    );
  }

  const campaign = candidate.campaign_id ? campaignById.get(candidate.campaign_id) ?? null : null;
  const scored = evaluations.filter((item) => evaluationAverage(item) !== null);
  const average = scored.length
    ? Math.round((scored.reduce((sum, item) => sum + (evaluationAverage(item) ?? 0), 0) / scored.length) * 10) / 10
    : null;

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <Link
          to="/tuyen-dung/ung-vien"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Danh sách ứng viên
        </Link>
      </div>

      <PageHeader
        eyebrow="Hồ sơ ứng viên"
        title={candidate.full_name}
        description={`${candidate.position_applied ?? "Chưa chọn vị trí"}${
          campaign ? ` · ${campaign.title}` : ""
        } · Ứng tuyển ${formatDay(candidate.applied_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={MANUAL_CANDIDATE_STATUSES.some((status) => status.value === candidate.status) ? candidate.status : ""}
              onValueChange={handleStatusChange}
              disabled={!canManage || statusBusy}
            >
              <SelectTrigger className="h-9 w-[180px] text-[12.5px]" aria-label="Đổi trạng thái ứng viên">
                <SelectValue placeholder="Cập nhật trạng thái" />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_CANDIDATE_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Thao tác hồ sơ">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px]">
                  <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Sửa hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => setSendFormOpen(true)}>
                    <Link2 className="h-3.5 w-3.5" /> Gửi biểu mẫu hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => setRejectOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Loại ứng viên
                  </DropdownMenuItem>
                  {candidate.status === "offer_accepted" && (
                    <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => void syncStatus("started")}>
                      <Check className="h-3.5 w-3.5" /> Đánh dấu đã nhận việc
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                    onSelect={() => setDeleteCandidateOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xoá ứng viên
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CandidateStatusBadge status={candidate.status} />
              {candidate.source && (
                <Badge variant="outline">{CANDIDATE_SOURCE_LABELS[candidate.source] ?? candidate.source}</Badge>
              )}
              {candidate.form_token && (
                <Badge variant="muted">
                  {candidate.form_submitted_at ? "Đã khai hồ sơ" : "Chưa khai hồ sơ"}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              {candidate.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {candidate.email}
                </span>
              )}
              {candidate.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {candidate.phone}
                </span>
              )}
              {campaign && (
                <span className="inline-flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" /> {campaign.title}
                </span>
              )}
              {candidate.employee_id && (
                <Link
                  to={`/employees/${candidate.employee_id}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <UserRound className="h-3 w-3" /> Hồ sơ nhân sự
                </Link>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Điểm đánh giá TB</p>
              <p className="tabular text-[16px] font-semibold text-foreground">
                {average !== null ? average.toFixed(1) : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Lương mong muốn</p>
              <p className="tabular text-[16px] font-semibold text-foreground">
                {candidate.expected_salary ? currency(Number(candidate.expected_salary), true) : "—"}
              </p>
            </div>
          </div>
        </div>

        <CandidatePipeline status={candidate.status} />
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-[12px]">
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="text-[12px]">
            Đánh giá ({evaluations.length})
          </TabsTrigger>
          <TabsTrigger value="interviews" className="text-[12px]">
            Phỏng vấn ({interviews.length})
          </TabsTrigger>
          <TabsTrigger value="offer" className="text-[12px]">
            Offer {latestOffer ? `(${OFFER_STATUS_LABELS[latestOffer.status] ?? latestOffer.status})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-[12px]">
            Trao đổi ({comments.length + emails.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="space-y-3 p-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold text-foreground">Thông tin ứng viên</p>
                {canManage && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3 w-3" /> Sửa
                  </Button>
                )}
              </div>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {[
                  ["Ngày sinh", candidate.date_of_birth ? formatDay(candidate.date_of_birth) : "—"],
                  ["Giới tính", candidate.gender ? GENDER_LABELS[candidate.gender] ?? candidate.gender : "—"],
                  ["Học vấn", candidate.education ?? "—"],
                  [
                    "Kinh nghiệm",
                    candidate.experience_years ? `${candidate.experience_years} năm` : "—",
                  ],
                  ["Lương hiện tại", candidate.current_salary ? currency(Number(candidate.current_salary)) : "—"],
                  ["Lương mong muốn", candidate.expected_salary ? currency(Number(candidate.expected_salary)) : "—"],
                  ["Địa chỉ", candidate.address ?? "—"],
                  ["Địa điểm làm việc", candidate.work_location ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-[12.5px] text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              {candidate.note && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Ghi chú</p>
                  <p className="mt-1 whitespace-pre-line text-[12px] leading-6 text-foreground">{candidate.note}</p>
                </div>
              )}
              {candidate.rejection_reason && (
                <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                  Lý do loại: {candidate.rejection_reason}
                </p>
              )}
            </Card>

            <Card className="space-y-3 p-4">
              <p className="text-[12.5px] font-semibold text-foreground">CV đính kèm</p>
              {candidate.cv_path ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{candidate.cv_file_name ?? "CV ứng viên"}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-[11.5px]" onClick={() => void openCv()}>
                      <ExternalLink className="h-3 w-3" /> Mở CV
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-[11.5px] text-destructive"
                        onClick={() => void removeCv()}
                        disabled={cvBusy}
                      >
                        <Trash2 className="h-3 w-3" /> Xoá
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11.5px] leading-5 text-muted-foreground">Chưa có CV đính kèm.</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(event) => void handleUploadCv(event.target.files?.[0])}
              />
              {canManage && (
                <Button
                  variant="outline"
                  className="h-9 w-full gap-1.5 text-[12px]"
                  disabled={cvBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {cvBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {candidate.cv_path ? "Thay CV" : "Tải CV lên"}
                </Button>
              )}

              <div className="border-t border-border/60 pt-3">
                <p className="text-[12.5px] font-semibold text-foreground">Biểu mẫu ứng tuyển</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {candidate.form_submitted_at
                    ? `Ứng viên đã khai hồ sơ lúc ${formatDateTime(candidate.form_submitted_at)}.`
                    : "Gửi liên kết để ứng viên tự khai thông tin."}
                </p>
                {canManage && (
                  <Button
                    variant="outline"
                    className="mt-2 h-8 gap-1.5 text-[11.5px]"
                    onClick={() => setSendFormOpen(true)}
                  >
                    <Link2 className="h-3 w-3" /> {candidate.form_submitted_at ? "Gửi lại liên kết" : "Gửi liên kết"}
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {applications.length > 0 && (
            <Card className="p-4">
              <p className="text-[12.5px] font-semibold text-foreground">Lịch sử ứng tuyển</p>
              <ul className="mt-2 divide-y divide-border/50">
                {applications.map((application) => (
                  <li key={application.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-foreground">
                        {campaignById.get(application.campaign_id)?.title ?? "Chiến dịch đã xoá"}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {formatDateTime(application.applied_at)}
                        {application.note ? ` · ${application.note}` : ""}
                      </p>
                    </div>
                    <CandidateStatusBadge status={application.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-muted-foreground">
              {evaluations.length} đánh giá · điểm trung bình {average ? average.toFixed(1) : "—"}/5
            </p>
            <Button className="h-8 gap-1.5 text-[12px]" onClick={() => setEvaluationOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Thêm đánh giá
            </Button>
          </div>
          {evaluations.length === 0 ? (
            <Card className="p-10 text-center">
              <Star className="mx-auto h-6 w-6 text-muted-foreground/70" />
              <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có đánh giá</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Ghi nhận điểm mạnh và đề xuất sau phỏng vấn.</p>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {evaluations.map((evaluation) => {
                const score = evaluationAverage(evaluation);
                return (
                  <Card key={evaluation.id} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[12.5px] font-semibold text-foreground">
                          {evaluation.reviewer_name ?? "Người đánh giá"}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">{formatDateTime(evaluation.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            evaluation.recommendation === "advance"
                              ? "success"
                              : evaluation.recommendation === "reject"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {EVALUATION_RECOMMENDATION_LABELS[evaluation.recommendation] ?? evaluation.recommendation}
                        </Badge>
                        {(canManage || evaluation.reviewer_id === user?.id) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Xoá đánh giá"
                            onClick={() => {
                              setPendingDelete(evaluation);
                              setDeleteKind("evaluation");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 rounded-md border border-border/60 bg-muted/20 p-2 text-center">
                      {[
                        ["Chuyên môn", evaluation.technical_score],
                        ["Giao tiếp", evaluation.communication_score],
                        ["Văn hoá", evaluation.culture_score],
                        ["Thái độ", evaluation.attitude_score],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
                          <p className="tabular text-[13px] font-semibold text-foreground">{value ?? "—"}</p>
                        </div>
                      ))}
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground">TB</p>
                        <p className="tabular text-[13px] font-semibold text-primary">{score ?? "—"}</p>
                      </div>
                    </div>
                    {evaluation.strengths && (
                      <p className="text-[11.5px] leading-5 text-foreground">
                        <span className="font-semibold">Điểm mạnh: </span>
                        {evaluation.strengths}
                      </p>
                    )}
                    {evaluation.weaknesses && (
                      <p className="text-[11.5px] leading-5 text-muted-foreground">
                        <span className="font-semibold text-foreground">Cần cải thiện: </span>
                        {evaluation.weaknesses}
                      </p>
                    )}
                    {evaluation.note && (
                      <p className="text-[11px] leading-5 text-muted-foreground">{evaluation.note}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interviews" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-muted-foreground">{interviews.length} buổi phỏng vấn</p>
            {canManage && (
              <Button
                className="h-8 gap-1.5 text-[12px]"
                onClick={() => {
                  setEditingInterview(null);
                  setInterviewOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Đặt lịch
              </Button>
            )}
          </div>
          {interviews.length === 0 ? (
            <Card className="p-10 text-center">
              <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground/70" />
              <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có lịch phỏng vấn</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Đặt lịch để theo dõi kết quả từng vòng.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-border/50">
                {interviews.map((interview) => (
                  <li key={interview.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-medium text-foreground">
                        {formatDateTime(interview.scheduled_at)}
                        <Badge variant={interviewTone(interview.status)}>
                          {INTERVIEW_STATUS_LABELS[interview.status] ?? interview.status}
                        </Badge>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3 w-3" /> {INTERVIEW_MODE_LABELS[interview.mode] ?? interview.mode}
                        </span>
                        <span>· {interview.duration_minutes} phút</span>
                        {interview.interviewer && <span>· {interview.interviewer}</span>}
                        {interview.location && <span>· {interview.location}</span>}
                      </p>
                      {interview.note && <p className="mt-1 text-[11px] text-muted-foreground">{interview.note}</p>}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Sửa lịch phỏng vấn"
                          onClick={() => {
                            setEditingInterview(interview);
                            setInterviewOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Xoá lịch phỏng vấn"
                          onClick={() => {
                            setPendingDelete(interview);
                            setDeleteKind("interview");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="offer" className="space-y-3">
          {latestOffer ? (
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {latestOffer.position ?? candidate.position_applied ?? "Offer làm việc"}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Tạo {formatDay(latestOffer.created_at)}
                    {latestOffer.department ? ` · ${latestOffer.department}` : ""}
                  </p>
                </div>
                <Badge variant={offerTone(latestOffer.status)}>
                  {OFFER_STATUS_LABELS[latestOffer.status] ?? latestOffer.status}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Lương cơ bản</p>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-foreground">
                    {latestOffer.base_salary ? currency(Number(latestOffer.base_salary)) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Phụ cấp</p>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-foreground">
                    {latestOffer.allowance ? currency(Number(latestOffer.allowance)) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Ngày nhận việc</p>
                  <p className="mt-0.5 text-[14px] font-semibold text-foreground">
                    {latestOffer.onboarding_date ? formatDay(latestOffer.onboarding_date) : "—"}
                  </p>
                </div>
              </div>

              {(latestOffer.work_location || latestOffer.response_deadline) && (
                <p className="text-[11px] text-muted-foreground">
                  {latestOffer.work_location ? `Địa điểm: ${latestOffer.work_location}` : ""}
                  {latestOffer.work_location && latestOffer.response_deadline ? " · " : ""}
                  {latestOffer.response_deadline
                    ? `Hạn phản hồi: ${formatDay(latestOffer.response_deadline)}`
                    : ""}
                </p>
              )}
              {latestOffer.other_benefits && (
                <p className="whitespace-pre-line text-[11.5px] leading-5 text-muted-foreground">
                  {latestOffer.other_benefits}
                </p>
              )}
              {latestOffer.note && (
                <p className="text-[11px] leading-5 text-muted-foreground">{latestOffer.note}</p>
              )}

              {onboardingId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/25 bg-success-subtle px-3 py-2">
                  <p className="text-[11.5px] text-success">Đã tạo hồ sơ hội nhập cho ứng viên.</p>
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-[11.5px]">
                    <Link to={`/hoi-nhap?record=${onboardingId}`}>
                      Mở hội nhập <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-[11.5px]"
                  onClick={() => printOfferLetter(latestOffer, candidate, activeCompany?.name ?? "Công ty")}
                >
                  <FileText className="h-3 w-3" /> In thư mời
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-[11.5px]"
                  onClick={() => downloadOfferLetter(latestOffer, candidate, activeCompany?.name ?? "Công ty")}
                >
                  <ExternalLink className="h-3 w-3" /> Tải thư mời
                </Button>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-[11.5px]"
                    onClick={() => {
                      setEditingOffer(latestOffer);
                      setOfferOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Sửa offer
                  </Button>
                )}
                {canManage && latestOffer.status === "draft" && (
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-[11.5px]"
                    onClick={() => void quickOfferStatus(latestOffer, "sent")}
                  >
                    Gửi offer
                  </Button>
                )}
                {canManage && latestOffer.status === "sent" && (
                  <>
                    <Button
                      size="sm"
                      className="h-8 gap-1 text-[11.5px]"
                      onClick={() => void quickOfferStatus(latestOffer, "accepted")}
                    >
                      <Check className="h-3 w-3" /> Ứng viên đồng ý
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-[11.5px] text-destructive"
                      onClick={() => void quickOfferStatus(latestOffer, "declined")}
                    >
                      Từ chối offer
                    </Button>
                  </>
                )}
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-[11.5px] text-destructive"
                    onClick={() => {
                      setPendingDelete(latestOffer);
                      setDeleteKind("offer");
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Xoá offer
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center">
              <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground/70" />
              <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có offer</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Tạo offer sau khi ứng viên đạt vòng phỏng vấn.
              </p>
              {canManage && (
                <Button
                  className="mt-3 h-9 gap-1.5 text-[12.5px]"
                  onClick={() => {
                    setEditingOffer(null);
                    setOfferOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Tạo offer
                </Button>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          <Card className="p-4">
            <p className="text-[12.5px] font-semibold text-foreground">Trao đổi nội bộ</p>
            <div className="mt-2 space-y-2">
              <Textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                rows={3}
                placeholder="Ghi chú về ứng viên, kết quả liên hệ, lưu ý cho vòng sau…"
                className="text-[12.5px]"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-[11.5px]"
                  disabled={posting || !commentText.trim()}
                  onClick={() => void postComment()}
                >
                  {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  Gửi trao đổi
                </Button>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {comments.length === 0 && (
                <li className="py-4 text-center text-[11.5px] text-muted-foreground">Chưa có trao đổi nào.</li>
              )}
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-border/60 bg-muted/15 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11.5px] font-semibold text-foreground">
                      {comment.author_name ?? "Thành viên"}
                      <span className="ml-2 font-normal text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                    </p>
                    {(comment.author_id === user?.id || canManage) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Xoá trao đổi"
                        onClick={() => {
                          setPendingDelete(comment);
                          setDeleteKind("comment");
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[12px] leading-5 text-foreground">{comment.content}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <p className="text-[12.5px] font-semibold text-foreground">Email đã ghi nhận</p>
            <ul className="mt-2 divide-y divide-border/50">
              {emails.length === 0 && (
                <li className="py-4 text-center text-[11.5px] text-muted-foreground">Chưa có email nào.</li>
              )}
              {emails.map((email) => (
                <li key={email.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-foreground">{email.subject}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {email.sent_to ?? "Chưa có người nhận"} · {formatDateTime(email.sent_at)}
                    </p>
                  </div>
                  <Badge variant="muted">{email.template ?? email.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>

      <FieldDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Sửa hồ sơ ứng viên"
        description="Cập nhật thông tin liên hệ, vị trí và lương mong muốn."
        fields={editFields}
        initial={candidate}
        submitLabel="Lưu thay đổi"
        onSubmit={handleEditCandidate}
      />

      <FieldDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Loại ứng viên"
        description="Trạng thái sẽ chuyển sang “Loại” và lưu lý do để đối soát."
        fields={rejectFields}
        initial={{ rejection_reason: candidate.rejection_reason ?? "" }}
        submitLabel="Xác nhận loại"
        onSubmit={handleReject}
      />

      <FieldDialog
        open={evaluationOpen}
        onOpenChange={setEvaluationOpen}
        title="Thêm đánh giá"
        description="Chấm điểm theo thang 1–5 và ghi lại đề xuất cho vòng tiếp theo."
        fields={evaluationFields}
        initial={{ recommendation: "hold" }}
        submitLabel="Lưu đánh giá"
        onSubmit={handleSaveEvaluation}
      />

      <FieldDialog
        open={interviewOpen}
        onOpenChange={(open) => {
          setInterviewOpen(open);
          if (!open) setEditingInterview(null);
        }}
        title={editingInterview ? "Sửa lịch phỏng vấn" : "Đặt lịch phỏng vấn"}
        description="Lưu lịch sẽ cập nhật trạng thái ứng viên theo kết quả buổi phỏng vấn."
        fields={interviewFields}
        initial={editingInterview ?? { duration_minutes: 60, mode: "onsite", status: "scheduled" }}
        submitLabel={editingInterview ? "Lưu thay đổi" : "Tạo lịch hẹn"}
        onSubmit={handleSaveInterview}
      />

      <FieldDialog
        open={offerOpen}
        onOpenChange={(open) => {
          setOfferOpen(open);
          if (!open) setEditingOffer(null);
        }}
        title={editingOffer ? "Sửa offer" : "Tạo offer"}
        description="Offer đồng ý sẽ tự tạo hồ sơ hội nhập và cập nhật trạng thái ứng viên."
        fields={offerFields}
        initial={
          editingOffer ?? {
            position: candidate.position_applied ?? "",
            department: campaign?.department ?? "",
            onboarding_date: candidate.onboarding_date ?? "",
            work_location: candidate.work_location ?? "",
            status: "draft",
          }
        }
        submitLabel={editingOffer ? "Lưu offer" : "Tạo offer"}
        onSubmit={handleSaveOffer}
      />

      <SendFormDialog
        candidate={candidate}
        open={sendFormOpen}
        onOpenChange={setSendFormOpen}
        onSent={() => void load()}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá mục này?</AlertDialogTitle>
            <AlertDialogDescription>Thao tác không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteRecord()}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteCandidateOpen} onOpenChange={setDeleteCandidateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá ứng viên?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ lịch phỏng vấn, đánh giá, offer và trao đổi của “{candidate.full_name}” sẽ bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeCandidate()}
            >
              Xoá ứng viên
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default CandidateProfile;
