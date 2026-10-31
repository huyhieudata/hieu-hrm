import { supabase } from "@/integrations/supabase/client";

export const CV_BUCKET = "recruitment-cvs";
export const CV_MAX_BYTES = 10 * 1024 * 1024;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type CandidateStatus =
  | "received"
  | "screening"
  | "qualified"
  | "interview_scheduled"
  | "interview_declined"
  | "interview_no_show"
  | "interview_attended"
  | "interview_passed"
  | "interview_failed"
  | "rejected"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "started";

export interface CandidateStatusMeta {
  value: CandidateStatus;
  label: string;
  tone: "muted" | "info" | "success" | "warning" | "destructive" | "subtle";
  group: "intake" | "screening" | "interview" | "offer" | "closed";
}

export const CANDIDATE_STATUSES: CandidateStatusMeta[] = [
  { value: "received", label: "Tiếp nhận", tone: "muted", group: "intake" },
  { value: "screening", label: "Đang sàng lọc", tone: "info", group: "screening" },
  { value: "qualified", label: "Đạt hồ sơ", tone: "success", group: "screening" },
  { value: "rejected", label: "Loại", tone: "destructive", group: "closed" },
  { value: "interview_scheduled", label: "Hẹn phỏng vấn", tone: "info", group: "interview" },
  { value: "interview_declined", label: "Từ chối phỏng vấn", tone: "warning", group: "closed" },
  { value: "interview_no_show", label: "Không đến phỏng vấn", tone: "destructive", group: "closed" },
  { value: "interview_attended", label: "Đến phỏng vấn", tone: "info", group: "interview" },
  { value: "interview_passed", label: "Đạt phỏng vấn", tone: "success", group: "interview" },
  { value: "interview_failed", label: "Không đạt phỏng vấn", tone: "destructive", group: "closed" },
  { value: "offer_sent", label: "Đã gửi offer", tone: "subtle", group: "offer" },
  { value: "offer_accepted", label: "Đồng ý offer", tone: "success", group: "offer" },
  { value: "offer_declined", label: "Từ chối nhận việc", tone: "warning", group: "closed" },
  { value: "started", label: "Đã đến nhận việc", tone: "success", group: "offer" },
];

export const statusMeta = (value: string): CandidateStatusMeta =>
  CANDIDATE_STATUSES.find((item) => item.value === value) ?? CANDIDATE_STATUSES[0];

/** Pipeline order used by the progress bar (only the main stages). */
export const PIPELINE_STAGES = [
  "received",
  "screening",
  "qualified",
  "interview_scheduled",
  "interview_attended",
  "interview_passed",
  "offer_sent",
  "offer_accepted",
  "started",
] as const;

/** Các bước 7–9 do hệ thống tự chuyển, không cho chọn thủ công. */
export const AUTO_CANDIDATE_STAGES = ["offer_sent", "offer_accepted", "started"] as const;

export const MANUAL_CANDIDATE_STATUSES = CANDIDATE_STATUSES.filter(
  (status) =>
    !(AUTO_CANDIDATE_STAGES as readonly string[]).includes(status.value) &&
    (status.group !== "closed" || status.value === "rejected"),
);

/** Vị trí của trạng thái trên pipeline chính; -1 nếu ứng viên đã dừng. */
export const candidateStageIndex = (status: string) => {
  const index = (PIPELINE_STAGES as readonly string[]).indexOf(status);
  if (index >= 0) return index;
  return statusMeta(status).group === "closed" ? -1 : 0;
};

export const isClosedCandidateStatus = (status: string) => statusMeta(status).group === "closed";

export const evaluationAverage = (evaluation: {
  technical_score: number | null;
  communication_score: number | null;
  culture_score: number | null;
  attitude_score: number | null;
}) => {
  const scores = [
    evaluation.technical_score,
    evaluation.communication_score,
    evaluation.culture_score,
    evaluation.attitude_score,
  ].filter((value): value is number => typeof value === "number" && value > 0);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;
};

export const ONBOARDING_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ hội nhập",
  in_progress: "Đang hội nhập",
  completed: "Đã hội nhập",
  cancelled: "Đã huỷ",
};

export interface OnboardingRecord {
  id: string;
  company_id: string;
  candidate_id: string | null;
  employee_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  employment_type: string | null;
  work_location: string | null;
  hire_date: string | null;
  expected_completion_date: string | null;
  base_salary: number | null;
  allowance: number | null;
  manager_employee_id: string | null;
  manager_name: string | null;
  checklist: { id: string; label: string; required: boolean; completed: boolean }[] | null;
  status: string;
  note: string | null;
  created_at: string;
}

export interface OnboardingProgress {
  done: number;
  total: number;
  percent: number;
  completed: boolean;
}

export const onboardingProgress = (record: {
  checklist: { completed: boolean }[] | null;
  status: string;
}): OnboardingProgress => {
  const items = record.checklist ?? [];
  const total = items.length;
  const done = items.filter((item) => item.completed).length;
  if (total === 0) {
    const completed = record.status === "completed";
    return { done, total, percent: completed ? 100 : 0, completed };
  }
  return { done, total, percent: Math.round((done / total) * 100), completed: done === total };
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  open: "Đang tuyển",
  on_hold: "Tạm dừng",
  closed: "Đã đóng",
};

export const CAMPAIGN_PRIORITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

export const JD_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  open: "Đang áp dụng",
  closed: "Ngừng áp dụng",
};

export const CANDIDATE_SOURCE_LABELS: Record<string, string> = {
  website: "Website công ty",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  referral: "Giới thiệu nội bộ",
  agency: "Headhunt",
  event: "Sự kiện tuyển dụng",
  other: "Khác",
};

export const INTERVIEW_MODE_LABELS: Record<string, string> = {
  onsite: "Tại văn phòng",
  online: "Trực tuyến",
  phone: "Điện thoại",
};

export const INTERVIEW_STATUS_LABELS: Record<string, string> = {
  scheduled: "Đã lên lịch",
  completed: "Đã phỏng vấn",
  cancelled: "Đã huỷ",
  no_show: "Không đến phỏng vấn",
};

export const GENDER_LABELS: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export interface JobDescription {
  id: string;
  company_id: string;
  code: string | null;
  title: string;
  department: string | null;
  level: string | null;
  employment_type: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  summary: string | null;
  responsibilities: string | null;
  requirements: string | null;
  benefits: string | null;
  status: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  company_id: string;
  job_description_id: string | null;
  code: string | null;
  title: string;
  department: string | null;
  headcount: number;
  priority: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  hiring_manager: string | null;
  description: string | null;
  sla_days: number;
  created_at: string;
}

export interface CandidateApplication {
  id: string;
  company_id: string;
  candidate_id: string;
  campaign_id: string;
  status: string;
  note: string | null;
  rejection_reason: string | null;
  applied_at: string;
  cv_path: string | null;
  cv_file_name: string | null;
}

/** Mã chiến dịch dạng CD-2026-001 dùng để phân biệt. */
export const buildCampaignCode = (year: number, sequence: number) =>
  `CD-${year}-${String(sequence).padStart(3, "0")}`;

export interface Candidate {
  id: string;
  company_id: string;
  campaign_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  position_applied: string | null;
  source: string | null;
  experience_years: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  hired_salary: number | null;
  onboarding_date: string | null;
  work_location: string | null;
  education: string | null;
  status: CandidateStatus;
  note: string | null;
  cv_url: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  employee_id: string | null;
  rejection_reason: string | null;
  form_token: string | null;
  form_sent_at: string | null;
  form_submitted_at: string | null;
  applied_at: string;
  created_at: string;
}

export interface CandidateEvaluation {
  id: string;
  company_id: string;
  candidate_id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  technical_score: number | null;
  communication_score: number | null;
  culture_score: number | null;
  attitude_score: number | null;
  recommendation: string;
  strengths: string | null;
  weaknesses: string | null;
  note: string | null;
  created_at: string;
}

export const EVALUATION_RECOMMENDATION_LABELS: Record<string, string> = {
  advance: "Đề xuất tiến",
  hold: "Cân nhắc thêm",
  reject: "Không phù hợp",
};

export interface Interview {
  id: string;
  company_id: string;
  candidate_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string;
  location: string | null;
  interviewer: string | null;
  status: string;
  note: string | null;
  created_at: string;
}

export interface CandidateComment {
  id: string;
  company_id: string;
  candidate_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

export interface CandidateOffer {
  id: string;
  company_id: string;
  candidate_id: string;
  position: string | null;
  department: string | null;
  base_salary: number | null;
  allowance: number | null;
  other_benefits: string | null;
  onboarding_date: string | null;
  work_location: string | null;
  response_deadline: string | null;
  status: string;
  note: string | null;
  created_at: string;
}

export const OFFER_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  sent: "Đã gửi",
  accepted: "Đã đồng ý",
  declined: "Từ chối",
};

export interface CandidateEmail {
  id: string;
  company_id: string;
  candidate_id: string;
  subject: string;
  body: string | null;
  sent_to: string | null;
  template: string | null;
  status: string;
  sent_at: string;
}

type RecruitmentTable =
  | "job_descriptions"
  | "recruitment_campaigns"
  | "candidates"
  | "candidate_interviews"
  | "candidate_comments"
  | "candidate_emails"
  | "candidate_evaluations"
  | "candidate_offers"
  | "candidate_applications"
  | "onboarding_records"
  | "onboarding_comments";

export const listRows = async <T>(
  table: RecruitmentTable,
  companyId: string,
  orderColumn = "created_at",
  ascending = false,
): Promise<T[]> => {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("company_id", companyId)
    .order(orderColumn, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
};

export const getCandidateByEmployee = async (employeeId: string): Promise<Candidate | null> => {
  const { data, error } = await db
    .from("candidates")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Candidate | null;
};

export const getCandidate = async (candidateId: string): Promise<Candidate | null> => {
  const { data, error } = await db.from("candidates").select("*").eq("id", candidateId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Candidate | null;
};

/** Tạo bản ghi hội nhập “Chờ hội nhập” khi ứng viên đồng ý offer (bỏ qua nếu đã có). */
export const ensureOnboardingRecord = async (candidate: Candidate): Promise<string | null> => {
  const rows = await listRows<OnboardingRecord>("onboarding_records", candidate.company_id, "created_at");
  const existing = rows.find(
    (record) => record.candidate_id === candidate.id && record.status !== "cancelled",
  );
  if (existing) return existing.id;

  return createRow("onboarding_records", {
    company_id: candidate.company_id,
    candidate_id: candidate.id,
    full_name: candidate.full_name,
    email: candidate.email,
    phone: candidate.phone,
    date_of_birth: candidate.date_of_birth,
    gender: candidate.gender,
    address: candidate.address,
    position: candidate.position_applied,
    work_location: candidate.work_location,
    hire_date: candidate.onboarding_date,
    base_salary: candidate.hired_salary,
    status: "pending",
    note: "Tạo tự động khi ứng viên đồng ý offer",
  });
};

export const createRow = async (table: RecruitmentTable, values: Record<string, unknown>) => {
  const { data, error } = await db.from(table).insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được bản ghi.");
  return data.id as string;
};

export const deleteRows = async (table: RecruitmentTable, ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await db.from(table).delete().in("id", ids);
  if (error) throw new Error(error.message ?? "Không xoá được bản ghi.");
};

export const updateRow = async (table: RecruitmentTable, id: string, values: Record<string, unknown>) => {
  const { error } = await db.from(table).update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được bản ghi.");
};

export const deleteRow = async (table: RecruitmentTable, id: string) => {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được bản ghi.");
};

/** Campaign deadline = start date (or creation date) + SLA days. */
export const campaignDeadline = (campaign: Campaign) => {
  const base = new Date(campaign.start_date ?? campaign.created_at);
  if (Number.isNaN(base.getTime())) return null;
  const deadline = new Date(base);
  deadline.setDate(deadline.getDate() + (campaign.sla_days ?? 30));
  return deadline;
};

export const campaignCountdown = (campaign: Campaign) => {
  const deadline = campaignDeadline(campaign);
  if (!deadline) return { days: 0, label: "—", tone: "muted" as const };
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
  const days = Math.round((target - startOfToday) / 86_400_000);
  if (days < 0) return { days, label: `Quá hạn ${Math.abs(days)} ngày`, tone: "destructive" as const };
  if (days === 0) return { days, label: "Hết hạn hôm nay", tone: "destructive" as const };
  if (days <= 7) return { days, label: `Còn ${days} ngày`, tone: "warning" as const };
  return { days, label: `Còn ${days} ngày`, tone: "success" as const };
};

export const toOptionsSafe = (values: string[]) => values.map((value) => ({ value, label: value }));

export const uploadCandidateCv = async (input: {
  companyId: string;
  candidateId: string;
  file: File;
}): Promise<string> => {
  if (input.file.size > CV_MAX_BYTES) {
    throw new Error("Tệp CV vượt quá 10MB.");
  }
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `${input.companyId}/${input.candidateId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(CV_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || "application/pdf",
      upsert: false,
    });

  if (error) throw error;
  return path;
};

export const getCandidateCvUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from(CV_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

export const deleteCandidateCvFile = async (path: string) => {
  await supabase.storage.from(CV_BUCKET).remove([path]);
};

export const candidateFormLink = (token: string) => `${window.location.origin}/ung-tuyen/${token}`;

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDay = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};
