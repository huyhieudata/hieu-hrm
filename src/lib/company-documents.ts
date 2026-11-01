import { documentFileProblem } from "@/lib/employee-records";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const BUCKET = "company-docs";

export interface CompanyDocument {
  id: string;
  company_id: string;
  title: string;
  category: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export const listDocuments = async (companyId: string) => {
  const { data, error } = await db.from("company_documents").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyDocument[];
};

const safeName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);

export const uploadDocument = async (companyId: string, file: File, meta: { title: string; category: string; description?: string }) => {
  const problem = documentFileProblem(file);
  if (problem) throw new Error(problem);
  if (file.size > 20 * 1024 * 1024) throw new Error("Tệp tối đa 20MB.");
  const path = `${companyId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) throw new Error(upErr.message);
  const { error } = await db.from("company_documents").insert({
    company_id: companyId, title: meta.title, category: meta.category || "Chung", description: meta.description || null,
    storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
};

/** Link ký hạn 5 phút (bucket private). */
export const documentUrl = async (doc: CompanyDocument, download = false) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300, download ? { download: doc.file_name } : undefined);
  if (error || !data) throw new Error(error?.message ?? "Không tạo được link.");
  return data.signedUrl;
};

export const deleteDocument = async (doc: CompanyDocument) => {
  const { error } = await db.from("company_documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
};
