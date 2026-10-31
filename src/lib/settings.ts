import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface DepartmentRecord {
  id: string;
  company_id: string;
  name: string;
  manager_employee_id: string | null;
  manager_name: string | null;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface OnboardingTemplate {
  id: string;
  company_id: string;
  label: string;
  description: string | null;
  required: boolean;
  sort_order: number;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
}

export const ONBOARDING_FORM_BUCKET = "onboarding-forms";
const ONBOARDING_FORM_MAX_BYTES = 15 * 1024 * 1024;

export const uploadOnboardingForm = async (
  companyId: string,
  file: File,
): Promise<{ path: string; name: string }> => {
  if (file.size > ONBOARDING_FORM_MAX_BYTES) {
    throw new Error("Tệp vượt quá 15MB. Vui lòng chọn tệp nhỏ hơn.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${companyId}/templates/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(ONBOARDING_FORM_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name };
};

export const getOnboardingFormUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from(ONBOARDING_FORM_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

export const removeOnboardingForm = async (path: string) => {
  await supabase.storage.from(ONBOARDING_FORM_BUCKET).remove([path]);
};

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export interface DocumentChecklistTemplate {
  id: string;
  company_id: string;
  label: string;
  category: string;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export const listDocumentChecklist = async (companyId: string): Promise<DocumentChecklistTemplate[]> => {
  const { data, error } = await db
    .from("document_checklist_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentChecklistTemplate[];
};

type SettingsTable =
  | "departments"
  | "onboarding_checklist_templates"
  | "department_positions"
  | "document_checklist_templates";

export interface DepartmentPosition {
  id: string;
  company_id: string;
  department_id: string;
  title: string;
  level: string | null;
  description: string | null;
  is_management: boolean;
  sort_order: number;
  created_at: string;
}

export const listDepartmentPositions = async (companyId: string): Promise<DepartmentPosition[]> => {
  const { data, error } = await db
    .from("department_positions")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DepartmentPosition[];
};

export const listDepartments = async (companyId: string): Promise<DepartmentRecord[]> => {
  const { data, error } = await db
    .from("departments")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DepartmentRecord[];
};

export const listOnboardingTemplates = async (companyId: string): Promise<OnboardingTemplate[]> => {
  const { data, error } = await db
    .from("onboarding_checklist_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OnboardingTemplate[];
};

export const createSetting = async (table: SettingsTable, values: Record<string, unknown>) => {
  const { data, error } = await db.from(table).insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được bản ghi.");
  return data.id as string;
};

export const updateSetting = async (table: SettingsTable, id: string, values: Record<string, unknown>) => {
  const { error } = await db.from(table).update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được bản ghi.");
};

export const deleteSetting = async (table: SettingsTable, id: string) => {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được bản ghi.");
};
