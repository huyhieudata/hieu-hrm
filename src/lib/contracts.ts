import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CompanyContract {
  id: string;
  company_id: string;
  employee_id: string;
  contract_no: string | null;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  position: string | null;
  department: string | null;
  base_salary: number | null;
  allowance: number | null;
  insurance_salary: number | null;
  status: string;
  note: string | null;
  contract_file_path: string | null;
  contract_file_name: string | null;
  created_at: string;
  employee_name: string | null;
  employee_code: string | null;
  employee_department: string | null;
}

type Row = Omit<CompanyContract, "employee_name" | "employee_code" | "employee_department"> & {
  employees?: { full_name: string | null; code: string | null; department: string | null } | null;
};

export const listCompanyContracts = async (companyId: string): Promise<CompanyContract[]> => {
  const { data, error } = await db
    .from("employee_contracts")
    .select(
      "id, company_id, employee_id, contract_no, contract_type, start_date, end_date, position, department, base_salary, allowance, insurance_salary, status, note, contract_file_path, contract_file_name, created_at, employees(full_name, code, department)",
    )
    .eq("company_id", companyId)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message ?? "Không tải được danh sách hợp đồng.");

  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    employee_name: row.employees?.full_name ?? null,
    employee_code: row.employees?.code ?? null,
    employee_department: row.employees?.department ?? null,
  }));
};

export const createContract = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("employee_contracts").insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được hợp đồng.");
  return data.id as string;
};

/** Tạo/cập nhật bản ghi lương tương ứng với hợp đồng (một chiều: HĐ → lương). */
export const syncSalaryFromContract = async (contractId: string) => {
  const { data: contract, error } = await db
    .from("employee_contracts")
    .select("id, company_id, employee_id, contract_no, start_date, base_salary, allowance, insurance_salary")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Không đồng bộ được dữ liệu lương.");
  if (!contract) return;

  const effectiveDate = contract.start_date ?? new Date().toISOString().slice(0, 10);
  const values = {
    base_salary: Number(contract.base_salary ?? 0),
    other_allowance: Number(contract.allowance ?? 0),
    insurance_salary: Number(contract.insurance_salary ?? 0),
    effective_date: effectiveDate,
    decision_no: contract.contract_no,
    note: contract.contract_no ? `Tạo từ hợp đồng ${contract.contract_no}` : "Tạo từ hợp đồng lao động",
  };

  const { data: linked } = await db
    .from("employee_salary_records")
    .select("id")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (linked?.id) {
    const { error: updateError } = await db
      .from("employee_salary_records")
      .update({ ...values, contract_id: contractId })
      .eq("id", linked.id);
    if (updateError) throw new Error(updateError.message ?? "Không đồng bộ được dữ liệu lương.");
    return;
  }

  const { data: sameDate } = await db
    .from("employee_salary_records")
    .select("id")
    .eq("employee_id", contract.employee_id)
    .eq("effective_date", effectiveDate)
    .is("contract_id", null)
    .limit(1)
    .maybeSingle();

  if (sameDate?.id) {
    const { error: updateError } = await db
      .from("employee_salary_records")
      .update({ ...values, contract_id: contractId })
      .eq("id", sameDate.id);
    if (updateError) throw new Error(updateError.message ?? "Không đồng bộ được dữ liệu lương.");
    return;
  }

  const { error: insertError } = await db.from("employee_salary_records").insert({
    ...values,
    company_id: contract.company_id,
    employee_id: contract.employee_id,
    contract_id: contractId,
  });
  if (insertError) throw new Error(insertError.message ?? "Không đồng bộ được dữ liệu lương.");
};

export const updateContract = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("employee_contracts").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được hợp đồng.");
};

export const deleteContract = async (id: string) => {
  const { error } = await db.from("employee_contracts").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được hợp đồng.");
};

export const contractDaysLeft = (contract: Pick<CompanyContract, "end_date" | "status">) => {
  if (!contract.end_date) return null;
  const end = new Date(`${contract.end_date}T00:00:00`).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  return Math.ceil((end - today) / 86400000);
};
