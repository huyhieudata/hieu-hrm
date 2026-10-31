import { supabase } from "@/integrations/supabase/client";

import type { EmployeeRecord } from "@/lib/employee-records";
import type { EmployeeRequest, RequestType } from "@/lib/requests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LeavePolicy {
  id: string;
  company_id: string;
  year: number;
  name: string;
  days_per_year: number;
  carry_over_max: number;
  prorate_by_hire_date: boolean;
  auto_annual_leave: boolean;
  active: boolean;
  created_at: string;
}

export interface LeavePolicyItem {
  id: string;
  company_id: string;
  policy_id: string;
  name: string;
  days: number;
  carries_over: boolean;
  sort_order: number;
}

export interface LeaveBalanceRow {
  id: string;
  company_id: string;
  employee_id: string;
  year: number;
  adjustment_days: number;
  note: string | null;
}

export interface LeavePolicyAssignment {
  id: string;
  company_id: string;
  policy_id: string;
  scope_type: string;
  scope_value: string | null;
}

export interface LeaveBalanceLog {
  id: string;
  company_id: string;
  employee_id: string;
  year: number;
  change_days: number;
  note: string | null;
  created_at: string;
}

export interface LeaveSummary {
  base: number;
  carryOver: number;
  adjustment: number;
  entitlement: number;
  used: number;
  remaining: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export const listLeavePolicyItems = async (companyId: string): Promise<LeavePolicyItem[]> => {
  const { data, error } = await db
    .from("leave_policy_items")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được các loại phép.");
  return (data ?? []) as LeavePolicyItem[];
};

export const saveLeavePolicyItems = async (
  companyId: string,
  policyId: string,
  items: { name: string; days: number; carries_over: boolean }[],
) => {
  const { error: deleteError } = await db.from("leave_policy_items").delete().eq("policy_id", policyId);
  if (deleteError) throw new Error(deleteError.message ?? "Không lưu được các loại phép.");

  if (items.length === 0) return;

  const { error } = await db.from("leave_policy_items").insert(
    items.map((item, index) => ({
      company_id: companyId,
      policy_id: policyId,
      name: item.name,
      days: item.days,
      carries_over: item.carries_over,
      sort_order: index + 1,
    })),
  );
  if (error) throw new Error(error.message ?? "Không lưu được các loại phép.");
};

export const listLeavePolicyAssignments = async (companyId: string): Promise<LeavePolicyAssignment[]> => {
  const { data, error } = await db
    .from("leave_policy_assignments")
    .select("*")
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Không tải được phạm vi áp dụng chính sách.");
  return (data ?? []) as LeavePolicyAssignment[];
};

export const saveLeavePolicyAssignments = async (
  companyId: string,
  policyId: string,
  assignments: { scope_type: string; scope_value: string | null }[],
) => {
  const { error: deleteError } = await db
    .from("leave_policy_assignments")
    .delete()
    .eq("policy_id", policyId);
  if (deleteError) throw new Error(deleteError.message ?? "Không lưu được phạm vi áp dụng.");

  if (assignments.length === 0) {
    const { error } = await db
      .from("leave_policy_assignments")
      .insert({ company_id: companyId, policy_id: policyId, scope_type: "company" });
    if (error) throw new Error(error.message ?? "Không lưu được phạm vi áp dụng.");
    return;
  }

  const { error } = await db.from("leave_policy_assignments").insert(
    assignments.map((assignment) => ({
      company_id: companyId,
      policy_id: policyId,
      scope_type: assignment.scope_type,
      scope_value: assignment.scope_value,
    })),
  );
  if (error) throw new Error(error.message ?? "Không lưu được phạm vi áp dụng.");
};

export const employeeInLeaveAssignments = (
  employee: Pick<EmployeeRecord, "id" | "department" | "position">,
  assignments: LeavePolicyAssignment[],
) =>
  assignments.some((assignment) => {
    if (assignment.scope_type === "company") return true;
    if (assignment.scope_type === "department") return assignment.scope_value === employee.department;
    if (assignment.scope_type === "position") return assignment.scope_value === employee.position;
    if (assignment.scope_type === "employee") return assignment.scope_value === employee.id;
    return false;
  });

export const listLeaveBalanceLogs = async (companyId: string, year: number): Promise<LeaveBalanceLog[]> => {
  const { data, error } = await db
    .from("leave_balance_logs")
    .select("id, company_id, employee_id, year, change_days, note, created_at")
    .eq("company_id", companyId)
    .eq("year", year)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được lịch sử thay đổi phép.");
  return (data ?? []) as LeaveBalanceLog[];
};

export const logLeaveBalanceChange = async (input: {
  company_id: string;
  employee_id: string;
  year: number;
  change_days: number;
  note: string | null;
  created_by: string | null;
}) => {
  const { error } = await db.from("leave_balance_logs").insert(input);
  if (error) throw new Error(error.message ?? "Không ghi được lịch sử thay đổi phép.");
};

export const listLeavePolicies = async (companyId: string): Promise<LeavePolicy[]> => {
  const { data, error } = await db
    .from("leave_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("year", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được chính sách phép.");
  return (data ?? []) as LeavePolicy[];
};

export const createLeavePolicy = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("leave_policies").insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được chính sách phép.");
  return data.id as string;
};

export const updateLeavePolicy = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("leave_policies").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được chính sách phép.");
};

export const deleteLeavePolicy = async (id: string) => {
  const { error } = await db.from("leave_policies").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được chính sách phép.");
};

export const listLeaveBalances = async (companyId: string, year: number): Promise<LeaveBalanceRow[]> => {
  const { data, error } = await db
    .from("employee_leave_balances")
    .select("*")
    .eq("company_id", companyId)
    .eq("year", year);
  if (error) throw new Error(error.message ?? "Không tải được số dư phép.");
  return (data ?? []) as LeaveBalanceRow[];
};

export const saveLeaveBalance = async (values: {
  company_id: string;
  employee_id: string;
  year: number;
  adjustment_days: number;
  note: string | null;
}) => {
  const { error } = await db
    .from("employee_leave_balances")
    .upsert(values, { onConflict: "employee_id,year" });
  if (error) throw new Error(error.message ?? "Không lưu được số dư phép.");
};

export const usedLeaveDaysFor = (
  requests: EmployeeRequest[],
  types: RequestType[],
  employeeId: string,
  year: number,
) => {
  const deductTypeIds = new Set(types.filter((type) => type.deduct_leave).map((type) => type.id));
  return round1(
    requests
      .filter(
        (request) =>
          request.employee_id === employeeId &&
          request.status === "approved" &&
          deductTypeIds.has(request.request_type_id) &&
          request.start_date.slice(0, 4) === String(year),
      )
      .reduce((total, request) => total + Number(request.leave_days ?? 0), 0),
  );
};

export const proratedItemDays = (
  employee: EmployeeRecord,
  policy: LeavePolicy,
  days: number,
  year: number,
) => proratedTotal(employee, policy, year, Number(days));

const proratedTotal = (employee: EmployeeRecord, policy: LeavePolicy, year: number, total: number) => {
  if (!policy.prorate_by_hire_date || !employee.hire_date) return total;
  const hireYear = Number(employee.hire_date.slice(0, 4));
  if (hireYear < year) return total;
  if (hireYear > year) return 0;
  const hireMonth = Number(employee.hire_date.slice(5, 7));
  const months = Math.max(0, 12 - hireMonth + 1);
  return round1((total * months) / 12);
};

export const isAnnualLeaveItem = (name: string) => /phép\s*năm|phep\s*nam/i.test(name);

export interface ContractLike {
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
}

/** Mỗi tháng làm việc theo HĐ xác định thời hạn / không xác định thời hạn = 1 ngày phép. */
export const autoAnnualLeaveDays = (
  employee: Pick<EmployeeRecord, "hire_date" | "resignation_date">,
  contracts: ContractLike[],
  year: number,
) => {
  let months = 0;
  for (let month = 0; month < 12; month += 1) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    if (employee.hire_date && new Date(`${employee.hire_date}T00:00:00`) > monthEnd) continue;
    if (employee.resignation_date && new Date(`${employee.resignation_date}T00:00:00`) < monthStart) continue;

    const covered = contracts.some(
      (contract) =>
        (contract.contract_type === "fixed_term" || contract.contract_type === "indefinite") &&
        (!contract.start_date || new Date(`${contract.start_date}T00:00:00`) <= monthEnd) &&
        (!contract.end_date || new Date(`${contract.end_date}T00:00:00`) >= monthStart),
    );
    if (covered) months += 1;
  }
  return months;
};

const policyTotal = (policy: LeavePolicy | null, items: LeavePolicyItem[], excludeAnnual = false) => {
  if (!policy) return 0;
  const own = items.filter(
    (item) => item.policy_id === policy.id && !(excludeAnnual && isAnnualLeaveItem(item.name)),
  );
  if (own.length === 0) return excludeAnnual ? 0 : Number(policy.days_per_year);
  return round1(own.reduce((total, item) => total + Number(item.days), 0));
};

export const summarizeLeave = (options: {
  employee: EmployeeRecord;
  year: number;
  policies: LeavePolicy[];
  items: LeavePolicyItem[];
  balances: LeaveBalanceRow[];
  requests: EmployeeRequest[];
  types: RequestType[];
  contracts?: ContractLike[];
}): LeaveSummary => {
  const { employee, year, policies, items, balances, requests, types } = options;
  const contracts = options.contracts ?? [];
  const policy = policies.find((item) => item.year === year) ?? null;
  const auto = policy?.auto_annual_leave ?? false;
  const autoDays = auto ? autoAnnualLeaveDays(employee, contracts, year) : 0;
  const base = policy
    ? round1(proratedTotal(employee, policy, year, policyTotal(policy, items, auto)) + autoDays)
    : 0;

  let carryOver = 0;
  const previousPolicy = policies.find((item) => item.year === year - 1) ?? null;
  if (policy && previousPolicy) {
    const previousAuto = previousPolicy.auto_annual_leave;
    const previousBase = round1(
      proratedTotal(employee, previousPolicy, year - 1, policyTotal(previousPolicy, items, previousAuto)) +
        (previousAuto ? autoAnnualLeaveDays(employee, contracts, year - 1) : 0),
    );
    const previousUsed = usedLeaveDaysFor(requests, types, employee.id, year - 1);
    carryOver = Math.min(
      Math.max(round1(previousBase - previousUsed), 0),
      Number(policy.carry_over_max ?? 0),
    );
  }

  const adjustment = Number(
    balances.find((row) => row.employee_id === employee.id && row.year === year)?.adjustment_days ?? 0,
  );
  const used = usedLeaveDaysFor(requests, types, employee.id, year);
  const entitlement = round1(base + carryOver + adjustment);

  return {
    base,
    carryOver,
    adjustment,
    entitlement,
    used,
    remaining: round1(entitlement - used),
  };
};
