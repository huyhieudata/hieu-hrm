import {
  canDeleteEvaluation,
  canEditEvaluation,
  isValidScore,
  missingCriteriaCount,
  selectableTemplates,
  validateTemplateDraft,
  weightedEvaluationScore,
} from "../src/lib/evaluation-score.ts";

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

// Bước 2: chấm phiếu theo biểu mẫu trong hồ sơ ứng viên

const tpls = [
  { id: "a1", name: "Phỏng vấn", kind: "interview", version: 1, is_active: false },
  { id: "a2", name: "Phỏng vấn", kind: "interview", version: 2, is_active: true },
  { id: "a3", name: " phỏng vấn ", kind: "interview", version: 3, is_active: true },
  { id: "b1", name: "Thử việc", kind: "probation", version: 1, is_active: true },
  { id: "c1", name: "KPI", kind: "kpi", version: 1, is_active: true },
  { id: "d1", name: "Định kỳ", kind: "periodic", version: 1, is_active: true },
];
const picked = selectableTemplates(tpls, ["interview", "probation", "periodic"]).map((t) => t.id).join(",");
eq(picked, "a3,d1,b1", "chỉ lấy bản mới nhất đang dùng, đúng loại");
eq(missingCriteriaCount(criteria, { k1: { score: 3 }, k2: { score: null } }), 2, "đếm tiêu chí chưa chấm");
eq(missingCriteriaCount(criteria, { k1: { score: 3 }, k2: { score: 1 }, k3: { score: 5 } }), 0, "đủ tiêu chí");
eq(isValidScore(7, 7), true, "thang tuỳ chỉnh 7");
eq(isValidScore(8, 7), false, "vượt thang");
eq(isValidScore(0, 5), false, "dưới 1");
eq(isValidScore(2.5, 5), false, "không nguyên");
const mineDraft = { status: "draft", reviewer_id: "u1" };
const mineSubmitted = { status: "submitted", reviewer_id: "u1" };
eq(canEditEvaluation(mineDraft, "u1", false), true, "sửa nháp của mình");
eq(canEditEvaluation(mineDraft, "u2", false), false, "không sửa nháp người khác");
eq(canEditEvaluation(mineSubmitted, "u1", false), false, "phiếu đã nộp bị khoá");
eq(canEditEvaluation(mineSubmitted, "u2", true), true, "recruitment.edit sửa được phiếu đã nộp");
eq(canEditEvaluation({ status: null, reviewer_id: "u1" }, "u1", false), false, "phiếu cũ coi như đã nộp");
eq(canDeleteEvaluation(mineDraft, "u1", false), true, "xoá nháp của mình");
eq(canDeleteEvaluation(mineSubmitted, "u1", false), false, "không xoá phiếu đã nộp");
eq(canDeleteEvaluation(mineDraft, "u2", false), false, "không xoá nháp người khác");
eq(canDeleteEvaluation(mineSubmitted, "u2", true), true, "recruitment.delete xoá được");
console.log("Tất cả kiểm thử chấm phiếu theo biểu mẫu đã qua.");
