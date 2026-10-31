import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CompanyAsset {
  id: string;
  company_id: string;
  employee_id: string;
  asset_code: string | null;
  name: string;
  category: string;
  serial_number: string | null;
  assigned_date: string;
  return_date: string | null;
  value: number | null;
  condition: string;
  status: string;
  note: string | null;
  created_at: string;
  employee_name: string | null;
  employee_code: string | null;
  department: string | null;
}

type Row = Omit<CompanyAsset, "employee_name" | "employee_code" | "department"> & {
  employees?: { full_name: string | null; code: string | null; department: string | null } | null;
};

export const listCompanyAssets = async (companyId: string): Promise<CompanyAsset[]> => {
  const { data, error } = await db
    .from("employee_assets")
    .select(
      "id, company_id, employee_id, asset_code, name, category, serial_number, assigned_date, return_date, value, condition, status, note, created_at, employees(full_name, code, department)",
    )
    .eq("company_id", companyId)
    .order("assigned_date", { ascending: false });

  if (error) throw new Error(error.message ?? "Không tải được danh sách tài sản.");

  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    employee_name: row.employees?.full_name ?? null,
    employee_code: row.employees?.code ?? null,
    department: row.employees?.department ?? null,
  }));
};

export const createAsset = async (values: Record<string, unknown>) => {
  const { error } = await db.from("employee_assets").insert(values);
  if (error) throw new Error(error.message ?? "Không tạo được tài sản.");
};

export const updateAsset = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("employee_assets").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được tài sản.");
};

export const deleteAsset = async (id: string) => {
  const { error } = await db.from("employee_assets").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được tài sản.");
};
