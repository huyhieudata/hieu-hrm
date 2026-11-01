import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { listRequestTypes, type RequestType } from "@/lib/requests";
import {
  APPROVER_TYPE_LABELS,
  createApprovalWorkflow,
  deleteApprovalWorkflow,
  listApprovalSteps,
  listApprovalWorkflows,
  listWorkflowSteps,
  listWorkflowTypes,
  saveApprovalSteps,
  saveWorkflowSteps,
  saveWorkflowTypes,
  updateApprovalWorkflow,
  type ApprovalStep,
  type ApprovalWorkflow,
  type WorkflowStep,
  type WorkflowType,
} from "@/lib/approvals";

interface StepDraft {
  name: string;
  approver_type: string;
  approver_employee_id: string;
  sla_hours: string;
}

const defaultStep = (index: number): StepDraft => ({
  name: `Bước ${index + 1}`,
  approver_type: "direct_manager",
  approver_employee_id: "",
  sla_hours: "24",
});

const ApprovalWorkflow = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("requests");

  const [types, setTypes] = useState<RequestType[]>([]);
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [workflowTypes, setWorkflowTypes] = useState<WorkflowType[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const [wfOpen, setWfOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [wfName, setWfName] = useState("");
  const [wfScope, setWfScope] = useState("company");
  const [wfScopeValue, setWfScopeValue] = useState("");
  const [wfFrom, setWfFrom] = useState("");
  const [wfTo, setWfTo] = useState("");
  const [wfTypeIds, setWfTypeIds] = useState<string[]>([]);
  const [wfSteps, setWfSteps] = useState<StepDraft[]>([defaultStep(0)]);
  const [wfSaving, setWfSaving] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
  const [pendingWorkflowDelete, setPendingWorkflowDelete] = useState<ApprovalWorkflow | null>(null);

  const [editingType, setEditingType] = useState<RequestType | null>(null);
  const [draft, setDraft] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [typeRows, stepRows, employeeRows, workflowRows] = await Promise.all([
        listRequestTypes(companyId),
        listApprovalSteps(companyId),
        listEmployees(companyId),
        listApprovalWorkflows(companyId),
      ]);
      const workflowIds = workflowRows.map((workflow) => workflow.id);
      const [workflowTypeRows, workflowStepRows] = await Promise.all([
        listWorkflowTypes(workflowIds),
        listWorkflowSteps(workflowIds),
      ]);
      setTypes(typeRows);
      setSteps(stepRows);
      setEmployees(employeeRows);
      setWorkflows(workflowRows);
      setWorkflowTypes(workflowTypeRows);
      setWorkflowSteps(workflowStepRows);
    } catch (loadError) {
      toast.error("Không tải được quy trình duyệt", { description: getErrorMessage(loadError) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeName = useCallback(
    (id: string | null) => employees.find((employee) => employee.id === id)?.full_name ?? null,
    [employees],
  );

  const stepsFor = (typeId: string) =>
    steps.filter((step) => step.request_type_id === typeId).sort((a, b) => a.step_order - b.step_order);

  const openEditor = (type: RequestType) => {
    const existing = stepsFor(type.id);
    setEditingType(type);
    setDraft(
      existing.length > 0
        ? existing.map((step) => ({
            name: step.name ?? `Bước ${step.step_order}`,
            approver_type: step.approver_type,
            approver_employee_id: step.approver_employee_id ?? "",
            sla_hours: String(step.sla_hours ?? 24),
          }))
        : [defaultStep(0)],
    );
    setError(null);
  };

  const updateStep = (index: number, patch: Partial<StepDraft>) =>
    setDraft((prev) => prev.map((step, position) => (position === index ? { ...step, ...patch } : step)));

  const removeStep = (index: number) =>
    setDraft((prev) => prev.filter((_, position) => position !== index));

  const addStep = () => setDraft((prev) => [...prev, defaultStep(prev.length)]);

  const scopeOptions = useMemo(
    () => ({
      department: Array.from(
        new Set(employees.map((employee) => employee.department).filter((name): name is string => !!name)),
      ).sort((a, b) => a.localeCompare(b, "vi")),
      position: Array.from(
        new Set(employees.map((employee) => employee.position).filter((title): title is string => !!title)),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    }),
    [employees],
  );

  const typesForWorkflow = (workflowId: string) =>
    workflowTypes.filter((item) => item.workflow_id === workflowId).map((item) => item.request_type_id);

  const stepsForWorkflow = (workflowId: string) =>
    workflowSteps
      .filter((step) => step.workflow_id === workflowId)
      .sort((a, b) => a.step_order - b.step_order);

  const scopeText = (workflow: ApprovalWorkflow) => {
    if (workflow.scope_type === "company") return "Toàn công ty";
    if (workflow.scope_type === "employee") {
      const employee = employees.find((item) => item.id === workflow.scope_value);
      return `Nhân sự · ${employee?.full_name ?? workflow.scope_value}`;
    }
    return `${workflow.scope_type === "department" ? "Bộ phận" : "Vị trí"} · ${workflow.scope_value}`;
  };

  const openWorkflowEditor = (workflow: ApprovalWorkflow | null) => {
    setEditingWorkflow(workflow);
    setWfError(null);
    if (workflow) {
      setWfName(workflow.name);
      setWfScope(workflow.scope_type);
      setWfScopeValue(workflow.scope_value ?? "");
      setWfFrom(workflow.effective_from ?? "");
      setWfTo(workflow.effective_to ?? "");
      setWfTypeIds(typesForWorkflow(workflow.id));
      const ownSteps = stepsForWorkflow(workflow.id);
      setWfSteps(
        ownSteps.length > 0
          ? ownSteps.map((step) => ({
              name: step.name ?? `Bước ${step.step_order}`,
              approver_type: step.approver_type,
              approver_employee_id: step.approver_employee_id ?? "",
              sla_hours: String(step.sla_hours ?? 24),
            }))
          : [defaultStep(0)],
      );
    } else {
      setWfName("Quy trình duyệt đơn");
      setWfScope("company");
      setWfScopeValue("");
      setWfFrom("");
      setWfTo("");
      setWfTypeIds(types.map((type) => type.id));
      setWfSteps([defaultStep(0)]);
    }
    setWfOpen(true);
  };

  const updateWfStep = (index: number, patch: Partial<StepDraft>) =>
    setWfSteps((prev) => prev.map((step, position) => (position === index ? { ...step, ...patch } : step)));

  const saveWorkflow = async () => {
    if (!companyId) return;
    setWfError(null);

    if (!wfName.trim()) {
      setWfError("Vui lòng nhập tên quy trình.");
      return;
    }
    if (wfScope !== "company" && !wfScopeValue) {
      setWfError("Chọn phạm vi áp dụng cụ thể.");
      return;
    }
    if (wfTypeIds.length === 0) {
      setWfError("Chọn ít nhất một loại đơn áp dụng.");
      return;
    }
    if (wfSteps.length === 0) {
      setWfError("Thêm ít nhất một bước duyệt.");
      return;
    }
    for (const [index, step] of wfSteps.entries()) {
      if (step.approver_type === "specific" && !step.approver_employee_id) {
        setWfError(`Bước ${index + 1}: chọn người duyệt cụ thể.`);
        return;
      }
      if (!step.sla_hours || Number(step.sla_hours) <= 0) {
        setWfError(`Bước ${index + 1}: SLA phải lớn hơn 0 giờ.`);
        return;
      }
    }
    if (wfFrom && wfTo && wfTo < wfFrom) {
      setWfError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    setWfSaving(true);
    try {
      const payload = {
        name: wfName.trim(),
        scope_type: wfScope,
        scope_value: wfScope === "company" ? null : wfScopeValue,
        effective_from: wfFrom || null,
        effective_to: wfTo || null,
        active: true,
      };

      let workflowId = editingWorkflow?.id ?? null;
      if (workflowId) {
        await updateApprovalWorkflow(workflowId, payload);
      } else {
        workflowId = await createApprovalWorkflow({ ...payload, company_id: companyId });
      }

      await saveWorkflowTypes(workflowId, wfTypeIds);
      await saveWorkflowSteps(
        workflowId,
        wfSteps.map((step, index) => ({
          name: step.name.trim() || `Bước ${index + 1}`,
          approver_type: step.approver_type,
          approver_employee_id: step.approver_type === "specific" ? step.approver_employee_id : null,
          sla_hours: Number(step.sla_hours),
        })),
      );

      toast.success(editingWorkflow ? "Đã cập nhật quy trình duyệt" : "Đã tạo quy trình duyệt");
      setWfOpen(false);
      setEditingWorkflow(null);
      await load();
    } catch (error) {
      setWfError(getErrorMessage(error));
    } finally {
      setWfSaving(false);
    }
  };

  const removeWorkflow = async () => {
    if (!pendingWorkflowDelete) return;
    try {
      await deleteApprovalWorkflow(pendingWorkflowDelete.id);
      toast.success("Đã xoá quy trình duyệt");
      setPendingWorkflowDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được quy trình", { description: getErrorMessage(error) });
    }
  };

  const submit = async () => {
    if (!companyId || !editingType) return;
    setError(null);

    for (const [index, step] of draft.entries()) {
      if (!step.approver_type) {
        setError(`Bước ${index + 1}: chọn cấp duyệt.`);
        return;
      }
      if (step.approver_type === "specific" && !step.approver_employee_id) {
        setError(`Bước ${index + 1}: chọn người duyệt cụ thể.`);
        return;
      }
      if (!step.sla_hours || Number(step.sla_hours) <= 0) {
        setError(`Bước ${index + 1}: SLA phải lớn hơn 0 giờ.`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveApprovalSteps(
        companyId,
        editingType.id,
        draft.map((step, index) => ({
          step_order: index + 1,
          name: step.name.trim() || `Bước ${index + 1}`,
          approver_type: step.approver_type,
          approver_employee_id: step.approver_type === "specific" ? step.approver_employee_id : null,
          sla_hours: Number(step.sla_hours),
        })),
      );
      toast.success("Đã lưu quy trình duyệt", {
        description: `${editingType.name} · ${draft.length} bước`,
      });
      setEditingType(null);
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = useMemo(() => steps.length, [steps]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Đơn từ"
        title="Quy trình duyệt"
        description="Thiết lập quy trình theo phạm vi áp dụng và các bước duyệt cho từng loại đơn."
        actions={
          canManage && (
            <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => openWorkflowEditor(null)}>
              <Plus className="h-4 w-4" /> Tạo quy trình duyệt
            </Button>
          )
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          {types.length} loại đơn · {totalSteps} bước duyệt đã cấu hình
        </div>
        <p className="text-[11px] text-muted-foreground">
          Không cấu hình bước nào: đơn sẽ chờ HR/quản trị viên duyệt trực tiếp.
        </p>
      </Card>

      {workflows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Quy trình theo phạm vi áp dụng
          </p>
          {workflows.map((workflow) => {
            const typeNames = typesForWorkflow(workflow.id)
              .map((id) => types.find((type) => type.id === id)?.name)
              .filter(Boolean);
            const ownSteps = stepsForWorkflow(workflow.id);
            return (
              <Card key={workflow.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{workflow.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {scopeText(workflow)} · {ownSteps.length} bước
                      {workflow.effective_from || workflow.effective_to
                        ? ` · ${workflow.effective_from ?? "…"} → ${workflow.effective_to ?? "…"}`
                        : " · áp dụng không thời hạn"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Loại đơn: {typeNames.length > 0 ? typeNames.join(", ") : "chưa chọn"}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11.5px]"
                        onClick={() => openWorkflowEditor(workflow)}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Xoá ${workflow.name}`}
                        onClick={() => setPendingWorkflowDelete(workflow)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải quy trình…
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {types.map((type) => {
            const typeSteps = stepsFor(type.id);
            return (
              <Card key={type.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{type.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {typeSteps.length > 0
                        ? `${typeSteps.length} bước duyệt`
                        : "Duyệt trực tiếp bởi HR/quản trị viên"}
                    </p>
                  </div>
                  {canManage && (
                    <Button variant="outline" size="sm" className="h-8 text-[11.5px]" onClick={() => openEditor(type)}>
                      {typeSteps.length > 0 ? "Sửa quy trình" : "Thiết lập"}
                    </Button>
                  )}
                </div>

                {typeSteps.length > 0 && (
                  <ol className="mt-3 space-y-2">
                    {typeSteps.map((step) => (
                      <li key={step.id} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[11px] font-semibold text-primary-subtle-foreground">
                          {step.step_order}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-foreground">{step.name ?? `Bước ${step.step_order}`}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {APPROVER_TYPE_LABELS[step.approver_type] ?? step.approver_type}
                            {step.approver_type === "specific"
                              ? ` · ${employeeName(step.approver_employee_id) ?? "Chưa chọn người"}`
                              : ""}
                          </p>
                        </div>
                        <Badge variant="muted" className="shrink-0">
                          SLA {step.sla_hours}h
                        </Badge>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Quy trình duyệt — {editingType?.name}</DialogTitle>
            <DialogDescription>
              Đơn mới sẽ đi qua các bước theo thứ tự; SLA tính từ lúc đơn được gửi. Đơn đang xử lý giữ quy trình cũ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {draft.length === 0 && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11.5px] text-muted-foreground">
                Chưa có bước duyệt. Đơn sẽ chờ HR/quản trị viên duyệt trực tiếp.
              </p>
            )}

            {draft.map((step, index) => (
              <div key={index} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-semibold text-foreground">Bước {index + 1}</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Xoá bước ${index + 1}`}
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tên bước</Label>
                    <Input
                      value={step.name}
                      onChange={(event) => updateStep(index, { name: event.target.value })}
                      className="h-9 text-[12px]"
                      placeholder={`Bước ${index + 1}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Cấp duyệt</Label>
                    <Select
                      value={step.approver_type}
                      onValueChange={(value) => updateStep(index, { approver_type: value, approver_employee_id: "" })}
                    >
                      <SelectTrigger className="h-9 text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(APPROVER_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {step.approver_type === "specific" && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px]">Người duyệt cụ thể</Label>
                      <Select
                        value={step.approver_employee_id}
                        onValueChange={(value) => updateStep(index, { approver_employee_id: value })}
                      >
                        <SelectTrigger className="h-9 text-[12px]">
                          <SelectValue placeholder="Chọn nhân sự" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((employee) => employee.status !== "resigned")
                            .map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.full_name} · {employee.code}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[11px]">SLA (giờ)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={step.sla_hours}
                      onChange={(event) => updateStep(index, { sla_hours: event.target.value })}
                      className="h-9 text-[12px]"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]" onClick={addStep}>
              <Plus className="h-3.5 w-3.5" /> Thêm bước duyệt
            </Button>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setEditingType(null)} disabled={saving}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu quy trình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={wfOpen}
        onOpenChange={(open) => {
          setWfOpen(open);
          if (!open) setEditingWorkflow(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "Sửa quy trình duyệt" : "Tạo quy trình duyệt"}</DialogTitle>
            <DialogDescription>
              Quy trình áp dụng cho các loại đơn đã chọn; phạm vi hẹp hơn (nhân sự → vị trí → bộ phận) được ưu tiên.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Tên quy trình</Label>
              <Input value={wfName} onChange={(event) => setWfName(event.target.value)} className="h-10" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Áp dụng cho</Label>
                <Select
                  value={wfScope}
                  onValueChange={(value) => {
                    setWfScope(value);
                    setWfScopeValue("");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Toàn công ty</SelectItem>
                    <SelectItem value="department">Phòng ban</SelectItem>
                    <SelectItem value="position">Vị trí</SelectItem>
                    <SelectItem value="employee">Nhân sự cụ thể</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {wfScope !== "company" && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">
                    {wfScope === "department" ? "Phòng ban" : wfScope === "position" ? "Vị trí" : "Nhân sự"}
                  </Label>
                  <Select value={wfScopeValue} onValueChange={setWfScopeValue}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      {wfScope === "department" &&
                        scopeOptions.department.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      {wfScope === "position" &&
                        scopeOptions.position.map((title) => (
                          <SelectItem key={title} value={title}>
                            {title}
                          </SelectItem>
                        ))}
                      {wfScope === "employee" &&
                        employees
                          .filter((employee) => employee.status !== "resigned")
                          .map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.full_name} · {employee.code}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[12px]">Hiệu lực từ</Label>
                <Input
                  type="date"
                  value={wfFrom}
                  onChange={(event) => setWfFrom(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Hiệu lực đến</Label>
                <Input type="date" value={wfTo} onChange={(event) => setWfTo(event.target.value)} className="h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[12px]">Loại đơn áp dụng</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {types.map((type) => {
                  const checked = wfTypeIds.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() =>
                        setWfTypeIds((prev) =>
                          prev.includes(type.id) ? prev.filter((id) => id !== type.id) : [...prev, type.id],
                        )
                      }
                      className={`rounded-md border px-2 py-2 text-[11.5px] text-left transition-colors ${
                        checked
                          ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {type.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px]">Các bước duyệt</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => setWfSteps((prev) => [...prev, defaultStep(prev.length)])}
                >
                  <Plus className="h-3 w-3" /> Thêm bước
                </Button>
              </div>

              {wfSteps.map((step, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11.5px] font-semibold text-foreground">Bước {index + 1}</p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xoá bước ${index + 1}`}
                      onClick={() => setWfSteps((prev) => prev.filter((_, position) => position !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Tên bước</Label>
                      <Input
                        value={step.name}
                        onChange={(event) => updateWfStep(index, { name: event.target.value })}
                        className="h-9 text-[12px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Cấp duyệt</Label>
                      <Select
                        value={step.approver_type}
                        onValueChange={(value) =>
                          updateWfStep(index, { approver_type: value, approver_employee_id: "" })
                        }
                      >
                        <SelectTrigger className="h-9 text-[12px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(APPROVER_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {step.approver_type === "specific" && (
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[11px]">Người duyệt cụ thể</Label>
                        <Select
                          value={step.approver_employee_id}
                          onValueChange={(value) => updateWfStep(index, { approver_employee_id: value })}
                        >
                          <SelectTrigger className="h-9 text-[12px]">
                            <SelectValue placeholder="Chọn nhân sự" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees
                              .filter((employee) => employee.status !== "resigned")
                              .map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.full_name} · {employee.code}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[11px]">SLA (giờ)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={step.sla_hours}
                        onChange={(event) => updateWfStep(index, { sla_hours: event.target.value })}
                        className="h-9 text-[12px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {wfError && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                {wfError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setWfOpen(false)} disabled={wfSaving}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void saveWorkflow()} disabled={wfSaving}>
              {wfSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu quy trình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingWorkflowDelete}
        onOpenChange={(open) => !open && setPendingWorkflowDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá quy trình duyệt?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingWorkflowDelete?.name} sẽ bị xoá. Các đơn đang xử lý vẫn giữ tiến trình đã tạo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeWorkflow()}
            >
              Xoá quy trình
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default ApprovalWorkflow;
