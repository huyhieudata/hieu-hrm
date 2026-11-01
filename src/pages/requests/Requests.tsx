import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, FileText, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import RequestDialog from "@/components/requests/request-dialog";
import { EmployeeRequestsView } from "@/pages/me/EmployeeRequestsView";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { SelectionBar } from "@/components/common/selection-bar";
import { useSelection } from "@/lib/use-selection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { findMyEmployee } from "@/lib/attendance";
import { getErrorMessage } from "@/lib/utils";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { listCompanyContracts, type CompanyContract } from "@/lib/contracts";
import {
  listLeaveBalances,
  listLeavePolicies,
  listLeavePolicyItems,
  summarizeLeave,
  type LeaveBalanceRow,
  type LeavePolicy,
  type LeavePolicyItem,
} from "@/lib/leave";
import {
  approvalsForRequest,
  currentApproval,
  formatDue,
  listRequestApprovals,
  skipPendingApprovals,
  slaState,
  updateApproval,
  type RequestApproval,
} from "@/lib/approvals";
import {
  applyAttendanceFix,
  createRequestRow,
  deleteRequestRow,
  cancelApprovedRequest,
  listRequestTypes,
  listRequests,
  overtimeSummary,
  REQUEST_SESSION_LABELS,
  REQUEST_STATUS_LABELS,
  requestStatusTone,
  updateRequestRow,
  type EmployeeRequest,
  type RequestType,
} from "@/lib/requests";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "cancelled", label: "Đã huỷ" },
];

const formatDay = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const shortTime = (value: string | null) => (value ? value.slice(0, 5) : "");

const Requests = () => {
  const { user } = useAuth();
  const { activeCompany, can, canManageModule, role } = useCompany();
  const companyId = activeCompany?.id ?? null;
  // Quản lý toàn bộ đơn (chọn tất cả, xoá hàng loạt, duyệt thay) chỉ dành cho Owner/Admin/HR.
  const isHrPlus = role === "owner" || role === "admin" || role === "hr";
  const canManage = isHrPlus && canManageModule("requests");
  const canApprove = can("leave.approve");

  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [types, setTypes] = useState<RequestType[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [myEmployee, setMyEmployee] = useState<EmployeeRecord | null>(null);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leavePolicyItems, setLeavePolicyItems] = useState<LeavePolicyItem[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [contracts, setContracts] = useState<CompanyContract[]>([]);
  const [approvals, setApprovals] = useState<RequestApproval[]>([]);
  const [tab, setTab] = useState("mine");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [params] = useSearchParams();
  useEffect(() => {
    if (params.get("tao") === "1") setFormOpen(true);
  }, [params]);
  const [decision, setDecision] = useState<{ request: EmployeeRequest; status: "approved" | "rejected" } | null>(
    null,
  );
  const [decisionNote, setDecisionNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { selected, toggle, selectAll, clear, prune } = useSelection();

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const [
        requestRows,
        typeRows,
        employeeRows,
        mine,
        policyRows,
        policyItemRows,
        balanceRows,
        approvalRows,
        contractRows,
      ] =
        await Promise.all([
          listRequests(companyId),
          listRequestTypes(companyId),
          listEmployees(companyId),
          findMyEmployee(companyId, user.id),
          listLeavePolicies(companyId),
          listLeavePolicyItems(companyId),
          listLeaveBalances(companyId, new Date().getFullYear()),
          listRequestApprovals(companyId),
          listCompanyContracts(companyId),
        ]);
      setRequests(requestRows);
      setTypes(typeRows);
      setEmployees(employeeRows);
      setMyEmployee(mine);
      setPolicies(policyRows);
      setLeavePolicyItems(policyItemRows);
      setLeaveBalances(balanceRows);
      setApprovals(approvalRows);
      setContracts(contractRows);
      prune(requestRows.map((request) => request.id));
    } catch (error) {
      toast.error("Không tải được đơn từ", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id, prune]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees]);
  const typeById = useMemo(() => new Map(types.map((item) => [item.id, item])), [types]);

  const myEmployeeId = myEmployee?.id ?? null;
  const reportIds = useMemo(
    () =>
      new Set(
        employees
          // Quản lý: danh sách nhân viên đã được RLS giới hạn theo phạm vi (cấp dưới trực tiếp + cùng phòng/phòng mình phụ trách).
          .filter(
            (employee) =>
              myEmployeeId &&
              employee.id !== myEmployeeId &&
              (employee.manager_id === myEmployeeId || role === "manager"),
          )
          .map((employee) => employee.id),
      ),
    [employees, myEmployeeId, role],
  );

  const inScope = useCallback(
    (request: EmployeeRequest) => {
      if (canManage) return true;
      if (request.employee_id === myEmployeeId) return true;
      return reportIds.has(request.employee_id);
    },
    [canManage, myEmployeeId, reportIds],
  );

  const approvalsByRequest = useMemo(() => {
    const map = new Map<string, RequestApproval[]>();
    approvals.forEach((approval) => {
      map.set(approval.request_id, [...(map.get(approval.request_id) ?? []), approval]);
    });
    map.forEach((list) => list.sort((a, b) => a.step_order - b.step_order));
    return map;
  }, [approvals]);

  const currentApprovalFor = useCallback(
    (requestId: string) => currentApproval(approvals, requestId),
    [approvals],
  );

  const canActOn = useCallback(
    (request: EmployeeRequest) => {
      if (request.status !== "pending") return false;
      // Không tự duyệt đơn của chính mình (server cũng chặn).
      if (myEmployeeId && request.employee_id === myEmployeeId) return false;
      const current = currentApprovalFor(request.id);
      // Không có bước duyệt: HR+ hoặc Quản lý trực tiếp của người gửi (có quyền duyệt).
      if (!current) return canApprove && (canManage || reportIds.has(request.employee_id));
      // Bước hiện tại đã có người duyệt cụ thể (vd. Quản lý trực tiếp): chỉ người đó, HR+ được duyệt thay.
      if (current.approver_employee_id) return current.approver_employee_id === myEmployeeId || canManage;
      // Bước theo vai trò (HR/Admin) chưa gán người: chỉ HR+.
      return canManage;
    },
    [canApprove, canManage, currentApprovalFor, myEmployeeId, reportIds],
  );

  const tabs = useMemo(() => {
    const mineCount = requests.filter((request) => request.employee_id === myEmployeeId).length;
    const approveCount = requests.filter((request) => canActOn(request)).length;
    const approvedCount = requests.filter((request) => request.status === "approved" && inScope(request)).length;
    const managedCount = requests.filter((request) => reportIds.has(request.employee_id)).length;

    return [
      { value: "mine", label: "Đơn của tôi", count: mineCount },
      canApprove && { value: "to_approve", label: "Đơn tôi duyệt", count: approveCount },
      { value: "approved", label: "Đơn đã duyệt", count: approvedCount },
      reportIds.size > 0 && { value: "managed", label: "Đơn tôi quản lý", count: managedCount },
    ].filter(Boolean) as { value: string; label: string; count: number }[];
  }, [canActOn, canApprove, inScope, myEmployeeId, reportIds, requests]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((item) => item.value === tab)) {
      setTab(tabs[0].value);
    }
  }, [tab, tabs]);

  const tabRequests = useMemo(() => {
    if (tab === "mine") return requests.filter((request) => request.employee_id === myEmployeeId);
    if (tab === "to_approve") return requests.filter((request) => canActOn(request));
    if (tab === "approved") return requests.filter((request) => request.status === "approved" && inScope(request));
    if (tab === "managed") return requests.filter((request) => reportIds.has(request.employee_id));
    return requests;
  }, [canActOn, inScope, myEmployeeId, reportIds, requests, tab]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tabRequests.filter((request) => {
      if (tab === "mine" && statusFilter !== "all" && request.status !== statusFilter) return false;
      if (typeFilter !== "all" && request.request_type_id !== typeFilter) return false;
      if (!keyword) return true;
      const employee = employeeById.get(request.employee_id);
      const type = typeById.get(request.request_type_id);
      return `${employee?.full_name ?? ""} ${employee?.code ?? ""} ${type?.name ?? ""} ${request.reason ?? ""}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [employeeById, query, statusFilter, tab, tabRequests, typeById, typeFilter]);

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;
  const year = new Date().getFullYear();
  const leaveSummaries = useMemo(() => {
    const map: Record<string, { entitlement: number; used: number; remaining: number }> = {};
    employees.forEach((employee) => {
      const summary = summarizeLeave({
        employee,
        year,
        policies,
        items: leavePolicyItems,
        balances: leaveBalances,
        requests,
        types,
        contracts: contracts.filter((contract) => contract.employee_id === employee.id),
      });
      map[employee.id] = {
        entitlement: summary.entitlement,
        used: summary.used,
        remaining: summary.remaining,
      };
    });
    return map;
  }, [contracts, employees, leaveBalances, leavePolicyItems, policies, requests, types, year]);
  const leaveUsed = useMemo(
    () =>
      requests
        .filter(
          (request) =>
            request.status === "approved" &&
            typeById.get(request.request_type_id)?.deduct_leave &&
            request.start_date.slice(0, 4) === String(year),
        )
        .reduce((total, request) => total + Number(request.leave_days ?? 0), 0),
    [requests, typeById, year],
  );

  const [cancelTarget, setCancelTarget] = useState<EmployeeRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const handleCancelApproved = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 5) {
      toast.error("Vui lòng nhập lý do huỷ (tối thiểu 5 ký tự).");
      return;
    }
    setCancelling(true);
    try {
      await cancelApprovedRequest(cancelTarget.id, cancelReason.trim());
      toast.success("Đã huỷ đơn đã duyệt (đã ghi nhật ký)");
      setCancelTarget(null);
      await load();
    } catch (error) {
      toast.error("Không huỷ được đơn", { description: getErrorMessage(error) });
    } finally {
      setCancelling(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const approvedIds = new Set(requests.filter((item) => item.status === "approved").map((item) => item.id));
      const deletable = selected.filter((id) => !approvedIds.has(id));
      await Promise.all(deletable.map((id) => deleteRequestRow(id)));
      toast.success(`Đã xoá ${deletable.length} đơn`, {
        description:
          deletable.length < selected.length
            ? `Bỏ qua ${selected.length - deletable.length} đơn đã duyệt — đơn đã duyệt chỉ có thể huỷ kèm lý do.`
            : undefined,
      });
      clear();
      setBulkOpen(false);
      await load();
    } catch (error) {
      toast.error("Không xoá được đơn", { description: getErrorMessage(error) });
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    await createRequestRow({ ...values, company_id: companyId });
    toast.success("Đã gửi đơn");
    await load();
  };

  const handleDecide = async () => {
    if (!decision || !user?.id) return;
    const decisionType = typeById.get(decision.request.request_type_id);
    if (decision.status === "approved" && decisionType?.category === "attendance_fix" && !canManage) {
      toast.error("Chỉ HR/quản trị viên được duyệt đơn sửa chấm công.");
      return;
    }
    setDeciding(true);
    try {
      const request = decision.request;
      const stamp = new Date().toISOString();
      const note = decisionNote.trim() || null;
      const current = currentApprovalFor(request.id);

      if (current) {
        await updateApproval(current.id, { status: decision.status, decided_by: user.id, note });
        const siblings = approvalsForRequest(approvals, request.id);
        const remaining = siblings.filter((item) => item.status === "pending" && item.id !== current.id);

        if (decision.status === "rejected") {
          await skipPendingApprovals(remaining);
          await updateRequestRow(request.id, {
            status: "rejected",
            decided_by: user.id,
            decided_at: stamp,
            decision_note: note,
          });
          toast.success("Đã từ chối đơn", { description: "Quy trình duyệt đã dừng." });
        } else if (remaining.length === 0) {
          await updateRequestRow(request.id, {
            status: "approved",
            decided_by: user.id,
            decided_at: stamp,
            decision_note: note,
          });
          if (typeById.get(request.request_type_id)?.category === "attendance_fix") {
            await applyAttendanceFix(request);
          }
          toast.success("Đã duyệt đơn", {
            description:
              typeById.get(request.request_type_id)?.category === "attendance_fix"
                ? "Bảng công đã được cập nhật theo giờ điều chỉnh."
                : undefined,
          });
        } else {
          toast.success(`Đã duyệt bước ${current.step_order}/${siblings.length}`, {
            description: "Đơn chuyển sang bước duyệt tiếp theo.",
          });
        }
      } else {
        await updateRequestRow(request.id, {
          status: decision.status,
          decided_by: user.id,
          decided_at: stamp,
          decision_note: note,
        });
        if (decision.status === "approved" && typeById.get(request.request_type_id)?.category === "attendance_fix") {
          await applyAttendanceFix(request);
        }
        toast.success(decision.status === "approved" ? "Đã duyệt đơn" : "Đã từ chối đơn", {
          description:
            decision.status === "approved" &&
            typeById.get(request.request_type_id)?.category === "attendance_fix"
              ? "Bảng công đã được cập nhật theo giờ điều chỉnh."
              : undefined,
        });
      }

      setDecision(null);
      setDecisionNote("");
      await load();
    } catch (error) {
      toast.error("Không xử lý được đơn", { description: getErrorMessage(error) });
    } finally {
      setDeciding(false);
    }
  };

  const cancelRequest = async (request: EmployeeRequest) => {
    try {
      await updateRequestRow(request.id, { status: "cancelled" });
      toast.success("Đã huỷ đơn");
      await load();
    } catch (error) {
      toast.error("Không huỷ được đơn", { description: getErrorMessage(error) });
    }
  };

  const removeRequest = async (request: EmployeeRequest) => {
    try {
      await deleteRequestRow(request.id);
      toast.success("Đã xoá đơn");
      await load();
    } catch (error) {
      toast.error("Không xoá được đơn", { description: getErrorMessage(error) });
    }
  };

  if (role === "employee") {
    return (
      <AppShell>
        <EmployeeRequestsView
          loading={loading}
          requests={requests}
          types={types}
          me={myEmployee}
          status={statusFilter}
          onStatus={setStatusFilter}
          remainingLeave={myEmployee ? leaveSummaries[myEmployee.id]?.remaining : null}
          onCreate={() => setFormOpen(true)}
        />
        <RequestDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          employees={myEmployee ? [myEmployee] : employees}
          types={types.filter((type) => type.active)}
          defaultEmployeeId={myEmployee?.id}
          leaveSummaries={leaveSummaries}
          onSubmit={handleCreate}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Đơn từ"
        title="Danh sách đơn"
        description="Đi muộn, về sớm, nghỉ phép, làm từ xa, sửa chấm công, ra ngoài… duyệt xong sẽ cập nhật bảng công."
        actions={
          <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Tạo đơn
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Chờ duyệt</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Đã duyệt</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{approvedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Ngày phép đã trừ ({year})
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{leaveUsed}</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setTab(item.value);
                setStatusFilter("all");
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                tab === item.value
                  ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {item.label}
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] ${
                  tab === item.value ? "bg-primary/15" : "bg-muted"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={filtered.length > 0 && filtered.every((request) => selected.includes(request.id))}
              onChange={() => selectAll(filtered.map((request) => request.id))}
            />
            Chọn trang
          </label>
        )}
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả loại đơn</option>
          {[...types]
            .sort((a, b) => Number(b.active) - Number(a.active) || a.sort_order - b.sort_order)
            .map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
                {type.active ? "" : " (đã tắt)"}
              </option>
            ))}
        </select>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm nhân sự, loại đơn…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[220px]"
          />
        </label>
        </div>
      </Card>

      {tab === "mine" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === filter.value
                  ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải đơn từ…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có đơn phù hợp</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tạo đơn mới để gửi duyệt.</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
        {canManage && (
          <SelectionBar count={selected.length} label="đơn" onClear={clear} onDelete={() => setBulkOpen(true)} />
        )}
        <div className="grid gap-2.5 xl:grid-cols-2">
          {filtered.map((request) => {
            const employee = employeeById.get(request.employee_id);
            const type = typeById.get(request.request_type_id);
            const isOwner = myEmployee?.id === request.employee_id;
            const period =
              request.start_date === request.end_date
                ? formatDay(request.start_date)
                : `${formatDay(request.start_date)} → ${formatDay(request.end_date)}`;
            const times = [shortTime(request.start_time), shortTime(request.end_time)].filter(Boolean).join(" – ");
            const steps = approvalsByRequest.get(request.id) ?? [];
            const pendingStep = steps.find((item) => item.status === "pending") ?? null;
            const pendingState = slaState(pendingStep);

            return (
              <Card key={request.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {canManage && (
                    <label className="touch-check mt-1">
                      <input
                        type="checkbox"
                        aria-label="Chọn đơn"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={selected.includes(request.id)}
                        onChange={() => toggle(request.id)}
                      />
                    </label>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12.5px] font-semibold text-foreground">
                        {employee?.full_name ?? "Nhân sự"}
                        {employee?.code && <span className="ml-1 font-normal text-muted-foreground">{employee.code}</span>}
                      </p>
                      <Badge variant="muted">{type?.name ?? "Loại đơn"}</Badge>
                      {type?.deduct_leave && (
                        <Badge variant="info">Trừ {request.leave_days || 0} ngày phép</Badge>
                      )}
                      {type?.category === "overtime" && <Badge variant="info">{overtimeSummary(request)}</Badge>}
                      <Badge variant={requestStatusTone(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {period}
                      {request.session ? ` · ${REQUEST_SESSION_LABELS[request.session] ?? request.session}` : ""}
                      {times ? ` · ${times}` : ""}
                    </p>
                    {request.reason && (
                      <p className="mt-1 line-clamp-2 text-[11.5px] text-foreground/80">{request.reason}</p>
                    )}
                    {request.decision_note && request.status !== "pending" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Phản hồi: {request.decision_note}</p>
                    )}
                    {steps.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        {pendingStep ? (
                          <>
                            <Badge variant={pendingState === "overdue" ? "destructive" : "muted"}>
                              Bước {pendingStep.step_order}/{steps.length}
                            </Badge>
                            <span>
                              {pendingStep.name ?? `Bước ${pendingStep.step_order}`} ·{" "}
                              {employeeById.get(pendingStep.approver_employee_id ?? "")?.full_name ?? "HR/quản trị"}
                            </span>
                            {pendingStep.due_at && (
                              <span className={pendingState === "overdue" ? "font-medium text-destructive" : ""}>
                                Hạn {formatDue(pendingStep.due_at)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span>Đã hoàn tất {steps.length} bước duyệt</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {canActOn(request) && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 gap-1 text-[11.5px]"
                          onClick={() => {
                            setDecision({ request, status: "approved" });
                            setDecisionNote("");
                          }}
                        >
                          <Check className="h-3.5 w-3.5" /> Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-[11.5px]"
                          onClick={() => {
                            setDecision({ request, status: "rejected" });
                            setDecisionNote("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" /> Từ chối
                        </Button>
                      </>
                    )}
                    {request.status === "pending" && (isOwner || canManage) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11.5px] text-muted-foreground"
                        onClick={() => void cancelRequest(request)}
                      >
                        Huỷ
                      </Button>
                    )}
                    {canManage && request.status === "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11.5px] text-muted-foreground"
                        onClick={() => {
                          setCancelTarget(request);
                          setCancelReason("");
                        }}
                      >
                        Huỷ đơn đã duyệt
                      </Button>
                    )}
                    {canManage && request.status !== "pending" && request.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11.5px] text-muted-foreground"
                        onClick={() => void removeRequest(request)}
                      >
                        Xoá
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        </div>
      )}

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {selected.length} đơn?</AlertDialogTitle>
            <AlertDialogDescription>Các đơn đã chọn sẽ bị xoá khỏi mô-đun Đơn từ.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleBulkDelete()}
            >
              Xoá đã chọn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RequestDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employees={employees}
        types={types.filter((type) => type.active)}
        defaultEmployeeId={myEmployee?.id}
        leaveSummaries={leaveSummaries}
        onSubmit={handleCreate}
      />

      <Dialog open={!!decision} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{decision?.status === "approved" ? "Duyệt đơn" : "Từ chối đơn"}</DialogTitle>
            <DialogDescription>
              {decision && typeById.get(decision.request.request_type_id)?.category === "attendance_fix" &&
              decision.status === "approved"
                ? "Bảng công sẽ được cập nhật theo giờ điều chỉnh trong đơn."
                : "Ghi chú phản hồi sẽ hiển thị cho người gửi."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            placeholder="Ghi chú (không bắt buộc)…"
          />
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setDecision(null)} disabled={deciding}>
              Huỷ
            </Button>
            <Button
              className={`h-9 gap-2 ${decision?.status === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
              onClick={() => void handleDecide()}
              disabled={deciding}
            >
              {deciding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {decision?.status === "approved" ? "Duyệt đơn" : "Từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Huỷ đơn đã duyệt</DialogTitle>
            <DialogDescription>
              Đơn đã duyệt không thể xoá. Huỷ cần lý do; thao tác được ghi vào nhật ký và báo cho nhân viên.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Lý do huỷ (bắt buộc)…"
          />
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Đóng
            </Button>
            <Button
              className="h-9 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleCancelApproved()}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Huỷ đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Requests;
