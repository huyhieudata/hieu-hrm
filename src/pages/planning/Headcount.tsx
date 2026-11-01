import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-provider";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import {
  MONTH_LABELS,
  createItem,
  createPlan,
  deletePlan,
  listItems,
  listPlans,
  sumMonths,
  updateItemMonths,
  updatePlan,
  type HeadcountItem,
  type HeadcountPlan,
  type MonthValues,
} from "@/lib/planning";
import { listDepartmentPositions, listDepartments, type DepartmentPosition, type DepartmentRecord } from "@/lib/settings";
import { cn } from "@/lib/utils";

const EMPTY_MONTHS: MonthValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const planFields: FieldDef[] = [
  { name: "year", label: "Năm định biên", type: "number", required: true, placeholder: String(new Date().getFullYear()) },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

interface RowConfig {
  key: string;
  departmentId: string;
  departmentName: string;
  positionId: string | null;
  positionTitle: string;
}

const Headcount = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("planning");

  const [plans, setPlans] = useState<HeadcountPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [positions, setPositions] = useState<DepartmentPosition[]>([]);
  const [items, setItems] = useState<HeadcountItem[]>([]);
  const [rowValues, setRowValues] = useState<Record<string, MonthValues>>({});
  const [itemIds, setItemIds] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<HeadcountPlan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HeadcountPlan | null>(null);

  const loadPlanning = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [planRows, departmentRows, positionRows] = await Promise.all([
        listPlans(companyId),
        listDepartments(companyId),
        listDepartmentPositions(companyId),
      ]);
      setPlans(planRows);
      setDepartments(departmentRows);
      setPositions(positionRows);
      setSelectedPlanId((current) =>
        current && planRows.some((plan) => plan.id === current) ? current : planRows[0]?.id ?? "",
      );
    } catch (error) {
      toast.error("Không tải được kế hoạch định biên", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadPlanning();
  }, [loadPlanning]);

  const loadItems = useCallback(async (planId: string) => {
    if (!planId) {
      setItems([]);
      setRowValues({});
      setItemIds({});
      return;
    }
    try {
      const rows = await listItems(planId);
      setItems(rows);
      const values: Record<string, MonthValues> = {};
      const ids: Record<string, string> = {};
      rows.forEach((row) => {
        const key = `${row.department_id}|${row.position_id ?? ""}`;
        values[key] = row.months;
        ids[key] = row.id;
      });
      setRowValues(values);
      setItemIds(ids);
    } catch (error) {
      toast.error("Không tải được dữ liệu định biên", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, []);

  useEffect(() => {
    void loadItems(selectedPlanId);
  }, [loadItems, selectedPlanId]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const rows = useMemo<RowConfig[]>(() => {
    const result: RowConfig[] = [];
    const usedKeys = new Set<string>();

    departments.forEach((department) => {
      const departmentPositions = positions.filter((position) => position.department_id === department.id);
      departmentPositions.forEach((position) => {
        const key = `${department.id}|${position.id}`;
        usedKeys.add(key);
        result.push({
          key,
          departmentId: department.id,
          departmentName: department.name,
          positionId: position.id,
          positionTitle: position.title,
        });
      });
    });

    // Keep rows for positions that were removed from the org structure but still hold data.
    items.forEach((item) => {
      const key = `${item.department_id}|${item.position_id ?? ""}`;
      if (usedKeys.has(key)) return;
      result.push({
        key,
        departmentId: item.department_id,
        departmentName: departments.find((department) => department.id === item.department_id)?.name ?? "Khác",
        positionId: item.position_id,
        positionTitle: item.position_title ?? "Vị trí đã xoá",
      });
    });

    return result;
  }, [departments, items, positions]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      `${row.departmentName} ${row.positionTitle}`.toLowerCase().includes(keyword),
    );
  }, [query, rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, { departmentName: string; rows: RowConfig[] }>();
    filteredRows.forEach((row) => {
      const entry = map.get(row.departmentId) ?? { departmentName: row.departmentName, rows: [] };
      entry.rows.push(row);
      map.set(row.departmentId, entry);
    });
    return Array.from(map.values());
  }, [filteredRows]);

  const valuesFor = (key: string): MonthValues => rowValues[key] ?? EMPTY_MONTHS;

  const setCell = (row: RowConfig, monthIndex: number, raw: string) => {
    const value = Math.max(0, Math.min(9999, Number(raw.replace(/[^\d]/g, "")) || 0));
    setRowValues((prev) => {
      const current = prev[row.key] ?? EMPTY_MONTHS;
      const next = [...current] as MonthValues;
      next[monthIndex] = value;
      return { ...prev, [row.key]: next };
    });
  };

  const persistRow = async (row: RowConfig) => {
    if (!selectedPlan || !companyId || !canManage) return;
    const months = rowValues[row.key] ?? EMPTY_MONTHS;
    setSavingKey(row.key);
    try {
      const existingId = itemIds[row.key];
      if (existingId) {
        await updateItemMonths(existingId, months);
      } else {
        if (sumMonths(months) === 0) return;
        const id = await createItem({
          plan_id: selectedPlan.id,
          company_id: companyId,
          department_id: row.departmentId,
          position_id: row.positionId,
          position_title: row.positionTitle,
          months,
        });
        setItemIds((prev) => ({ ...prev, [row.key]: id }));
      }
    } catch (error) {
      toast.error("Không lưu được định biên", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handlePlanSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    const year = Number(values.year ?? 0);
    if (!year || year < 2000 || year > 2100) throw new Error("Năm không hợp lệ.");
    if (editingPlan) {
      await updatePlan(editingPlan.id, { year, note: (values.note as string) ?? null });
      toast.success("Đã cập nhật bản ghi định biên");
    } else {
      const id = await createPlan({ company_id: companyId, year, note: (values.note as string) ?? null });
      setSelectedPlanId(id);
      toast.success(`Đã tạo định biên năm ${year}`);
    }
    setFormOpen(false);
    setEditingPlan(null);
    await loadPlanning();
  };

  const handleDeletePlan = async () => {
    if (!pendingDelete) return;
    try {
      await deletePlan(pendingDelete.id);
      toast.success("Đã xoá bản ghi định biên");
      setPendingDelete(null);
      setSelectedPlanId("");
      await loadPlanning();
    } catch (error) {
      toast.error("Không xoá được", { description: error instanceof Error ? error.message : undefined });
    }
  };

  const monthTotals = MONTH_LABELS.map((_, index) =>
    filteredRows.reduce((sum, row) => sum + valuesFor(row.key)[index], 0),
  );
  const grandTotal = monthTotals.reduce((sum, value) => sum + value, 0);

  const exportRows = () => [
    ...filteredRows.map((row) => {
      const months = valuesFor(row.key);
      return [row.departmentName, row.positionTitle, ...months.map(String), String(sumMonths(months))];
    }),
    ["Tổng cộng", "", ...monthTotals.map(String), String(grandTotal)],
  ];

  const exportHeaders = ["Phòng ban", "Vị trí", ...MONTH_LABELS, "Tổng"];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hoạch định"
        title="Định biên nhân sự"
        description={
          selectedPlan
            ? `Kế hoạch định biên năm ${selectedPlan.year} — nhấp vào ô để nhập số lượng theo tháng.`
            : "Kế hoạch định biên theo phòng ban và vị trí, mỗi năm một bản ghi."
        }
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              disabled={!selectedPlan}
              onClick={() =>
                exportExcel(
                  `dinh-bien-${selectedPlan?.year ?? ""}`,
                  exportHeaders,
                  exportRows(),
                  `Định biên ${selectedPlan?.year ?? ""}`,
                )
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              disabled={!selectedPlan}
              onClick={() =>
                exportPdf(
                  `Định biên nhân sự năm ${selectedPlan?.year ?? ""}`,
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              disabled={!selectedPlan}
              onClick={() =>
                exportPdf(
                  `Định biên nhân sự năm ${selectedPlan?.year ?? ""}`,
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(),
                )
              }
            >
              <Printer className="h-3.5 w-3.5" /> In
            </Button>
            {canManage && (
              <Button
                className="h-9 gap-1.5 text-[12.5px]"
                onClick={() => {
                  setEditingPlan(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Thêm năm
              </Button>
            )}
          </>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="h-9 w-[190px] text-[12.5px]">
              <SelectValue placeholder="Chọn năm định biên" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  Năm {plan.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPlan && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Thao tác bản ghi định biên">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[210px]">
                <DropdownMenuItem
                  className="gap-2 text-[12.5px]"
                  disabled={!canManage}
                  onSelect={() => {
                    setEditingPlan(selectedPlan);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Sửa bản ghi năm
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                  disabled={!canManage}
                  onSelect={() => setPendingDelete(selectedPlan)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Xoá bản ghi năm
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm phòng ban, vị trí…"
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground/80 hover:border-primary/30 focus:border-primary focus:shadow-focus sm:w-[240px]"
            />
          </label>
        </div>

        {selectedPlan?.note && <p className="text-[11.5px] text-muted-foreground">{selectedPlan.note}</p>}
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải kế hoạch định biên…
        </Card>
      ) : plans.length === 0 ? (
        <Card className="p-14 text-center">
          <FileSpreadsheet className="mx-auto h-7 w-7 text-muted-foreground/70" />
          <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">Chưa có bản ghi định biên</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-muted-foreground">
            Mỗi năm là một bản ghi. Tạo bản ghi đầu tiên để nhập số lượng định biên theo tháng cho từng phòng ban và
            vị trí.
          </p>
          {canManage && (
            <Button
              className="mt-4 h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditingPlan(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Tạo định biên năm {new Date().getFullYear()}
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-[240px] bg-muted/40 px-4 py-2.5 text-left font-semibold">
                    Phòng ban / Vị trí
                  </th>
                  {MONTH_LABELS.map((label, index) => (
                    <th key={label} className="w-[62px] px-1 py-2.5 text-center font-semibold">
                      T{index + 1}
                    </th>
                  ))}
                  <th className="w-[64px] px-2 py-2.5 text-center font-semibold">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => {
                  const departmentTotals = MONTH_LABELS.map((_, index) =>
                    group.rows.reduce((sum, row) => sum + valuesFor(row.key)[index], 0),
                  );
                  return (
                    <Fragment key={group.departmentName}>
                      <tr className="bg-muted/25">
                        <td className="sticky left-0 z-10 bg-muted/25 px-4 py-2 font-semibold text-foreground">
                          {group.departmentName}
                        </td>
                        {departmentTotals.map((total, index) => (
                          <td key={index} className="px-1 py-2 text-center font-medium text-muted-foreground">
                            {total || ""}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center font-semibold text-foreground">
                          {departmentTotals.reduce((sum, value) => sum + value, 0) || ""}
                        </td>
                      </tr>
                      {group.rows.map((row) => {
                        const months = valuesFor(row.key);
                        return (
                          <tr key={row.key} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="sticky left-0 z-10 bg-card px-4 py-1.5 text-foreground">
                              <span className="block truncate">{row.positionTitle}</span>
                            </td>
                            {months.map((value, index) => (
                              <td key={index} className="px-0.5 py-1 text-center">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={value === 0 ? "" : String(value)}
                                  placeholder="0"
                                  disabled={!canManage}
                                  onChange={(event) => setCell(row, index, event.target.value)}
                                  onBlur={() => void persistRow(row)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                                  }}
                                  className={cn(
                                    "h-8 w-[54px] rounded border border-transparent bg-transparent text-center text-[12px] text-foreground outline-none transition-colors",
                                    canManage && "hover:border-border focus:border-primary focus:bg-card focus:shadow-focus",
                                    savingKey === row.key && "opacity-60",
                                  )}
                                />
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-center font-semibold text-foreground">
                              {sumMonths(months) || ""}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-foreground">
                      Tổng cộng
                    </td>
                    {monthTotals.map((total, index) => (
                      <td key={index} className="px-1 py-2.5 text-center text-[12.5px] font-semibold text-foreground">
                        {total || 0}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center text-[12.5px] font-semibold text-primary-subtle-foreground">
                      {grandTotal}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {filteredRows.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">
              Không có phòng ban/vị trí phù hợp. Thiết lập vị trí tại Cài đặt → Cơ cấu tổ chức.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-[11.5px] text-muted-foreground">
            <span>
              {grouped.length} phòng ban · {filteredRows.length} vị trí · số liệu lưu tự động khi rời ô
            </span>
            <span>Vị trí đồng bộ từ Cài đặt → Cơ cấu tổ chức</span>
          </div>
        </Card>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingPlan(null);
        }}
        title={editingPlan ? "Sửa bản ghi định biên" : "Tạo bản ghi định biên"}
        description="Mỗi năm chỉ có một bản ghi định biên."
        fields={planFields}
        initial={editingPlan ?? { year: new Date().getFullYear() + 1 }}
        submitLabel={editingPlan ? "Lưu thay đổi" : "Tạo bản ghi"}
        onSubmit={handlePlanSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bản ghi định biên?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ số liệu định biên năm {pendingDelete?.year} sẽ bị xoá và không thể khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeletePlan()}
            >
              Xoá bản ghi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Headcount;
