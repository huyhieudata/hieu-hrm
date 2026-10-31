import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const APPROVER_TYPE_LABELS: Record<string, string> = {
  direct_manager: "Quản lý trực tiếp",
  manager_of_manager: "Cấp trên của quản lý trực tiếp",
  specific: "Người được chỉ định",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  skipped: "Bỏ qua",
};

export interface ApprovalStep {
  id: string;
  company_id: string;
  request_type_id: string;
  step_order: number;
  name: string | null;
  approver_type: string;
  approver_employee_id: string | null;
  sla_hours: number;
}

export interface ApprovalWorkflow {
  id: string;
  company_id: string;
  name: string;
  scope_type: string;
  scope_value: string | null;
  effective_from: string | null;
  effective_to: string | null;
  active: boolean;
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  name: string | null;
  approver_type: string;
  approver_employee_id: string | null;
  sla_hours: number;
}

export interface WorkflowType {
  workflow_id: string;
  request_type_id: string;
}

export const listApprovalWorkflows = async (companyId: string): Promise<ApprovalWorkflow[]> => {
  const { data, error } = await db
    .from("approval_workflows")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được quy trình duyệt.");
  return (data ?? []) as ApprovalWorkflow[];
};

export const listWorkflowTypes = async (workflowIds: string[]): Promise<WorkflowType[]> => {
  if (workflowIds.length === 0) return [];
  const { data, error } = await db
    .from("approval_workflow_types")
    .select("workflow_id, request_type_id")
    .in("workflow_id", workflowIds);
  if (error) throw new Error(error.message ?? "Không tải được loại đơn của quy trình.");
  return (data ?? []) as WorkflowType[];
};

export const listWorkflowSteps = async (workflowIds: string[]): Promise<WorkflowStep[]> => {
  if (workflowIds.length === 0) return [];
  const { data, error } = await db
    .from("approval_workflow_steps")
    .select("*")
    .in("workflow_id", workflowIds)
    .order("step_order", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được bước duyệt của quy trình.");
  return (data ?? []) as WorkflowStep[];
};

export const createApprovalWorkflow = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("approval_workflows").insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được quy trình duyệt.");
  return data.id as string;
};

export const updateApprovalWorkflow = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("approval_workflows").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được quy trình duyệt.");
};

export const deleteApprovalWorkflow = async (id: string) => {
  const { error } = await db.from("approval_workflows").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được quy trình duyệt.");
};

export const saveWorkflowTypes = async (workflowId: string, requestTypeIds: string[]) => {
  const { error: deleteError } = await db
    .from("approval_workflow_types")
    .delete()
    .eq("workflow_id", workflowId);
  if (deleteError) throw new Error(deleteError.message ?? "Không lưu được loại đơn áp dụng.");
  if (requestTypeIds.length === 0) return;
  const { error } = await db
    .from("approval_workflow_types")
    .insert(requestTypeIds.map((id) => ({ workflow_id: workflowId, request_type_id: id })));
  if (error) throw new Error(error.message ?? "Không lưu được loại đơn áp dụng.");
};

export const saveWorkflowSteps = async (
  workflowId: string,
  steps: { name: string; approver_type: string; approver_employee_id: string | null; sla_hours: number }[],
) => {
  const { error: deleteError } = await db
    .from("approval_workflow_steps")
    .delete()
    .eq("workflow_id", workflowId);
  if (deleteError) throw new Error(deleteError.message ?? "Không lưu được bước duyệt.");
  if (steps.length === 0) return;
  const { error } = await db.from("approval_workflow_steps").insert(
    steps.map((step, index) => ({
      workflow_id: workflowId,
      step_order: index + 1,
      name: step.name,
      approver_type: step.approver_type,
      approver_employee_id: step.approver_type === "specific" ? step.approver_employee_id : null,
      sla_hours: step.sla_hours,
    })),
  );
  if (error) throw new Error(error.message ?? "Không lưu được bước duyệt.");
};

export interface RequestApproval {
  id: string;
  company_id: string;
  request_id: string;
  step_order: number;
  name: string | null;
  approver_type: string;
  approver_employee_id: string | null;
  sla_hours: number | null;
  due_at: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  created_at: string;
}

export const listApprovalSteps = async (companyId: string): Promise<ApprovalStep[]> => {
  const { data, error } = await db
    .from("request_approval_steps")
    .select("*")
    .eq("company_id", companyId)
    .order("request_type_id", { ascending: true })
    .order("step_order", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được quy trình duyệt.");
  return (data ?? []) as ApprovalStep[];
};

export const saveApprovalSteps = async (
  companyId: string,
  requestTypeId: string,
  steps: Omit<ApprovalStep, "id" | "company_id" | "request_type_id">[],
) => {
  const { error: deleteError } = await db
    .from("request_approval_steps")
    .delete()
    .eq("company_id", companyId)
    .eq("request_type_id", requestTypeId);
  if (deleteError) throw new Error(deleteError.message ?? "Không lưu được quy trình duyệt.");

  if (steps.length === 0) return;

  const { error } = await db.from("request_approval_steps").insert(
    steps.map((step, index) => ({
      company_id: companyId,
      request_type_id: requestTypeId,
      step_order: index + 1,
      name: step.name,
      approver_type: step.approver_type,
      approver_employee_id: step.approver_type === "specific" ? step.approver_employee_id : null,
      sla_hours: step.sla_hours,
    })),
  );
  if (error) throw new Error(error.message ?? "Không lưu được quy trình duyệt.");
};

export const listRequestApprovals = async (companyId: string): Promise<RequestApproval[]> => {
  const { data, error } = await db
    .from("request_approvals")
    .select("*")
    .eq("company_id", companyId)
    .order("step_order", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được tiến trình duyệt.");
  return (data ?? []) as RequestApproval[];
};

export const approvalsForRequest = (approvals: RequestApproval[], requestId: string) =>
  approvals.filter((item) => item.request_id === requestId).sort((a, b) => a.step_order - b.step_order);

export const currentApproval = (approvals: RequestApproval[], requestId: string) =>
  approvalsForRequest(approvals, requestId).find((item) => item.status === "pending") ?? null;

export const updateApproval = async (
  id: string,
  values: { status: string; decided_by: string; note: string | null },
) => {
  const { error } = await db
    .from("request_approvals")
    .update({ ...values, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được bước duyệt.");
};

export const skipPendingApprovals = async (approvals: RequestApproval[]) => {
  const ids = approvals.filter((item) => item.status === "pending").map((item) => item.id);
  if (ids.length === 0) return;
  const { error } = await db.from("request_approvals").update({ status: "skipped" }).in("id", ids);
  if (error) throw new Error(error.message ?? "Không cập nhật được bước duyệt.");
};

export const slaState = (approval: RequestApproval | null) => {
  if (!approval?.due_at) return "none" as const;
  const due = new Date(approval.due_at).getTime();
  const now = Date.now();
  if (approval.status !== "pending") return "done" as const;
  if (now > due) return "overdue" as const;
  if (due - now < 4 * 3600 * 1000) return "soon" as const;
  return "ontrack" as const;
};

export const formatDue = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
