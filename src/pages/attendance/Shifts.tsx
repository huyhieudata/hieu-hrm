import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import ShiftFormDialog from "@/components/attendance/shift-form-dialog";
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
import {
  SHIFT_TYPE_LABELS,
  WORK_DAY_LABELS,
  createRow,
  deleteRow,
  formatCredit,
  listRows,
  shiftWindowLabel,
  updateRow,
  type WorkShift,
} from "@/lib/attendance";

const dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const shortTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "—");

const Shifts = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("shifts");

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkShift | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkShift | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setShifts(await listRows<WorkShift>("work_shifts", companyId, "start_time", true));
    } catch (error) {
      toast.error("Không tải được ca làm việc", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (payload: Record<string, unknown>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    if (editing) {
      await updateRow("work_shifts", editing.id, payload);
      toast.success("Đã cập nhật ca làm việc");
    } else {
      await createRow("work_shifts", { ...payload, company_id: companyId });
      toast.success("Đã tạo ca làm việc");
    }
    await load();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRow("work_shifts", pendingDelete.id);
      toast.success("Đã xoá ca làm việc");
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
        title="Ca làm việc"
        description="Giờ làm buổi sáng và buổi chiều, khung giờ chấm công hợp lệ, ngưỡng đi muộn, ngày làm việc và số công ghi nhận."
        actions={
          canManage && (
            <Button
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Thêm ca
            </Button>
          )
        }
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải ca làm việc…
        </Card>
      ) : shifts.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có ca làm việc</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tạo ca đầu tiên để phân ca cho nhân sự.</p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shifts.map((shift) => (
            <Card key={shift.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-foreground">
                    {shift.name}
                    <Badge variant="muted" className="text-[10px]">
                      {SHIFT_TYPE_LABELS[shift.shift_type] ?? "Tùy chọn"}
                    </Badge>
                    {shift.code && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {shift.code}
                      </Badge>
                    )}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {shift.shift_type === "single"
                        ? `${shortTime(shift.morning_start ?? shift.start_time)} – ${shortTime(
                            shift.morning_end ?? shift.end_time,
                          )} · liên tục`
                        : `Sáng ${shortTime(shift.morning_start ?? shift.start_time)} – ${shortTime(
                            shift.morning_end,
                          )}`}
                    </span>
                    {shift.shift_type !== "single" && (
                      <>
                        <span className="text-border">·</span>
                        <span>
                          Chiều {shortTime(shift.afternoon_start)} –{" "}
                          {shortTime(shift.afternoon_end ?? shift.end_time)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={shift.active ? "success" : "muted"}>
                    {shift.active ? "Đang áp dụng" : "Ngừng"}
                  </Badge>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${shift.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[190px]">
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px]"
                          onSelect={() => {
                            setEditing(shift);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                          onSelect={() => setPendingDelete(shift)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xoá ca
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-muted/40 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Giờ chấm công hợp lệ
                  </p>
                  <p className="text-[12px] font-medium text-foreground">{shiftWindowLabel(shift)}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Muộn sau {shortTime(shift.late_after)}
                    {shift.late_after_pm ? ` · chiều ${shortTime(shift.late_after_pm)}` : ""}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Công ghi nhận
                  </p>
                  <p className="text-[12px] font-medium text-foreground">
                    {formatCredit(Number(shift.work_credit ?? 1))} công / ngày
                    <span className="ml-1 font-normal text-muted-foreground">
                      · quên check-out {formatCredit(Number(shift.forgot_checkout_credit ?? 0))}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {dayOrder.map((day) => {
                  const active = shift.work_days.includes(day);
                  return (
                    <span
                      key={day}
                      className={`inline-flex h-6 min-w-7 items-center justify-center rounded-md px-1.5 text-[10.5px] font-medium ${
                        active
                          ? "bg-primary-subtle text-primary-subtle-foreground"
                          : "bg-muted/50 text-muted-foreground/60"
                      }`}
                    >
                      {WORK_DAY_LABELS[day]}
                    </span>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ShiftFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        shift={editing}
        onSubmit={handleSave}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá ca làm việc?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} và các phân ca liên quan sẽ bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá ca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Shifts;
