import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Laptop, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
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
import { Input } from "@/components/ui/input";
import { useCompany } from "@/lib/company-provider";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/utils";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITION_LABELS,
  ASSET_STATUS_LABELS,
  listEmployees,
  type EmployeeRecord,
} from "@/lib/employee-records";
import {
  createAsset,
  deleteAsset,
  listCompanyAssets,
  updateAsset,
  type CompanyAsset,
} from "@/lib/assets";
import { todayIso } from "@/lib/attendance";

const assetFields = (employees: EmployeeRecord[]): FieldDef[] => [
  {
    name: "employee_id",
    label: "Nhân sự",
    type: "select",
    required: true,
    span: 2,
    options: employees.map((employee) => ({
      value: employee.id,
      label: `${employee.full_name} · ${employee.code}${employee.department ? ` · ${employee.department}` : ""}`,
    })),
  },
  { name: "name", label: "Tên tài sản", required: true, span: 2, placeholder: 'MacBook Pro 14" M3' },
  { name: "asset_code", label: "Mã tài sản", placeholder: "TS-2026-014" },
  {
    name: "category",
    label: "Loại tài sản",
    type: "select",
    required: true,
    options: Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  },
  { name: "serial_number", label: "Số serial", placeholder: "C02XK1ABCD" },
  { name: "value", label: "Giá trị", type: "currency", placeholder: "45000000" },
  { name: "assigned_date", label: "Ngày bàn giao", type: "date", required: true },
  { name: "return_date", label: "Ngày thu hồi", type: "date" },
  {
    name: "condition",
    label: "Tình trạng",
    type: "select",
    options: Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => ({ value, label })),
  },
  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

const statusTone = (status: string) =>
  status === "assigned" ? "success" : status === "returned" ? "muted" : status === "lost" ? "destructive" : "warning";

const money = (value: number | null) =>
  value === null || value === undefined ? "—" : `${new Intl.NumberFormat("vi-VN").format(Number(value))} đ`;

const formatDay = (value: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const Assets = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("assets");

  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [condition, setCondition] = useState("all");
  const [department, setDepartment] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyAsset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CompanyAsset | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { selected, toggle, selectAll, clear, prune } = useSelection();

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [assetRows, employeeRows] = await Promise.all([
        listCompanyAssets(companyId),
        listEmployees(companyId),
      ]);
      setAssets(assetRows);
      setEmployees(employeeRows);
      prune(assetRows.map((asset) => asset.id));
    } catch (error) {
      toast.error("Không tải được tài sản", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, prune]);

  useEffect(() => {
    void load();
  }, [load]);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(assets.map((asset) => asset.department).filter((value): value is string => !!value))).sort(
        (a, b) => a.localeCompare(b, "vi"),
      ),
    [assets],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (category !== "all" && asset.category !== category) return false;
      if (status !== "all" && asset.status !== status) return false;
      if (condition !== "all" && asset.condition !== condition) return false;
      if (department !== "all" && asset.department !== department) return false;
      if (fromDate && asset.assigned_date < fromDate) return false;
      if (toDate && asset.assigned_date > toDate) return false;
      if (!keyword) return true;
      return `${asset.name} ${asset.asset_code ?? ""} ${asset.serial_number ?? ""} ${asset.employee_name ?? ""} ${
        asset.employee_code ?? ""
      }`
        .toLowerCase()
        .includes(keyword);
    });
  }, [assets, category, condition, department, fromDate, query, status, toDate]);

  const stats = useMemo(() => {
    const totalValue = assets.reduce((sum, asset) => sum + Number(asset.value ?? 0), 0);
    return {
      total: assets.length,
      assigned: assets.filter((asset) => asset.status === "assigned").length,
      returned: assets.filter((asset) => asset.status === "returned").length,
      broken: assets.filter((asset) => asset.status === "lost" || asset.status === "damaged").length,
      totalValue,
    };
  }, [assets]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    if (!values.employee_id) throw new Error("Vui lòng chọn nhân sự.");

    const payload = {
      company_id: companyId,
      employee_id: values.employee_id,
      name: values.name,
      asset_code: values.asset_code,
      category: values.category ?? "other",
      serial_number: values.serial_number,
      value: values.value === null ? null : Number(values.value),
      assigned_date: values.assigned_date,
      return_date: values.return_date,
      condition: values.condition ?? "new",
      status: values.status ?? "assigned",
      note: values.note,
    };

    try {
      if (editing) {
        await updateAsset(editing.id, payload);
        toast.success("Đã cập nhật tài sản");
      } else {
        await createAsset(payload);
        toast.success("Đã thêm tài sản");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selected.map((id) => deleteAsset(id)));
      toast.success(`Đã xoá ${selected.length} tài sản`);
      clear();
      setBulkOpen(false);
      await load();
    } catch (error) {
      toast.error("Không xoá được tài sản", { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAsset(pendingDelete.id);
      toast.success("Đã xoá tài sản");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được tài sản", { description: getErrorMessage(error) });
    }
  };

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    "Tên tài sản",
    "Mã tài sản",
    "Loại",
    "Serial",
    "Ngày bàn giao",
    "Ngày thu hồi",
    "Tình trạng",
    "Trạng thái",
    "Giá trị",
  ];

  const exportRows = () =>
    filtered.map((asset) => [
      asset.employee_code ?? "",
      asset.employee_name ?? "",
      asset.department ?? "",
      asset.name,
      asset.asset_code ?? "",
      ASSET_CATEGORY_LABELS[asset.category] ?? asset.category,
      asset.serial_number ?? "",
      asset.assigned_date,
      asset.return_date ?? "",
      ASSET_CONDITION_LABELS[asset.condition] ?? asset.condition,
      ASSET_STATUS_LABELS[asset.status] ?? asset.status,
      asset.value ?? "",
    ]);

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setStatus("all");
    setCondition("all");
    setDepartment("all");
    setFromDate("");
    setToDate("");
  };

  const hasFilters =
    query || category !== "all" || status !== "all" || condition !== "all" || department !== "all" || fromDate || toDate;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Quản lý nhân sự"
        title="Quản lý tài sản"
        description="Toàn bộ tài sản bàn giao cho nhân sự, đồng bộ với tab Tài sản trong hồ sơ nhân viên."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => exportExcel("danh-sach-tai-san", exportHeaders, exportRows(), "Tài sản")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => exportPdf("Danh sách tài sản", activeCompany?.name ?? "Công ty", exportHeaders, exportRows())}
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
                <Plus className="h-4 w-4" /> Thêm tài sản
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng tài sản", value: String(stats.total), tone: "text-foreground" },
          { label: "Đang sử dụng", value: String(stats.assigned), tone: "text-success" },
          { label: "Đã thu hồi", value: String(stats.returned), tone: "text-muted-foreground" },
          { label: "Mất / hư hỏng", value: String(stats.broken), tone: "text-destructive" },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{item.label}</p>
            <p className={`mt-1 font-display text-[22px] font-semibold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tài sản, serial, nhân sự…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[250px]"
          />
        </label>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả loại</option>
          {Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả tình trạng</option>
          {Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả phòng ban</option>
          {departmentOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="h-9 w-[145px] text-[12px]"
          aria-label="Bàn giao từ ngày"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="h-9 w-[145px] text-[12px]"
          aria-label="Bàn giao đến ngày"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-[11.5px] text-muted-foreground" onClick={clearFilters}>
            Xoá bộ lọc
          </Button>
        )}

        <span className="ml-auto text-[11.5px] text-muted-foreground">
          {filtered.length} / {assets.length} tài sản · {money(stats.totalValue)}
        </span>
      </Card>

      {canManage && (
        <SelectionBar
          count={selected.length}
          label="tài sản"
          onClear={clear}
          onDelete={() => setBulkOpen(true)}
        />
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tài sản…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Laptop className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">
            {assets.length === 0 ? "Chưa có tài sản nào" : "Không có tài sản phù hợp bộ lọc"}
          </p>
          {canManage && assets.length === 0 && (
            <Button
              className="mt-3 h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Thêm tài sản
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                  {canManage && (
                    <th className="w-[40px] px-2 py-2.5 text-center font-semibold">
                      <label className="touch-check">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả tài sản"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={filtered.length > 0 && filtered.every((asset) => selected.includes(asset.id))}
                          onChange={() => selectAll(filtered.map((asset) => asset.id))}
                        />
                      </label>
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-left font-semibold">Tài sản</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Nhân sự</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Loại</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Bàn giao</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Giá trị</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Tình trạng</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                  <th className="w-[48px] px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr key={asset.id} className="border-t border-border/50 hover:bg-muted/20">
                    {canManage && (
                      <td className="px-2 py-2.5 text-center">
                        <label className="touch-check">
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${asset.name}`}
                            className="h-3.5 w-3.5 accent-primary"
                            checked={selected.includes(asset.id)}
                            onChange={() => toggle(asset.id)}
                          />
                        </label>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <p className="text-[12px] font-medium text-foreground">{asset.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {asset.asset_code ?? "—"}
                        {asset.serial_number ? ` · SN ${asset.serial_number}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-[12px] text-foreground">{asset.employee_name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {asset.employee_code ?? ""}
                        {asset.department ? ` · ${asset.department}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="subtle">{ASSET_CATEGORY_LABELS[asset.category] ?? asset.category}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-foreground">
                      {formatDay(asset.assigned_date)}
                      {asset.return_date && (
                        <span className="block text-[11px] text-muted-foreground">
                          Thu hồi {formatDay(asset.return_date)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-foreground">{money(asset.value)}</td>
                    <td className="px-3 py-2.5 text-center text-[11px] text-muted-foreground">
                      {ASSET_CONDITION_LABELS[asset.condition] ?? asset.condition}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={statusTone(asset.status)}>
                        {ASSET_STATUS_LABELS[asset.status] ?? asset.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Thao tác tài sản">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[190px]">
                            <DropdownMenuItem
                              className="gap-2 text-[12.5px]"
                              onSelect={() => {
                                setEditing(asset);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                              onSelect={() => setPendingDelete(asset)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Xoá tài sản
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa tài sản" : "Thêm tài sản"}
        description="Tài sản được đồng bộ với tab Tài sản trong hồ sơ nhân sự."
        fields={assetFields(employees)}
        initial={
          editing
            ? {
                ...editing,
                assigned_date: editing.assigned_date,
                return_date: editing.return_date ?? "",
              }
            : { assigned_date: todayIso(), status: "assigned", condition: "new" }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm tài sản"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {selected.length} tài sản?</AlertDialogTitle>
            <AlertDialogDescription>
              Các tài sản đã chọn sẽ bị xoá khỏi hồ sơ nhân sự và mô-đun tài sản.
            </AlertDialogDescription>
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
            <AlertDialogTitle>Xoá tài sản?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} sẽ bị xoá khỏi hồ sơ nhân sự và mô-đun tài sản.
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
    </AppShell>
  );
};

export default Assets;
