import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import { listOnboardingTemplates } from "@/lib/settings";
import { createRow } from "@/lib/recruitment";
import type { EmployeeRecord } from "@/lib/employee-records";

interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
}

interface OnboardingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  employee: EmployeeRecord;
  onSaved: () => void | Promise<void>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const progressTone = (percent: number) =>
  percent >= 100 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-destructive";

const OnboardingFormDialog = ({ open, onOpenChange, companyId, employee, onSaved }: OnboardingFormDialogProps) => {
  const [hireDate, setHireDate] = useState(employee.hire_date ?? todayIso());
  const [expectedDate, setExpectedDate] = useState(
    addDays(employee.hire_date ?? todayIso(), 3),
  );
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const start = employee.hire_date ?? todayIso();
    setHireDate(start);
    setExpectedDate(addDays(start, 3));
    setNote("");
    setError(null);

    listOnboardingTemplates(companyId)
      .then((templates) =>
        setChecklist(
          templates.map((template) => ({
            id: crypto.randomUUID(),
            label: template.label,
            required: template.required,
            completed: false,
          })),
        ),
      )
      .catch(() => setChecklist([]));
  }, [companyId, employee.hire_date, open]);

  const done = checklist.filter((item) => item.completed).length;
  const percent = checklist.length ? Math.round((done / checklist.length) * 100) : 0;

  const toggle = (id: string) =>
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    );

  const save = async () => {
    setSaving(true);
    try {
      const status = checklist.length > 0 && done === checklist.length ? "completed" : done > 0 ? "in_progress" : "pending";
      await createRow("onboarding_records", {
        company_id: companyId,
        employee_id: employee.id,
        full_name: employee.full_name,
        email: employee.work_email ?? employee.personal_email ?? null,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        hire_date: hireDate || null,
        expected_completion_date: expectedDate || null,
        status,
        note: note.trim() || null,
        checklist,
      });
      toast.success("Đã thêm hồ sơ hội nhập");
      await onSaved();
      onOpenChange(false);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Thêm hồ sơ hội nhập</DialogTitle>
          <DialogDescription>
            {employee.full_name} · {employee.code} · vị trí và bộ phận đồng bộ theo nhân viên.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Vị trí</Label>
              <Input value={employee.position ?? ""} readOnly className="h-10 bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Bộ phận</Label>
              <Input value={employee.department ?? ""} readOnly className="h-10 bg-muted/40" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px]">Ngày nhận việc</Label>
              <Input
                type="date"
                value={hireDate}
                onChange={(event) => {
                  setHireDate(event.target.value);
                  if (event.target.value) setExpectedDate(addDays(event.target.value, 3));
                }}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Ngày hoàn thành dự kiến</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(event) => setExpectedDate(event.target.value)}
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground">Mặc định: ngày nhận việc + 3 ngày.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[12px]">Trạng thái</Label>
              <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-[12px] text-muted-foreground">
                Tự động theo tiến độ checklist
              </div>
              <p className="text-[10px] text-muted-foreground">
                0%: Chờ hội nhập · &gt;0%: Đang hội nhập · 100%: Hoàn thành.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[12px]">Checklist hội nhập</Label>
              <span className="text-[10.5px] text-muted-foreground">
                {done}/{checklist.length} mục
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${progressTone(percent)}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {checklist.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11.5px] text-muted-foreground">
                  Chưa có mục checklist — thêm tại Cài đặt check list → Checklist hội nhập.
                </p>
              ) : (
                checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-muted/50"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        item.completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                      }`}
                    >
                      {item.completed && <Check className="h-3 w-3" />}
                    </span>
                    <span className="text-[11.5px] text-foreground">
                      {item.label}
                      {item.required && <span className="ml-1 text-[10px] text-destructive">*</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Ghi chú</Label>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button className="h-9 gap-2" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Thêm hồ sơ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingFormDialog;
