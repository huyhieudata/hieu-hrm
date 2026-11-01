import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Search, User, Users } from "lucide-react";

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
import { findShiftConflicts, SCOPE_TYPE_LABELS, todayIso } from "@/lib/attendance";
import type { ShiftAssignment, WorkShift } from "@/lib/attendance";
import type { EmployeeRecord } from "@/lib/employee-records";
import type { DepartmentPosition, DepartmentRecord } from "@/lib/settings";
import { getErrorMessage } from "@/lib/utils";

interface ShiftAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ShiftAssignment | null;
  shifts: WorkShift[];
  employees: EmployeeRecord[];
  departments: DepartmentRecord[];
  positions: DepartmentPosition[];
  assignments: ShiftAssignment[];
  onSubmit: (rows: Record<string, unknown>[]) => Promise<void>;
}

const scopeMeta = [
  { value: "company", label: SCOPE_TYPE_LABELS.company, icon: Building2 },
  { value: "department", label: "Bộ phận", icon: Building2 },
  { value: "position", label: "Vị trí", icon: Users },
  { value: "employee", label: "Cá nhân", icon: User },
];

const ShiftAssignmentDialog = ({
  open,
  onOpenChange,
  assignment,
  shifts,
  employees,
  departments,
  positions,
  assignments,
  onSubmit,
}: ShiftAssignmentDialogProps) => {
  const [shiftId, setShiftId] = useState("");
  const [scopeType, setScopeType] = useState("department");
  const [departmentName, setDepartmentName] = useState("");
  const [positionTitles, setPositionTitles] = useState<string[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQuery("");
    if (assignment) {
      setShiftId(assignment.shift_id);
      setScopeType(assignment.scope_type);
      setDepartmentName(assignment.scope_type === "department" ? assignment.scope_value ?? "" : "");
      setPositionTitles(assignment.scope_type === "position" && assignment.scope_value ? [assignment.scope_value] : []);
      setEmployeeCode(assignment.scope_type === "employee" ? assignment.scope_value ?? "" : "");
      setEffectiveFrom(assignment.effective_from ?? todayIso());
      setEffectiveTo(assignment.effective_to ?? "");
    } else {
      setShiftId("");
      setScopeType("department");
      setDepartmentName("");
      setPositionTitles([]);
      setEmployeeCode("");
      setEffectiveFrom(todayIso());
      setEffectiveTo("");
    }
  }, [assignment, open]);

  const departmentOptions = useMemo(() => {
    const fromOrg = departments.map((department) => department.name);
    const fromEmployees = employees
      .map((employee) => employee.department)
      .filter((name): name is string => !!name);
    return Array.from(new Set([...fromOrg, ...fromEmployees])).sort((a, b) => a.localeCompare(b, "vi"));
  }, [departments, employees]);

  const positionOptions = useMemo(() => {
    const fromOrg = positions.map((position) => position.title);
    const fromEmployees = employees
      .map((employee) => employee.position)
      .filter((title): title is string => !!title);
    return Array.from(new Set([...fromOrg, ...fromEmployees])).sort((a, b) => a.localeCompare(b, "vi"));
  }, [employees, positions]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== "resigned"),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return activeEmployees;
    return activeEmployees.filter((employee) =>
      `${employee.full_name} ${employee.code} ${employee.department ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [activeEmployees, query]);

  const filteredPositions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return positionOptions;
    return positionOptions.filter((title) => title.toLowerCase().includes(keyword));
  }, [positionOptions, query]);

  const togglePosition = (title: string) =>
    setPositionTitles((prev) => (prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]));

  const buildCandidates = () => {
    const base = { effective_from: effectiveFrom || null, effective_to: effectiveTo || null };
    if (scopeType === "company") return [{ ...base, scope_type: "company", scope_value: null }];
    if (scopeType === "department") {
      if (!departmentName) throw new Error("Vui lòng chọn bộ phận.");
      return [{ ...base, scope_type: "department", scope_value: departmentName }];
    }
    if (scopeType === "position") {
      if (positionTitles.length === 0) throw new Error("Vui lòng tích chọn ít nhất một vị trí.");
      return positionTitles.map((title) => ({ ...base, scope_type: "position", scope_value: title }));
    }
    if (!employeeCode) throw new Error("Vui lòng chọn nhân sự.");
    return [{ ...base, scope_type: "employee", scope_value: employeeCode }];
  };

  const submit = async () => {
    setError(null);
    if (!shiftId) {
      setError("Vui lòng chọn ca làm việc.");
      return;
    }

    let candidates: ReturnType<typeof buildCandidates>;
    try {
      candidates = buildCandidates();
    } catch (buildError) {
      setError(getErrorMessage(buildError));
      return;
    }

    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      setError("Hiệu lực đến phải sau hiệu lực từ.");
      return;
    }

    const ignoreIds = assignment ? [assignment.id] : [];
    const conflicts = candidates.flatMap((candidate) =>
      findShiftConflicts(candidate, employees, assignments, shifts, ignoreIds).map((conflict) => ({
        ...conflict,
        scope: candidate,
      })),
    );

    if (conflicts.length > 0) {
      const first = conflicts[0];
      const extra = conflicts.length > 1 ? ` và ${conflicts.length - 1} nhân sự khác` : "";
      setError(
        `Trùng ca: ${first.employee.full_name} (${first.employee.code}) đã có ca ${first.shiftName} trong khoảng thời gian này${extra}.`,
      );
      return;
    }

    setSaving(true);
    try {
      await onSubmit(candidates);
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{assignment ? "Sửa phân ca" : "Phân ca làm việc"}</DialogTitle>
          <DialogDescription>
            Ưu tiên áp dụng: cá nhân → vị trí → phòng ban → toàn công ty. Mỗi nhân sự chỉ có một ca trong một khoảng
            thời gian.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Ca làm việc <span className="text-destructive">*</span>
            </Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Chọn ca làm việc" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} · {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Phân cho</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {scopeMeta.map((meta) => {
                const active = scopeType === meta.value;
                const Icon = meta.icon;
                return (
                  <button
                    key={meta.value}
                    type="button"
                    onClick={() => {
                      setScopeType(meta.value);
                      setError(null);
                      setQuery("");
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[11.5px] font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {scopeType === "company" && (
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11.5px] text-muted-foreground">
              Áp dụng cho toàn bộ nhân sự. Các phân ca theo phòng ban, vị trí hoặc cá nhân sẽ được ưu tiên hơn.
            </p>
          )}

          {scopeType === "department" && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Bộ phận / phòng ban</Label>
              <Select value={departmentName} onValueChange={setDepartmentName}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scopeType === "position" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[12px]">Vị trí / chức danh</Label>
                <span className="text-[11px] text-muted-foreground">Đã chọn {positionTitles.length}</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm vị trí…"
                  className="h-9 pl-8"
                />
              </div>
              <div className="scrollbar-slim max-h-[190px] overflow-y-auto rounded-md border border-border">
                {filteredPositions.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">
                    Chưa có vị trí trong Cơ cấu tổ chức.
                  </p>
                ) : (
                  filteredPositions.map((title) => {
                    const checked = positionTitles.includes(title);
                    return (
                      <button
                        key={title}
                        type="button"
                        onClick={() => togglePosition(title)}
                        className="flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate text-[12px] text-foreground">{title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {scopeType === "employee" && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Nhân sự</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên, mã hoặc phòng ban…"
                  className="h-9 pl-8"
                />
              </div>
              <div className="scrollbar-slim max-h-[190px] overflow-y-auto rounded-md border border-border">
                {filteredEmployees.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">
                    Không tìm thấy nhân sự.
                  </p>
                ) : (
                  filteredEmployees.map((employee) => {
                    const checked = employeeCode === employee.code;
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => setEmployeeCode(employee.code)}
                        className={`flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2 text-left last:border-b-0 ${
                          checked ? "bg-primary-subtle/60" : "hover:bg-muted/40"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                          }`}
                        >
                          {checked && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-medium text-foreground">
                            {employee.full_name}
                            <span className="ml-1 font-normal text-muted-foreground">{employee.code}</span>
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {employee.department ?? "Chưa có phòng ban"}
                            {employee.position ? ` · ${employee.position}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="effective-from" className="text-[12px]">
                Hiệu lực từ
              </Label>
              <Input
                id="effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="effective-to" className="text-[12px]">
                Hiệu lực đến
              </Label>
              <Input
                id="effective-to"
                type="date"
                value={effectiveTo}
                onChange={(event) => setEffectiveTo(event.target.value)}
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">Bỏ trống nếu áp dụng không thời hạn.</p>
            </div>
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
          <Button className="h-9 gap-2" onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {assignment ? "Lưu thay đổi" : "Phân ca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftAssignmentDialog;
