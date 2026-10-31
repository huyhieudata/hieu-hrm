import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

export interface HeadcountPlan {
  id: string;
  company_id: string;
  year: number;
  note: string | null;
  created_at: string;
}

export type MonthValues = [number, number, number, number, number, number, number, number, number, number, number, number];

export interface HeadcountItem {
  id: string;
  plan_id: string;
  company_id: string;
  department_id: string;
  position_id: string | null;
  position_title: string | null;
  months: MonthValues;
}

const MONTH_COLUMNS = [
  "month_1",
  "month_2",
  "month_3",
  "month_4",
  "month_5",
  "month_6",
  "month_7",
  "month_8",
  "month_9",
  "month_10",
  "month_11",
  "month_12",
] as const;

const toMonths = (row: Record<string, unknown>): MonthValues =>
  MONTH_COLUMNS.map((column) => Number(row[column] ?? 0)) as MonthValues;

export const listPlans = async (companyId: string): Promise<HeadcountPlan[]> => {
  const { data, error } = await db
    .from("headcount_plans")
    .select("*")
    .eq("company_id", companyId)
    .order("year", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được kế hoạch định biên.");
  return (data ?? []) as HeadcountPlan[];
};

export const createPlan = async (values: { company_id: string; year: number; note?: string | null }) => {
  const { data, error } = await db.from("headcount_plans").insert(values).select("id").single();
  if (error) {
    if (error.code === "23505" || String(error.message).includes("duplicate key")) {
      throw new Error(`Năm ${values.year} đã có bản ghi định biên. Mỗi năm chỉ tạo một bản ghi.`);
    }
    throw new Error(error.message ?? "Không tạo được bản ghi định biên.");
  }
  return data.id as string;
};

export const updatePlan = async (id: string, values: { year?: number; note?: string | null }) => {
  const { error } = await db.from("headcount_plans").update(values).eq("id", id);
  if (error) {
    if (error.code === "23505" || String(error.message).includes("duplicate key")) {
      throw new Error(`Năm ${values.year} đã có bản ghi định biên khác.`);
    }
    throw new Error(error.message ?? "Không cập nhật được bản ghi định biên.");
  }
};

export const deletePlan = async (id: string) => {
  const { error } = await db.from("headcount_plans").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được bản ghi định biên.");
};

export const listItems = async (planId: string): Promise<HeadcountItem[]> => {
  const { data, error } = await db.from("headcount_items").select("*").eq("plan_id", planId);
  if (error) throw new Error(error.message ?? "Không tải được dữ liệu định biên.");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    plan_id: String(row.plan_id),
    company_id: String(row.company_id),
    department_id: String(row.department_id),
    position_id: (row.position_id as string | null) ?? null,
    position_title: (row.position_title as string | null) ?? null,
    months: toMonths(row),
  }));
};

export const createItem = async (input: {
  plan_id: string;
  company_id: string;
  department_id: string;
  position_id: string | null;
  position_title: string | null;
  months: MonthValues;
}): Promise<string> => {
  const payload: Record<string, unknown> = {
    plan_id: input.plan_id,
    company_id: input.company_id,
    department_id: input.department_id,
    position_id: input.position_id,
    position_title: input.position_title,
  };
  MONTH_COLUMNS.forEach((column, index) => {
    payload[column] = input.months[index] ?? 0;
  });

  const { data, error } = await db.from("headcount_items").insert(payload).select("id").single();
  if (error) throw new Error(error.message ?? "Không lưu được định biên.");
  return data.id as string;
};

export const updateItemMonths = async (id: string, months: MonthValues) => {
  const payload: Record<string, unknown> = {};
  MONTH_COLUMNS.forEach((column, index) => {
    payload[column] = months[index] ?? 0;
  });
  const { error } = await db.from("headcount_items").update(payload).eq("id", id);
  if (error) throw new Error(error.message ?? "Không lưu được định biên.");
};

export const deleteItem = async (id: string) => {
  const { error } = await db.from("headcount_items").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được dòng định biên.");
};

export const sumMonths = (months: MonthValues) => months.reduce((total, value) => total + Number(value ?? 0), 0);
