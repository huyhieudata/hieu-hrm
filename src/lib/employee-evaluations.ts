// Phiếu đánh giá nhân viên (thử việc, định kỳ) theo biểu mẫu – bảng employee_evaluations.
// Máy chủ là nguồn đúng: tính điểm tổng có trọng số, kiểm tra thang/đủ tiêu chí khi nộp,
// khoá phiếu đã nộp (trigger validate_employee_evaluation) và giới hạn người xem (RLS).
import { supabase } from "@/integrations/supabase/client";
import type { EvaluationAnswers } from "./evaluation-score.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type EmployeeEvaluationKind = "probation" | "periodic";
export const EMPLOYEE_EVALUATION_KINDS: readonly EmployeeEvaluationKind[] = [
  "probation",
  "periodic",
];

export const EMPLOYEE_RECOMMENDATIONS: Record<
  EmployeeEvaluationKind,
  Record<string, string>
> = {
  probation: {
    pass: "Đạt – ký hợp đồng chính thức",
    extend: "Gia hạn thử việc",
    fail: "Không đạt",
  },
  periodic: {
    excellent: "Xuất sắc",
    good: "Tốt",
    fair: "Đạt",
    poor: "Chưa đạt",
  },
};

export const recommendationLabel = (kind: string, value: string | null) =>
  (value &&
    EMPLOYEE_RECOMMENDATIONS[kind as EmployeeEvaluationKind]?.[value]) ||
  "—";

export interface EmployeeEvaluation {
  id: string;
  company_id: string;
  employee_id: string;
  template_id: string;
  kind: EmployeeEvaluationKind;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  reviewer_id: string | null;
  answers: EvaluationAnswers;
  total_score: number | null;
  recommendation: string | null;
  strengths: string | null;
  improvements: string | null;
  overall_comment: string | null;
  status: "draft" | "submitted";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeEvaluationDraft {
  template_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  answers: EvaluationAnswers;
  recommendation: string;
  strengths: string;
  improvements: string;
  overall_comment: string;
  status: "draft" | "submitted";
}

const COLUMNS =
  "id, company_id, employee_id, template_id, kind, period_label, period_start, period_end, reviewer_id, answers, total_score, recommendation, strengths, improvements, overall_comment, status, submitted_at, created_at, updated_at";

export const listEmployeeEvaluations = async (
  employeeId: string,
): Promise<EmployeeEvaluation[]> => {
  const { data, error } = await db
    .from("employee_evaluations")
    .select(COLUMNS)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as EmployeeEvaluation[]).map((row) => ({
    ...row,
    total_score: row.total_score === null ? null : Number(row.total_score),
  }));
};

const cleanAnswers = (answers: EvaluationAnswers): EvaluationAnswers => {
  const result: EvaluationAnswers = {};
  Object.entries(answers).forEach(([key, answer]) => {
    const score = typeof answer?.score === "number" ? answer.score : null;
    const comment = answer?.comment?.trim() || null;
    if (score !== null || comment) result[key] = { score, comment };
  });
  return result;
};

export const saveEmployeeEvaluation = async (
  params: {
    companyId: string;
    employeeId: string;
    evaluationId: string | null;
  },
  draft: EmployeeEvaluationDraft,
) => {
  const values = {
    period_label: draft.period_label.trim() || null,
    period_start: draft.period_start || null,
    period_end: draft.period_end || null,
    answers: cleanAnswers(draft.answers),
    recommendation: draft.recommendation || null,
    strengths: draft.strengths.trim() || null,
    improvements: draft.improvements.trim() || null,
    overall_comment: draft.overall_comment.trim() || null,
    status: draft.status,
  };
  if (params.evaluationId) {
    const { data, error } = await db
      .from("employee_evaluations")
      .update(values)
      .eq("id", params.evaluationId)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Anh/chị không có quyền sửa phiếu này.");
    return;
  }
  const { error } = await db.from("employee_evaluations").insert({
    ...values,
    company_id: params.companyId,
    employee_id: params.employeeId,
    template_id: draft.template_id,
  });
  if (error) {
    if (/row-level security/i.test(error.message ?? ""))
      throw new Error(
        "Anh/chị chỉ đánh giá được nhân viên mình quản lý (hoặc cần quyền tạo đánh giá).",
      );
    throw error;
  }
};

export const deleteEmployeeEvaluation = async (id: string) => {
  const { data, error } = await db
    .from("employee_evaluations")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length)
    throw new Error("Không xoá được phiếu (chỉ xoá được phiếu nháp của mình).");
};
