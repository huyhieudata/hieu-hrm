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

