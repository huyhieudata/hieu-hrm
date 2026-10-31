import { toast } from "sonner";

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
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
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
<p class="sub">${escapeHtml(subtitle)} · Xuất ngày ${new Date().toLocaleDateString("vi-VN")}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<footer>${rows.length} dòng · ONHRM</footer>
</body></html>`;

  const win = window.open("", "_blank", "width=1080,height=900");
  if (!win) {
    toast.error("Trình duyệt đã chặn cửa sổ xuất PDF. Vui lòng cho phép popup.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
};
