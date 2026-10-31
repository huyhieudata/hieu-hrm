import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Gavel,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCompany } from "@/lib/company-provider";
import {
  DISCIPLINE_CATEGORY_LABELS,
  DISCIPLINE_PROCEDURE_STEPS,
  createRecord,
  fetchRecords,
  formatDate,
  removeRecord,
  toOptions,
  updateRecord,
  uploadEmployeeFile,
  type DisciplineChecklistStep,
  type DisciplineRecord,
} from "@/lib/employee-records";
import { todayIso } from "@/lib/attendance";

const categoryOptions = Object.entries(DISCIPLINE_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const categoryTone = (category: string) => {
  switch (category) {
    case "reprimand":
      return "warning" as const;
    case "salary_delay":
      return "info" as const;
    case "demotion":
    case "dismissal":
      return "destructive" as const;
    default:
      return "muted" as const;
  }
};

const emptySteps = () =>
  Object.fromEntries(
    DISCIPLINE_PROCEDURE_STEPS.map((step) => [
      step.key,
      { checked: false, file_path: null as string | null, file_name: null as string | null },
    ]),
  ) as Record<string, { checked: boolean; file_path: string | null; file_name: string | null }>;

const today = todayIso;

interface DisciplineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  companyId: string;
  editing: DisciplineRecord | null;
  onSaved: () => void | Promise<void>;
}

const DisciplineForm = ({
  open,
  onOpenChange,
  employeeId,
  companyId,
  editing,
  onSaved,
}: DisciplineFormProps) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("reminder");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [recordNo, setRecordNo] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [decisionNo, setDecisionNo] = useState("");
  const [description, setDescription] = useState("");
  const [additionalMeasures, setAdditionalMeasures] = useState("");
  const [steps, setSteps] = useState(emptySteps());
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setCategory(editing?.category ?? "reminder");
    setEffectiveDate(editing?.effective_date?.slice(0, 10) ?? today());
    setRecordNo(editing?.record_no ?? "");
    setIncidentDate(editing?.incident_date?.slice(0, 10) ?? "");
    setDecisionNo(editing?.decision_no ?? "");
    setDescription(editing?.description ?? "");
    setAdditionalMeasures(editing?.additional_measures ?? "");
    const next = emptySteps();
    (editing?.checklist ?? []).forEach((step) => {
      if (next[step.key]) {
        next[step.key] = {
          checked: Boolean(step.completed && step.file_path),
          file_path: step.file_path ?? null,
          file_name: step.file_name ?? null,
        };
      }
    });
    setSteps(next);
    setError(null);
  }, [editing, open]);

  const needsChecklist = category !== "reminder";

  const missing = useMemo(
    () =>
      needsChecklist
        ? DISCIPLINE_PROCEDURE_STEPS.filter((step) => {
            const value = steps[step.key];
            return !value || !value.checked || !value.file_path;
          })
        : [],
    [needsChecklist, steps],
  );

  const canSave = Boolean(title.trim()) && Boolean(effectiveDate);

  const setStep = (key: string, patch: Partial<{ checked: boolean; file_path: string | null; file_name: string | null }>) => {
    setSteps((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const handleUpload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(key);
    setError(null);
    try {
      const path = await uploadEmployeeFile({ companyId, employeeId, file });
      setStep(key, { file_path: path, file_name: file.name, checked: true });
      toast.success("Đã tải hồ sơ đính kèm", { description: file.name });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không tải được tệp. Kiểm tra dung lượng và định dạng.",
      );
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Vui lòng nhập nội dung kỷ luật.");
      return;
    }
    if (!effectiveDate) {
      setError("Vui lòng chọn ngày hiệu lực.");
      return;
    }
    const checklist: DisciplineChecklistStep[] = DISCIPLINE_PROCEDURE_STEPS.map((step) => ({
      key: step.key,
      label: step.label,
      completed: steps[step.key]?.checked ?? false,
      file_path: steps[step.key]?.file_path ?? null,
      file_name: steps[step.key]?.file_name ?? null,
    }));

    const payload = {
      title: title.trim(),
      category,
      effective_date: effectiveDate,
      record_no: recordNo.trim() || null,
      incident_date: incidentDate || null,
      decision_no: decisionNo.trim() || null,
      description: description.trim() || null,
      additional_measures: additionalMeasures.trim() || null,
      checklist: needsChecklist ? checklist : null,
    };

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateRecord("employee_discipline_records", editing.id, payload);
      } else {
        await createRecord("employee_discipline_records", { ...payload, employee_id: employeeId });
      }

      if (needsChecklist && missing.length > 0) {
        toast.warning(editing ? "Đã cập nhật, còn thiếu hồ sơ kỷ luật" : "Đã lưu, còn thiếu hồ sơ kỷ luật", {
          description: `Còn ${missing.length} bước chưa tích hoặc chưa có hồ sơ đính kèm. Bổ sung để đủ quy trình.`,
        });
      } else {
        toast.success(editing ? "Đã cập nhật bản ghi kỷ luật" : "Đã thêm bản ghi kỷ luật");
      }
      await onSaved();
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Không lưu được bản ghi.";
      setError(
        message.includes("row-level security") ? "Bạn không có quyền ghi nhận kỷ luật." : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa bản ghi kỷ luật" : "Thêm kỷ luật"}</DialogTitle>
          <DialogDescription>
            Ngoài hình thức nhắc nhở, checklist quy trình xử lý kỷ luật và hồ sơ từng bước là bắt buộc theo
            quy trình. Nếu còn thiếu, bản ghi vẫn được lưu nhưng sẽ hiển thị cảnh báo nhắc nhở.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="discipline-title" className="text-[12.5px]">
              Nội dung <span className="text-destructive">*</span>
            </Label>
            <Input
              id="discipline-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Vi phạm nội quy chấm công"
              className="h-10"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="discipline-record-no" className="text-[12.5px]">
                Số biên bản
              </Label>
              <Input
                id="discipline-record-no"
                value={recordNo}
                onChange={(event) => setRecordNo(event.target.value)}
                placeholder="BB-2026/014"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discipline-incident-date" className="text-[12.5px]">
                Ngày ghi nhận sự việc
              </Label>
              <Input
                id="discipline-incident-date"
                type="date"
                value={incidentDate}
                onChange={(event) => setIncidentDate(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">
                Hình thức <span className="text-destructive">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discipline-date" className="text-[12.5px]">
                Ngày hiệu lực <span className="text-destructive">*</span>
              </Label>
              <Input
                id="discipline-date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discipline-decision" className="text-[12.5px]">
                Số quyết định
              </Label>
              <Input
                id="discipline-decision"
                value={decisionNo}
                onChange={(event) => setDecisionNo(event.target.value)}
                placeholder="QĐ-2026/078"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discipline-measures" className="text-[12.5px]">
                Biện pháp bổ sung
              </Label>
              <Input
                id="discipline-measures"
                value={additionalMeasures}
                onChange={(event) => setAdditionalMeasures(event.target.value)}
                placeholder="Bồi hoàn chi phí, đào tạo lại…"
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discipline-description" className="text-[12.5px]">
              Mô tả
            </Label>
            <Textarea
              id="discipline-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="text-[13px]"
            />
          </div>

          {needsChecklist ? (
            <section className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 py-2.5">
                <div>
                  <p className="text-[12px] font-semibold text-foreground">
                    Checklist quy trình xử lý kỷ luật lao động
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Mỗi bước phải được tích và có hồ sơ đính kèm mới lưu được.
                  </p>
                </div>
                <Badge variant={missing.length === 0 ? "success" : "warning"}>
                  {DISCIPLINE_PROCEDURE_STEPS.length - missing.length}/{DISCIPLINE_PROCEDURE_STEPS.length}
                </Badge>
              </div>

              <ul className="divide-y divide-border/60">
                {DISCIPLINE_PROCEDURE_STEPS.map((step) => {
                  const value = steps[step.key];
                  const isUploading = uploadingKey === step.key;
                  const done = Boolean(value?.checked && value?.file_path);
                  return (
                    <li key={step.key} className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <Checkbox
                          id={`step-${step.key}`}
                          checked={Boolean(value?.checked)}
                          onCheckedChange={(checked) => setStep(step.key, { checked: checked === true })}
                          className="mt-0.5"
                        />
                        <label htmlFor={`step-${step.key}`} className="min-w-0 cursor-pointer">
                          <span className="block text-[12px] font-medium text-foreground">{step.label}</span>
                          {value?.file_name ? (
                            <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                              <Paperclip className="h-3 w-3" />
                              <span className="truncate">{value.file_name}</span>
                            </span>
                          ) : (
                            <span className="text-[10.5px] text-destructive/80">Chưa có hồ sơ đính kèm</span>
                          )}
                        </label>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {done && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                            onChange={(event) => {
                              void handleUpload(step.key, event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-primary-subtle">
                            {isUploading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            {value?.file_path ? "Thay tệp" : "Tải hồ sơ"}
                          </span>
                        </label>
                        {value?.file_path && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Xoá tệp ${step.label}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setStep(step.key, { file_path: null, file_name: null, checked: false })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-[11.5px] leading-5 text-muted-foreground">
              Hình thức <strong>Nhắc nhở</strong> không bắt buộc checklist hồ sơ xử lý kỷ luật.
            </p>
          )}

          {needsChecklist && missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-[11.5px] leading-5 text-warning">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Checklist còn {missing.length} bước chưa tích hoặc chưa có hồ sơ đính kèm. Vẫn lưu được, nhưng
                bản ghi sẽ hiện cảnh báo cho đến khi bổ sung đủ.
              </span>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || !canSave} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface DisciplineTabProps {
  employeeId: string;
  canManage: boolean;
}

export const DisciplineTab = ({ employeeId, canManage }: DisciplineTabProps) => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [rows, setRows] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DisciplineRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DisciplineRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchRecords<DisciplineRecord>("employee_discipline_records", employeeId, "effective_date"));
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await removeRecord("employee_discipline_records", pendingDelete.id);
      toast.success("Đã xoá bản ghi kỷ luật");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được bản ghi", {
        description: deleteError instanceof Error ? deleteError.message : undefined,
      });
    }
  };

  const incompleteCount = rows.filter((row) => {
    if (row.category === "reminder") return false;
    const done = (row.checklist ?? []).filter((step) => step.completed && step.file_path).length;
    return done < DISCIPLINE_PROCEDURE_STEPS.length;
  }).length;

  const checklistSummary = (row: DisciplineRecord) => {
    if (row.category === "reminder") return null;
    const done = (row.checklist ?? []).filter((step) => step.completed && step.file_path).length;
    return { done, total: DISCIPLINE_PROCEDURE_STEPS.length };
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
            <Gavel className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Kỷ luật</h3>
            <p className="text-[11.5px] text-muted-foreground">{rows.length} bản ghi</p>
          </div>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-[12px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Gavel className="h-3.5 w-3.5" />
            Thêm kỷ luật
          </Button>
        )}
      </div>

      {!loading && incompleteCount > 0 && (
        <div className="flex items-start gap-2 border-b border-warning/25 bg-warning-subtle px-5 py-2.5 text-[11.5px] leading-5 text-warning">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {incompleteCount} bản ghi kỷ luật chưa hoàn tất checklist hồ sơ xử lý kỷ luật. Mở bản ghi để bổ
            sung tài liệu.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Gavel className="mx-auto h-5 w-5 text-muted-foreground/70" />
          <p className="mt-2 text-[12.5px] text-muted-foreground">Không có bản ghi kỷ luật nào.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => {
            const summary = checklistSummary(row);
            return (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/25">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{row.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.record_no ? `${row.record_no} · ` : ""}
                    {row.incident_date ? `Ghi nhận ${formatDate(row.incident_date)} · ` : ""}
                    Hiệu lực {formatDate(row.effective_date)}
                    {row.decision_no ? ` · ${row.decision_no}` : ""}
                    {row.additional_measures ? ` · Bổ sung: ${row.additional_measures}` : ""}
                  </p>
                </div>

                {summary && (
                  <span
                    className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${
                      summary.done === summary.total
                        ? "bg-success-subtle text-success"
                        : "bg-warning-subtle text-warning"
                    }`}
                  >
                    {summary.done === summary.total ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {summary.done === summary.total
                      ? `Đủ ${summary.total}/${summary.total} hồ sơ`
                      : `Thiếu hồ sơ · ${summary.done}/${summary.total}`}
                  </span>
                )}

                <Badge variant={categoryTone(row.category)}>
                  {DISCIPLINE_CATEGORY_LABELS[row.category] ?? row.category}
                </Badge>

                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${row.title}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[190px]">
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px]"
                        onSelect={() => {
                          setEditing(row);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá bản ghi
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {companyId && (
        <DisciplineForm
          open={formOpen}
          onOpenChange={setFormOpen}
          employeeId={employeeId}
          companyId={companyId}
          editing={editing}
          onSaved={load}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bản ghi kỷ luật?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title} sẽ bị xoá khỏi hồ sơ nhân viên. Hồ sơ đính kèm đã tải lên vẫn được lưu
              trong kho tài liệu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
