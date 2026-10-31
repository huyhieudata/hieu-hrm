import { validateTemplateDraft, weightedEvaluationScore } from "../src/lib/evaluation-score.ts";

const eq = (a: unknown, b: unknown, m: string) => {
  if (a !== b) {
    console.error("FAIL", m, a, b);
    process.exit(1);
  }
  console.log("ok", m, a);
};

const criteria = [
  { id: "k1", weight: 2 },
  { id: "k2", weight: 1 },
  { id: "k3", weight: 1 },
];
// Cùng ca kiểm thử với dry-run SQL: (4×2 + 3 + 5) / 4 = 4.00
eq(weightedEvaluationScore(criteria, { k1: { score: 4 }, k2: { score: 3 }, k3: { score: 5 } }), 4, "tổng có trọng số");
eq(weightedEvaluationScore(criteria, { k1: { score: 4 } }), 4, "nháp chỉ chấm 1 tiêu chí");
eq(weightedEvaluationScore(criteria, {}), null, "chưa chấm");
eq(weightedEvaluationScore([{ id: "a", weight: 1 }, { id: "b", weight: 2 }], { a: { score: 1 }, b: { score: 2 } }), 1.67, "làm tròn 2 số");
eq(weightedEvaluationScore(criteria, { k1: { score: null }, k2: { score: 5 } }), 5, "bỏ qua điểm trống");

const draft = { name: "Phỏng vấn", scale_max: 5, criteria: [{ name: "Chuyên môn", weight: 1 }] };
eq(validateTemplateDraft(draft), null, "biểu mẫu hợp lệ");
eq(validateTemplateDraft({ ...draft, name: " " }) !== null, true, "thiếu tên");
eq(validateTemplateDraft({ ...draft, scale_max: 11 }) !== null, true, "thang quá 10");
eq(validateTemplateDraft({ ...draft, criteria: [] }) !== null, true, "không có tiêu chí");
eq(validateTemplateDraft({ ...draft, criteria: [{ name: "X", weight: 0 }] }) !== null, true, "trọng số 0");
console.log("Tất cả kiểm thử điểm đánh giá đã qua.");
