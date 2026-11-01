import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_TYPE_LABELS, daysUntil, type ContractAppendixRecord, type EmployeeRecord } from "@/lib/employee-records";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ContractTemplate {
  id: string;
  company_id: string;
  name: string;
  contract_type: string | null;
  body_html: string;
  active: boolean;
  updated_at: string;
}

/** Biến dùng trong mẫu hợp đồng: {{ten_bien}}. */
export const CONTRACT_TEMPLATE_VARS: { key: string; label: string }[] = [
  { key: "ten_cong_ty", label: "Tên công ty" },
  { key: "so_hop_dong", label: "Số hợp đồng" },
  { key: "loai_hop_dong", label: "Loại hợp đồng" },
  { key: "ngay_ky", label: "Ngày ký" },
  { key: "ho_ten", label: "Họ tên người lao động" },
  { key: "ma_nhan_vien", label: "Mã nhân viên" },
  { key: "gioi_tinh", label: "Giới tính" },
  { key: "ngay_sinh", label: "Ngày sinh" },
  { key: "quoc_tich", label: "Quốc tịch" },
  { key: "cccd", label: "Số CCCD" },
  { key: "ngay_cap_cccd", label: "Ngày cấp CCCD" },
  { key: "noi_cap_cccd", label: "Nơi cấp CCCD" },
  { key: "dia_chi_thuong_tru", label: "Địa chỉ thường trú" },
  { key: "dia_chi_tam_tru", label: "Địa chỉ tạm trú" },
  { key: "dien_thoai", label: "Điện thoại" },
  { key: "ma_so_thue", label: "MST cá nhân" },
  { key: "so_bhxh", label: "Số sổ BHXH" },
  { key: "phong_ban", label: "Phòng ban" },
  { key: "chuc_danh", label: "Chức danh" },
  { key: "dia_diem_lam_viec", label: "Địa điểm làm việc" },
  { key: "tu_ngay", label: "Từ ngày" },
  { key: "den_ngay", label: "Đến ngày" },
  { key: "luong_co_ban", label: "Lương cơ bản" },
  { key: "luong_dong_bh", label: "Lương đóng BHXH" },
  { key: "phu_cap", label: "Phụ cấp" },
  { key: "ngan_hang", label: "Ngân hàng / STK" },
];

export const DEFAULT_CONTRACT_TEMPLATE = `<p style="text-align:center"><b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br/><b>Độc lập - Tự do - Hạnh phúc</b></p>
<p style="text-align:center">---------------</p>
<h2 style="text-align:center">HỢP ĐỒNG LAO ĐỘNG</h2>
<p style="text-align:center">Số: {{so_hop_dong}}</p>
<p>Hôm nay, ngày {{ngay_ky}}, chúng tôi gồm:</p>
<p><b>Bên A (Người sử dụng lao động):</b> {{ten_cong_ty}}</p>
<p><b>Bên B (Người lao động):</b> {{ho_ten}} — Mã NV: {{ma_nhan_vien}}<br/>
Giới tính: {{gioi_tinh}} · Ngày sinh: {{ngay_sinh}} · Quốc tịch: {{quoc_tich}}<br/>
Số CCCD: {{cccd}} cấp ngày {{ngay_cap_cccd}} tại {{noi_cap_cccd}}<br/>
Địa chỉ thường trú: {{dia_chi_thuong_tru}}<br/>
Chỗ ở hiện tại: {{dia_chi_tam_tru}} · Điện thoại: {{dien_thoai}}<br/>
MST cá nhân: {{ma_so_thue}} · Số sổ BHXH: {{so_bhxh}}</p>
<p>Hai bên thoả thuận ký kết hợp đồng lao động theo Bộ luật Lao động 2019 với các điều khoản sau:</p>
<p><b>Điều 1. Loại hợp đồng và thời hạn:</b> {{loai_hop_dong}}, từ ngày {{tu_ngay}} đến ngày {{den_ngay}}.</p>
<p><b>Điều 2. Công việc:</b> Chức danh {{chuc_danh}}, bộ phận {{phong_ban}}. Địa điểm làm việc: {{dia_diem_lam_viec}}.</p>
<p><b>Điều 3. Tiền lương:</b> Mức lương: {{luong_co_ban}}. Phụ cấp: {{phu_cap}}. Mức lương đóng BHXH: {{luong_dong_bh}}. Hình thức trả: chuyển khoản {{ngan_hang}}.</p>
<p><b>Điều 4. Thời giờ làm việc, nghỉ ngơi, BHXH, BHYT, BHTN:</b> theo nội quy công ty và quy định pháp luật.</p>
<p><b>Điều 5. Quyền và nghĩa vụ của các bên:</b> theo Bộ luật Lao động và nội quy lao động.</p>
<p>Hợp đồng được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
<table style="width:100%;margin-top:32px"><tr>
<td style="text-align:center;width:50%"><b>NGƯỜI LAO ĐỘNG</b><br/>(Ký, ghi rõ họ tên)<br/><br/><br/><br/>{{ho_ten}}</td>
<td style="text-align:center;width:50%"><b>NGƯỜI SỬ DỤNG LAO ĐỘNG</b><br/>(Ký, đóng dấu)</td>
</tr></table>`;

const vnDate = (value: string | null | undefined) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const vnMoney = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : `${new Intl.NumberFormat("vi-VN").format(Number(value))} đồng`;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ContractLike {
  contract_no: string | null;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  position: string | null;
  department: string | null;
  base_salary: number | null;
  allowance: number | null;
  insurance_salary: number | null;
  work_location?: string | null;
  signed_date?: string | null;
}

export const buildContractVars = (
  contract: ContractLike,
  employee: EmployeeRecord | null,
  companyName: string,
): Record<string, string> => ({
  ten_cong_ty: companyName,
  so_hop_dong: contract.contract_no ?? "",
  loai_hop_dong: CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type,
  ngay_ky: vnDate(contract.signed_date ?? contract.start_date),
  ho_ten: employee?.full_name ?? "",
  ma_nhan_vien: employee?.code ?? "",
  gioi_tinh: employee?.gender === "male" ? "Nam" : employee?.gender === "female" ? "Nữ" : "",
  ngay_sinh: vnDate(employee?.date_of_birth),
  quoc_tich: employee?.nationality ?? "Việt Nam",
  cccd: employee?.national_id ?? "",
  ngay_cap_cccd: vnDate(employee?.national_id_issue_date),
  noi_cap_cccd: employee?.national_id_issue_place ?? "",
  dia_chi_thuong_tru: employee?.permanent_address ?? "",
  dia_chi_tam_tru: employee?.current_address ?? "",
  dien_thoai: employee?.phone ?? "",
  ma_so_thue: employee?.tax_code ?? "",
  so_bhxh: employee?.insurance_number ?? "",
  phong_ban: contract.department ?? employee?.department ?? "",
  chuc_danh: contract.position ?? employee?.position ?? "",
  dia_diem_lam_viec: contract.work_location ?? employee?.work_location ?? "",
  tu_ngay: vnDate(contract.start_date),
  den_ngay: contract.end_date ? vnDate(contract.end_date) : "không xác định thời hạn",
  luong_co_ban: vnMoney(contract.base_salary),
  luong_dong_bh: vnMoney(contract.insurance_salary),
  phu_cap: vnMoney(contract.allowance),
  ngan_hang: [employee?.bank_account, employee?.bank_name].filter(Boolean).join(" – "),
});

/** Thay {{bien}} bằng giá trị (đã escape); biến trống ⇒ dòng chấm để điền tay. */
export const renderContractTemplate = (body: string, vars: Record<string, string>) =>
  body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) =>
    vars[key] ? escapeHtml(vars[key]) : "……………………",
  );

const wrapDocument = (title: string, bodyHtml: string) => `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>@page{size:A4;margin:2cm 2cm 2cm 3cm}body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.5;color:#000}h2{font-size:15pt;margin:12px 0}p{margin:6px 0}</style>
</head><body>${bodyHtml}</body></html>`;

/** Xuất Word (.doc dạng HTML – Word/LibreOffice/Google Docs mở được, không cần thư viện nặng). */
export const downloadContractWord = (fileName: string, bodyHtml: string) => {
  const blob = new Blob(["\ufeff", wrapDocument(fileName, bodyHtml)], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.replace(/[\\/:*?"<>|]+/g, "-")}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** In / lưu PDF qua hộp thoại in của trình duyệt. */
export const printContractPdf = (title: string, bodyHtml: string) => {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error("Trình duyệt chặn cửa sổ in.");
  }
  doc.open();
  doc.write(wrapDocument(title, bodyHtml));
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1500);
  }, 250);
};

/* ------------------------------ Mẫu hợp đồng ------------------------------ */

export const listContractTemplates = async (companyId: string): Promise<ContractTemplate[]> => {
  const { data, error } = await db
    .from("contract_templates")
    .select("id, company_id, name, contract_type, body_html, active, updated_at")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw new Error(error.message ?? "Không tải được mẫu hợp đồng.");
  return (data ?? []) as ContractTemplate[];
};

export const saveContractTemplate = async (values: Partial<ContractTemplate> & { company_id: string }) => {
  const { id, ...rest } = values;
  const query = id
    ? db.from("contract_templates").update(rest).eq("id", id)
    : db.from("contract_templates").insert(rest);
  const { error } = await query;
  if (error) throw new Error(error.message ?? "Không lưu được mẫu hợp đồng.");
};

export const deleteContractTemplate = async (id: string) => {
  const { error } = await db.from("contract_templates").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được mẫu.");
};

/** Chọn mẫu phù hợp loại HĐ; không có ⇒ mẫu mặc định. */
export const pickTemplate = (templates: ContractTemplate[], contractType: string) =>
  templates.find((t) => t.active && t.contract_type === contractType)?.body_html ??
  templates.find((t) => t.active && !t.contract_type)?.body_html ??
  DEFAULT_CONTRACT_TEMPLATE;

/* ------------------------------ Phụ lục ------------------------------ */

export const listContractAppendices = async (contractId: string): Promise<ContractAppendixRecord[]> => {
  const { data, error } = await db
    .from("contract_appendices")
    .select("*")
    .eq("contract_id", contractId)
    .order("effective_date", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được phụ lục.");
  return (data ?? []) as ContractAppendixRecord[];
};

export const createContractAppendix = async (values: Record<string, unknown>) => {
  const { error } = await db.from("contract_appendices").insert(values);
  if (error) throw new Error(error.message ?? "Không tạo được phụ lục.");
};

export const deleteContractAppendix = async (id: string) => {
  const { error } = await db.from("contract_appendices").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được phụ lục.");
};

/* -------------------------- Gợi ý chuyển đổi (BLLĐ 2019) -------------------------- */

export interface LegalWarning {
  tone: "warning" | "danger" | "info";
  text: string;
}

const monthsBetween = (from: string, to: string) => {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);
};

/**
 * Cảnh báo tham khảo (không chặn lưu). `history` = toàn bộ HĐ của cùng nhân sự.
 * Căn cứ: Điều 20, 22, 25 Bộ luật Lao động 2019.
 */
export const contractLegalWarnings = (
  contract: ContractLike & { id?: string; status: string },
  history: (ContractLike & { id?: string; status: string })[],
): LegalWarning[] => {
  const warnings: LegalWarning[] = [];
  const left = daysUntil(contract.end_date);
  const active = contract.status === "active";

  if (contract.contract_type === "probation") {
    if (contract.start_date && contract.end_date) {
      const days = Math.round(
        (new Date(`${contract.end_date}T00:00:00`).getTime() - new Date(`${contract.start_date}T00:00:00`).getTime()) / 86400000,
      ) + 1;
      if (days > 180) warnings.push({ tone: "danger", text: `Thử việc ${days} ngày — vượt mức tối đa 180 ngày (Điều 25 BLLĐ 2019).` });
      else if (days > 60) warnings.push({ tone: "info", text: `Thử việc ${days} ngày — chỉ hợp lệ trên 60 ngày với vị trí quản lý doanh nghiệp (tối đa 180 ngày).` });
    }
    if (active && left !== null && left < 0)
      warnings.push({ tone: "danger", text: "Đã hết thời gian thử việc: cần ký HĐLĐ chính thức hoặc thông báo kết quả/chấm dứt." });
    else if (active && left !== null && left <= 7)
      warnings.push({ tone: "warning", text: `Còn ${left} ngày hết thử việc — chuẩn bị đánh giá và HĐLĐ chính thức.` });
  }

  if (contract.contract_type === "seasonal")
    warnings.push({ tone: "info", text: "BLLĐ 2019 không còn loại HĐ mùa vụ; về pháp lý được xem là HĐ xác định thời hạn (≤ 36 tháng)." });

  if (contract.contract_type === "fixed_term" || contract.contract_type === "seasonal") {
    if (contract.start_date && contract.end_date && monthsBetween(contract.start_date, contract.end_date) >= 36)
      warnings.push({ tone: "danger", text: "HĐ xác định thời hạn không được quá 36 tháng (Điều 20 BLLĐ 2019)." });
    const fixedBefore = history.filter(
      (item) =>
        item.id !== contract.id &&
        (item.contract_type === "fixed_term" || item.contract_type === "seasonal") &&
        (item.start_date ?? "") <= (contract.start_date ?? "9999"),
    ).length;
    if (fixedBefore >= 2)
      warnings.push({ tone: "danger", text: `Đây là HĐ xác định thời hạn thứ ${fixedBefore + 1}: chỉ được ký tối đa 2 lần, hợp đồng này phải là HĐ không xác định thời hạn (Điều 20 khoản 2).` });
    else if (fixedBefore === 1)
      warnings.push({ tone: "warning", text: "Đây là HĐ xác định thời hạn thứ 2: khi hết hạn nếu tiếp tục làm việc phải ký HĐ không xác định thời hạn (Điều 20 khoản 2)." });
    if (active && left !== null && left < 0)
      warnings.push({
        tone: "danger",
        text: `HĐ đã hết hạn ${-left} ngày nhưng còn hiệu lực trên hệ thống: trong 30 ngày phải ký HĐ mới; quá 30 ngày HĐ trở thành không xác định thời hạn.`,
      });
    else if (active && left !== null && left <= 30)
      warnings.push({ tone: "warning", text: `Còn ${left} ngày hết hạn — cần gia hạn/ký HĐ mới hoặc thông báo chấm dứt.` });
  }
  return warnings;
};
