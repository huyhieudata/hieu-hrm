// Phiếu đánh giá ứng viên theo biểu mẫu (mô-đun 4, bước 2): chọn biểu mẫu + vòng phỏng vấn,
// chấm điểm từng tiêu chí theo thang của biểu mẫu, lưu nháp hoặc nộp. Máy chủ là nguồn đúng
// của điểm tổng và khoá phiếu đã nộp (trigger validate_candidate_evaluation).
import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EVALUATION_KIND_LABELS,
  missingCriteriaCount,
  weightedEvaluationScore,
  type CandidateEvaluationDraft,
  type EvaluationAnswers,
  type EvaluationCriterion,
  type EvaluationTemplate,
} from "@/lib/evaluations";
import {
  EVALUATION_RECOMMENDATION_LABELS,
  INTERVIEW_MODE_LABELS,
  formatDateTime,
  type CandidateEvaluation,
  type Interview,
} from "@/lib/recruitment";
import { cn, getErrorMessage } from "@/lib/utils";

const NO_INTERVIEW = "none";

interface TemplateEvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Biểu mẫu chọn được cho phiếu mới (đang dùng, bản mới nhất). */
  templates: EvaluationTemplate[];
  /** Mọi biểu mẫu của công ty, để mở phiếu cũ dùng bản đã ngừng. */
  allTemplates: EvaluationTemplate[];
  criteria: EvaluationCriterion[];
  interviews: Interview[];
  evaluation: CandidateEvaluation | null;
  /** Vòng phỏng vấn chọn sẵn khi tạo phiếu mới (mở từ Lịch phỏng vấn). */
  defaultInterviewId?: string | null;
  readOnly: boolean;
  onSave: (draft: CandidateEvaluationDraft) => Promise<void>;
}

const interviewLabel = (interview: Interview) =>
  [
    formatDateTime(interview.scheduled_at),
    INTERVIEW_MODE_LABELS[interview.mode] ?? interview.mode,
    interview.interviewer,
  ]
    .filter(Boolean)
    .join(" · ");

export const TemplateEvaluationDialog = ({
  open,
  onOpenChange,
  templates,
  allTemplates,
  criteria,
  interviews,
  evaluation,
  defaultInterviewId = null,
  readOnly,
  onSave,
}: TemplateEvaluationDialogProps) => {
  const [templateId, setTemplateId] = useState("");
  const [interviewId, setInterviewId] = useState(NO_INTERVIEW);
  const [answers, setAnswers] = useState<EvaluationAnswers>({});
  const [recommendation, setRecommendation] = useState("hold");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTemplateId(evaluation?.template_id ?? templates[0]?.id ?? "");
    const presetInterview =
      defaultInterviewId &&
      interviews.some((row) => row.id === defaultInterviewId)
        ? defaultInterviewId
        : null;
    setInterviewId(
      evaluation
        ? (evaluation.interview_id ?? NO_INTERVIEW)
        : (presetInterview ?? NO_INTERVIEW),
    );
    setAnswers(evaluation?.answers ?? {});
    setRecommendation(evaluation?.recommendation ?? "hold");
    setStrengths(evaluation?.strengths ?? "");
    setWeaknesses(evaluation?.weaknesses ?? "");
    setNote(evaluation?.note ?? "");
    setError(null);
    setSaving(null);
  }, [open, evaluation, templates, defaultInterviewId, interviews]);

  const template = useMemo(
    () => allTemplates.find((row) => row.id === templateId) ?? null,
    [allTemplates, templateId],
  );
  const templateCriteria = useMemo(
    () =>
      criteria
        .filter((row) => row.template_id === templateId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [criteria, templateId],
  );
  const preview = weightedEvaluationScore(templateCriteria, answers);
  const missing = missingCriteriaCount(templateCriteria, answers);
  const isSubmitted = evaluation?.status !== "draft" && !!evaluation;
  const scale = template?.scale_max ?? 5;

  const patchAnswer = (
    criterionId: string,
    patch: { score?: number | null; comment?: string },
  ) =>
    setAnswers((current) => ({
      ...current,
      [criterionId]: { ...current[criterionId], ...patch },
    }));

  const submit = async (status: "draft" | "submitted") => {
    if (!templateId) {
      setError("Hãy chọn biểu mẫu đánh giá.");
      return;
    }
    if (status === "submitted" && missing > 0) {
      setError(`Còn ${missing} tiêu chí chưa chấm điểm, chưa nộp được phiếu.`);
      return;
    }
    setSaving(status);
    setError(null);
    try {
      await onSave({
        template_id: templateId,
        interview_id: interviewId === NO_INTERVIEW ? null : interviewId,
        answers,
        recommendation,
        strengths,
        weaknesses,
        note,
        status,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(null);
    }
  };

  let lastGroup: string | null = null;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Phiếu đánh giá"
              : evaluation
                ? "Sửa phiếu đánh giá"
                : "Chấm theo biểu mẫu"}
          </DialogTitle>
          <DialogDescription>
            Chấm điểm từng tiêu chí theo thang 1–{scale}. Lưu nháp để chấm tiếp
            sau, nộp phiếu khi đã chấm đủ.
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Phiếu đã nộp nên chỉ xem được.
            Người có quyền sửa tuyển dụng mới chỉnh được.
          </p>
        )}
        {!readOnly && isSubmitted && (
          <p className="flex items-center gap-2 rounded-md bg-warning-subtle px-3 py-2 text-[12px] text-warning">
            <Lock className="h-3.5 w-3.5" /> Phiếu đã nộp. Anh/chị đang chỉnh
            với quyền sửa tuyển dụng.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Biểu mẫu</Label>
            <Select
              value={templateId}
              onValueChange={setTemplateId}
              disabled={!!evaluation || readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn biểu mẫu" />
              </SelectTrigger>
              <SelectContent>
                {(evaluation && template ? [template] : templates).map(
                  (row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name} · v{row.version} ·{" "}
                      {EVALUATION_KIND_LABELS[row.kind] ?? row.kind}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vòng phỏng vấn</Label>
            <Select
              value={interviewId}
              onValueChange={setInterviewId}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_INTERVIEW}>
                  Không gắn vòng phỏng vấn
                </SelectItem>
                {interviews.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {interviewLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {template?.description && (
          <p className="text-[12px] text-muted-foreground">
            {template.description}
          </p>
        )}

        {templateId && templateCriteria.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            Biểu mẫu này chưa có tiêu chí.
          </p>
        )}

        <div className="space-y-2">
          {templateCriteria.map((criterion, index) => {
            const answer = answers[criterion.id] ?? {};
            const showGroup =
              criterion.group_name && criterion.group_name !== lastGroup;
            lastGroup = criterion.group_name;
            return (
              <div key={criterion.id} className="space-y-2">
                {showGroup && (
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    {criterion.group_name}
                  </p>
                )}
                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[12.5px] font-semibold text-foreground">
                        {index + 1}. {criterion.name}
                      </p>
                      {criterion.description && (
                        <p className="text-[11px] text-muted-foreground">
                          {criterion.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Trọng số {criterion.weight}
                    </span>
                  </div>
                  <div
                    className="flex flex-wrap gap-1"
                    role="radiogroup"
                    aria-label={`Điểm ${criterion.name}`}
                  >
                    {Array.from({ length: scale }, (_, i) => i + 1).map(
                      (value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          role="radio"
                          aria-checked={answer.score === value}
                          variant={
                            answer.score === value ? "default" : "outline"
                          }
                          className={cn(
                            "h-7 w-8 px-0 text-[12px]",
                            readOnly && "pointer-events-none",
                          )}
                          disabled={readOnly && answer.score !== value}
                          onClick={() =>
                            patchAnswer(criterion.id, {
                              score: answer.score === value ? null : value,
                            })
                          }
                        >
                          {value}
                        </Button>
                      ),
                    )}
                  </div>
                  <Input
                    value={answer.comment ?? ""}
                    readOnly={readOnly}
                    placeholder={
                      readOnly ? "" : "Nhận xét cho tiêu chí (không bắt buộc)"
                    }
                    className="h-8 text-[12px]"
                    onChange={(event) =>
                      patchAnswer(criterion.id, { comment: event.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Đề xuất</Label>
            <Select
              value={recommendation}
              onValueChange={setRecommendation}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVALUATION_RECOMMENDATION_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end rounded-md bg-muted/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
              Điểm tổng có trọng số
            </p>
            <p className="tabular text-[18px] font-semibold text-primary">
              {(evaluation && readOnly ? evaluation.total_score : preview) ??
                "—"}
              <span className="text-[12px] font-normal text-muted-foreground">
                /{scale}
              </span>
            </p>
            {!readOnly && missing > 0 && templateCriteria.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Còn {missing} tiêu chí chưa chấm
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Điểm mạnh</Label>
            <Textarea
              value={strengths}
              readOnly={readOnly}
              onChange={(e) => setStrengths(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Điểm cần cải thiện</Label>
            <Textarea
              value={weaknesses}
              readOnly={readOnly}
              onChange={(e) => setWeaknesses(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nhận xét chung</Label>
            <Textarea
              value={note}
              readOnly={readOnly}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!saving}
          >
            {readOnly ? "Đóng" : "Huỷ"}
          </Button>
          {!readOnly && !isSubmitted && (
            <Button
              variant="secondary"
              onClick={() => void submit("draft")}
              disabled={!!saving}
            >
              {saving === "draft" && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              Lưu nháp
            </Button>
          )}
          {!readOnly && (
            <Button
              onClick={() => void submit("submitted")}
              disabled={!!saving || !templateId}
            >
              {saving === "submitted" && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              {isSubmitted ? "Lưu thay đổi" : "Nộp phiếu"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
