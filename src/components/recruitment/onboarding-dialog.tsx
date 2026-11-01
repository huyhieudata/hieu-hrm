import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, ListChecks, Settings2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";
import {
  EMPLOYMENT_TYPE_LABELS,
  createEmployee,
  listEmployees,
  type EmployeeRecord,
} from "@/lib/employee-records";
import {
  createRow,
  listRows,
  updateRow,
  type Candidate,
  type CandidateOffer,
  type OnboardingRecord,
} from "@/lib/recruitment";
import {
  listDepartments,
  listOnboardingTemplates,
  type DepartmentRecord,
  type OnboardingChecklistItem,
} from "@/lib/settings";

interface OnboardingDialogProps {
  candidate: Candidate | null;
  offer?: CandidateOffer | null;
  /** Pending onboarding record to complete (created automatically on offer acceptance). */
  record?: OnboardingRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (employee: EmployeeRecord | null) => void | Promise<void>;
}

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  gender: "none",
  address: "",
  department: "",
  position: "",
  employment_type: "full_time",
  work_location: "",
  hire_date: "",
  base_salary: "",
  allowance: "",
  bank_name: "",
  bank_account: "",
  tax_code: "",
  national_id: "",
  note: "",
};

const Field = ({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-[12px]">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
    {children}
    {hint && <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>}
  </div>
);

export const OnboardingDialog = ({
  candidate,
  offer,
  record,
  open,
  onOpenChange,
  onDone,
}: OnboardingDialogProps) => {
  const [form, setForm] = useState(emptyForm);
  const [existingRecord, setExistingRecord] = useState<OnboardingRecord | null>(record ?? null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [templates, setTemplates] = useState<OnboardingChecklistItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [manualManager, setManualManager] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill synchronously so the dialog never opens with empty fields.
  const initialValues = useMemo(() => {
    if (!candidate) return emptyForm;
    return {
      ...emptyForm,
      full_name: candidate.full_name ?? "",
      email: candidate.email ?? "",
      phone: candidate.phone ?? "",
      date_of_birth: candidate.date_of_birth?.slice(0, 10) ?? "",
      gender: candidate.gender ?? "none",
      address: candidate.address ?? "",
      department: offer?.department ?? "",
      position: offer?.position ?? candidate.position_applied ?? "",
      work_location: offer?.work_location ?? "",
      hire_date: offer?.onboarding_date?.slice(0, 10) ?? "",
      base_salary: offer?.base_salary ? String(offer.base_salary) : "",
      allowance: offer?.allowance ? String(offer.allowance) : "",
    };
  }, [candidate, offer]);

  useEffect(() => {
    if (!open) return;
    setForm(initialValues);
    setManualManager(false);
    setManagerId("");
    setError(null);
  }, [initialValues, open]);

  useEffect(() => {
    if (!open || !candidate) return;
    let active = true;
    setLoading(true);
    void Promise.all([
      listDepartments(candidate.company_id),
      listOnboardingTemplates(candidate.company_id),
      listEmployees(candidate.company_id),
      record
        ? Promise.resolve([record] as OnboardingRecord[])
        : listRows<OnboardingRecord>("onboarding_records", candidate.company_id, "created_at"),
    ])
      .then(([deptRows, templateRows, employeeRows, recordRows]) => {
        if (!active) return;
        setDepartments(deptRows);
        setEmployees(employeeRows);

        const pending =
          recordRows.find(
            (row) => row.candidate_id === candidate.id && row.status !== "completed" && row.status !== "cancelled",
          ) ?? null;
        setExistingRecord(pending);

        setTemplates(
          templateRows.map((item) => {
            const saved = pending?.checklist?.find((entry) => entry.id === item.id);
            return {
              id: item.id,
              label: item.label,
              required: item.required,
              completed: saved?.completed ?? false,
            };
          }),
        );

        if (pending) {
          if (pending.manager_employee_id) {
            const deptManager = deptRows.find((item) => item.name === pending.department)?.manager_employee_id;
            if (deptManager !== pending.manager_employee_id) {
              setManualManager(true);
              setManagerId(pending.manager_employee_id);
            }
          }
          setForm((prev) => ({
            ...prev,
            full_name: pending.full_name || prev.full_name,
            email: pending.email ?? prev.email,
            phone: pending.phone ?? prev.phone,
            date_of_birth: pending.date_of_birth?.slice(0, 10) ?? prev.date_of_birth,
            address: pending.address ?? prev.address,
            department: pending.department ?? prev.department,
            position: pending.position ?? prev.position,
            employment_type: pending.employment_type ?? prev.employment_type,
            work_location: pending.work_location ?? prev.work_location,
            hire_date: pending.hire_date?.slice(0, 10) ?? prev.hire_date,
            base_salary: pending.base_salary ? String(pending.base_salary) : prev.base_salary,
            allowance: pending.allowance ? String(pending.allowance) : prev.allowance,
          }));
        }
      })
      .catch(() => {
        if (!active) return;
        setDepartments([]);
        setTemplates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [candidate, open, record]);

  const department = useMemo(
    () => departments.find((item) => item.name === form.department) ?? null,
    [departments, form.department],
  );

  const manualManagerRecord = useMemo(
    () => employees.find((employee) => employee.id === managerId) ?? null,
    [employees, managerId],
  );

  const effectiveManagerId = manualManager
    ? manualManagerRecord?.id ?? null
    : department?.manager_employee_id ?? null;
  const effectiveManagerName = manualManager
    ? manualManagerRecord?.full_name ?? null
    : department?.manager_name ?? null;

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleChecklist = (id: string, checked: boolean) =>
    setTemplates((prev) => prev.map((item) => (item.id === id ? { ...item, completed: checked } : item)));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!candidate) return;

    if (!form.full_name.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }
    if (!form.hire_date) {
      setError("Vui lòng chọn ngày nhận việc.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Block duplicates against existing employee records (server enforces this too)
      if (form.email.trim()) {
        const { data: sameEmail } = await supabase
          .from("employees")
          .select("id, full_name")
          .eq("company_id", candidate.company_id)
          .ilike("work_email", form.email.trim())
          .limit(1);
        if (sameEmail && sameEmail.length > 0) {
          setError(`Email ${form.email.trim()} đã có trong hồ sơ nhân sự (${sameEmail[0].full_name}).`);
          setSaving(false);
          return;
        }
      }
      if (form.phone.trim()) {
        const { data: samePhone } = await supabase
          .from("employees")
          .select("id, full_name")
          .eq("company_id", candidate.company_id)
          .eq("phone", form.phone.trim())
          .limit(1);
        if (samePhone && samePhone.length > 0) {
          setError(`Số điện thoại ${form.phone.trim()} đã có trong hồ sơ nhân sự (${samePhone[0].full_name}).`);
          setSaving(false);
          return;
        }
      }

      const code = `NV-${String(Date.now()).slice(-6)}`;
      const employeeId = await createEmployee({
        company_id: candidate.company_id,
        code,
        full_name: form.full_name.trim(),
        work_email: form.email || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender === "none" ? null : form.gender,
        current_address: form.address || null,
        department: form.department || null,
        position: form.position || null,
        employment_type: form.employment_type || null,
        work_location: form.work_location || null,
        hire_date: form.hire_date,
        status: "active",
        manager_id: effectiveManagerId,
        national_id: form.national_id || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
        tax_code: form.tax_code || null,
        notes: form.note || null,
      });

      const onboardingPayload = {
        company_id: candidate.company_id,
        candidate_id: candidate.id,
        employee_id: employeeId,
        full_name: form.full_name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender === "none" ? null : form.gender,
        address: form.address || null,
        department: form.department || null,
        position: form.position || null,
        employment_type: form.employment_type || null,
        work_location: form.work_location || null,
        hire_date: form.hire_date,
        base_salary: form.base_salary ? Number(form.base_salary) : null,
        allowance: form.allowance ? Number(form.allowance) : null,
        national_id: form.national_id || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
        tax_code: form.tax_code || null,
        manager_employee_id: effectiveManagerId,
        manager_name: effectiveManagerName,
        checklist: templates,
        note: form.note || null,
        status: "completed",
      };

      if (existingRecord) {
        await updateRow("onboarding_records", existingRecord.id, onboardingPayload);
      } else {
        await createRow("onboarding_records", onboardingPayload);
      }

      const { error: rpcError } = await supabase.rpc("complete_candidate_onboarding", {
        p_candidate: candidate.id,
        p_employee: employeeId,
      });
      if (rpcError) throw rpcError;

      toast.success("Đã tiếp nhận nhân sự mới", {
        description: `${form.full_name.trim()} đã vào module Hội nhập và được ghi nhận “Đã đến nhận việc”.`,
      });
      await onDone?.(null);
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Không hoàn tất được tiếp nhận.";
      setError(
        message.includes("duplicate key")
          ? "Mã nhân viên bị trùng, vui lòng thử lại."
          : message.includes("Email đã tồn tại") || message.includes("Số điện thoại đã tồn tại")
            ? message
            : message.includes("row-level security")
              ? "Bạn không có quyền tạo hồ sơ nhân sự."
              : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tiếp nhận nhân sự mới</DialogTitle>
            <DialogDescription>
              Thông tin được tự điền từ hồ sơ ứng viên, vị trí ứng tuyển và offer. Quản lý phòng ban lấy từ Cài
              đặt → Cơ cấu tổ chức.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Thông tin cá nhân
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Họ và tên" htmlFor="ob-name" required>
                  <Input
                    id="ob-name"
                    value={form.full_name}
                    onChange={(event) => setField("full_name", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Email công việc" htmlFor="ob-email">
                  <Input
                    id="ob-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Số điện thoại" htmlFor="ob-phone">
                  <Input
                    id="ob-phone"
                    value={form.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Ngày sinh" htmlFor="ob-dob">
                  <Input
                    id="ob-dob"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) => setField("date_of_birth", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Giới tính">
                  <Select value={form.gender} onValueChange={(value) => setField("gender", value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chưa chọn</SelectItem>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Số CCCD / CMND" htmlFor="ob-nid">
                  <Input
                    id="ob-nid"
                    value={form.national_id}
                    onChange={(event) => setField("national_id", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Địa chỉ hiện tại" htmlFor="ob-address">
                    <Input
                      id="ob-address"
                      value={form.address}
                      onChange={(event) => setField("address", event.target.value)}
                      className="h-10 text-[13px]"
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Vị trí & hội nhập
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phòng ban" hint="Chọn phòng ban để tự gán người quản lý từ Cài đặt.">
                  <Select value={form.department || "none"} onValueChange={(value) => setField("department", value === "none" ? "" : value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Chọn phòng ban" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chưa chọn</SelectItem>
                      {departments.map((item) => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Chức danh" htmlFor="ob-position">
                  <Input
                    id="ob-position"
                    value={form.position}
                    onChange={(event) => setField("position", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
              </div>

              <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <UserCog className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Quản lý trực tiếp {manualManager ? "(gán thủ công)" : "(tự động theo cơ cấu tổ chức)"}
                    </p>
                    <p className="truncate text-[12px] font-medium text-foreground">
                      {effectiveManagerName ?? "Chưa gán người quản lý cho phòng ban này"}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
                    <Link to="/cai-dat/co-cau-to-chuc">
                      <Settings2 className="h-3 w-3" /> Cài đặt
                    </Link>
                  </Button>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-muted-foreground">
                  <Checkbox
                    checked={manualManager}
                    onCheckedChange={(checked) => setManualManager(checked === true)}
                    className="h-3.5 w-3.5"
                  />
                  Gán thủ công người quản lý khác
                </label>

                {manualManager && (
                  <Select value={managerId || "none"} onValueChange={(value) => setManagerId(value === "none" ? "" : value)}>
                    <SelectTrigger className="h-9 bg-card text-[12.5px]">
                      <SelectValue placeholder="Chọn người quản lý trực tiếp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chưa chọn</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                          {employee.position ? ` · ${employee.position}` : ""}
                          {employee.department ? ` · ${employee.department}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hình thức làm việc">
                  <Select value={form.employment_type} onValueChange={(value) => setField("employment_type", value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Địa điểm làm việc" htmlFor="ob-location">
                  <Input
                    id="ob-location"
                    value={form.work_location}
                    onChange={(event) => setField("work_location", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Ngày nhận việc" htmlFor="ob-hire" required>
                  <Input
                    id="ob-hire"
                    type="date"
                    value={form.hire_date}
                    onChange={(event) => setField("hire_date", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Mức lương theo offer" htmlFor="ob-salary">
                  <Input
                    id="ob-salary"
                    inputMode="numeric"
                    value={form.base_salary}
                    onChange={(event) => setField("base_salary", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Phụ cấp" htmlFor="ob-allowance">
                  <Input
                    id="ob-allowance"
                    inputMode="numeric"
                    value={form.allowance}
                    onChange={(event) => setField("allowance", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Mã số thuế TNCN" htmlFor="ob-tax">
                  <Input
                    id="ob-tax"
                    value={form.tax_code}
                    onChange={(event) => setField("tax_code", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Ngân hàng" htmlFor="ob-bank">
                  <Input
                    id="ob-bank"
                    value={form.bank_name}
                    onChange={(event) => setField("bank_name", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Số tài khoản" htmlFor="ob-account">
                  <Input
                    id="ob-account"
                    value={form.bank_account}
                    onChange={(event) => setField("bank_account", event.target.value)}
                    className="h-10 text-[13px]"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">Checklist hội nhập</p>
                    <p className="text-[11px] text-muted-foreground">
                      Lấy từ Cài đặt → Checklist hội nhập
                    </p>
                  </div>
                </div>
                <Badge variant="muted">
                  {templates.filter((item) => item.completed).length}/{templates.length}
                </Badge>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 px-3.5 py-5 text-[11.5px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải checklist…
                </div>
              ) : templates.length === 0 ? (
                <p className="px-3.5 py-4 text-[11.5px] text-muted-foreground">
                  Chưa có bước hội nhập nào. Thiết lập tại{" "}
                  <Link to="/cai-dat/checklist-hoi-nhap" className="font-medium text-primary hover:underline">
                    Cài đặt → Checklist hội nhập
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {templates.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <Checkbox
                        id={`ob-check-${item.id}`}
                        checked={item.completed}
                        onCheckedChange={(checked) => toggleChecklist(item.id, checked === true)}
                      />
                      <label htmlFor={`ob-check-${item.id}`} className="min-w-0 flex-1 cursor-pointer text-[12px] text-foreground">
                        {item.label}
                      </label>
                      {item.required && <Badge variant="warning">Bắt buộc</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Field label="Ghi chú hội nhập" htmlFor="ob-note">
              <Textarea
                id="ob-note"
                rows={2}
                value={form.note}
                onChange={(event) => setField("note", event.target.value)}
                className="text-[13px]"
              />
            </Field>

            {error && (
              <p className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Đang tiếp nhận…" : "Hoàn tất tiếp nhận"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
