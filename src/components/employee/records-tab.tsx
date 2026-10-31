import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createRecord, fetchRecords, removeRecord, updateRecord } from "@/lib/employee-records";
import { syncSalaryFromContract } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export interface RecordColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface RecordsTabProps<T extends { id: string }> {
  table:
    | "employee_work_history"
    | "employee_contracts"
    | "employee_salary_records"
    | "employee_insurance_records"
    | "employee_rewards"
    | "employee_discipline_records"
    | "employee_training_records"
    | "employee_assets"
    | "employee_debts"
    | "employee_dependents";
  employeeId: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  addLabel: string;
  emptyText: string;
  columns: RecordColumn<T>[];
  fields: FieldDef[];
  orderColumn?: string;
  ascending?: boolean;
  canManage: boolean;
  initialForEdit: (row: T) => Record<string, unknown>;
  createDefaults?: Record<string, unknown>;
  rowKeyText: (row: T) => string;
  /** Called after a successful create/update/delete (parent can refresh related data). */
  onChanged?: () => void | Promise<void>;
  /** One-click action shown above edit (e.g. return an asset). */
  quickAction?: {
    label: string;
    icon: LucideIcon;
    isAvailable: (row: T) => boolean;
    run: (row: T) => Promise<void>;
    successMessage?: string;
  };
}

export function RecordsTab<T extends { id: string }>({
  table,
  employeeId,
  title,
  description,
  icon: Icon,
  addLabel,
  emptyText,
  columns,
  fields,
  orderColumn,
  ascending = false,
  canManage,
  initialForEdit,
  createDefaults,
  rowKeyText,
  onChanged,
  quickAction,
}: RecordsTabProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecords<T>(table, employeeId, orderColumn ?? "created_at", ascending);
      setRows(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [ascending, employeeId, orderColumn, table]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    let recordId = editing?.id ?? "";
    if (editing) {
      await updateRecord(table, editing.id, values);
      toast.success("Đã cập nhật thông tin");
    } else {
      recordId = await createRecord(table, { ...createDefaults, ...values, employee_id: employeeId });
      toast.success("Đã thêm bản ghi mới");
    }

    if (table === "employee_contracts" && recordId) {
      try {
        await syncSalaryFromContract(recordId);
      } catch (syncError) {
        toast.error("Hợp đồng đã lưu nhưng chưa đồng bộ được lương", {
          description: syncError instanceof Error ? syncError.message : undefined,
        });
      }
    }

    await load();
    await onChanged?.();
  };

  const handleQuickAction = async (row: T) => {
    if (!quickAction) return;
    try {
      await quickAction.run(row);
      await load();
      await onChanged?.();
      toast.success(quickAction.successMessage ?? "Đã cập nhật");
    } catch (quickError) {
      toast.error("Không thực hiện được thao tác", {
        description: quickError instanceof Error ? quickError.message : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await removeRecord(table, pendingDelete.id);
      toast.success("Đã xoá bản ghi");
      setPendingDelete(null);
      await load();
      await onChanged?.();
    } catch (deleteError) {
      toast.error("Không xoá được bản ghi", {
        description: deleteError instanceof Error ? deleteError.message : undefined,
      });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
            <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">{title}</h3>
            <p className="text-[11.5px] text-muted-foreground">{description ?? `${rows.length} bản ghi`}</p>
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
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : error ? (
        <p className="px-5 py-8 text-center text-[12.5px] text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Icon className="mx-auto h-5 w-5 text-muted-foreground/70" />
          <p className="mt-2 text-[12.5px] text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="hidden items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:flex">
            <span className="flex-1">{columns[0]?.label}</span>
            {columns.slice(1).map((column) => (
              <span key={column.key} style={{ width: column.width ?? "128px" }} className="shrink-0">
                {column.label}
              </span>
            ))}
            <span className="w-8 shrink-0" />
          </div>

          <ul className="divide-y divide-border/60">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/25">
                <div className="min-w-0 flex-1 text-[12.5px] text-foreground">
                  {columns[0].render ? columns[0].render(row) : String((row as Record<string, unknown>)[columns[0].key] ?? "—")}
                </div>

                {columns.slice(1).map((column) => (
                  <div
                    key={column.key}
                    style={{ width: column.width ?? "128px" }}
                    className={cn("hidden shrink-0 text-[12px] text-muted-foreground md:block")}
                  >
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "—")}
                  </div>
                ))}

                <div className="w-8 shrink-0">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${rowKeyText(row)}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        {quickAction && quickAction.isAvailable(row) && (
                          <>
                            <DropdownMenuItem
                              className="gap-2 text-[12.5px]"
                              onSelect={() => void handleQuickAction(row)}
                            >
                              <quickAction.icon className="h-3.5 w-3.5" /> {quickAction.label}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
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
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? `Sửa ${title.toLowerCase()}` : addLabel}
        fields={fields}
        initial={editing ? initialForEdit(editing) : createDefaults}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bản ghi này?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? rowKeyText(pendingDelete) : ""} sẽ bị xoá khỏi hồ sơ nhân viên và không thể hoàn tác.
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
}
