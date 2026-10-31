import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  Eye,
  FileDown,
  FileSpreadsheet,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog } from "@/components/employee/field-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-provider";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/utils";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { listRequests, listRequestTypes, type EmployeeRequest, type RequestType } from "@/lib/requests";
import { listCompanyContracts, type CompanyContract } from "@/lib/contracts";
import {
  createLeavePolicy,
  deleteLeavePolicy,
  autoAnnualLeaveDays,
  employeeInLeaveAssignments,
  isAnnualLeaveItem,
  listLeaveBalanceLogs,
  listLeaveBalances,
  listLeavePolicies,
  listLeavePolicyAssignments,
  logLeaveBalanceChange,
  saveLeavePolicyAssignments,
  listLeavePolicyItems,
  proratedItemDays,
  saveLeaveBalance,
  saveLeavePolicyItems,
  summarizeLeave,
  updateLeavePolicy,
  type LeaveBalanceLog,
  type LeaveBalanceRow,
  type LeavePolicy,
  type LeavePolicyAssignment,
  type LeavePolicyItem,
} from "@/lib/leave";
import { useAuth } from "@/lib/auth-provider";

interface ItemDraft {
  name: string;
  days: string;
  carries_over: boolean;
}

interface PolicyDraft {
  name: string;
  year: string;
  carry_over_max: string;
  prorate_by_hire_date: boolean;
  auto_annual_leave: boolean;
  active: boolean;
  items: ItemDraft[];
}

const emptyItem = (): ItemDraft => ({ name: "", days: "12", carries_over: true });

const LeavePolicies = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("leave");

  const [year, setYear] = useState(new Date().getFullYear());
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [items, setItems] = useState<LeavePolicyItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [types, setTypes] = useState<RequestType[]>([]);
  const [contracts, setContracts] = useState<CompanyContract[]>([]);
  const [assignments, setAssignments] = useState<LeavePolicyAssignment[]>([]);
  const [logs, setLogs] = useState<LeaveBalanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [detailEmployee, setDetailEmployee] = useState<EmployeeRecord | null>(null);

  const [assignMode, setAssignMode] = useState("company");
  const [assignDepartments, setAssignDepartments] = useState<string[]>([]);
  const [assignPositions, setAssignPositions] = useState<string[]>([]);
  const [assignEmployees, setAssignEmployees] = useState<string[]>([]);
  const [assignQuery, setAssignQuery] = useState("");

  const [policyOpen, setPolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [draft, setDraft] = useState<PolicyDraft>({
    name: "",
    year: String(new Date().getFullYear()),
    carry_over_max: "5",
    prorate_by_hire_date: true,
    auto_annual_leave: true,
    active: true,
    items: [],
  });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<LeavePolicy | null>(null);
  const [adjustEmployee, setAdjustEmployee] = useState<EmployeeRecord | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [
        policyRows,
        itemRows,
        balanceRows,
        employeeRows,
        requestRows,
        typeRows,
        assignmentRows,
        logRows,
        contractRows,
      ] = await Promise.all([
        listLeavePolicies(companyId),
        listLeavePolicyItems(companyId),
        listLeaveBalances(companyId, year),
        listEmployees(companyId),
        listRequests(companyId),
        listRequestTypes(companyId),
        listLeavePolicyAssignments(companyId),
        listLeaveBalanceLogs(companyId, year),
        listCompanyContracts(companyId),
      ]);
      setPolicies(policyRows);
      setItems(itemRows);
      setBalances(balanceRows);
      setEmployees(employeeRows);
      setRequests(requestRows);
      setTypes(typeRows);
      setAssignments(assignmentRows);
      setLogs(logRows);
      setContracts(contractRows);
    } catch (error) {
      toast.error("Không tải được dữ liệu nghỉ phép", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const policy = useMemo(() => policies.find((item) => item.year === year) ?? null, [policies, year]);
  const policyItems = useMemo(
    () => items.filter((item) => item.policy_id === policy?.id).sort((a, b) => a.sort_order - b.sort_order),
    [items, policy?.id],
  );

  const policyAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.policy_id === policy?.id),
    [assignments, policy?.id],
  );

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(employees.map((employee) => employee.department).filter((name): name is string => !!name)),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [employees],
  );

  const positionOptions = useMemo(
    () =>
      Array.from(
        new Set(employees.map((employee) => employee.position).filter((title): title is string => !!title)),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [employees],
  );

  const scopedEmployees = useMemo(() => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const keyword = query.trim().toLowerCase();

    return employees.filter((employee) => {
      if (employee.hire_date && employee.hire_date > end) return false;
      if (employee.resignation_date && employee.resignation_date < start) return false;
      if (policyAssignments.length > 0 && !employeeInLeaveAssignments(employee, policyAssignments)) return false;
      if (departmentFilter !== "all" && employee.department !== departmentFilter) return false;
      if (positionFilter !== "all" && employee.position !== positionFilter) return false;
      if (keyword) {
        const haystack = `${employee.full_name} ${employee.code} ${employee.department ?? ""} ${employee.position ?? ""}`;
        if (!haystack.toLowerCase().includes(keyword)) return false;
      }
      return true;
    });
  }, [departmentFilter, employees, policyAssignments, positionFilter, query, year]);

  const summaries = useMemo(
    () =>
      scopedEmployees.map((employee) => ({
        employee,
        summary: summarizeLeave({
          employee,
          year,
          policies,
          items,
          balances,
          requests,
          types,
          contracts: contracts.filter((contract) => contract.employee_id === employee.id),
        }),
      })),
    [balances, contracts, items, policies, requests, scopedEmployees, types, year],
  );

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);

  const itemColumns = useMemo(
    () =>
      policyItems
        .filter((item) => !(policy?.auto_annual_leave && isAnnualLeaveItem(item.name)))
        .map((item) => ({ ...item, days: Number(item.days) })),
    [policy?.auto_annual_leave, policyItems],
  );

  const employeeContracts = useCallback(
    (employeeId: string) => contracts.filter((contract) => contract.employee_id === employeeId),
    [contracts],
  );

  const leaveLedger = useMemo(() => {
    const deductIds = new Set(types.filter((type) => type.deduct_leave).map((type) => type.id));
    return requests
      .filter(
        (request) =>
          request.status === "approved" &&
          deductIds.has(request.request_type_id) &&
          request.start_date.slice(0, 4) === String(year),
      )
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [requests, types, year]);

  const totals = useMemo(
    () =>
      summaries.reduce(
        (acc, item) => ({
          entitlement: acc.entitlement + item.summary.entitlement,
          used: acc.used + item.summary.used,
          remaining: acc.remaining + item.summary.remaining,
        }),
        { entitlement: 0, used: 0, remaining: 0 },
      ),
    [summaries],
  );

  const openPolicy = (existing: LeavePolicy | null) => {
    setEditingPolicy(existing);
    setPolicyError(null);
    setAssignQuery("");
    setAssignDepartments([]);
    setAssignPositions([]);
    setAssignEmployees([]);
    setAssignMode("company");

    if (existing) {
      const own = assignments.filter((assignment) => assignment.policy_id === existing.id);
      const mode = own.find((assignment) => assignment.scope_type !== "company")?.scope_type ?? "company";
      setAssignMode(mode);
      setAssignDepartments(
        own.filter((assignment) => assignment.scope_type === "department").map((assignment) => assignment.scope_value ?? ""),
      );
      setAssignPositions(
        own.filter((assignment) => assignment.scope_type === "position").map((assignment) => assignment.scope_value ?? ""),
      );
      setAssignEmployees(
        own.filter((assignment) => assignment.scope_type === "employee").map((assignment) => assignment.scope_value ?? ""),
      );
    }
    if (existing) {
      const own = items
        .filter((item) => item.policy_id === existing.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const auto = existing.auto_annual_leave;
      const manualOwn = own.filter((item) => !(auto && isAnnualLeaveItem(item.name)));
      setDraft({
        name: existing.name,
        year: String(existing.year),
        carry_over_max: String(existing.carry_over_max),
        prorate_by_hire_date: existing.prorate_by_hire_date,
        auto_annual_leave: auto,
        active: existing.active,
        items: manualOwn.map((item) => ({
          name: item.name,
          days: String(item.days),
          carries_over: item.carries_over,
        })),
      });
    } else {
      setDraft({
        name: "Chính sách phép năm",
        year: String(year),
        carry_over_max: "5",
        prorate_by_hire_date: true,
        auto_annual_leave: true,
        active: true,
        items: [],
      });
    }
    setPolicyOpen(true);
  };

  const updateDraft = (patch: Partial<PolicyDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const updateItem = (index: number, patch: Partial<ItemDraft>) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    }));

  const savePolicy = async () => {
    if (!companyId) return;
    setPolicyError(null);

    if (!draft.name.trim()) {
      setPolicyError("Vui lòng nhập tên chính sách.");
      return;
    }
    if (!draft.auto_annual_leave && draft.items.length === 0) {
      setPolicyError("Thêm ít nhất một loại phép vào quỹ hoặc bật phép năm tự động.");
      return;
    }
    for (const [index, item] of draft.items.entries()) {
      if (!item.name.trim()) {
        setPolicyError(`Loại phép ${index + 1}: chưa nhập tên.`);
        return;
      }
      if (Number.isNaN(Number(item.days)) || Number(item.days) < 0) {
        setPolicyError(`Loại phép ${index + 1}: số ngày không hợp lệ.`);
        return;
      }
    }

    setSavingPolicy(true);
    try {
      const totalDays = draft.items.reduce((sum, item) => sum + Number(item.days), 0);
      const payload = {
        name: draft.name.trim(),
        year: Number(draft.year),
        days_per_year: Number(totalDays.toFixed(1)),
        carry_over_max: Number(draft.carry_over_max || 0),
        prorate_by_hire_date: draft.prorate_by_hire_date,
        auto_annual_leave: draft.auto_annual_leave,
        active: draft.active,
      };

      let policyId = editingPolicy?.id ?? null;
      if (policyId) {
        await updateLeavePolicy(policyId, payload);
      } else {
        policyId = await createLeavePolicy({ ...payload, company_id: companyId });
      }

      await saveLeavePolicyItems(
        companyId,
        policyId,
        draft.items
          .filter((item) => !(draft.auto_annual_leave && isAnnualLeaveItem(item.name)))
          .map((item) => ({
            name: item.name.trim(),
            days: Number(item.days),
            carries_over: item.carries_over,
          })),
      );

      if (assignMode === "department" && assignDepartments.length === 0) {
        throw new Error("Chọn ít nhất một bộ phận áp dụng chính sách.");
      }
      if (assignMode === "position" && assignPositions.length === 0) {
        throw new Error("Chọn ít nhất một vị trí áp dụng chính sách.");
      }
      if (assignMode === "employee" && assignEmployees.length === 0) {
        throw new Error("Chọn ít nhất một nhân sự áp dụng chính sách.");
      }

      await saveLeavePolicyAssignments(
        companyId,
        policyId,
        assignMode === "company"
          ? [{ scope_type: "company", scope_value: null }]
          : assignMode === "department"
            ? assignDepartments.map((name) => ({ scope_type: "department", scope_value: name }))
            : assignMode === "position"
              ? assignPositions.map((title) => ({ scope_type: "position", scope_value: title }))
              : assignEmployees.map((id) => ({ scope_type: "employee", scope_value: id })),
      );

      toast.success(editingPolicy ? "Đã cập nhật chính sách phép" : "Đã tạo chính sách phép");
      setPolicyOpen(false);
      setEditingPolicy(null);
      setYear(Number(draft.year));
      await load();
    } catch (error) {
      setPolicyError(getErrorMessage(error));
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!pendingDelete) return;
    try {
      await deleteLeavePolicy(pendingDelete.id);
      toast.success("Đã xoá chính sách phép");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  const balance = (employeeId: string) =>
    balances.find((row) => row.employee_id === employeeId && row.year === year) ?? null;

  const handleAdjust = async (values: Record<string, string | number | null>) => {
    if (!companyId || !adjustEmployee) throw new Error("Thiếu thông tin.");
    try {
      const nextValue = Number(values.adjustment_days ?? 0);
      const previousValue = Number(balance(adjustEmployee.id)?.adjustment_days ?? 0);
      await saveLeaveBalance({
        company_id: companyId,
        employee_id: adjustEmployee.id,
        year,
        adjustment_days: nextValue,
        note: (values.note as string) ?? null,
      });
      if (nextValue !== previousValue) {
        await logLeaveBalanceChange({
          company_id: companyId,
          employee_id: adjustEmployee.id,
          year,
          change_days: Number((nextValue - previousValue).toFixed(1)),
          note: (values.note as string) ?? null,
          created_by: user?.id ?? null,
        });
      }
      toast.success("Đã cập nhật số dư phép");
      setAdjustEmployee(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const detailSummary = useMemo(
    () =>
      detailEmployee
        ? summarizeLeave({ employee: detailEmployee, year, policies, items, balances, requests, types })
        : null,
    [balances, detailEmployee, items, policies, requests, types, year],
  );

  const detailSources = useMemo(() => {
    if (!detailEmployee || !policy) return [];
    const autoSources = policy.auto_annual_leave
      ? [
          {
            id: "auto-annual",
            name: "Phép năm (theo hợp đồng)",
            days: autoAnnualLeaveDays(detailEmployee, employeeContracts(detailEmployee.id), year),
            carriesOver: true,
          },
        ]
      : [];
    return [
      ...autoSources,
      ...policyItems
        .filter((item) => !(policy.auto_annual_leave && isAnnualLeaveItem(item.name)))
        .map((item) => ({
          id: item.id,
          name: item.name,
          days: proratedItemDays(detailEmployee, policy, Number(item.days), year),
          carriesOver: item.carries_over,
        })),
    ];
  }, [detailEmployee, employeeContracts, policy, policyItems, year]);

  const detailHistory = useMemo(() => {
    if (!detailEmployee) return [];
    const adjustmentEntries = logs
      .filter((log) => log.employee_id === detailEmployee.id && log.year === year)
      .map((log) => ({
        id: `log-${log.id}`,
        date: log.created_at,
        label: "Điều chỉnh quỹ phép",
        note: log.note,
        change: Number(log.change_days),
      }));

    const leaveEntries = requests
      .filter(
        (request) =>
          request.employee_id === detailEmployee.id &&
          request.status === "approved" &&
          typeById.get(request.request_type_id)?.deduct_leave &&
          request.start_date.slice(0, 4) === String(year),
      )
      .map((request) => ({
        id: `req-${request.id}`,
        date: `${request.start_date}T00:00:00`,
        label: typeById.get(request.request_type_id)?.name ?? "Nghỉ phép",
        note: request.reason,
        change: -Number(request.leave_days ?? 0),
      }));

    return [...adjustmentEntries, ...leaveEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [detailEmployee, logs, requests, typeById, year]);

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    ...itemColumns.map((item) => item.name),
    "Chuyển năm trước",
    "Điều chỉnh",
    "Tổng quỹ",
    "Đã dùng",
    "Còn lại",
  ];

  const exportRows = () =>
    summaries.map(({ employee, summary }) => [
      employee.code,
      employee.full_name,
      employee.department ?? "",
      ...itemColumns.map((item) =>
        policy ? proratedItemDays(employee, policy, item.days, year) : 0,
      ),
      summary.carryOver,
      summary.adjustment,
      summary.entitlement,
      summary.used,
      summary.remaining,
    ]);

  const fileBase = `quy-phep-${year}`;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Nghỉ phép"
        title="Quỹ phép & chính sách"
        description="Thiết lập chính sách phép với nhiều loại phép, theo dõi quỹ phép, số ngày đã dùng và còn lại."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => exportExcel(fileBase, exportHeaders, exportRows(), `Quỹ phép ${year}`)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportPdf(
                  `Quỹ phép năm ${year}`,
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            {canManage && (
              <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => openPolicy(policy)}>
                <Plus className="h-4 w-4" /> {policy ? "Sửa chính sách" : "Tạo chính sách"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tổng quỹ phép</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">
            {Number(totals.entitlement.toFixed(1))}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Đã sử dụng</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-warning">
            {Number(totals.used.toFixed(1))}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Còn lại</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-success">
            {Number(totals.remaining.toFixed(1))}
          </p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <label className="text-[12px] text-muted-foreground">Năm</label>
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())}
            className="h-9 w-[100px] rounded-md border border-border bg-card px-3 text-[12.5px] text-foreground shadow-xs outline-none focus:border-primary"
          />
        </div>

        {policy ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={policy.active ? "success" : "muted"}>{policy.name}</Badge>
            <span className="text-[11.5px] text-muted-foreground">
              chuyển tối đa {policy.carry_over_max} ngày
              {policy.prorate_by_hire_date ? " · tính theo ngày vào làm" : ""}
            </span>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Thao tác chính sách">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[190px]">
                  <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => openPolicy(policy)}>
                    <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                    onSelect={() => setPendingDelete(policy)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xoá chính sách
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">Chưa có chính sách phép cho năm {year}.</span>
        )}
      </Card>

      {policy && (
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> Các loại phép trong quỹ
          </p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Phạm vi áp dụng:{" "}
            {policyAssignments.length === 0 || policyAssignments.some((assignment) => assignment.scope_type === "company")
              ? "Toàn công ty"
              : policyAssignments
                  .map((assignment) => {
                    const label =
                      assignment.scope_type === "department"
                        ? "Bộ phận"
                        : assignment.scope_type === "position"
                          ? "Vị trí"
                          : "Nhân sự";
                    const value =
                      assignment.scope_type === "employee"
                        ? employees.find((employee) => employee.id === assignment.scope_value)?.full_name ??
                          assignment.scope_value
                        : assignment.scope_value;
                    return `${label} · ${value}`;
                  })
                  .join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {policyItems.length === 0 ? (
              <span className="text-[11.5px] text-muted-foreground">Chưa có loại phép — dùng số ngày mặc định.</span>
            ) : (
              policyItems.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[11.5px] text-foreground"
                >
                  {item.name}
                  <span className="font-semibold text-primary-subtle-foreground">{item.days} ngày</span>
                  {!item.carries_over && <Badge variant="muted">không chuyển</Badge>}
                </span>
              ))
            )}
          </div>
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm nhân sự, mã, phòng ban…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[250px]"
          />
        </label>
        <select
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả phòng ban</option>
          {departmentOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={positionFilter}
          onChange={(event) => setPositionFilter(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả vị trí</option>
          {positionOptions.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[11.5px] text-muted-foreground">{scopedEmployees.length} nhân sự</span>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải quỹ phép…
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Nhân sự</th>
                  {policy?.auto_annual_leave && (
                    <th className="w-[120px] px-2 py-2.5 text-center font-semibold">Phép năm (HĐ)</th>
                  )}
                  {itemColumns.length === 0 && !policy?.auto_annual_leave ? (
                    <th className="w-[90px] px-2 py-2.5 text-center font-semibold">Phép cơ bản</th>
                  ) : (
                    itemColumns.map((item) => (
                      <th key={item.id} className="w-[110px] px-2 py-2.5 text-center font-semibold">
                        {item.name}
                      </th>
                    ))
                  )}
                  <th className="w-[100px] px-2 py-2.5 text-center font-semibold">Chuyển năm trước</th>
                  <th className="w-[80px] px-2 py-2.5 text-center font-semibold">Điều chỉnh</th>
                  <th className="w-[90px] px-2 py-2.5 text-center font-semibold">Tổng quỹ</th>
                  <th className="w-[80px] px-2 py-2.5 text-center font-semibold">Đã dùng</th>
                  <th className="w-[90px] px-2 py-2.5 text-center font-semibold">Còn lại</th>
                  <th className="w-[48px] px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {summaries.map(({ employee, summary }) => (
                  <tr key={employee.id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <p className="text-[12px] font-medium text-foreground">{employee.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {employee.code}
                        {employee.department ? ` · ${employee.department}` : ""}
                      </p>
                    </td>
                    {policy?.auto_annual_leave && (
                      <td className="px-2 py-2 text-center font-medium text-foreground">
                        {autoAnnualLeaveDays(employee, employeeContracts(employee.id), year)}
                      </td>
                    )}
                    {itemColumns.length === 0 && !policy?.auto_annual_leave ? (
                      <td className="px-2 py-2 text-center text-muted-foreground">{summary.base}</td>
                    ) : (
                      itemColumns.map((item) => (
                        <td key={item.id} className="px-2 py-2 text-center text-muted-foreground">
                          {policy ? proratedItemDays(employee, policy, item.days, year) : 0}
                        </td>
                      ))
                    )}
                    <td className="px-2 py-2 text-center text-muted-foreground">{summary.carryOver}</td>
                    <td className="px-2 py-2 text-center text-muted-foreground">{summary.adjustment}</td>
                    <td className="px-2 py-2 text-center font-semibold text-foreground">{summary.entitlement}</td>
                    <td className="px-2 py-2 text-center text-warning">{summary.used}</td>
                    <td
                      className={`px-2 py-2 text-center font-semibold ${
                        summary.remaining < 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {summary.remaining}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Xem chi tiết phép ${employee.full_name}`}
                          onClick={() => setDetailEmployee(employee)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Điều chỉnh phép ${employee.full_name}`}
                            onClick={() => setAdjustEmployee(employee)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summaries.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">
              Không có nhân sự làm việc trong năm {year}.
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Bảng phép đã sử dụng</h3>
            <p className="text-[11.5px] text-muted-foreground">
              Các đơn nghỉ có trừ quỹ phép, đã duyệt trong năm {year}.
            </p>
          </div>
          <Badge variant="muted">{leaveLedger.length} lượt nghỉ</Badge>
        </div>

        {leaveLedger.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-muted-foreground">Chưa có ngày phép nào được sử dụng.</p>
        ) : (
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/30 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Thời gian nghỉ</th>
                  <th className="px-3 py-2 text-left font-semibold">Nhân sự</th>
                  <th className="px-3 py-2 text-left font-semibold">Nguồn phép</th>
                  <th className="w-[80px] px-3 py-2 text-center font-semibold">Số ngày</th>
                  <th className="px-3 py-2 text-left font-semibold">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {leaveLedger.map((request) => {
                  const employee = employeeById.get(request.employee_id);
                  const type = typeById.get(request.request_type_id);
                  return (
                    <tr key={request.id} className="border-t border-border/50">
                      <td className="px-4 py-2 text-foreground">
                        {request.start_date === request.end_date
                          ? new Date(`${request.start_date}T00:00:00`).toLocaleDateString("vi-VN")
                          : `${new Date(`${request.start_date}T00:00:00`).toLocaleDateString("vi-VN")} → ${new Date(
                              `${request.end_date}T00:00:00`,
                            ).toLocaleDateString("vi-VN")}`}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-foreground">{employee?.full_name ?? "—"}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">{employee?.code ?? ""}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="info">{type?.name ?? "Nghỉ phép"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-warning">{request.leave_days}</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-muted-foreground">{request.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

            <Dialog open={!!detailEmployee} onOpenChange={(open) => !open && setDetailEmployee(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Chi tiết phép — {detailEmployee?.full_name}</DialogTitle>
            <DialogDescription>
              {detailEmployee?.code}
              {detailEmployee?.department ? ` · ${detailEmployee.department}` : ""}
              {detailEmployee?.position ? ` · ${detailEmployee.position}` : ""} · năm {year}
            </DialogDescription>
          </DialogHeader>

          {detailSummary && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border bg-muted/25 px-3 py-2">
                  <p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">Tổng quỹ</p>
                  <p className="text-[18px] font-semibold text-foreground">{detailSummary.entitlement}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/25 px-3 py-2">
                  <p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">Đã dùng</p>
                  <p className="text-[18px] font-semibold text-warning">{detailSummary.used}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/25 px-3 py-2">
                  <p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">Còn lại</p>
                  <p className={`text-[18px] font-semibold ${detailSummary.remaining < 0 ? "text-destructive" : "text-success"}`}>
                    {detailSummary.remaining}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Nguồn phép</p>
                <ul className="mt-1.5 divide-y divide-border/60 rounded-md border border-border">
                  {detailSources.length === 0 ? (
                    <li className="flex items-center justify-between px-3 py-2 text-[11.5px]">
                      <span className="text-foreground">Phép cơ bản</span>
                      <span className="font-semibold text-foreground">{detailSummary.base}</span>
                    </li>
                  ) : (
                    detailSources.map((source) => (
                      <li key={source.id} className="flex items-center justify-between px-3 py-2 text-[11.5px]">
                        <span className="text-foreground">
                          {source.name}
                          {!source.carriesOver && <span className="ml-1.5 text-[10px] text-muted-foreground">không chuyển</span>}
                        </span>
                        <span className="font-semibold text-foreground">{source.days}</span>
                      </li>
                    ))
                  )}
                  <li className="flex items-center justify-between px-3 py-2 text-[11.5px]">
                    <span className="text-muted-foreground">Chuyển từ năm trước</span>
                    <span className="font-medium text-foreground">{detailSummary.carryOver}</span>
                  </li>
                  <li className="flex items-center justify-between px-3 py-2 text-[11.5px]">
                    <span className="text-muted-foreground">Điều chỉnh</span>
                    <span className="font-medium text-foreground">{detailSummary.adjustment}</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Lịch sử thay đổi phép
                </p>
                {detailHistory.length === 0 ? (
                  <p className="mt-1.5 rounded-md border border-border px-3 py-4 text-center text-[11.5px] text-muted-foreground">
                    Chưa có thay đổi nào trong năm {year}.
                  </p>
                ) : (
                  <ul className="scrollbar-slim mt-1.5 max-h-[250px] divide-y divide-border/60 overflow-y-auto rounded-md border border-border">
                    {detailHistory.map((entry) => (
                      <li key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11.5px] font-medium text-foreground">{entry.label}</p>
                          <p className="truncate text-[10.5px] text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString("vi-VN")}
                            {entry.note ? ` · ${entry.note}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[11.5px] font-semibold ${
                            entry.change >= 0 ? "text-success" : "text-warning"
                          }`}
                        >
                          {entry.change >= 0 ? "+" : ""}
                          {entry.change} ngày
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setDetailEmployee(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Sửa chính sách phép" : "Tạo chính sách phép"}</DialogTitle>
            <DialogDescription>
              Quỹ phép = tổng các loại phép, cộng phép chuyển từ năm trước và điều chỉnh thủ công.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px]">Tên chính sách</Label>
                <Input
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Năm áp dụng</Label>
                <Input
                  type="number"
                  value={draft.year}
                  onChange={(event) => updateDraft({ year: event.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Số ngày chuyển sang năm sau (tối đa)</Label>
                <Input
                  type="number"
                  value={draft.carry_over_max}
                  onChange={(event) => updateDraft({ carry_over_max: event.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Tính theo ngày vào làm</Label>
                <Select
                  value={draft.prorate_by_hire_date ? "true" : "false"}
                  onValueChange={(value) => updateDraft({ prorate_by_hire_date: value === "true" })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Có (chia theo tháng)</SelectItem>
                    <SelectItem value="false">Không (đủ năm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Phép năm tự động theo hợp đồng</Label>
                <Select
                  value={draft.auto_annual_leave ? "true" : "false"}
                  onValueChange={(value) => {
                    const enabled = value === "true";
                    setDraft((prev) => ({
                      ...prev,
                      auto_annual_leave: enabled,
                      items: enabled
                        ? prev.items.filter((item) => !isAnnualLeaveItem(item.name))
                        : prev.items.some((item) => isAnnualLeaveItem(item.name))
                          ? prev.items
                          : [...prev.items, { name: "Phép năm", days: "12", carries_over: true }],
                    }));
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Có · 1 ngày mỗi tháng làm việc theo HĐ</SelectItem>
                    <SelectItem value="false">Không · nhập thủ công</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Trạng thái</Label>
                <Select
                  value={draft.active ? "true" : "false"}
                  onValueChange={(value) => updateDraft({ active: value === "true" })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Đang áp dụng</SelectItem>
                    <SelectItem value="false">Tạm dừng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px]">Các loại phép bổ sung</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => setDraft((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))}
                >
                  <Plus className="h-3 w-3" /> Thêm loại phép
                </Button>
              </div>

              {draft.auto_annual_leave && (
                <p className="rounded-md border border-border bg-muted/25 px-3 py-2 text-[10.5px] text-muted-foreground">
                  Phép năm được tính tự động: mỗi tháng làm việc theo hợp đồng xác định thời hạn hoặc không xác
                  định thời hạn = 1 ngày. Chỉ thêm các loại phép bổ sung bên dưới.
                </p>
              )}

              {draft.items.map((item, index) => (
                <div key={index} className="rounded-md border border-border bg-muted/20 p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[1fr_90px_130px_32px] sm:items-center">
                    <Input
                      value={item.name}
                      onChange={(event) => updateItem(index, { name: event.target.value })}
                      placeholder="Nghỉ phép năm"
                      className="h-9 text-[12px]"
                    />
                    <Input
                      type="number"
                      step={0.5}
                      min={0}
                      value={item.days}
                      onChange={(event) => updateItem(index, { days: event.target.value })}
                      className="h-9 text-[12px]"
                    />
                    <Select
                      value={item.carries_over ? "true" : "false"}
                      onValueChange={(value) => updateItem(index, { carries_over: value === "true" })}
                    >
                      <SelectTrigger className="h-9 text-[11.5px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Được chuyển năm sau</SelectItem>
                        <SelectItem value="false">Không chuyển</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xoá loại phép ${index + 1}`}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, position) => position !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}

              <p className="text-[10.5px] text-muted-foreground">
                Tổng quỹ:{" "}
                <span className="font-semibold text-foreground">
                  {Number(draft.items.reduce((sum, item) => sum + (Number(item.days) || 0), 0).toFixed(1))} ngày
                </span>
              </p>
            </div>

                        <div className="space-y-2">
              <Label className="text-[12px]">Gán chính sách cho</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { value: "company", label: "Toàn công ty" },
                  { value: "department", label: "Bộ phận" },
                  { value: "position", label: "Vị trí" },
                  { value: "employee", label: "Nhân sự" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAssignMode(option.value)}
                    className={`rounded-md border px-2 py-2 text-[11.5px] font-medium transition-colors ${
                      assignMode === option.value
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {assignMode === "company" && (
                <p className="rounded-md border border-border bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                  Áp dụng cho toàn bộ nhân sự trong công ty.
                </p>
              )}

              {assignMode === "department" && (
                <div className="scrollbar-slim max-h-[170px] overflow-y-auto rounded-md border border-border">
                  {departmentOptions.length === 0 ? (
                    <p className="px-3 py-5 text-center text-[11px] text-muted-foreground">Chưa có phòng ban.</p>
                  ) : (
                    departmentOptions.map((name) => {
                      const checked = assignDepartments.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() =>
                            setAssignDepartments((prev) =>
                              prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
                            )
                          }
                          className="flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate text-[11.5px] text-foreground">{name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {assignMode === "position" && (
                <div className="scrollbar-slim max-h-[170px] overflow-y-auto rounded-md border border-border">
                  {positionOptions.length === 0 ? (
                    <p className="px-3 py-5 text-center text-[11px] text-muted-foreground">Chưa có vị trí.</p>
                  ) : (
                    positionOptions.map((title) => {
                      const checked = assignPositions.includes(title);
                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() =>
                            setAssignPositions((prev) =>
                              prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title],
                            )
                          }
                          className="flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate text-[11.5px] text-foreground">{title}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {assignMode === "employee" && (
                <>
                  <Input
                    value={assignQuery}
                    onChange={(event) => setAssignQuery(event.target.value)}
                    placeholder="Tìm nhân sự để gán…"
                    className="h-9 text-[12px]"
                  />
                  <div className="scrollbar-slim max-h-[170px] overflow-y-auto rounded-md border border-border">
                    {employees
                      .filter((employee) => employee.status !== "resigned")
                      .filter((employee) =>
                        `${employee.full_name} ${employee.code}`
                          .toLowerCase()
                          .includes(assignQuery.trim().toLowerCase()),
                      )
                      .map((employee) => {
                        const checked = assignEmployees.includes(employee.id);
                        return (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() =>
                              setAssignEmployees((prev) =>
                                prev.includes(employee.id)
                                  ? prev.filter((item) => item !== employee.id)
                                  : [...prev, employee.id],
                              )
                            }
                            className="flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[11.5px] text-foreground">{employee.full_name}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {employee.code}
                                {employee.department ? ` · ${employee.department}` : ""}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>

{policyError && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                {policyError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setPolicyOpen(false)} disabled={savingPolicy}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void savePolicy()} disabled={savingPolicy}>
              {savingPolicy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lưu chính sách
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FieldDialog
        open={!!adjustEmployee}
        onOpenChange={(open) => !open && setAdjustEmployee(null)}
        title="Điều chỉnh quỹ phép"
        description={
          adjustEmployee
            ? `${adjustEmployee.full_name} · năm ${year}. Số ngày điều chỉnh cộng thêm vào tổng quỹ.`
            : undefined
        }
        fields={[
          { name: "adjustment_days", label: "Số ngày điều chỉnh (+/-)", type: "number", placeholder: "0" },
          { name: "note", label: "Ghi chú", span: 2, placeholder: "Lý do điều chỉnh…" },
        ]}
        initial={{
          adjustment_days: adjustEmployee ? balance(adjustEmployee.id)?.adjustment_days ?? 0 : 0,
          note: adjustEmployee ? balance(adjustEmployee.id)?.note ?? "" : "",
        }}
        submitLabel="Lưu điều chỉnh"
        onSubmit={handleAdjust}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá chính sách phép?</AlertDialogTitle>
            <AlertDialogDescription>
              Chính sách năm {pendingDelete?.year} cùng các loại phép của chính sách sẽ bị xoá; quỹ phép được tính lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeletePolicy()}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default LeavePolicies;
