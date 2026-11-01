/**
 * Phần tính lương thuần (không phụ thuộc Supabase) để dễ kiểm thử.
 * Công thức: lương theo ngày công thực tế + phép hưởng lương, BHNV 10,5%,
 * giảm trừ gia cảnh và thuế TNCN lũy tiến từng phần.
 */

export const INSURANCE_EMPLOYEE_RATE = 0.105;

/** Số ngày làm việc không hưởng lương trong tháng từ mức này trở lên thì không đóng BHXH/BHYT/BHTN. */
export const INSURANCE_UNPAID_DAYS_EXEMPT = 14;
/** Trần lương đóng bảo hiểm = 20 lần mức lương cơ sở. */
export const INSURANCE_CAP_MULTIPLIER = 20;

interface TaxBracket {
  upTo: number;
  rate: number;
}

export interface PitRule {
  /** Áp dụng cho kỳ lương có ngày đầu tháng >= effectiveFrom (YYYY-MM-DD). */
  effectiveFrom: string;
  personalDeduction: number;
  dependentDeduction: number;
  brackets: TaxBracket[];
  source: string;
}

/**
 * Tham số thuế TNCN theo ngày hiệu lực, sắp xếp tăng dần.
 * - Trước 2026: Luật 04/2007/QH12 (biểu 7 bậc), NQ 954/2020/UBTVQH14 (11 triệu / 4,4 triệu).
 * - Từ kỳ tính thuế 2026: Luật Thuế TNCN số 109/2025/QH15 (Điều 9, biểu 5 bậc; Điều 29 khoản 2
 *   áp dụng cho tiền lương, tiền công từ kỳ tính thuế 2026) và NQ 110/2025/UBTVQH15 (15,5 triệu / 6,2 triệu).
 */
export const PIT_RULES: PitRule[] = [
  {
    effectiveFrom: "1900-01-01",
    personalDeduction: 11_000_000,
    dependentDeduction: 4_400_000,
    brackets: [
      { upTo: 5_000_000, rate: 0.05 },
      { upTo: 10_000_000, rate: 0.1 },
      { upTo: 18_000_000, rate: 0.15 },
      { upTo: 32_000_000, rate: 0.2 },
      { upTo: 52_000_000, rate: 0.25 },
      { upTo: 80_000_000, rate: 0.3 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.35 },
    ],
    source: "Luật 04/2007/QH12, NQ 954/2020/UBTVQH14",
  },
  {
    effectiveFrom: "2026-01-01",
    personalDeduction: 15_500_000,
    dependentDeduction: 6_200_000,
    brackets: [
      { upTo: 10_000_000, rate: 0.05 },
      { upTo: 30_000_000, rate: 0.1 },
      { upTo: 60_000_000, rate: 0.2 },
      { upTo: 100_000_000, rate: 0.3 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.35 },
    ],
    source: "Luật 109/2025/QH15, NQ 110/2025/UBTVQH15",
  },
];

/** Mức lương cơ sở theo ngày hiệu lực (NĐ 73/2024/NĐ-CP, NĐ 161/2026/NĐ-CP). */
export interface BaseWageRule {
  effectiveFrom: string;
  amount: number;
  capMultiplier?: number;
  employeeRate?: number;
  unpaidDaysExempt?: number;
}

export const BASE_WAGE_RULES: BaseWageRule[] = [
  { effectiveFrom: "1900-01-01", amount: 2_340_000 },
  { effectiveFrom: "2026-07-01", amount: 2_530_000 },
];

const periodKey = (year?: number, month?: number) => {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
};

const pickRule = <T extends { effectiveFrom: string }>(rules: T[], key: string) =>
  rules.reduce((found, rule) => (rule.effectiveFrom <= key ? rule : found), rules[0]);

/** Tham số thuế áp dụng cho kỳ lương (mặc định: tháng hiện tại). */
export const getPitRule = (year?: number, month?: number) => pickRule(PIT_RULES, periodKey(year, month));

/** Trần lương đóng bảo hiểm của kỳ lương. */
export const getInsuranceCap = (year?: number, month?: number) => {
  const rule = pickRule(BASE_WAGE_RULES, periodKey(year, month));
  return rule.amount * (rule.capMultiplier ?? INSURANCE_CAP_MULTIPLIER);
};

/** Một dòng bảng public.payroll_parameters (company_id null = mặc định hệ thống). */
export interface PayrollParameterRow {
  company_id: string | null;
  effective_date: string;
  personal_deduction: number;
  dependent_deduction: number;
  base_wage: number;
  insurance_cap_multiplier: number;
  employee_insurance_rate: number;
  insurance_unpaid_days_exempt: number;
  pit_brackets: { up_to: number | null; rate: number }[];
  source?: string | null;
}

/**
 * Nạp tham số từ bảng payroll_parameters (cùng quy tắc chọn với hàm SQL payroll_params:
 * ngày hiệu lực mới nhất <= kỳ, cùng ngày thì ưu tiên bản ghi của công ty).
 * Thay nội dung PIT_RULES/BASE_WAGE_RULES để mọi hàm tính dùng chung tham số với máy chủ.
 */
export const applyPayrollParameters = (rows: PayrollParameterRow[]) => {
  if (!rows.length) return;
  const byDate = new Map<string, PayrollParameterRow>();
  for (const row of rows) {
    const current = byDate.get(row.effective_date);
    if (!current || (current.company_id === null && row.company_id !== null)) byDate.set(row.effective_date, row);
  }
  const sorted = [...byDate.values()].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  PIT_RULES.splice(
    0,
    PIT_RULES.length,
    ...sorted.map((row) => ({
      effectiveFrom: row.effective_date,
      personalDeduction: Number(row.personal_deduction),
      dependentDeduction: Number(row.dependent_deduction),
      brackets: row.pit_brackets.map((b) => ({
        upTo: b.up_to === null ? Number.POSITIVE_INFINITY : Number(b.up_to),
        rate: Number(b.rate),
      })),
      source: row.source ?? "",
    })),
  );
  BASE_WAGE_RULES.splice(
    0,
    BASE_WAGE_RULES.length,
    ...sorted.map((row) => ({
      effectiveFrom: row.effective_date,
      amount: Number(row.base_wage),
      capMultiplier: Number(row.insurance_cap_multiplier),
      employeeRate: Number(row.employee_insurance_rate),
      unpaidDaysExempt: Number(row.insurance_unpaid_days_exempt),
    })),
  );
};

/** Giảm trừ theo kỳ hiện tại, giữ để tương thích chỗ hiển thị cũ. */
export const PERSONAL_DEDUCTION = getPitRule().personalDeduction;
export const DEPENDENT_DEDUCTION = getPitRule().dependentDeduction;

/** Thuế TNCN lũy tiến từng phần theo biểu thuế tháng của kỳ lương (mặc định: kỳ hiện tại). */
export const computePit = (taxable: number, rule: PitRule = getPitRule()) => {
  let remaining = Math.max(taxable, 0);
  let previous = 0;
  let tax = 0;
  for (const bracket of rule.brackets) {
    const span = bracket.upTo - previous;
    const amount = Math.min(remaining, span);
    if (amount <= 0) break;
    tax += amount * bracket.rate;
    remaining -= amount;
    previous = bracket.upTo;
  }
  return Math.round(tax);
};

/** BH người lao động 10,5%: áp trần 20 lần lương cơ sở, miễn khi nghỉ không lương từ 14 ngày làm việc. */
export const computeEmployeeInsurance = (input: {
  insuranceSalary: number;
  unpaidDays: number;
  year?: number;
  month?: number;
}) => {
  const rule = pickRule(BASE_WAGE_RULES, periodKey(input.year, input.month));
  if (input.unpaidDays >= (rule.unpaidDaysExempt ?? INSURANCE_UNPAID_DAYS_EXEMPT)) return 0;
  const base = Math.min(Math.max(input.insuranceSalary, 0), getInsuranceCap(input.year, input.month));
  return Math.round(base * (rule.employeeRate ?? INSURANCE_EMPLOYEE_RATE));
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
  period?: { year: number; month: number },
) => {
  const rule = getPitRule(period?.year, period?.month);
  const otherAllowance = Math.max(Number(adjustment.other_allowance) || 0, 0);
  const otherDeduction = Math.max(Number(adjustment.other_deduction) || 0, 0);
  const gross =
    Number(item.base_salary) +
    Number(item.position_allowance) +
    Number(item.responsibility_allowance) +
    otherAllowance;
  const dependents = Math.max(Number(item.dependents_count ?? 0), 0);
  const taxable = Math.max(
    gross - Number(item.insurance_employee) - rule.personalDeduction - dependents * rule.dependentDeduction,
    0,
  );
  const tax = computePit(taxable, rule);
  const net = gross - Number(item.insurance_employee) - tax - otherDeduction;

  return {
    other_allowance: otherAllowance,
    other_deduction: otherDeduction,
    gross_salary: gross,
    taxable_income: taxable,
    tax_amount: tax,
    net_salary: net,
    /** Khấu trừ lớn hơn thu nhập: thực nhận âm, giao diện cần cảnh báo. */
    negative_net: net < 0,
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
  const pitRule = getPitRule(period.year, period.month);
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
    const insurance =
      gross > 0
        ? computeEmployeeInsurance({
            insuranceSalary,
            unpaidDays: Math.max(standardDays - paidDays, 0),
            year: period.year,
            month: period.month,
          })
        : 0;
    const dependents = Math.max(Number(employee.dependents_count ?? 0), 0);
    const taxable = Math.max(
      gross - insurance - pitRule.personalDeduction - dependents * pitRule.dependentDeduction,
      0,
    );
    const tax = computePit(taxable, pitRule);
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
