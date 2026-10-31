import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, FileText, Home, Loader2, LogOut, MapPin, PenLine } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeRecord } from "@/lib/employee-records";
import { todayIso } from "@/lib/attendance";
import {
  leaveDays,
  listDates,
  REQUEST_CATEGORY_LABELS,
  REQUEST_CATEGORY_ORDER,
  REQUEST_SESSION_LABELS,
  type RequestType,
} from "@/lib/requests";
import { getErrorMessage } from "@/lib/utils";

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeRecord[];
  types: RequestType[];
  defaultEmployeeId?: string;
  leaveSummaries?: Record<string, { entitlement: number; used: number; remaining: number }>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

const TIME_CATEGORIES = ["late", "early_leave", "attendance_fix", "outside"];
const SESSION_CATEGORIES = ["leave", "remote", "late", "early_leave", "outside", "attendance_fix"];

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  leave: CalendarDays,
  late: Clock,
  early_leave: LogOut,
  remote: Home,
  outside: MapPin,
  attendance_fix: PenLine,
  other: FileText,
};

const RequestDialog = ({
  open,
  onOpenChange,
  employees,
  types,
  defaultEmployeeId,
  leaveSummaries,
  onSubmit,
}: RequestDialogProps) => {
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState("leave");
  const [typeId, setTypeId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [session, setSession] = useState("full_day");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () => REQUEST_CATEGORY_ORDER.filter((value) => types.some((type) => type.category === value)),
    [types],
  );

  const typesOfCategory = useMemo(
    () => types.filter((type) => type.category === category),
    [category, types],
  );

  const selectedType = useMemo(
    () => typesOfCategory.find((type) => type.id === typeId) ?? typesOfCategory[0] ?? null,
    [typeId, typesOfCategory],
  );

  useEffect(() => {
    if (!open) return;
    const firstCategory = categories[0] ?? "leave";
    const firstType = types.find((type) => type.category === firstCategory) ?? types[0] ?? null;
    setEmployeeId(defaultEmployeeId ?? employees[0]?.id ?? "");
    setCategory(firstType?.category ?? firstCategory);
    setTypeId(firstType?.id ?? "");
    setStartDate(todayIso());
    setEndDate(todayIso());
    setSession("full_day");
    setStartTime("");
    setEndTime("");
    setReason("");
    setError(null);
  }, [categories, defaultEmployeeId, employees, open, types]);

  const changeCategory = (value: string) => {
    setCategory(value);
    const firstType = types.find((type) => type.category === value) ?? null;
    setTypeId(firstType?.id ?? "");
    setError(null);
  };

  const needsTime = TIME_CATEGORIES.includes(category);
  const needsSession = SESSION_CATEGORIES.includes(category);
  const computedDays = listDates(startDate, endDate).length;
  const leaveDayCount = leaveDays(startDate, endDate, session);
  const employee = employees.find((item) => item.id === employeeId) ?? null;
  const leaveInfo = employeeId ? leaveSummaries?.[employeeId] ?? null : null;

  const submit = async () => {
    setError(null);
    if (!employeeId) {
      setError("Vui lòng chọn nhân sự.");
      return;
    }
    if (!selectedType) {
      setError("Vui lòng chọn loại đơn.");
      return;
    }
    if (endDate < startDate) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    if (selectedType.max_days && computedDays > selectedType.max_days) {
      setError(`Loại đơn này tối đa ${selectedType.max_days} ngày.`);
      return;
    }
    if (needsTime && !startTime && !endTime) {
      setError("Vui lòng nhập giờ cụ thể cho đơn.");
      return;
    }
    if (startTime && endTime && endTime < startTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        employee_id: employeeId,
        request_type_id: selectedType.id,
        start_date: startDate,
        end_date: endDate,
        session: needsSession ? session : null,
        start_time: needsTime ? startTime || null : null,
        end_time: needsTime ? endTime || null : null,
        leave_days: category === "leave" ? leaveDayCount : 0,
        reason: reason.trim(),
        status: "pending",
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[660px]">
        <DialogHeader>
          <DialogTitle>Tạo đơn</DialogTitle>
          <DialogDescription>Chọn nhóm đơn, lý do cụ thể và thời gian áp dụng.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Nhóm đơn</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.map((value) => {
                const Icon = CATEGORY_ICONS[value] ?? FileText;
                const active = category === value;
                const count = types.filter((type) => type.category === value).length;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeCategory(value)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-2 text-[11.5px] font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{REQUEST_CATEGORY_LABELS[value] ?? value}</span>
                    {count > 1 && <span className="text-[9.5px] opacity-70">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[12px]">
                Nhân sự <span className="text-destructive">*</span>
              </Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Chọn nhân sự" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.full_name} · {item.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px]">
                Lý do / loại chi tiết <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedType?.id ?? ""}
                onValueChange={setTypeId}
                disabled={typesOfCategory.length <= 1}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Chọn lý do" />
                </SelectTrigger>
                <SelectContent>
                  {typesOfCategory.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                      {type.deduct_leave ? " · trừ phép" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-[10.5px] text-muted-foreground">
                  {selectedType.max_days ? `Tối đa ${selectedType.max_days} ngày` : "Không giới hạn số ngày"}
                  {selectedType.deduct_leave ? " · trừ vào ngày phép năm" : " · không trừ ngày phép"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="request-start" className="text-[12px]">
                Từ ngày <span className="text-destructive">*</span>
              </Label>
              <Input
                id="request-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (event.target.value > endDate) setEndDate(event.target.value);
                }}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-end" className="text-[12px]">
                Đến ngày <span className="text-destructive">*</span>
              </Label>
              <Input
                id="request-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {needsSession && ["leave", "attendance_fix", "remote"].includes(category) && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">{category === "leave" ? "Thời gian nghỉ" : "Buổi áp dụng"}</Label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_SESSION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsTime && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="request-start-time" className="text-[12px]">
                  {category === "late"
                    ? "Giờ vào mong muốn"
                    : category === "attendance_fix"
                      ? "Giờ vào điều chỉnh"
                      : "Từ giờ"}
                </Label>
                <Input
                  id="request-start-time"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request-end-time" className="text-[12px]">
                  {category === "early_leave"
                    ? "Giờ về mong muốn"
                    : category === "attendance_fix"
                      ? "Giờ ra điều chỉnh"
                      : "Đến giờ"}
                </Label>
                <Input
                  id="request-end-time"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="request-reason" className="text-[12px]">
              Ghi chú <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="request-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Trình bày lý do và thông tin liên quan…"
            />
          </div>

          {category === "leave" && selectedType && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11.5px] text-muted-foreground">
              <p className="font-medium text-foreground">
                {employee?.full_name ?? "Nhân sự"} nghỉ {computedDays} ngày
                {session !== "full_day" ? ` (${REQUEST_SESSION_LABELS[session]})` : ""}
              </p>
              <p>
                {selectedType.deduct_leave
                  ? `Trừ ${leaveDayCount} ngày phép năm`
                  : "Không trừ ngày phép (nghỉ không lương hoặc nghỉ ốm)"}
              </p>
              {leaveInfo && (
                <p className="mt-1">
                  Phép năm {new Date().getFullYear()}: đã dùng {leaveInfo.used}/{leaveInfo.entitlement} ngày · còn{" "}
                  <span className={leaveInfo.remaining - leaveDayCount < 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>
                    {Number((leaveInfo.remaining - (selectedType.deduct_leave ? leaveDayCount : 0)).toFixed(1))} ngày
                  </span>
                </p>
              )}
            </div>
          )}

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
          <Button className="h-9 gap-2" onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Gửi đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestDialog;
