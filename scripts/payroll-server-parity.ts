/**
 * Sinh kịch bản SQL kiểm tra công thức lương phía server (migration 20261101040500) khớp với
 * src/lib/payroll-calc.ts. Chỉ chạy trong transaction rồi ROLLBACK, ví dụ:
 *   pnpm -s test:payroll:sql > /tmp/t.sql   # nội dung đã có sẵn begin; ... rollback;
 * Mọi khẳng định sai sẽ raise exception, chạy hết là đạt.
 */
import {
  applyPayrollAdjustment,
  calculatePayroll,
  computeEmployeeInsurance,
  computePit,
  getInsuranceCap,
  getPitRule,
  type PayrollEmployeeInput,
  type PayrollSalaryInput,
  type PayrollAttendanceInput,
} from "../src/lib/payroll-calc.ts";

const C = "00000000-0000-4000-8000-0000000c0001";
const P26 = "00000000-0000-4000-8000-0000000a0726";
const P25 = "00000000-0000-4000-8000-0000000a1225";
const E = ["e1", "e2", "e3"].map((_, i) => `00000000-0000-4000-8000-00000000e00${i + 1}`);

const employees: PayrollEmployeeInput[] = [
  { id: E[0], full_name: "TEST Lương 1", code: "ZZT1", department: null, hire_date: "2024-01-01", resignation_date: null, dependents_count: 1 },
  { id: E[1], full_name: "TEST Lương 2", code: "ZZT2", department: null, hire_date: "2024-01-01", resignation_date: null, dependents_count: 0 },
  { id: E[2], full_name: "TEST Lương 3", code: "ZZT3", department: null, hire_date: "2026-07-16", resignation_date: null, dependents_count: 2 },
];
const salaries: PayrollSalaryInput[] = [
  { employee_id: E[0], effective_date: "2025-01-01", base_salary: 40_000_000, position_allowance: 3_000_000, responsibility_allowance: 1_500_000, other_allowance: 730_000, insurance_salary: 100_000_000 },
  { employee_id: E[1], effective_date: "2025-01-01", base_salary: 12_345_678, position_allowance: 0, responsibility_allowance: 0, other_allowance: 0, insurance_salary: 8_000_000 },
  { employee_id: E[2], effective_date: "2026-07-16", base_salary: 15_000_000, position_allowance: 1_000_000, responsibility_allowance: 0, other_allowance: 0, insurance_salary: null },
];
const attendance: PayrollAttendanceInput[] = Array.from({ length: 19 }, (_, i) => ({
  employee_id: E[0],
  work_date: `2026-07-${String(i + 1).padStart(2, "0")}`,
  check_in: "08:00",
  check_out: "17:00",
  shift_id: null,
}));

const q = (v: unknown) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const cols = ["company_id", "period_id", "employee_id", "employee_name", "employee_code", "department", "work_days", "attendance_days", "leave_days", "base_salary", "position_allowance", "responsibility_allowance", "other_allowance", "gross_salary", "insurance_salary", "insurance_employee", "taxable_income", "tax_amount", "other_deduction", "net_salary", "dependents_count"] as const;
const insertItem = (item: Record<string, unknown>) =>
  `insert into public.payroll_items (${cols.join(", ")}) values (${cols.map((c) => q(item[c])).join(", ")});`;
const expectFail = (label: string, sql: string) => `do $t$ begin
  begin ${sql} exception when others then raise notice 'ok (bị chặn đúng): % -> %', ${q(label)}, sqlerrm; return; end;
  raise exception 'FAIL: % không bị chặn', ${q(label)};
end $t$;`;
const expectEq = (label: string, sqlExpr: string, value: number) =>
  `do $t$ begin if (${sqlExpr}) is distinct from ${value}::numeric then raise exception 'FAIL % : % <> %', ${q(label)}, (${sqlExpr}), ${value}; end if; end $t$;`;

const out: string[] = ["begin;"];

// 1) Hàm thuần khớp TS.
const r25 = getPitRule(2025, 12), r26 = getPitRule(2026, 1);
out.push(expectEq("giảm trừ 2025", "public.payroll_personal_deduction('2025-12-01')", r25.personalDeduction));
out.push(expectEq("giảm trừ 2026", "public.payroll_personal_deduction('2026-01-01')", r26.personalDeduction));
out.push(expectEq("NPT 2025", "public.payroll_dependent_deduction('2025-12-01')", r25.dependentDeduction));
out.push(expectEq("NPT 2026", "public.payroll_dependent_deduction('2026-01-01')", r26.dependentDeduction));
for (const t of [0, 1, 4_999_999, 5_000_000, 10_000_000, 18_000_001, 30_000_000, 45_678_901, 60_000_000, 80_000_000, 100_000_000, 250_000_000]) {
  out.push(expectEq(`PIT 2025 ${t}`, `public.payroll_compute_pit(${t}, '2025-12-01')`, computePit(t, r25)));
  out.push(expectEq(`PIT 2026 ${t}`, `public.payroll_compute_pit(${t}, '2026-01-01')`, computePit(t, r26)));
}
out.push(expectEq("trần BH 6/2026", "public.payroll_insurance_cap('2026-06-01')", getInsuranceCap(2026, 6)));
out.push(expectEq("trần BH 7/2026", "public.payroll_insurance_cap('2026-07-01')", getInsuranceCap(2026, 7)));
for (const [sal, unpaid, y, m] of [[100_000_000, 0, 2026, 7], [100_000_000, 0, 2026, 6], [10_000_000, 13.99, 2026, 7], [10_000_000, 14, 2026, 7], [7_777_777, 2, 2025, 12]]) {
  out.push(expectEq(`BH ${sal}/${unpaid}/${m}`, `public.payroll_employee_insurance(${sal}, ${unpaid}, make_date(${y}, ${m}, 1))`, computeEmployeeInsurance({ insuranceSalary: sal, unpaidDays: unpaid, year: y, month: m })));
}

// 2) Dữ liệu giả (chỉ tồn tại trong transaction).
out.push(`insert into public.companies (id, name) values (${q(C)}, 'ZZ TEST lương server');`);
employees.forEach((e) => out.push(`insert into public.employees (id, company_id, code, full_name, hire_date, dependents_count) values (${q(e.id)}, ${q(C)}, ${q(e.code)}, ${q(e.full_name)}, ${q(e.hire_date)}, ${e.dependents_count});`));
salaries.forEach((s) => out.push(`insert into public.employee_salary_records (company_id, employee_id, effective_date, base_salary, position_allowance, responsibility_allowance, other_allowance, insurance_salary) values (${q(C)}, ${q(s.employee_id)}, ${q(s.effective_date)}, ${s.base_salary}, ${s.position_allowance}, ${s.responsibility_allowance}, ${s.other_allowance}, ${q(s.insurance_salary)});`));
out.push(`insert into public.payroll_periods (id, company_id, year, month, standard_work_days) values (${q(P26)}, ${q(C)}, 2026, 7, 26), (${q(P25)}, ${q(C)}, 2025, 12, 24);`);

// 3) Bảng lương do client (payroll-calc.ts) tính phải được server chấp nhận.
const p26 = calculatePayroll({ companyId: C, period: { id: P26, year: 2026, month: 7, standard_work_days: 26 }, employees, salaries, attendance, shifts: [], leaves: [] });
const p25 = calculatePayroll({ companyId: C, period: { id: P25, year: 2025, month: 12, standard_work_days: 24 }, employees: employees.slice(0, 2), salaries, attendance: [], shifts: [], leaves: [] });
if (p26.items.length !== 3 || p25.items.length !== 2) throw new Error("fixture sai");
[...p26.items, ...p25.items].forEach((item) => out.push(insertItem(item as unknown as Record<string, unknown>)));
out.push(expectEq("đã chèn 5 phiếu", `(select count(*) from public.payroll_items where company_id = ${q(C)})`, 5));

// 4) Điều chỉnh hợp lệ (applyPayrollAdjustment) được chấp nhận.
const it1 = p26.items[0];
const adj = applyPayrollAdjustment(it1, { other_allowance: 2_000_000, other_deduction: 500_000, note: "test" }, { year: 2026, month: 7 });
out.push(`update public.payroll_items set other_allowance = ${adj.other_allowance}, other_deduction = ${adj.other_deduction}, gross_salary = ${adj.gross_salary}, taxable_income = ${adj.taxable_income}, tax_amount = ${adj.tax_amount}, net_salary = ${adj.net_salary} where period_id = ${q(P26)} and employee_id = ${q(E[0])};`);
out.push(expectEq("điều chỉnh đã lưu", `(select net_salary from public.payroll_items where period_id = ${q(P26)} and employee_id = ${q(E[0])})`, adj.net_salary));

// 5) Số liệu tự ý phải bị chặn.
const where1 = `where period_id = ${q(P26)} and employee_id = ${q(E[0])}`;
const where2 = `where period_id = ${q(P26)} and employee_id = ${q(E[1])}`;
out.push(expectFail("hạ thuế", `update public.payroll_items set tax_amount = tax_amount - 100000, net_salary = net_salary + 100000 ${where1};`));
out.push(expectFail("hạ thu nhập tính thuế", `update public.payroll_items set taxable_income = taxable_income - 1000000 ${where1};`));
out.push(expectFail("tăng lương cơ bản", `update public.payroll_items set base_salary = base_salary + 1000000, gross_salary = gross_salary + 1000000, net_salary = net_salary + 1000000 ${where1};`));
out.push(expectFail("bỏ BH", `update public.payroll_items set insurance_employee = 0, net_salary = net_salary + insurance_employee ${where1};`));
out.push(expectFail("thêm người phụ thuộc", `update public.payroll_items set dependents_count = 3 ${where1};`));
out.push(expectFail("công vượt công chuẩn", `update public.payroll_items set work_days = 27 ${where1};`));
const fake = { ...p26.items[1], employee_id: E[1], dependents_count: 2 };
out.push(`delete from public.payroll_items ${where2};`);
out.push(expectFail("chèn phiếu khai sai NPT", insertItem(fake as unknown as Record<string, unknown>)));

out.push("rollback;");
console.log(out.join("\n"));
