import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, CopyPlus, Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-provider";
import {
  EVALUATION_KIND_LABELS,
  createEvaluationTemplateVersion,
  deleteEvaluationTemplate,
  listEvaluationCriteria,
  listEvaluationTemplates,
  listUsedTemplateIds,
  saveEvaluationTemplate,
  validateTemplateDraft,
  type CriterionDraft,
  type EvaluationCriterion,
  type EvaluationKind,
  type EvaluationTemplate,
  type TemplateDraft,
} from "@/lib/evaluations";
import { getErrorMessage } from "@/lib/utils";

const emptyCriterion = (): CriterionDraft => ({ group_name: "", name: "", description: "", weight: 1 });

const emptyDraft = (): TemplateDraft => ({
  name: "",
  kind: "interview",
  description: "",
  scale_max: 5,
  is_active: true,
  criteria: [
    { ...emptyCriterion(), name: "Chuyên môn" },
    { ...emptyCriterion(), name: "Giao tiếp" },
    { ...emptyCriterion(), name: "Phù hợp văn hoá" },
    { ...emptyCriterion(), name: "Thái độ" },
  ],
});

interface EditorState {
  id: string | null;
  locked: boolean;
  draft: TemplateDraft;
}

const EvaluationTemplatesPage = () => {
  const { activeCompany, canDo } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canCreate = canDo("evaluations", "create");
  const canEdit = canDo("evaluations", "edit");
  const canDelete = canDo("evaluations", "delete");

  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<EvaluationTemplate | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [t, c, u] = await Promise.all([
        listEvaluationTemplates(companyId),
        listEvaluationCriteria(companyId),
        listUsedTemplateIds(companyId).catch(() => new Set<string>()),
      ]);
      setTemplates(t);
      setCriteria(c);
      setUsed(u);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không tải được biểu mẫu đánh giá."));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const criteriaByTemplate = useMemo(() => {
    const map = new Map<string, EvaluationCriterion[]>();
    criteria.forEach((row) => map.set(row.template_id, [...(map.get(row.template_id) ?? []), row]));
    return map;
  }, [criteria]);

  const visible = useMemo(
    () => (showInactive ? templates : templates.filter((t) => t.is_active)),
    [showInactive, templates],
  );

  const openEdit = (template: EvaluationTemplate) =>
    setEditor({
      id: template.id,
      locked: used.has(template.id),
      draft: {
        name: template.name,
        kind: template.kind,
        description: template.description ?? "",
        scale_max: template.scale_max,
        is_active: template.is_active,
        criteria: (criteriaByTemplate.get(template.id) ?? []).map((c) => ({
          id: c.id,
          group_name: c.group_name ?? "",
          name: c.name,
          description: c.description ?? "",
          weight: c.weight,
        })),
      },
    });

  const patchDraft = (patch: Partial<TemplateDraft>) =>
    setEditor((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));

  const patchCriterion = (index: number, patch: Partial<CriterionDraft>) =>
    setEditor((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              criteria: current.draft.criteria.map((c, i) => (i === index ? { ...c, ...patch } : c)),
            },
          }
        : current,
    );

  const save = async () => {
    if (!editor || !companyId) return;
    const problem = validateTemplateDraft(editor.draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await saveEvaluationTemplate(companyId, editor.id, editor.draft, criteria, editor.locked);
      toast.success(editor.id ? "Đã cập nhật biểu mẫu." : "Đã tạo biểu mẫu.");
      setEditor(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const newVersion = async (template: EvaluationTemplate) => {
    try {
      await createEvaluationTemplateVersion(template.id);
      toast.success(`Đã tạo phiên bản mới của "${template.name}", bản cũ chuyển sang ngừng dùng.`);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteEvaluationTemplate(deleting.id);
      toast.success("Đã xoá biểu mẫu.");
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không xoá được biểu mẫu đã dùng, hãy chuyển sang ngừng dùng."));
    }
  };

  const totalWeight = editor ? editor.draft.criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0) : 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Đánh giá"
        title="Biểu mẫu đánh giá"
        description="Bộ tiêu chí có thang điểm và trọng số, dùng khi đánh giá phỏng vấn ứng viên. Biểu mẫu đã dùng thì khoá tiêu chí, muốn đổi hãy tạo phiên bản mới."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Hiện cả bản ngừng dùng
            </label>
            {canCreate && (
              <Button onClick={() => setEditor({ id: null, locked: false, draft: emptyDraft() })}>
                <Plus className="mr-2 h-4 w-4" /> Tạo biểu mẫu
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <ClipboardCheck className="h-8 w-8" />
          <p>Chưa có biểu mẫu đánh giá nào.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((template) => {
            const rows = criteriaByTemplate.get(template.id) ?? [];
            const weightSum = rows.reduce((sum, c) => sum + c.weight, 0);
            const isUsed = used.has(template.id);
            return (
              <Card key={template.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold">
                      {template.name} <span className="text-xs font-normal text-muted-foreground">v{template.version}</span>
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="outline">{EVALUATION_KIND_LABELS[template.kind]}</Badge>
                      <Badge variant="secondary">Thang 1–{template.scale_max}</Badge>
                      {!template.is_active && <Badge variant="outline">Ngừng dùng</Badge>}
                      {isUsed && (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" /> Đã dùng
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canEdit && (
                      <Button size="icon-sm" variant="ghost" aria-label="Sửa biểu mẫu" onClick={() => openEdit(template)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canCreate && isUsed && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Tạo phiên bản mới"
                        title="Tạo phiên bản mới"
                        onClick={() => void newVersion(template)}
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && !isUsed && (
                      <Button size="icon-sm" variant="ghost" aria-label="Xoá biểu mẫu" onClick={() => setDeleting(template)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                <ul className="divide-y rounded-md border text-sm">
                  {rows.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0 truncate">
                        {c.group_name && <span className="text-muted-foreground">{c.group_name} · </span>}
                        {c.name}
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {weightSum > 0 ? `${Math.round((c.weight / weightSum) * 1000) / 10}%` : "—"}
                      </span>
                    </li>
                  ))}
                  {rows.length === 0 && <li className="px-3 py-2 text-muted-foreground">Chưa có tiêu chí.</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editor} onOpenChange={(open) => !open && !saving && setEditor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {editor && (
            <>
              <DialogHeader>
                <DialogTitle>{editor.id ? "Sửa biểu mẫu đánh giá" : "Tạo biểu mẫu đánh giá"}</DialogTitle>
              </DialogHeader>
              {editor.locked && (
                <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> Biểu mẫu đã có phiếu đánh giá dùng nên chỉ sửa được tên, mô tả và trạng thái.
                  Muốn đổi tiêu chí, hãy tạo phiên bản mới.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="tpl-name">Tên biểu mẫu</Label>
                  <Input id="tpl-name" value={editor.draft.name} onChange={(e) => patchDraft({ name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Loại đánh giá</Label>
                  <Select
                    value={editor.draft.kind}
                    disabled={editor.locked}
                    onValueChange={(value) => patchDraft({ kind: value as EvaluationKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVALUATION_KIND_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-scale">Thang điểm tối đa (2–10)</Label>
                  <Input
                    id="tpl-scale"
                    type="number"
                    min={2}
                    max={10}
                    disabled={editor.locked}
                    value={editor.draft.scale_max}
                    onChange={(e) => patchDraft({ scale_max: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="tpl-desc">Mô tả / hướng dẫn chấm</Label>
                  <Textarea
                    id="tpl-desc"
                    rows={2}
                    value={editor.draft.description}
                    onChange={(e) => patchDraft({ description: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <Switch checked={editor.draft.is_active} onCheckedChange={(v) => patchDraft({ is_active: v })} /> Đang dùng
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tiêu chí ({editor.draft.criteria.length})</Label>
                  {!editor.locked && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => patchDraft({ criteria: [...editor.draft.criteria, emptyCriterion()] })}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Thêm tiêu chí
                    </Button>
                  )}
                </div>
                {editor.draft.criteria.map((c, index) => (
                  <div key={c.id ?? `new-${index}`} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1.4fr_90px_32px]">
                    <Input
                      placeholder="Nhóm (tuỳ chọn)"
                      aria-label={`Nhóm tiêu chí ${index + 1}`}
                      disabled={editor.locked}
                      value={c.group_name}
                      onChange={(e) => patchCriterion(index, { group_name: e.target.value })}
                    />
                    <Input
                      placeholder="Tên tiêu chí"
                      aria-label={`Tên tiêu chí ${index + 1}`}
                      disabled={editor.locked}
                      value={c.name}
                      onChange={(e) => patchCriterion(index, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      aria-label={`Trọng số tiêu chí ${index + 1}`}
                      title={totalWeight > 0 ? `${Math.round(((Number(c.weight) || 0) / totalWeight) * 1000) / 10}%` : ""}
                      disabled={editor.locked}
                      value={c.weight}
                      onChange={(e) => patchCriterion(index, { weight: Number(e.target.value) })}
                    />
                    {!editor.locked ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Bỏ tiêu chí ${index + 1}`}
                        onClick={() =>
                          patchDraft({ criteria: editor.draft.criteria.filter((_, i) => i !== index) })
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Input
                      className="sm:col-span-4"
                      placeholder="Mô tả / gợi ý chấm (tuỳ chọn)"
                      aria-label={`Mô tả tiêu chí ${index + 1}`}
                      disabled={editor.locked}
                      value={c.description}
                      onChange={(e) => patchCriterion(index, { description: e.target.value })}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Điểm tổng = Σ(điểm × trọng số) ÷ Σ trọng số, theo thang 1–{editor.draft.scale_max}. Tổng trọng số hiện tại:{" "}
                  {totalWeight}.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>
                  Huỷ
                </Button>
                <Button disabled={saving} onClick={() => void save()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá biểu mẫu?</AlertDialogTitle>
            <AlertDialogDescription>
              Biểu mẫu "{deleting?.name}" và các tiêu chí của nó sẽ bị xoá. Biểu mẫu đã dùng thì không xoá được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default EvaluationTemplatesPage;
