import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import ShiftAssignmentDialog from "@/components/attendance/shift-assignment-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { listDepartmentPositions, listDepartments, type DepartmentPosition, type DepartmentRecord } from "@/lib/settings";
import {
  SCOPE_TYPE_LABELS,
  createRows,
  deleteRow,
  listRows,
  updateRow,
  type ShiftAssignment,
  type WorkShift,
} from "@/lib/attendance";

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const ShiftAssignments = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("shifts");

  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [positions, setPositions] = useState<DepartmentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftAssignment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShiftAssignment | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [assignmentRows, shiftRows, employeeRows, departmentRows, positionRows] = await Promise.all([
        listRows<ShiftAssignment>("shift_assignments", companyId, "created_at"),
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listEmployees(companyId),
        listDepartments(companyId),
        listDepartmentPositions(companyId),
      ]);
      setAssignments(assignmentRows);
      setShifts(shiftRows);
      setEmployees(employeeRows);
      setDepartments(departmentRows);
      setPositions(positionRows);
    } catch (error) {
      toast.error("Không tải được phân ca", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (rows: Record<string, unknown>[]) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    if (editing) {
      await updateRow("shift_assignments", editing.id, rows[0]);
      if (rows.length > 1) {
        await createRows(
          "shift_assignments",
          rows.slice(1).map((row) => ({ ...row, company_id: companyId })),
        );
      }
      toast.success("Đã cập nhật phân ca");
    } else {
      await createRows(
        "shift_assignments",
        rows.map((row) => ({ ...row, company_id: companyId })),
      );
      toast.success(rows.length > 1 ? `Đã phân ca cho ${rows.length} vị trí` : "Đã phân ca");
    }
    await load();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRow("shift_assignments", pendingDelete.id);
      toast.success("Đã xoá phân ca");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Phân ca"
        description="Gán ca theo phòng ban, vị trí hoặc từng nhân sự; mỗi nhân sự chỉ có một ca trong một khoảng thời gian."
        actions={
          canManage && (
            <Button
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Phân ca
            </Button>
          )
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="hidden items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:flex">
          <span className="flex-1">Ca làm việc</span>
          <span className="w-[150px] shrink-0">Phân cho</span>
          <span className="w-[190px] shrink-0">Giá trị phạm vi</span>
          <span className="w-[190px] shrink-0">Hiệu lực</span>
          <span className="w-9 shrink-0" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải phân ca…
          </div>
        ) : assignments.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <CalendarRange className="mx-auto h-6 w-6 text-muted-foreground/70" />
            <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có phân ca</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Tạo ca làm việc trước, sau đó phân ca cho phòng ban hoặc nhân sự.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {assignments.map((assignment) => {
              const shift = shifts.find((item) => item.id === assignment.shift_id);
              return (
                <li key={assignment.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-foreground">
                      {shift?.name ?? "Ca đã xoá"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {shift ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}` : "—"}
                    </p>
                  </div>
                  <span className="hidden w-[150px] shrink-0 lg:block">
                    <Badge variant="muted">{SCOPE_TYPE_LABELS[assignment.scope_type] ?? assignment.scope_type}</Badge>
                  </span>
                  <span className="hidden w-[190px] shrink-0 truncate text-[12px] text-foreground lg:block">
                    {assignment.scope_value ?? "Toàn công ty"}
                  </span>
                  <span className="hidden w-[190px] shrink-0 text-[11.5px] text-muted-foreground lg:block">
                    {formatDate(assignment.effective_from)} →{" "}
                    {assignment.effective_to ? formatDate(assignment.effective_to) : "nay"}
                  </span>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Thao tác phân ca">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[190px]">
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px]"
                          onSelect={() => {
                            setEditing(assignment);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                          onSelect={() => setPendingDelete(assignment)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xoá phân ca
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ShiftAssignmentDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        assignment={editing}
        shifts={shifts}
        employees={employees}
        departments={departments}
        positions={positions}
        assignments={assignments}
        onSubmit={handleSave}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá phân ca?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.scope_value
                ? `${SCOPE_TYPE_LABELS[pendingDelete.scope_type] ?? ""} · ${pendingDelete.scope_value}`
                : "Phân ca toàn công ty"}{" "}
              sẽ bị xoá. Nhân sự thuộc phạm vi này sẽ dùng ca khác (nếu có) hoặc không có ca.
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

export default ShiftAssignments;
