import { supabase } from "@/integrations/supabase/client";
import { readXlsxFirstSheet } from "@/lib/xlsx-reader";

export type AccountRowInput = { key: string; employee_id?: string; email?: string; full_name?: string; role?: string; group_id?: string | null };
export type AccountResult = {
  key: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  result: "created" | "exists" | "linked" | "reset" | "error";
  message: string;
  mail_status?: string;
  /** Chỉ có khi gửi email thất bại — dùng để tải CSV một lần rồi xoá khỏi bộ nhớ. */
  temporary_password?: string;
};

export const ACCOUNT_RESULT_META: Record<AccountResult["result"], { label: string; tone: "success" | "muted" | "info" | "destructive" }> = {
  created: { label: "Đã tạo", tone: "success" },
  reset: { label: "Đã đặt lại", tone: "success" },
  linked: { label: "Đã có tài khoản – đã gắn", tone: "info" },
  exists: { label: "Đã có tài khoản", tone: "muted" },
  error: { label: "Lỗi", tone: "destructive" },
};

export const MAX_ACCOUNT_ROWS = 200;

const invoke = async (body: Record<string, unknown>): Promise<AccountResult[]> => {
  const { data, error } = await supabase.functions.invoke("create-employee-accounts", { body });
  if (error) {
    // Lấy thông báo tiếng Việt từ máy chủ nếu có.
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return (data?.results ?? []) as AccountResult[];
};

export const createEmployeeAccounts = (companyId: string, rows: AccountRowInput[]) =>
  invoke({ company_id: companyId, action: "create", rows });

export const resetEmployeePassword = (companyId: string, employeeId: string) =>
  invoke({ company_id: companyId, action: "reset", employee_id: employeeId });

const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Tải CSV tên đăng nhập + mật khẩu tạm (chỉ các dòng gửi mail lỗi). Không gửi lên máy chủ. */
export const downloadCredentialsCsv = (rows: AccountResult[]) => {
  const lines = [["Họ tên", "Tên đăng nhập", "Mật khẩu tạm", "Link đăng nhập"].join(",")];
  for (const r of rows) {
    if (!r.temporary_password) continue;
    lines.push([r.full_name, r.email, r.temporary_password, `${window.location.origin}/login`].map(csvCell).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tai-khoan-tam-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const parseCsvText = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

/** Đọc tệp .xlsx/.csv có cột Email và Họ tên (dòng đầu là tiêu đề). */
export const readAccountFile = async (file: File): Promise<AccountRowInput[]> => {
  const table = /\.xlsx$/i.test(file.name)
    ? await readXlsxFirstSheet(await file.arrayBuffer())
    : parseCsvText((await file.text()).replace(/^\uFEFF/, ""));
  const [header = [], ...body] = table;
  const h = header.map((c) => norm(String(c ?? "")));
  const emailIdx = h.findIndex((c) => c.includes("email") || c.includes("thu dien tu"));
  const nameIdx = h.findIndex((c) => c.includes("ho ten") || c.includes("ho va ten") || c === "ten" || c.includes("name"));
  if (emailIdx < 0) throw new Error("Không thấy cột Email ở dòng tiêu đề.");
  const rows = body
    .map((r, i) => ({ key: `f${i + 2}`, email: String(r[emailIdx] ?? "").trim(), full_name: nameIdx >= 0 ? String(r[nameIdx] ?? "").trim() : "" }))
    .filter((r) => r.email || r.full_name);
  if (rows.length === 0) throw new Error("Tệp không có dòng dữ liệu.");
  if (rows.length > MAX_ACCOUNT_ROWS) throw new Error(`Tối đa ${MAX_ACCOUNT_ROWS} dòng mỗi lần (tệp có ${rows.length}).`);
  return rows;
};

/** Đánh dấu đã đổi mật khẩu lần đầu (máy chủ chỉ cho chính người dùng xoá cờ của mình). */
export const clearMustChangePassword = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("clear_must_change_password");
  if (error) throw error;
};

export const fetchMustChangePassword = async (userId: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("profiles").select("must_change_password").eq("id", userId).maybeSingle();
  return Boolean(data?.must_change_password);
};
