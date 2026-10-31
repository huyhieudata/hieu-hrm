/**
 * Phần tính lương thuần (không phụ thuộc Supabase) để dễ kiểm thử.
 * Công thức: lương theo ngày công thực tế + phép hưởng lương, BHNV 10,5%,
 * giảm trừ gia cảnh và thuế TNCN lũy tiến từng phần.
 */

export const PERSONAL_DEDUCTION = 11_000_000;
export const DEPENDENT_DEDUCTION = 4_400_000;
export const INSURANCE_EMPLOYEE_RATE = 0.105;

const TAX_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 5_000_000, rate: 0.05 },
  { upTo: 10_000_000, rate: 0.1 },
  { upTo: 18_000_000, rate: 0.15 },
  { upTo: 32_000_000, rate: 0.2 },
  { upTo: 52_000_000, rate: 0.25 },
  { upTo: 80_000_000, rate: 0.3 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.35 },
];

/** Thuế TNCN lũy tiến từng phần theo biểu thuế tháng. */
export const computePit = (taxable: number) => {
  let remaining = Math.max(taxable, 0);
  let previous = 0;
  let tax = 0;
  for (const bracket of TAX_BRACKETS) {
    const span = bracket.upTo - previous;
    const amount = Math.min(remaining, span);
    if (amount <= 0) break;
    tax += amount * bracket.rate;
    remaining -= amount;
    previous = bracket.upTo;
  }
  return Math.round(tax);
};

export interface PayrollPeriodInput {
  id: string;
  year: number;
  month: number;
  standard_work_days: number;
}

export interface PayrollEmployeeInput {
  id: string;
  full_name: string;
  code: string | null;
  department: string | null;
  hire_date: string | null;
  resignation_date: string | null;
  dependents_count: number | null;
}

export interface PayrollSalaryInput {
  employee_id: string;
  effective_date: string;
  base_salary: number | null;
  position_allowance: number | null;
  responsibility_allowance: number | null;
  other_allowance: number | null;
  insurance_salary: number | null;
}

export interface PayrollAttendanceInput {
  employee_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  shift_id: string | null;
}

export interface PayrollShiftInput {
  id: string;
  work_credit: number | null;
  forgot_checkout_credit: number | null;
}

export interface PayrollLeaveInput {
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_days: number | null;
  status: string;
  category: string | null;
  deduct_leave: boolean | null;
}

export interface PayrollItemDraft {
  company_id: string;
  period_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string | null;
  department: string | null;
  work_days: number;
  attendance_days: number;
  leave_days: number;
  base_salary: number;
  position_allowance: number;
  responsibility_allowance: number;
  other_allowance: number;
  gross_salary: number;
  insurance_salary: number;
  insurance_employee: number;
  taxable_income: number;
  tax_amount: number;
  other_deduction: number;
  net_salary: number;
  dependents_count: number;
}

export interface SkippedEmployee {
  employee_id: string;
  employee_name: string;
  reason: "no_salary" | "not_in_period";
}

export type PayrollWarningCode = "no_salary" | "no_attendance" | "mid_month" | "resigned_in_period";

export interface PayrollWarning {
  employee_id: string;
  employee_name: string;
  code: PayrollWarningCode;
  detail: string;
}

export interface PayrollCalcResult {
  items: PayrollItemDraft[];
  skipped: SkippedEmployee[];
  warnings: PayrollWarning[];
  hasAttendanceData: boolean;
}

export interface PayrollAdjustmentInput {
  other_allowance: number;
  other_deduction: number;
  note: string | null;
}

/** Điều chỉnh tay phụ cấp/khấu trừ và tính lại thu nhập chịu thuế, thuế, thực nhận. */
export const applyPayrollAdjustment = (
  item: Pick<
    PayrollItemDraft,
    | "base_salary"
    | "position_allowance"
    | "responsibility_allowance"
    | "other_allowance"
    | "insurance_employee"
    | "dependents_count"
  >,
  adjustment: PayrollAdjustmentInput,
) => {
  const otherAllowance = Math.max(Number(adjustment.other_allowance) || 0, 0);
  const otherDeduction = Math.max(Number(adjustment.other_deduction) || 0, 0);
  const gross =
    Number(item.base_salary) +
    Number(item.position_allowance) +
    Number(item.responsibility_allowance) +
    otherAllowance;
  const dependents = Math.max(Number(item.dependents_count ?? 0), 0);
  const taxable = Math.max(
    gross - Number(item.insurance_employee) - PERSONAL_DEDUCTION - dependents * DEPENDENT_DEDUCTION,
    0,
  );
  const tax = computePit(taxable);
  const net = gross - Number(item.insurance_employee) - tax - otherDeduction;

  return {
    other_allowance: otherAllowance,
    other_deduction: otherDeduction,
    gross_salary: gross,
    taxable_income: taxable,
    tax_amount: tax,
    net_salary: net,
    note: adjustment.note?.trim() ? adjustment.note.trim() : null,
  };
};

const pad = (value: number) => String(value).padStart(2, "0");
const DAY = 24 * 60 * 60 * 1000;

const asDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);
const asIso = (value: Date) => value.toISOString().slice(0, 10);
const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const daysBetween = (from: string, to: string) => Math.round((asDate(to).getTime() - asDate(from).getTime()) / DAY);

const eachDate = (from: string, to: string) => {
  const dates: string[] = [];
  const total = daysBetween(from, to);
  for (let index = 0; index <= total; index += 1) {
    dates.push(asIso(new Date(asDate(from).getTime() + index * DAY)));
  }
  return dates;
};

/** Hệ số công của một ngày: quên check-out dùng hệ số riêng, không có ca thì tính 1 công. */
const creditForDay = (records: PayrollAttendanceInput[], shift: PayrollShiftInput | undefined) => {
  if (!records.some((record) => record.check_in)) return 0;
  if (records.some((record) => record.check_in && !record.check_out)) {
    return shift ? Number(shift.forgot_checkout_credit ?? 0) : 1;
  }
  return shift ? Number(shift.work_credit ?? 1) : 1;
};

export const payrollPeriodRange = (year: number, month: number) => ({
  start: `${year}-${pad(month)}-01`,
  end: asIso(new Date(Date.UTC(year, month, 0))),
});

export const calculatePayroll = (input: {
  companyId: string;
  period: PayrollPeriodInput;
  employees: PayrollEmployeeInput[];
  salaries: PayrollSalaryInput[];
  attendance: PayrollAttendanceInput[];
  shifts: PayrollShiftInput[];
  leaves: PayrollLeaveInput[];
}): PayrollCalcResult => {
  const { companyId, period, employees, attendance, shifts, leaves } = input;
  const { start: periodStart, end: periodEnd } = payrollPeriodRange(period.year, period.month);
  const standardDays = Number(period.standard_work_days) > 0 ? Number(period.standard_work_days) : 26;
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));

  // Không có bất kỳ bản ghi chấm công nào trong tháng: không thể chia lương theo
  // ngày công nên tạm tính theo thời gian làm việc thực tế trong tháng.
  const hasAttendanceData = attendance.length > 0;

  const attendanceByEmployee = new Map<string, Map<string, PayrollAttendanceInput[]>>();
  attendance.forEach((record) => {
    const byDate = attendanceByEmployee.get(record.employee_id) ?? new Map<string, PayrollAttendanceInput[]>();
    byDate.set(record.work_date, [...(byDate.get(record.work_date) ?? []), record]);
    attendanceByEmployee.set(record.employee_id, byDate);
  });

  const salaryByEmployee = new Map<string, PayrollSalaryInput>();
  [...input.salaries]
    .filter((row) => row.effective_date <= periodEnd)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    .forEach((row) => salaryByEmployee.set(row.employee_id, row));

  const leavesByEmployee = new Map<string, PayrollLeaveInput[]>();
  leaves
    .filter(
      (leave) =>
        leave.status === "approved" &&
        leave.category === "leave" &&
        leave.deduct_leave !== false &&
        leave.start_date <= periodEnd &&
        leave.end_date >= periodStart,
    )
    .forEach((leave) =>
      leavesByEmployee.set(leave.employee_id, [...(leavesByEmployee.get(leave.employee_id) ?? []), leave]),
    );

  const items: PayrollItemDraft[] = [];
  const skipped: SkippedEmployee[] = [];
  const warnings: PayrollWarning[] = [];

  employees.forEach((employee) => {
    if (employee.hire_date && employee.hire_date > periodEnd) {
      skipped.push({ employee_id: employee.id, employee_name: employee.full_name, reason: "not_in_period" });
      return;
    }
    if (employee.resignation_date && employee.resignation_date < periodStart) {
      skipped.push({ employee_id: employee.id, employee_name: employee.full_name, reason: "not_in_period" });
      return;
    }

    const salary = salaryByEmployee.get(employee.id);
    const baseSalary = Number(salary?.base_salary ?? 0);
    if (!salary || baseSalary <= 0) {
      skipped.push({ employee_id: employee.id, employee_name: employee.full_name, reason: "no_salary" });
      warnings.push({
        employee_id: employee.id,
        employee_name: employee.full_name,
        code: "no_salary",
        detail: "Chưa có bảng lương nên không được tính trong kỳ",
      });
      return;
    }

    if (employee.hire_date && employee.hire_date > periodStart) {
      warnings.push({
        employee_id: employee.id,
        employee_name: employee.full_name,
        code: "mid_month",
        detail: `Vào làm ${employee.hire_date}`,
      });
    }
    if (
      employee.resignation_date &&
      employee.resignation_date >= periodStart &&
      employee.resignation_date <= periodEnd
    ) {
      warnings.push({
        employee_id: employee.id,
        employee_name: employee.full_name,
        code: "resigned_in_period",
        detail: `Nghỉ việc ${employee.resignation_date}`,
      });
    }

    const employmentStart = employee.hire_date && employee.hire_date > periodStart ? employee.hire_date : periodStart;
    const employmentEnd =
      employee.resignation_date && employee.resignation_date < periodEnd ? employee.resignation_date : periodEnd;

    const dayCredits = attendanceByEmployee.get(employee.id) ?? new Map<string, PayrollAttendanceInput[]>();
    let attendanceDays = 0;
    const creditedDates = new Set<string>();
    dayCredits.forEach((records, date) => {
      if (date < employmentStart || date > employmentEnd) return;
      const shiftId = records.find((record) => record.shift_id)?.shift_id ?? null;
      const credit = creditForDay(records, shiftId ? shiftById.get(shiftId) : undefined);
      if (credit > 0) {
        attendanceDays += credit;
        creditedDates.add(date);
      }
    });

    let leaveDays = 0;
    (leavesByEmployee.get(employee.id) ?? []).forEach((leave) => {
      const from = leave.start_date > employmentStart ? leave.start_date : employmentStart;
      const to = leave.end_date < employmentEnd ? leave.end_date : employmentEnd;
      if (from > to) return;
      const span = daysBetween(leave.start_date, leave.end_date) + 1;
      const perDay = Number(leave.leave_days ?? 0) > 0 ? Number(leave.leave_days) / span : 1;
      eachDate(from, to).forEach((date) => {
        if (creditedDates.has(date)) return;
        leaveDays += perDay;
      });
    });

    // Nhân sự chưa có dữ liệu chấm công/phép (ví dụ chưa cấu hình chấm công hoặc
    // vào làm giữa tháng) được tính theo tỉ lệ thời gian làm việc trong tháng,
    // không bị trả 0 đồng oan.
    const employmentDays = daysBetween(employmentStart, employmentEnd) + 1;
    const monthDays = daysBetween(periodStart, periodEnd) + 1;
    const fallbackDays = round(standardDays * Math.min(employmentDays / monthDays, 1), 2);
    const hasOwnData = dayCredits.size > 0 || (leavesByEmployee.get(employee.id)?.length ?? 0) > 0;

    const paidDays = !hasOwnData
      ? fallbackDays
      : Math.min(round(attendanceDays + leaveDays, 2), standardDays);

    if (!hasOwnData) {
      warnings.push({
        employee_id: employee.id,
        employee_name: employee.full_name,
        code: "no_attendance",
        detail: `Chưa có chấm công, tạm tính ${round(paidDays, 2)}/${standardDays} ngày công`,
      });
    }
    const ratio = standardDays > 0 ? paidDays / standardDays : 1;

    const base = Math.round(baseSalary * ratio);
    const positionAllowance = Math.round(Number(salary.position_allowance ?? 0) * ratio);
    const responsibilityAllowance = Math.round(Number(salary.responsibility_allowance ?? 0) * ratio);
    const otherAllowance = Math.round(Number(salary.other_allowance ?? 0) * ratio);
    const gross = base + positionAllowance + responsibilityAllowance + otherAllowance;

    const insuranceSalary = Number(salary.insurance_salary ?? baseSalary);
    const insurance = gross > 0 ? Math.round(insuranceSalary * INSURANCE_EMPLOYEE_RATE) : 0;
    const dependents = Math.max(Number(employee.dependents_count ?? 0), 0);
    const taxable = Math.max(gross - insurance - PERSONAL_DEDUCTION - dependents * DEPENDENT_DEDUCTION, 0);
    const tax = computePit(taxable);
    const net = gross - insurance - tax;

    items.push({
      company_id: companyId,
      period_id: period.id,
      employee_id: employee.id,
      employee_name: employee.full_name,
      employee_code: employee.code,
      department: employee.department,
      work_days: round(paidDays, 2),
      attendance_days: round(attendanceDays, 2),
      leave_days: round(leaveDays, 2),
      base_salary: base,
      position_allowance: positionAllowance,
      responsibility_allowance: responsibilityAllowance,
      other_allowance: otherAllowance,
      gross_salary: gross,
      insurance_salary: insuranceSalary,
      insurance_employee: insurance,
      taxable_income: taxable,
      tax_amount: tax,
      other_deduction: 0,
      net_salary: net,
      dependents_count: dependents,
    });
  });

  return { items, skipped, warnings, hasAttendanceData };
};
