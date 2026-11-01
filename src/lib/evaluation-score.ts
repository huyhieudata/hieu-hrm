// Hàm thuần (không phụ thuộc Supabase) để chạy được bằng `pnpm test:evaluations`.
export interface EvaluationAnswer {
  score?: number | null;
  comment?: string | null;
}

export type EvaluationAnswers = Record<string, EvaluationAnswer>;

interface DraftLike {
  name: string;
  scale_max: number;
  criteria: { name: string; weight: number }[];
}

/**
 * BR-4.3: điểm tổng = Σ(điểm × trọng số) / Σ(trọng số) trên các tiêu chí đã chấm, làm tròn 2 số.
 * Khớp với trigger `validate_candidate_evaluation` phía máy chủ (máy chủ là nguồn đúng).
 */
export const weightedEvaluationScore = (
  criteria: { id: string; weight: number }[],
  answers: EvaluationAnswers,
): number | null => {
  let sum = 0;
  let weight = 0;
  criteria.forEach((criterion) => {
    const score = answers[criterion.id]?.score;
    if (typeof score === "number" && Number.isFinite(score)) {
      sum += score * Number(criterion.weight);
      weight += Number(criterion.weight);
    }
  });
  if (weight <= 0) return null;
  return Math.round((sum / weight) * 100) / 100;
};

/** Kiểm tra biểu mẫu trước khi lưu, trả về lỗi đầu tiên (hoặc null). */
export const validateTemplateDraft = (draft: DraftLike): string | null => {
  if (!draft.name.trim()) return "Biểu mẫu cần có tên.";
  if (!Number.isInteger(draft.scale_max) || draft.scale_max < 2 || draft.scale_max > 10)
    return "Thang điểm phải từ 2 đến 10.";
  if (draft.criteria.length === 0) return "Biểu mẫu cần ít nhất một tiêu chí.";
  for (const [index, criterion] of draft.criteria.entries()) {
    if (!criterion.name.trim()) return `Tiêu chí ${index + 1} chưa có tên.`;
    if (!(Number(criterion.weight) > 0) || Number(criterion.weight) > 1000)
      return `Trọng số tiêu chí "${criterion.name.trim()}" phải lớn hơn 0 và không quá 1000.`;
  }
  return null;
};


interface TemplateLike {
  id: string;
  name: string;
  kind: string;
  version: number;
  is_active: boolean;
}

/**
 * Biểu mẫu dùng được để chấm phiếu mới: đang dùng, đúng loại, và chỉ giữ phiên bản mới nhất
 * của mỗi tên biểu mẫu (BR-4.1 – bản cũ thường đã bị ngừng khi tạo phiên bản mới).
 */
export const selectableTemplates = <T extends TemplateLike>(templates: T[], kinds: readonly string[]): T[] => {
  const latest = new Map<string, T>();
  templates.forEach((template) => {
    if (!template.is_active || !kinds.includes(template.kind)) return;
    const key = `${template.kind}|${template.name.trim().toLowerCase()}`;
    const current = latest.get(key);
    if (!current || template.version > current.version) latest.set(key, template);
  });
  return Array.from(latest.values()).sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "vi"),
  );
};

/** Số tiêu chí chưa có điểm (phiếu chỉ nộp được khi bằng 0 – khớp trigger máy chủ). */
export const missingCriteriaCount = (criteria: { id: string }[], answers: EvaluationAnswers): number =>
  criteria.filter((criterion) => typeof answers[criterion.id]?.score !== "number").length;

/** Điểm hợp lệ: số nguyên từ 1 đến thang tối đa của biểu mẫu. */
export const isValidScore = (score: unknown, scaleMax: number): boolean =>
  typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= scaleMax;

/**
 * BR-4.2: phiếu nháp chỉ người chấm sửa được (người có recruitment.edit cũng sửa được);
 * phiếu đã nộp chỉ người có recruitment.edit sửa được.
 */
export const canEditEvaluation = (
  evaluation: { status?: string | null; reviewer_id: string | null },
  userId: string | null | undefined,
  hasRecruitmentEdit: boolean,
): boolean => {
  if (hasRecruitmentEdit) return true;
  return (evaluation.status ?? "submitted") === "draft" && !!userId && evaluation.reviewer_id === userId;
};

/** Khớp policy evaluations_delete: quyền xoá tuyển dụng, hoặc phiếu nháp của chính mình. */
export const canDeleteEvaluation = (
  evaluation: { status?: string | null; reviewer_id: string | null },
  userId: string | null | undefined,
  hasRecruitmentDelete: boolean,
): boolean =>
  hasRecruitmentDelete || ((evaluation.status ?? "submitted") === "draft" && !!userId && evaluation.reviewer_id === userId);
