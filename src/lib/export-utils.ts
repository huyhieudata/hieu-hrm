import { printViaFrame } from "@/lib/print-frame";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** SEC-07: giới hạn số dòng mỗi lần xuất và ngưỡng cảnh báo xuất hàng loạt. */
export const MAX_EXPORT_ROWS = 5000;
const BULK_WARN_ROWS = 200;
let auditCompanyId: string | null = null;
/** CompanyProvider gọi khi đổi công ty đang mở để nhật ký xuất gắn đúng công ty. */
export const setExportAuditCompany = (companyId: string | null) => {
  auditCompanyId = companyId;
};

const limitRows = <T>(rows: T[]): T[] => {
  if (rows.length <= MAX_EXPORT_ROWS) return rows;
  toast.warning(`Chỉ xuất ${MAX_EXPORT_ROWS} dòng đầu`, {
    description: `Có ${rows.length} dòng. Hãy lọc bớt rồi xuất tiếp để giới hạn dữ liệu cá nhân bị sao chép.`,
  });
  return rows.slice(0, MAX_EXPORT_ROWS);
};

/** Ghi nhật ký xuất: chỉ loại, tên tệp và số dòng — không gửi nội dung. */
const auditExport = (kind: "export_excel" | "export_pdf", target: string, rowCount: number) => {
  if (rowCount >= BULK_WARN_ROWS) {
    toast.info("Xuất hàng loạt đã được ghi nhật ký", {
      description: `${rowCount} dòng. Vui lòng bảo quản tệp, không chia sẻ ra ngoài.`,
    });
  }
  if (!auditCompanyId) return;
  const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown> };
  void Promise.resolve(
    db.rpc("log_data_access", { p_company: auditCompanyId, p_kind: kind, p_target: target, p_row_count: rowCount }),
  ).catch(() => undefined);
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Excel-compatible spreadsheet (HTML table saved as .xls, opens natively in Excel). */
export const exportExcel = (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  sheetTitle = filename,
) => {
  rows = limitRows(rows);
  auditExport("export_excel", filename, rows.length);
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${escapeHtml(sheetTitle).slice(0, 28)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table{border-collapse:collapse}
  td,th{border:1px solid #c9ced6;padding:6px 8px;font-family:"Segoe UI",sans-serif;font-size:12px;vertical-align:top}
  th{background:#eef2f8;font-weight:600;text-align:left}
</style></head>
<body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;

  download(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
  toast.success("Đã xuất tệp Excel", { description: `${rows.length} dòng` });
};

/** Opens a print-ready table; the user can print or save as PDF. */
export const exportPdf = (
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  rows = limitRows(rows);
  auditExport("export_pdf", title, rows.length);
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page{size:A4 landscape;margin:12mm}
  body{font-family:"Segoe UI",system-ui,sans-serif;color:#111;margin:32px}
  h1{font-size:20px;margin:0 0 4px}
  p.sub{color:#666;font-size:12px;margin:0 0 18px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #d6dae1;padding:6px 8px;font-size:11.5px;text-align:left;vertical-align:top}
  th{background:#f2f5fa;font-weight:600}
  tr:nth-child(even) td{background:#fafbfd}
  footer{margin-top:18px;color:#888;font-size:10.5px}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="sub">${escapeHtml(subtitle)} · Xuất ngày ${new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<footer>${rows.length} dòng · ONHRM</footer>
</body></html>`;

  printViaFrame(html);
};
