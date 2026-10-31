import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileSignature, FileSpreadsheet, Loader2, MoreHorizontal, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { SelectionBar } from "@/components/common/selection-bar";
import { useSelection } from "@/lib/use-selection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/lib/company-provider";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/utils";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  getDocumentSignedUrl,
  listEmployees,
  uploadEmployeeFile,
  type EmployeeRecord,
} from "@/lib/employee-records";
import {
  contractDaysLeft,
  createContract,
  deleteContract,
  listCompanyContracts,
  syncSalaryFromContract,
  updateContract,
  type CompanyContract,
} from "@/lib/contracts";
import { todayIso } from "@/lib/attendance";

const formatDay = (value: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN") : "—";

const formatMoney = (value: number | null) =>
  value === null || value === undefined ? "—" : `${new Intl.NumberFormat("vi-VN").format(value)} đ`;


const Contracts = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("contracts");

  const [contracts, setContracts] = useState<CompanyContract[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyContract | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CompanyContract | null>(null);
  const [detailContract, setDetailContract] = useState<CompanyContract | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { selected, toggle, selectAll, clear, prune } = useSelection();

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [contractRows, employeeRows] = await Promise.all([
        listCompanyContracts(companyId),
        listEmployees(companyId),
      ]);
      setContracts(contractRows);
      setEmployees(employeeRows);
      prune(contractRows.map((contract) => contract.id));
    } catch (error) {
      toast.error("Không tải được hợp đồng", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, prune]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeOptions = useMemo(
    () =>
      employees
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"))
        .map((employee) => ({
          value: employee.id,
          label: `${employee.full_name} · ${employee.code}${employee.department ? ` · ${employee.department}` : ""}`,
        })),
    [employees],
  );

  const fields = useMemo<FieldDef[]>(
    () => [
      { name: "employee_id", label: "Nhân sự", type: "select", required: true, options: employeeOptions, span: 2 },
      { name: "contract_no", label: "Số hợp đồng", placeholder: "HĐ-2026-001" },
      {
        name: "contract_type",
        label: "Loại hợp đồng",
        type: "select",
        required: true,
        options: Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        name: "status",
        label: "Trạng thái",
        type: "select",
        options: Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
      { name: "start_date", label: "Ngày bắt đầu", type: "date" },
      { name: "end_date", label: "Ngày kết thúc", type: "date", hint: "Bỏ trống nếu không xác định thời hạn." },
      { name: "position", label: "Chức danh", placeholder: "Chuyên viên nhân sự" },
      { name: "department", label: "Phòng ban", placeholder: "Phòng Nhân sự" },
      { name: "base_salary", label: "Lương cơ bản", type: "number" },
      { name: "allowance", label: "Phụ cấp", type: "number" },
      { name: "insurance_salary", label: "Lương đóng bảo hiểm", type: "number" },
      { name: "note", label: "Ghi chú", type: "textarea" },
    ],
    [employeeOptions],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (statusFilter !== "all" && contract.status !== statusFilter) return false;
      if (typeFilter !== "all" && contract.contract_type !== typeFilter) return false;
      if (!keyword) return true;
      return `${contract.employee_name ?? ""} ${contract.employee_code ?? ""} ${contract.contract_no ?? ""} ${
        contract.department ?? contract.employee_department ?? ""
      } ${contract.position ?? ""} ${CONTRACT_TYPE_LABELS[contract.contract_type] ?? ""}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [contracts, query, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const active = contracts.filter((contract) => contract.status === "active");
    const expiring = active.filter((contract) => {
      const days = contractDaysLeft(contract);
      return days !== null && days >= 0 && days <= 30;
    });
    const ended = contracts.filter((contract) => contract.status !== "active");
    return { total: contracts.length, active: active.length, expiring: expiring.length, ended: ended.length };
  }, [contracts]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    if (!values.employee_id) throw new Error("Vui lòng chọn nhân sự.");
    if (values.start_date && values.end_date && String(values.end_date) < String(values.start_date)) {
      throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    }

    const payload = {
      employee_id: values.employee_id,
      contract_no: values.contract_no,
      contract_type: values.contract_type ?? "fixed_term",
      status: values.status ?? "active",
      start_date: values.start_date,
      end_date: values.end_date,
      position: values.position,
      department: values.department,
      base_salary: values.base_salary === null ? null : Number(values.base_salary),
      allowance: values.allowance === null ? null : Number(values.allowance),
      insurance_salary: values.insurance_salary === null ? null : Number(values.insurance_salary),
      note: values.note,
    };

    try {
      if (editing) {
        await updateContract(editing.id, payload);
        await syncSalaryFromContract(editing.id);
        toast.success("Đã cập nhật hợp đồng", { description: "Bản ghi lương đã được đồng bộ." });
      } else {
        const contractId = await createContract({ ...payload, company_id: companyId });
        await syncSalaryFromContract(contractId);
        toast.success("Đã tạo hợp đồng", { description: "Đã tạo bản ghi lương tương ứng." });
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const handleUploadContractFile = async (file: File | undefined) => {
    if (!file || !detailContract) return;
    setFileBusy(true);
    try {
      const path = await uploadEmployeeFile({
        companyId: detailContract.company_id,
        employeeId: detailContract.employee_id,
        file,
      });
      await updateContract(detailContract.id, {
        contract_file_path: path,
        contract_file_name: file.name,
      });
      setDetailContract({ ...detailContract, contract_file_path: path, contract_file_name: file.name });
      toast.success("Đã tải hợp đồng lên", { description: file.name });
      await load();
    } catch (uploadError) {
      toast.error("Không tải được hợp đồng", {
        description: uploadError instanceof Error ? uploadError.message : undefined,
      });
    } finally {
      setFileBusy(false);
    }
  };

  const openContractFile = async () => {
    if (!detailContract?.contract_file_path) return;
    try {
      const url = await getDocumentSignedUrl(detailContract.contract_file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Không mở được tệp hợp đồng");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selected.map((id) => deleteContract(id)));
      toast.success(`Đã xoá ${selected.length} hợp đồng`);
      clear();
      setBulkOpen(false);
      await load();
    } catch (error) {
      toast.error("Không xoá được hợp đồng", { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteContract(pendingDelete.id);
      toast.success("Đã xoá hợp đồng");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được hợp đồng", { description: getErrorMessage(error) });
    }
  };

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Số hợp đồng",
    "Loại hợp đồng",
    "Phòng ban",
    "Chức danh",
    "Bắt đầu",
    "Kết thúc",
    "Lương cơ bản",
    "Phụ cấp",
    "Lương bảo hiểm",
    "Trạng thái",
    "Ghi chú",
  ];

  const exportRows = () =>
    filtered.map((contract) => [
      contract.employee_code ?? "",
      contract.employee_name ?? "",
      contract.contract_no ?? "",
      CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type,
      contract.department ?? contract.employee_department ?? "",
      contract.position ?? "",
      contract.start_date ?? "",
      contract.end_date ?? "",
      contract.base_salary ?? "",
      contract.allowance ?? "",
      contract.insurance_salary ?? "",
      CONTRACT_STATUS_LABELS[contract.status] ?? contract.status,
      contract.note ?? "",
    ]);

  const statusTone = (contract: CompanyContract) => {
    if (contract.status === "active") {
      const days = contractDaysLeft(contract);
      if (days !== null && days >= 0 && days <= 30) return "warning" as const;
      return "success" as const;
    }
    return contract.status === "expired" ? "warning" as const : "muted" as const;
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Quản lý nhân sự"
        title="Hợp đồng"
        description="Tất cả hợp đồng lao động của công ty: tạo, cập nhật, xoá, tìm kiếm và xuất danh sách."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => exportExcel("danh-sach-hop-dong", exportHeaders, exportRows(), "Danh sách hợp đồng")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportPdf(
                  "Danh sách hợp đồng lao động",
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            {canManage && (
              <Button
                className="h-9 gap-1.5 text-[12.5px]"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Thêm hợp đồng
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tổng hợp đồng</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Đang hiệu lực</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-success">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sắp hết hạn 30 ngày</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-warning">{stats.expiring}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Hết hạn / chấm dứt</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{stats.ended}</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo nhân sự, số HĐ, phòng ban…"
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[280px]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả loại HĐ</option>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[11.5px] text-muted-foreground">{filtered.length} hợp đồng</span>
      </Card>

      {canManage && (
        <SelectionBar
          count={selected.length}
          label="hợp đồng"
          onClear={clear}
          onDelete={() => setBulkOpen(true)}
        />
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải hợp đồng…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileSignature className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">
            {contracts.length === 0 ? "Chưa có hợp đồng nào" : "Không có hợp đồng phù hợp bộ lọc"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">Thêm hợp đồng mới hoặc điều chỉnh bộ lọc.</p>
          {canManage && contracts.length === 0 && (
            <Button
              className="mt-3 h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Thêm hợp đồng
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  {canManage && (
                    <th className="w-[40px] px-2 py-2.5 text-center font-semibold">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả hợp đồng"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={filtered.length > 0 && filtered.every((contract) => selected.includes(contract.id))}
                        onChange={() => selectAll(filtered.map((contract) => contract.id))}
                      />
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-left font-semibold">Nhân sự</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Hợp đồng</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Thời hạn</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Lương cơ bản</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Phụ cấp</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                  <th className="w-[48px] px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((contract) => {
                  const days = contractDaysLeft(contract);
                  return (
                    <tr key={contract.id} className="border-t border-border/50 hover:bg-muted/20">
                      {canManage && (
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Chọn hợp đồng ${contract.contract_no ?? ""}`}
                            className="h-3.5 w-3.5 accent-primary"
                            checked={selected.includes(contract.id)}
                            onChange={() => toggle(contract.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setDetailContract(contract)}
                          className="text-left text-[12px] font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {contract.employee_name ?? "Nhân sự"}
                        </button>
                        <p className="text-[10px] text-muted-foreground">
                          {contract.employee_code ?? "—"}
                          {contract.employee_department ? ` · ${contract.employee_department}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-mono text-[11.5px] text-foreground">{contract.contract_no ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type}
                          {contract.position ? ` · ${contract.position}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[11.5px] text-foreground">
                          {formatDay(contract.start_date)} → {contract.end_date ? formatDay(contract.end_date) : "Không thời hạn"}
                        </p>
                        {contract.status === "active" && days !== null && days >= 0 && days <= 30 && (
                          <p className="text-[10px] font-medium text-warning">Còn {days} ngày</p>
                        )}
                        {contract.status === "active" && days !== null && days < 0 && (
                          <p className="text-[10px] font-medium text-destructive">Đã quá hạn {-days} ngày</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] text-foreground">
                        {formatMoney(contract.base_salary)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] text-muted-foreground">
                        {formatMoney(contract.allowance)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant={statusTone(contract)}>
                          {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Thao tác hợp đồng">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[190px]">
                              <DropdownMenuItem
                                className="gap-2 text-[12.5px]"
                                onSelect={() => {
                                  setEditing(contract);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                                onSelect={() => setPendingDelete(contract)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Xoá hợp đồng
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!detailContract} onOpenChange={(open) => !open && setDetailContract(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Hợp đồng {detailContract?.contract_no ?? ""}
              {detailContract && (
                <Badge variant={statusTone(detailContract)}>
                  {CONTRACT_STATUS_LABELS[detailContract.status] ?? detailContract.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailContract?.employee_name ?? "Nhân sự"} · {detailContract?.employee_code ?? "—"}
            </DialogDescription>
          </DialogHeader>

          {detailContract && (
            <div className="space-y-4 py-1">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  ["Loại hợp đồng", CONTRACT_TYPE_LABELS[detailContract.contract_type] ?? detailContract.contract_type],
                  ["Phòng ban", detailContract.department ?? detailContract.employee_department ?? "—"],
                  ["Chức danh", detailContract.position ?? "—"],
                  [
                    "Thời hạn",
                    `${formatDay(detailContract.start_date)} → ${
                      detailContract.end_date ? formatDay(detailContract.end_date) : "Không thời hạn"
                    }`,
                  ],
                  ["Lương cơ bản", formatMoney(detailContract.base_salary)],
                  ["Phụ cấp", formatMoney(detailContract.allowance)],
                  ["Lương đóng bảo hiểm", formatMoney(detailContract.insurance_salary)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-[12.5px] font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {detailContract.note && (
                <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[11.5px] leading-5 text-muted-foreground">
                  {detailContract.note}
                </p>
              )}

              <div className="rounded-lg border border-border px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tài liệu hợp đồng
                </p>
                {detailContract.contract_file_path ? (
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void openContractFile()}
                      className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{detailContract.contract_file_name ?? "Tệp hợp đồng"}</span>
                    </button>
                    {canManage && (
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                        {fileBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                        Thay tệp
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            void handleUploadContractFile(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11.5px] text-muted-foreground">Chưa có tệp hợp đồng.</p>
                    {canManage && (
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                        {fileBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Tải hợp đồng
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            void handleUploadContractFile(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">PDF/DOC/DOCX/ảnh, tối đa 15MB.</p>
              </div>

              <Link
                to={`/employees/${detailContract.employee_id}`}
                className="inline-flex text-[11.5px] font-medium text-primary hover:underline"
              >
                Mở hồ sơ nhân sự
              </Link>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setDetailContract(null)}>
              Đóng
            </Button>
            {canManage && detailContract && (
              <Button
                className="h-9 gap-1.5"
                onClick={() => {
                  const contract = detailContract;
                  setDetailContract(null);
                  setEditing(contract);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa hợp đồng" : "Thêm hợp đồng"}
        description="Hợp đồng được lưu trong hồ sơ nhân sự và dùng cho cảnh báo hết hạn."
        fields={fields}
        initial={
          editing
            ? { ...editing, contract_type: editing.contract_type, status: editing.status }
            : {
                contract_type: "fixed_term",
                status: "active",
                start_date: todayIso(),
              }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm hợp đồng"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {selected.length} hợp đồng?</AlertDialogTitle>
            <AlertDialogDescription>Các hợp đồng đã chọn sẽ bị xoá khỏi hệ thống.</AlertDialogDescription>
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá hợp đồng?</AlertDialogTitle>
            <AlertDialogDescription>
              Hợp đồng {pendingDelete?.contract_no ?? ""} của {pendingDelete?.employee_name ?? "nhân sự"} sẽ bị xoá khỏi hồ sơ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá hợp đồng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Contracts;
