import { computePit, getPitRule, applyPayrollAdjustment, computeEmployeeInsurance, getInsuranceCap } from "../src/lib/payroll-calc.ts";
const eq = (a: number, b: number, m: string) => { if (a !== b) { console.error("FAIL", m, a, b); process.exit(1); } console.log("ok", m, a); };
const old = getPitRule(2025, 12), neu = getPitRule(2026, 1);
eq(old.personalDeduction, 11_000_000, "2025 giảm trừ");
eq(neu.personalDeduction, 15_500_000, "2026 giảm trừ");
eq(neu.dependentDeduction, 6_200_000, "2026 NPT");
eq(computePit(10_000_000, old), 750_000, "biểu cũ 10tr");
eq(computePit(10_000_000, neu), 500_000, "biểu mới 10tr");
eq(computePit(30_000_000, neu), 2_500_000, "biểu mới 30tr");
eq(computePit(60_000_000, neu), 8_500_000, "biểu mới 60tr");
eq(computePit(100_000_000, neu), 20_500_000, "biểu mới 100tr");
eq(getInsuranceCap(2026, 6), 46_800_000, "trần BH 6/2026");
eq(getInsuranceCap(2026, 7), 50_600_000, "trần BH 7/2026");
eq(computeEmployeeInsurance({ insuranceSalary: 100_000_000, unpaidDays: 0, year: 2026, month: 7 }), 5_313_000, "BH có trần");
eq(computeEmployeeInsurance({ insuranceSalary: 10_000_000, unpaidDays: 14, year: 2026, month: 7 }), 0, "nghỉ 14 ngày");
const adj = applyPayrollAdjustment({ base_salary: 5_000_000, position_allowance: 0, responsibility_allowance: 0, other_allowance: 0, insurance_employee: 525_000, dependents_count: 0 }, { other_allowance: 0, other_deduction: 6_000_000, note: null }, { year: 2026, month: 1 });
eq(Number(adj.negative_net), 1, "cảnh báo thực nhận âm");

// Tham số nạp từ bảng payroll_parameters thay thế hằng số mặc định.
{
  const { applyPayrollParameters, getPitRule: rule, getInsuranceCap: cap, computeEmployeeInsurance: ins } = await import("../src/lib/payroll-calc.ts");
  applyPayrollParameters([
    { company_id: null, effective_date: "1900-01-01", personal_deduction: 11e6, dependent_deduction: 4.4e6, base_wage: 2.34e6, insurance_cap_multiplier: 20, employee_insurance_rate: 0.105, insurance_unpaid_days_exempt: 14, pit_brackets: [{ up_to: null, rate: 0.05 }] },
    { company_id: null, effective_date: "2027-01-01", personal_deduction: 1, dependent_deduction: 1, base_wage: 1, insurance_cap_multiplier: 1, employee_insurance_rate: 0.1, insurance_unpaid_days_exempt: 14, pit_brackets: [{ up_to: null, rate: 0.05 }] },
    { company_id: "c", effective_date: "2027-01-01", personal_deduction: 20e6, dependent_deduction: 8e6, base_wage: 3e6, insurance_cap_multiplier: 20, employee_insurance_rate: 0.1, insurance_unpaid_days_exempt: 10, pit_brackets: [{ up_to: 1e6, rate: 0.1 }, { up_to: null, rate: 0.2 }] },
  ]);
  const r = rule(2027, 2);
  if (r.personalDeduction !== 20e6 || r.brackets.length !== 2 || r.brackets[1].upTo !== Infinity) throw new Error("FAIL applyPayrollParameters rule");
  if (cap(2027, 2) !== 60e6) throw new Error("FAIL applyPayrollParameters cap");
  if (ins({ insuranceSalary: 100e6, unpaidDays: 0, year: 2027, month: 2 }) !== 6e6) throw new Error("FAIL applyPayrollParameters rate");
  if (ins({ insuranceSalary: 10e6, unpaidDays: 10, year: 2027, month: 2 }) !== 0) throw new Error("FAIL applyPayrollParameters exempt");
  console.log("ok applyPayrollParameters");
}

// Tăng ca: lương 26tr, 26 công -> lương giờ 125.000; 2h ngày thường + 1h lễ.
{
  const { computeOvertimePay } = await import("../src/lib/payroll-calc.ts");
  const ot = computeOvertimePay(26_000_000, 26, [{ hours: 2, kind: "weekday" }, { hours: 1, kind: "holiday" }]);
  eq(ot.hours, 3, "OT giờ");
  eq(ot.pay, 750_000, "OT tiền (2×1.5 + 1×3)×125k");
  eq(ot.taxable, 375_000, "OT chịu thuế (100%)");
  const w = computeOvertimePay(26_000_000, 26, [{ hours: 4, kind: "weekend" }]);
  eq(w.pay, 1_000_000, "OT cuối tuần 200%");
}
