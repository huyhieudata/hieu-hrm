import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { currency } from "@/lib/format";
import {
  ONBOARDING_STATUS_LABELS,
  formatDay,
  onboardingProgress,
  updateRow,
  type OnboardingRecord,
} from "@/lib/recruitment";
import {
  listOnboardingTemplates,
  type OnboardingChecklistItem,
} from "@/lib/settings";

interface OnboardingDetailDialogProps {
  record: OnboardingRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onRequestCreate?: (record: OnboardingRecord) => void;
  onUpdated?: () => void | Promise<void>;
}

export const OnboardingDetailDialog = ({
  record,
  open,
  onOpenChange,
  canManage,
  onRequestCreate,
  onUpdated,
}: OnboardingDetailDialogProps) => {
  const [items, setItems] = useState<OnboardingChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !record) return;
    let active = true;
    setLoading(true);

    if (record.checklist && record.checklist.length > 0) {
      setItems(record.checklist.map((item) => ({ ...item })));
      setLoading(false);
      return;
    }

    void listOnboardingTemplates(record.company_id)
      .then((templates) => {
        if (!active) return;
        setItems(
          templates.map((template) => ({
            id: template.id,
            label: template.label,
            required: template.required,
            completed: false,
          })),
        );
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, record]);

  const progress = useMemo(
    () =>
      onboardingProgress({
        checklist: items,
        status: items.length > 0 && items.every((item) => item.completed) ? "completed" : "in_progress",
      }),
    [items],
  );

  const statusLabel = record?.status === "cancelled"
    ? "Đã huỷ"
    : progress.completed
      ? "Hoàn thành"
      : "Chưa hoàn thành";

  const persist = async (next: OnboardingChecklistItem[]) => {
    if (!record) return;
    const allDone = next.length > 0 && next.every((item) => item.completed);
    const anyDone = next.some((item) => item.completed);
    const status = allDone ? "completed" : anyDone ? "in_progress" : "pending";

    setSaving(true);
    try {
      await updateRow("onboarding_records", record.id, { checklist: next, status });
      if (allDone && record.candidate_id) {
        await updateRow("candidates", record.candidate_id, { status: "started" });
      }
      await onUpdated?.();
      if (allDone) {
        toast.success("Đã hoàn thành hội nhập", { description: "Toàn bộ đầu việc đã được tích." });
      }
    } catch (error) {
      toast.error("Không cập nhật được checklist", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string, checked: boolean) => {
    if (!record || !canManage) return;
    const next = items.map((item) => (item.id === id ? { ...item, completed: checked } : item));
    setItems(next);
    void persist(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {record?.full_name ?? "Bản ghi hội nhập"}
            {record && (
              <Badge
                variant={
                  record.status === "cancelled"
                    ? "muted"
                    : progress.completed
                      ? "success"
                      : "warning"
                }
              >
                {statusLabel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {record
              ? [record.position, record.department].filter(Boolean).join(" · ") || "Chưa có vị trí"
              : ""}
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="space-y-4 py-1">
            <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2">
              {[
                ["Ngày nhận việc", formatDay(record.hire_date)],
                ["Người quản lý", record.manager_name ?? "—"],
                ["Mức lương", record.base_salary ? currency(Number(record.base_salary)) : "—"],
                ["Phụ cấp", record.allowance ? currency(Number(record.allowance)) : "—"],
                ["Email", record.email ?? "—"],
                ["Điện thoại", record.phone ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-[12px] font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[12px] font-semibold text-foreground">Đầu việc hội nhập</p>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {progress.done}/{progress.total || 0} · {progress.percent}%
                </span>
              </div>

              <div className="px-3.5 pt-3">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      progress.completed ? "bg-success" : "bg-primary"
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 px-3.5 py-6 text-[11.5px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải checklist…
                </div>
              ) : items.length === 0 ? (
                <p className="px-3.5 py-5 text-[11.5px] text-muted-foreground">
                  Chưa có đầu việc nào. Thiết lập tại Cài đặt → Checklist hội nhập.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border/60">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <Checkbox
                        id={`detail-${item.id}`}
                        checked={item.completed}
                        disabled={!canManage || record.status === "cancelled"}
                        onCheckedChange={(checked) => toggle(item.id, checked === true)}
                      />
                      <label
                        htmlFor={`detail-${item.id}`}
                        className={`min-w-0 flex-1 text-[12px] ${
                          item.completed ? "text-muted-foreground line-through" : "text-foreground"
                        } ${canManage ? "cursor-pointer" : ""}`}
                      >
                        {item.label}
                      </label>
                      {item.completed && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                      {item.required && <Badge variant="warning">Bắt buộc</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[10.5px] leading-5 text-muted-foreground">
              Tích đủ toàn bộ đầu việc → trạng thái tự chuyển “Hoàn thành”. Nếu còn thiếu, thanh tiến độ và
              trạng thái “Chưa hoàn thành” hiển thị tương ứng. {saving && "Đang lưu…"}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {record && canManage && progress.completed && !record.employee_id && record.status !== "cancelled" && (
              <Button
                className="h-9 gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                onClick={() => onRequestCreate?.(record)}
              >
                <CheckCircle2 className="h-4 w-4" /> Tạo hồ sơ nhân viên
              </Button>
            )}
            {record && !progress.completed && record.status !== "cancelled" && (
              <p className="text-[11px] leading-5 text-muted-foreground">
                Hoàn tất 100% checklist để mở nút tạo hồ sơ nhân viên.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
          {record?.employee_id && (
            <Button asChild variant="outline" className="h-9 gap-1.5 text-[12px]">
              <Link to={`/employees/${record.employee_id}`}>
                <ArrowUpRight className="h-3.5 w-3.5" /> Mở hồ sơ nhân viên
              </Link>
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
