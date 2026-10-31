import { useEffect, useState } from "react";
import { Briefcase, Layers, Loader2, SlidersHorizontal } from "lucide-react";

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
import { SHIFT_TYPE_LABELS, WORK_DAY_LABELS } from "@/lib/attendance";
import type { WorkShift } from "@/lib/attendance";
import { getErrorMessage } from "@/lib/utils";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const TYPE_META = [
  {
    value: "office",
    label: SHIFT_TYPE_LABELS.office,
    hint: "Sáng và chiều, nghỉ trưa",
    icon: Briefcase,
  },
  {
    value: "single",
    label: SHIFT_TYPE_LABELS.single,
    hint: "Một khối liên tục",
    icon: Layers,
  },
  {
    value: "custom",
    label: SHIFT_TYPE_LABELS.custom,
    hint: "Tự cấu hình từng buổi",
    icon: SlidersHorizontal,
  },
];

interface FormState {
  name: string;
  code: string;
  shift_type: string;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  valid_checkin_from: string;
  valid_checkin_to: string;
  late_after: string;
  valid_checkin_from_pm: string;
  valid_checkin_to_pm: string;
  late_after_pm: string;
  work_credit: string;
  forgot_checkout_credit: string;
}

const templates: Record<string, Omit<FormState, "name" | "code">> = {
  office: {
    shift_type: "office",
    morning_start: "08:00",
    morning_end: "12:00",
    afternoon_start: "13:00",
    afternoon_end: "17:30",
    valid_checkin_from: "07:30",
    valid_checkin_to: "08:30",
    late_after: "08:05",
    valid_checkin_from_pm: "13:00",
    valid_checkin_to_pm: "14:00",
    late_after_pm: "13:05",
    work_credit: "1",
    forgot_checkout_credit: "0.5",
  },
  single: {
    shift_type: "single",
    morning_start: "09:00",
    morning_end: "18:00",
    afternoon_start: "",
    afternoon_end: "",
    valid_checkin_from: "08:30",
    valid_checkin_to: "09:45",
    late_after: "09:05",
    valid_checkin_from_pm: "",
    valid_checkin_to_pm: "",
    late_after_pm: "",
    work_credit: "1",
    forgot_checkout_credit: "0.5",
  },
  custom: {
    shift_type: "custom",
    morning_start: "08:00",
    morning_end: "12:00",
    afternoon_start: "13:30",
    afternoon_end: "18:00",
    valid_checkin_from: "07:45",
    valid_checkin_to: "08:30",
    late_after: "08:05",
    valid_checkin_from_pm: "13:15",
    valid_checkin_to_pm: "14:00",
    late_after_pm: "13:35",
    work_credit: "1",
    forgot_checkout_credit: "0.5",
  },
};

const time = (value: string | null | undefined, fallback: string) => (value ? value.slice(0, 5) : fallback);

const minutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  ...templates.office,
});

interface ShiftFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: WorkShift | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

const ShiftFormDialog = ({ open, onOpenChange, shift, onSubmit }: ShiftFormDialogProps) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (shift) {
      const type = shift.shift_type ?? "office";
      setForm({
        name: shift.name,
        code: shift.code ?? "",
        shift_type: type,
        morning_start: time(shift.morning_start ?? shift.start_time, "08:00"),
        morning_end: time(shift.morning_end, "12:00"),
        afternoon_start: time(shift.afternoon_start, ""),
        afternoon_end: time(shift.afternoon_end ?? shift.end_time, ""),
        valid_checkin_from: time(shift.valid_checkin_from, "07:30"),
        valid_checkin_to: time(shift.valid_checkin_to, "08:30"),
        late_after: time(shift.late_after, "08:05"),
        valid_checkin_from_pm: time(shift.valid_checkin_from_pm, ""),
        valid_checkin_to_pm: time(shift.valid_checkin_to_pm, ""),
        late_after_pm: time(shift.late_after_pm, ""),
        work_credit: String(shift.work_credit ?? 1),
        forgot_checkout_credit: String(shift.forgot_checkout_credit ?? 0.5),
      });
      setDays(shift.work_days ?? []);
    } else {
      setForm(emptyForm());
      setDays(["mon", "tue", "wed", "thu", "fri"]);
    }
  }, [open, shift]);

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const chooseType = (type: string) => {
    if (type === form.shift_type) return;
    setForm((prev) => ({
      ...prev,
      ...templates[type],
      name: prev.name,
      code: prev.code,
    }));
  };

  const toggleDay = (day: string) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));

  const isSingle = form.shift_type === "single";

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Vui lòng nhập tên ca.");
      return;
    }
    if (minutes(form.morning_start) >= minutes(form.morning_end)) {
      setError(isSingle ? "Giờ kết thúc phải sau giờ bắt đầu." : "Giờ kết thúc buổi sáng phải sau giờ bắt đầu.");
      return;
    }
    if (!isSingle && minutes(form.afternoon_start) >= minutes(form.afternoon_end)) {
      setError("Giờ kết thúc buổi chiều phải sau giờ bắt đầu.");
      return;
    }
    if (minutes(form.valid_checkin_from) > minutes(form.valid_checkin_to)) {
      setError("Khung giờ chấm công buổi sáng không hợp lệ.");
      return;
    }
    if (
      minutes(form.late_after) < minutes(form.valid_checkin_from) ||
      minutes(form.late_after) > minutes(form.valid_checkin_to)
    ) {
      setError("Giờ muộn buổi sáng phải nằm trong khung giờ chấm công.");
      return;
    }
    if (!isSingle) {
      if (!form.valid_checkin_from_pm || !form.valid_checkin_to_pm || !form.late_after_pm) {
        setError("Vui lòng nhập đủ khung giờ chấm công buổi chiều.");
        return;
      }
      if (minutes(form.valid_checkin_from_pm) > minutes(form.valid_checkin_to_pm)) {
        setError("Khung giờ chấm công buổi chiều không hợp lệ.");
        return;
      }
      if (
        minutes(form.late_after_pm) < minutes(form.valid_checkin_from_pm) ||
        minutes(form.late_after_pm) > minutes(form.valid_checkin_to_pm)
      ) {
        setError("Giờ muộn buổi chiều phải nằm trong khung giờ chấm công.");
        return;
      }
    }
    if (days.length === 0) {
      setError("Chọn ít nhất một ngày làm việc.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        code: form.code.trim() || null,
        shift_type: form.shift_type,
        morning_start: form.morning_start,
        morning_end: form.morning_end,
        afternoon_start: isSingle ? null : form.afternoon_start,
        afternoon_end: isSingle ? null : form.afternoon_end,
        valid_checkin_from: form.valid_checkin_from,
        valid_checkin_to: form.valid_checkin_to,
        late_after: form.late_after,
        valid_checkin_from_pm: isSingle ? null : form.valid_checkin_from_pm,
        valid_checkin_to_pm: isSingle ? null : form.valid_checkin_to_pm,
        late_after_pm: isSingle ? null : form.late_after_pm,
        work_credit: Number(form.work_credit),
        forgot_checkout_credit: Number(form.forgot_checkout_credit),
        work_days: days,
        start_time: form.morning_start,
        end_time: isSingle ? form.morning_end : form.afternoon_end,
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{shift ? "Sửa ca làm việc" : "Thêm ca làm việc"}</DialogTitle>
          <DialogDescription>
            Chọn loại ca, khai báo giờ làm từng buổi và khung giờ chấm công hợp lệ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Loại ca</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPE_META.map((item) => {
                const active = form.shift_type === item.value;
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => chooseType(item.value)}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold">{item.label}</span>
                      <span
                        className={`block text-[10.5px] ${active ? "text-primary-subtle-foreground/80" : "text-muted-foreground"}`}
                      >
                        {item.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shift-name" className="text-[12px]">
                Tên ca <span className="text-destructive">*</span>
              </Label>
              <Input
                id="shift-name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Ca hành chính"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-code" className="text-[12px]">
                Mã ca
              </Label>
              <Input
                id="shift-code"
                value={form.code}
                onChange={(event) => set("code", event.target.value)}
                placeholder="HC"
                className="h-10"
              />
            </div>
          </div>

          {isSingle ? (
            <div className="rounded-lg border border-border bg-muted/25 p-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Giờ làm việc liên tục
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="single-start" className="text-[12px]">
                    Giờ bắt đầu
                  </Label>
                  <Input
                    id="single-start"
                    type="time"
                    value={form.morning_start}
                    onChange={(event) => set("morning_start", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="single-end" className="text-[12px]">
                    Giờ kết thúc
                  </Label>
                  <Input
                    id="single-end"
                    type="time"
                    value={form.morning_end}
                    onChange={(event) => set("morning_end", event.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/25 p-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Buổi sáng
                </p>
                <div className="mt-2 space-y-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="morning-start" className="text-[12px]">
                      Giờ bắt đầu
                    </Label>
                    <Input
                      id="morning-start"
                      type="time"
                      value={form.morning_start}
                      onChange={(event) => set("morning_start", event.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="morning-end" className="text-[12px]">
                      Giờ kết thúc
                    </Label>
                    <Input
                      id="morning-end"
                      type="time"
                      value={form.morning_end}
                      onChange={(event) => set("morning_end", event.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/25 p-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Buổi chiều
                </p>
                <div className="mt-2 space-y-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="afternoon-start" className="text-[12px]">
                      Giờ bắt đầu
                    </Label>
                    <Input
                      id="afternoon-start"
                      type="time"
                      value={form.afternoon_start}
                      onChange={(event) => set("afternoon_start", event.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="afternoon-end" className="text-[12px]">
                      Giờ kết thúc
                    </Label>
                    <Input
                      id="afternoon-end"
                      type="time"
                      value={form.afternoon_end}
                      onChange={(event) => set("afternoon_end", event.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/25 p-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Khung giờ chấm công buổi sáng
              </p>
              <div className="mt-2 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="valid-from" className="text-[12px]">
                      Hợp lệ từ
                    </Label>
                    <Input
                      id="valid-from"
                      type="time"
                      value={form.valid_checkin_from}
                      onChange={(event) => set("valid_checkin_from", event.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="valid-to" className="text-[12px]">
                      Hợp lệ đến
                    </Label>
                    <Input
                      id="valid-to"
                      type="time"
                      value={form.valid_checkin_to}
                      onChange={(event) => set("valid_checkin_to", event.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="late-after" className="text-[12px]">
                    Giờ muộn
                  </Label>
                  <Input
                    id="late-after"
                    type="time"
                    value={form.late_after}
                    onChange={(event) => set("late_after", event.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {!isSingle && (
              <div className="rounded-lg border border-border bg-muted/25 p-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Khung giờ chấm công buổi chiều
                </p>
                <div className="mt-2 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="valid-from-pm" className="text-[12px]">
                        Hợp lệ từ
                      </Label>
                      <Input
                        id="valid-from-pm"
                        type="time"
                        value={form.valid_checkin_from_pm}
                        onChange={(event) => set("valid_checkin_from_pm", event.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="valid-to-pm" className="text-[12px]">
                        Hợp lệ đến
                      </Label>
                      <Input
                        id="valid-to-pm"
                        type="time"
                        value={form.valid_checkin_to_pm}
                        onChange={(event) => set("valid_checkin_to_pm", event.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="late-after-pm" className="text-[12px]">
                      Giờ muộn
                    </Label>
                    <Input
                      id="late-after-pm"
                      type="time"
                      value={form.late_after_pm}
                      onChange={(event) => set("late_after_pm", event.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10.5px] leading-4 text-muted-foreground">
            Chấm công trong khung hợp lệ được ghi nhận; sau giờ muộn bị tính đi muộn; ngoài khung hợp lệ không ghi
            nhận công.
          </p>

          <div className="space-y-2">
            <Label className="text-[12px]">Ngày làm việc</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_ORDER.map((day) => {
                const active = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={active}
                    className={`h-9 rounded-md border text-[11.5px] font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {WORK_DAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="work-credit" className="text-[12px]">
                Số công ghi nhận / ngày
              </Label>
              <Input
                id="work-credit"
                type="number"
                min={0}
                max={2}
                step={0.5}
                value={form.work_credit}
                onChange={(event) => set("work_credit", event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-credit" className="text-[12px]">
                Số công khi quên check-out
              </Label>
              <Input
                id="forgot-credit"
                type="number"
                min={0}
                max={2}
                step={0.5}
                value={form.forgot_checkout_credit}
                onChange={(event) => set("forgot_checkout_credit", event.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button className="h-9 gap-2" onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {shift ? "Lưu thay đổi" : "Tạo ca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftFormDialog;
