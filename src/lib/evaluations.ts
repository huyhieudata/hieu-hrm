import { supabase } from "@/integrations/supabase/client";
import type { EvaluationAnswers } from "./evaluation-score.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type EvaluationKind = "interview" | "probation" | "periodic";

export const EVALUATION_KIND_LABELS: Record<EvaluationKind, string> = {
  interview: "Phỏng vấn ứng viên",
  probation: "Đánh giá thử việc",
  periodic: "Đánh giá định kỳ",
};

export interface EvaluationTemplate {
  id: string;
  company_id: string;
  name: string;
  kind: EvaluationKind;
  description: string | null;
  scale_max: number;
  version: number;
  previous_version_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationCriterion {
  id: string;
  template_id: string;
  company_id: string;
  group_name: string | null;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
}


export {
  canDeleteEvaluation,
  canEditEvaluation,
  isValidScore,
  missingCriteriaCount,
  selectableTemplates,
  validateTemplateDraft,
  weightedEvaluationScore,
} from "./evaluation-score.ts";
export type { EvaluationAnswer, EvaluationAnswers } from "./evaluation-score.ts";

/** Loại biểu mẫu được chấm trong hồ sơ ứng viên ở bản đầu (KPI/360 làm sau). */
export const CANDIDATE_EVALUATION_KINDS: readonly EvaluationKind[] = ["interview", "probation", "periodic"];

export const EVALUATION_STATUS_LABELS: Record<"draft" | "submitted", string> = {
  draft: "Nháp",
  submitted: "Đã nộp",
};

export interface CriterionDraft {
  id?: string;
  group_name: string;
  name: string;
  description: string;
  weight: number;
}

export interface TemplateDraft {
  name: string;
  kind: EvaluationKind;
  description: string;
  scale_max: number;
  is_active: boolean;
  criteria: CriterionDraft[];
}

const TEMPLATE_COLUMNS =
  "id, company_id, name, kind, description, scale_max, version, previous_version_id, is_active, created_at, updated_at";
const CRITERION_COLUMNS = "id, template_id, company_id, group_name, name, description, weight, sort_order";

export const listEvaluationTemplates = async (companyId: string): Promise<EvaluationTemplate[]> => {
  const { data, error } = await db
    .from("evaluation_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("company_id", companyId)
    .order("is_active", { ascending: false })
    .order("name")
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EvaluationTemplate[];
};

export const listEvaluationCriteria = async (companyId: string): Promise<EvaluationCriterion[]> => {
  const { data, error } = await db
    .from("evaluation_criteria")
    .select(CRITERION_COLUMNS)
    .eq("company_id", companyId)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as EvaluationCriterion[]).map((row) => ({ ...row, weight: Number(row.weight) }));
};

/** Mã biểu mẫu đã có phiếu đánh giá dùng (BR-4.1: khoá cấu trúc). */
export const listUsedTemplateIds = async (companyId: string): Promise<Set<string>> => {
  const { data, error } = await db
    .from("candidate_evaluations")
    .select("template_id")
    .eq("company_id", companyId)
    .not("template_id", "is", null);
  if (error) throw error;
  return new Set(((data ?? []) as { template_id: string }[]).map((row) => row.template_id));
};

const criterionRow = (criterion: CriterionDraft, templateId: string, companyId: string, index: number) => ({
  template_id: templateId,
  company_id: companyId,
  group_name: criterion.group_name.trim() || null,
  name: criterion.name.trim(),
  description: criterion.description.trim() || null,
  weight: Number(criterion.weight),
  sort_order: index + 1,
});

/**
 * Tạo hoặc cập nhật biểu mẫu kèm tiêu chí. Với biểu mẫu đã dùng, máy chủ chỉ cho đổi
 * tên/mô tả/trạng thái; cấu trúc phải đổi qua phiên bản mới.
 */
export const saveEvaluationTemplate = async (
  companyId: string,
  templateId: string | null,
  draft: TemplateDraft,
  existing: EvaluationCriterion[],
  structureLocked: boolean,
): Promise<string> => {
  const base = {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    is_active: draft.is_active,
  };
  let id = templateId;
  if (id) {
    const values = structureLocked ? base : { ...base, kind: draft.kind, scale_max: draft.scale_max };
    const { error } = await db.from("evaluation_templates").update(values).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from("evaluation_templates")
      .insert({ ...base, company_id: companyId, kind: draft.kind, scale_max: draft.scale_max })
      .select("id")
      .single();
    if (error) throw error;
    id = (data as { id: string }).id;
  }
  if (structureLocked || !id) return id as string;

  const keep = new Set(draft.criteria.map((c) => c.id).filter(Boolean) as string[]);
  const removed = existing.filter((c) => c.template_id === id && !keep.has(c.id)).map((c) => c.id);
  if (removed.length) {
    const { error } = await db.from("evaluation_criteria").delete().in("id", removed);
    if (error) throw error;
  }
  for (const [index, criterion] of draft.criteria.entries()) {
    const row = criterionRow(criterion, id, companyId, index);
    const { error } = criterion.id
      ? await db.from("evaluation_criteria").update(row).eq("id", criterion.id)
      : await db.from("evaluation_criteria").insert(row);
    if (error) throw error;
  }
  return id;
};

export const createEvaluationTemplateVersion = async (templateId: string): Promise<string> => {
  const { data, error } = await db.rpc("create_evaluation_template_version", { source_template: templateId });
  if (error) throw error;
  return data as string;
};

export const deleteEvaluationTemplate = async (templateId: string) => {
  const { error } = await db.from("evaluation_templates").delete().eq("id", templateId);
  if (error) throw error;
};

export interface CandidateEvaluationDraft {
  template_id: string;
  interview_id: string | null;
  answers: EvaluationAnswers;
  recommendation: string;
  strengths: string;
  weaknesses: string;
  note: string;
  status: "draft" | "submitted";
}

/** Chỉ giữ câu trả lời có điểm hoặc nhận xét, cắt khoảng trắng. */
const cleanAnswers = (answers: EvaluationAnswers): EvaluationAnswers => {
  const result: EvaluationAnswers = {};
  Object.entries(answers).forEach(([key, answer]) => {
    const score = typeof answer?.score === "number" ? answer.score : null;
    const comment = answer?.comment?.trim() || null;
    if (score !== null || comment) result[key] = { score, comment };
  });
  return result;
};

/**
 * Lưu phiếu đánh giá theo biểu mẫu (tạo mới hoặc cập nhật). Máy chủ tự tính `total_score`,
 * kiểm tra thang điểm/đủ tiêu chí khi nộp và khoá phiếu đã nộp (BR-4.2).
 */
export const saveCandidateEvaluation = async (
  params: {
    companyId: string;
    candidateId: string;
    reviewerId: string | null;
    reviewerName: string;
    evaluationId: string | null;
  },
  draft: CandidateEvaluationDraft,
) => {
  const values = {
    interview_id: draft.interview_id,
    answers: cleanAnswers(draft.answers),
    recommendation: draft.recommendation || "hold",
    strengths: draft.strengths.trim() || null,
    weaknesses: draft.weaknesses.trim() || null,
    note: draft.note.trim() || null,
    status: draft.status,
  };
  if (params.evaluationId) {
    const { error } = await db.from("candidate_evaluations").update(values).eq("id", params.evaluationId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("candidate_evaluations").insert({
    ...values,
    company_id: params.companyId,
    candidate_id: params.candidateId,
    template_id: draft.template_id,
    reviewer_id: params.reviewerId,
    reviewer_name: params.reviewerName,
  });
  if (error) throw error;
};
