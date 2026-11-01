import { confirmDialog } from "@/components/common/confirm-dialog";
// Tab "Đánh giá" trong hồ sơ nhân viên: phiếu thử việc/định kỳ theo biểu mẫu (mô-đun 4).
// HR/admin (evaluations.*) chấm mọi nhân viên; quản lý chấm nhân viên mình quản lý;
// nhân viên xem phiếu đã nộp của chính mình. Máy chủ kiểm tra lại toàn bộ (RLS + trigger).
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import {
  EVALUATION_KIND_LABELS,
  EVALUATION_STATUS_LABELS,
  listEvaluationCriteria,
  listEvaluationTemplates,
  missingCriteriaCount,
  selectableTemplates,
  weightedEvaluationScore,
  type EvaluationAnswers,
  type EvaluationCriterion,
  type EvaluationTemplate,
} from "@/lib/evaluations";
import {
  EMPLOYEE_EVALUATION_KINDS,
  EMPLOYEE_RECOMMENDATIONS,
  deleteEmployeeEvaluation,
  listEmployeeEvaluations,
  recommendationLabel,
  saveEmployeeEvaluation,
  type EmployeeEvaluation,
  type EmployeeEvaluationDraft,
  type EmployeeEvaluationKind,
} from "@/lib/employee-evaluations";
import { formatDate } from "@/lib/employee-records";
import { cn, getErrorMessage } from "@/lib/utils";

const NO_RECOMMENDATION = "none";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EvaluationTemplate[];
  allTemplates: EvaluationTemplate[];
  criteria: EvaluationCriterion[];
  evaluation: EmployeeEvaluation | null;
  readOnly: boolean;
  onSave: (draft: EmployeeEvaluationDraft) => Promise<void>;
}

const EmployeeEvaluationDialog = ({
  open,
  onOpenChange,
  templates,
  allTemplates,
  criteria,
  evaluation,
  readOnly,
  onSave,
}: DialogProps) => {
  const [templateId, setTemplateId] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [answers, setAnswers] = useState<EvaluationAnswers>({});
  const [recommendation, setRecommendation] = useState(NO_RECOMMENDATION);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTemplateId(evaluation?.template_id ?? templates[0]?.id ?? "");
    setPeriodLabel(evaluation?.period_label ?? "");
    setPeriodStart(evaluation?.period_start ?? "");
    setPeriodEnd(evaluation?.period_end ?? "");
    setAnswers(evaluation?.answers ?? {});
    setRecommendation(evaluation?.recommendation ?? NO_RECOMMENDATION);
    setStrengths(evaluation?.strengths ?? "");
    setImprovements(evaluation?.improvements ?? "");
    setComment(evaluation?.overall_comment ?? "");
    setSaving(null);
    setError(null);
  }, [open, evaluation, templates]);

  const template = useMemo(
    () => allTemplates.find((row) => row.id === templateId) ?? null,
    [allTemplates, templateId],
  );
  const kind = (
    template?.kind === "probation" ? "probation" : "periodic"
  ) as EmployeeEvaluationKind;
  const templateCriteria = useMemo(
    () =>
      criteria
        .filter((row) => row.template_id === templateId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [criteria, templateId],
  );
  const scale = template?.scale_max ?? 5;
  const preview = weightedEvaluationScore(templateCriteria, answers);
  const missing = missingCriteriaCount(templateCriteria, answers);
  const isSubmitted = !!evaluation && evaluation.status === "submitted";

  useEffect(() => {
    if (
      recommendation !== NO_RECOMMENDATION &&
      !EMPLOYEE_RECOMMENDATIONS[kind][recommendation]
    ) {
      setRecommendation(NO_RECOMMENDATION);
    }
  }, [kind, recommendation]);

  const patchAnswer = (
    id: string,
    patch: { score?: number | null; comment?: string },
  ) =>
    setAnswers((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));

  const submit = async (status: "draft" | "submitted") => {
    if (!templateId) return setError("Hãy chọn biểu mẫu đánh giá.");
    if (periodStart && periodEnd && periodEnd < periodStart)
      return setError("Ngày kết thúc kỳ phải sau ngày bắt đầu.");
    if (status === "submitted" && missing > 0)
      return setError(
        `Còn ${missing} tiêu chí chưa chấm điểm, chưa nộp được phiếu.`,
      );
    setSaving(status);
    setError(null);
    try {
      await onSave({
        template_id: templateId,
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        answers,
        recommendation:
          recommendation === NO_RECOMMENDATION ? "" : recommendation,
        strengths,
        improvements,
        overall_comment: comment,
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
                : "Đánh giá nhân viên"}
          </DialogTitle>
          <DialogDescription>
            Chấm từng tiêu chí theo thang 1–{scale}. Lưu nháp để chấm tiếp, nộp
            phiếu khi đã chấm đủ.
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Phiếu đã nộp nên chỉ xem được.
          </p>
        )}
        {!readOnly && isSubmitted && (
          <p className="flex items-center gap-2 rounded-md bg-warning-subtle px-3 py-2 text-[12px] text-warning">
            <Lock className="h-3.5 w-3.5" /> Phiếu đã nộp. Anh/chị đang chỉnh
            với quyền sửa đánh giá.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Kỳ đánh giá</Label>
            <Input
              value={periodLabel}
              readOnly={readOnly}
              maxLength={100}
              placeholder={
                kind === "probation" ? "VD: Thử việc 2 tháng" : "VD: Quý 4/2026"
              }
              onChange={(e) => setPeriodLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={periodStart}
              readOnly={readOnly}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={periodEnd}
              readOnly={readOnly}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
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
                    onChange={(e) =>
                      patchAnswer(criterion.id, { comment: e.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              {kind === "probation" ? "Kết luận thử việc" : "Xếp loại"}
            </Label>
            <Select
              value={recommendation}
              onValueChange={setRecommendation}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_RECOMMENDATION}>Chưa chọn</SelectItem>
                {Object.entries(EMPLOYEE_RECOMMENDATIONS[kind]).map(
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
            <Label>Cần cải thiện</Label>
            <Textarea
              value={improvements}
              readOnly={readOnly}
              onChange={(e) => setImprovements(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nhận xét chung</Label>
            <Textarea
              value={comment}
              readOnly={readOnly}
              onChange={(e) => setComment(e.target.value)}
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

interface EvaluationsTabProps {
  employeeId: string;
  /** Hồ sơ của chính người đang xem (nhân viên tự xem phiếu đã nộp). */
  isSelf: boolean;
}

export const EmployeeEvaluationsTab = ({
  employeeId,
  isSelf,
}: EvaluationsTabProps) => {
  const { user } = useAuth();
  const { activeCompany, canDo, role } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canCreateAll = canDo("evaluations", "create");
  const canEditAll = canDo("evaluations", "edit");
  const canDeleteAll = canDo("evaluations", "delete");
  // Quản lý: máy chủ kiểm tra có quản lý nhân viên này hay không.
  const canCreate = !isSelf && (canCreateAll || role === "manager");

  const [rows, setRows] = useState<EmployeeEvaluation[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeEvaluation | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [list, tpl, crit] = await Promise.all([
        listEmployeeEvaluations(employeeId),
        listEvaluationTemplates(companyId).catch(
          () => [] as EvaluationTemplate[],
        ),
        listEvaluationCriteria(companyId).catch(
          () => [] as EvaluationCriterion[],
        ),
      ]);
      setRows(list);
      setTemplates(tpl);
      setCriteria(crit);
    } catch (loadError) {
      toast.error(getErrorMessage(loadError, "Không tải được phiếu đánh giá."));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectable = useMemo(
    () => selectableTemplates(templates, EMPLOYEE_EVALUATION_KINDS),
    [templates],
  );
  // Nút xám vì: (1) không đọc được biểu mẫu (thiếu quyền Đánh giá › Xem), hoặc (2) chưa có biểu mẫu
  // loại Thử việc/Định kỳ đang dùng (biểu mẫu Phỏng vấn không dùng cho nhân viên).
  const noTemplateReason =
    templates.length === 0 && !canDo("evaluations", "view")
      ? "Vai trò của anh/chị chưa có quyền Đánh giá › Xem nên không thấy biểu mẫu. Nhờ Chủ sở hữu/Quản trị cấp ở Cài đặt › Thành viên & quyền."
      : "Chưa có biểu mẫu loại Thử việc hoặc Định kỳ đang dùng (biểu mẫu Phỏng vấn không áp dụng). HR/Quản trị tạo ở Cài đặt › Biểu mẫu đánh giá.";
  const templateName = (id: string) => {
    const row = templates.find((t) => t.id === id);
    return row ? `${row.name} · v${row.version}` : "Biểu mẫu";
  };
  const scaleOf = (id: string) =>
    templates.find((t) => t.id === id)?.scale_max ?? 5;

  const canEditRow = (row: EmployeeEvaluation) =>
    canEditAll ||
    (row.status === "draft" && !!user?.id && row.reviewer_id === user.id);
  const canDeleteRow = (row: EmployeeEvaluation) =>
    canDeleteAll ||
    (row.status === "draft" && !!user?.id && row.reviewer_id === user.id);

  const handleSave = async (draft: EmployeeEvaluationDraft) => {
    if (!companyId) return;
    await saveEmployeeEvaluation(
      { companyId, employeeId, evaluationId: editing?.id ?? null },
      draft,
    );
    toast.success(
      draft.status === "submitted" ? "Đã nộp phiếu đánh giá." : "Đã lưu nháp.",
    );
    setDialogOpen(false);
    await load();
  };

  const handleDelete = async (row: EmployeeEvaluation) => {
    if (!(await confirmDialog("Xoá phiếu đánh giá này?"))) return;
    try {
      await deleteEmployeeEvaluation(row.id);
      toast.success("Đã xoá phiếu.");
      await load();
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
            <ClipboardCheck className="h-[17px] w-[17px]" />
          </span>
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">
              Đánh giá thử việc & định kỳ
            </h3>
            <p className="text-[11.5px] text-muted-foreground">
              {isSelf
                ? "Phiếu đánh giá đã nộp của anh/chị."
                : "Chấm theo biểu mẫu, điểm tổng do hệ thống tính."}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button
            size="sm"
            className="gap-1"
            disabled={selectable.length === 0}
            title={selectable.length === 0 ? noTemplateReason : undefined}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Tạo phiếu đánh giá
          </Button>
        )}
      </div>
      {canCreate && !loading && selectable.length === 0 && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {noTemplateReason}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Chưa có phiếu đánh giá nào.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setEditing(row);
                  setDialogOpen(true);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-foreground">
                    {templateName(row.template_id)}
                  </span>
                  <Badge variant="outline">
                    {EVALUATION_KIND_LABELS[row.kind]}
                  </Badge>
                  <Badge
                    variant={
                      row.status === "submitted" ? "default" : "secondary"
                    }
                  >
                    {EVALUATION_STATUS_LABELS[row.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {[
                    row.period_label,
                    row.period_start || row.period_end
                      ? `${formatDate(row.period_start)} – ${formatDate(row.period_end)}`
                      : null,
                    `Kết luận: ${recommendationLabel(row.kind, row.recommendation)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span className="tabular text-[15px] font-semibold text-primary">
                  {row.total_score ?? "—"}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    /{scaleOf(row.template_id)}
                  </span>
                </span>
                {canDeleteRow(row) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Xoá phiếu"
                    onClick={() => void handleDelete(row)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <EmployeeEvaluationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templates={selectable}
        allTemplates={templates}
        criteria={criteria}
        evaluation={editing}
        readOnly={!!editing && !canEditRow(editing)}
        onSave={handleSave}
      />
    </Card>
  );
};
