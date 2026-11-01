import { supabase } from "@/integrations/supabase/client";
import { applyPayrollParameters, type PayrollParameterRow } from "@/lib/payroll-calc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface PayrollPeriod {
  id: string;
  company_id: string;
  year: number;
  month: number;
  status: "draft" | "locked" | "paid";
  standard_work_days: number;
  note: string | null;
  created_at: string;
}

export interface PayrollItem {
  id: string;
  company_id: string;
  period_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string | null;
  department: string | null;
  work_days: number;
  attendance_days: number;
  leave_days: number;
  base_salary: number;
  position_allowance: number;
  responsibility_allowance: number;
  other_allowance: number;
  gross_salary: number;
  insurance_salary: number;
  insurance_employee: number;
  taxable_income: number;
  tax_amount: number;
  other_deduction: number;
  net_salary: number;
  dependents_count: number;
  note: string | null;
  adjusted_at: string | null;
  adjusted_by: string | null;
}

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  draft: "Bản nháp",
  locked: "Đã chốt",
  paid: "Đã chi trả",
};

export {
  DEPENDENT_DEDUCTION,
  INSURANCE_EMPLOYEE_RATE,
  PERSONAL_DEDUCTION,
  computePit,
  getPitRule,
  applyPayrollAdjustment,
  calculatePayroll,
  payrollPeriodRange,
  applyPayrollParameters,
  type PayrollParameterRow,
  type PayrollAdjustmentInput,
  type PayrollWarning,
  type PayrollWarningCode,
  type PayrollAttendanceInput,
  type PayrollCalcResult,
  type PayrollEmployeeInput,
  type PayrollItemDraft,
  type PayrollLeaveInput,
  type PayrollSalaryInput,
  type PayrollShiftInput,
} from "@/lib/payroll-calc";

export const listPayrollPeriods = async (companyId: string): Promise<PayrollPeriod[]> => {
  const { data, error } = await db
    .from("payroll_periods")
    .select("*")
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được kỳ lương.");
  return (data ?? []) as PayrollPeriod[];
};

export const createPayrollPeriod = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("payroll_periods").insert(values).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Kỳ lương của tháng này đã tồn tại.");
    throw new Error(error.message ?? "Không tạo được kỳ lương.");
  }
  return data.id as string;
};

export const updatePayrollPeriod = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("payroll_periods").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được kỳ lương.");
};

export const deletePayrollPeriod = async (id: string) => {
  const { error } = await db.from("payroll_periods").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được kỳ lương.");
};

export const listPayrollItems = async (companyId: string, periodId?: string): Promise<PayrollItem[]> => {
  let query = db.from("payroll_items").select("*").eq("company_id", companyId);
  if (periodId) query = query.eq("period_id", periodId);
  const { data, error } = await query.order("employee_name", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được bảng lương.");
  return (data ?? []) as PayrollItem[];
};

/**
 * Thay toàn bộ bảng lương của kỳ trong một giao dịch phía máy chủ: không để lại
 * trạng thái bảng lương trống nếu bước ghi thất bại, và chặn sửa kỳ đã chốt.
 */
/** Cập nhật một phiếu lương; trigger chặn khi kỳ không còn ở trạng thái nháp. */
export const updatePayrollItem = async (itemId: string, values: Record<string, unknown>) => {
  const { error } = await db.from("payroll_items").update(values).eq("id", itemId);
  if (error) throw new Error(error.message ?? "Không lưu được phiếu lương.");
};

export const replacePayrollItems = async (periodId: string, items: Record<string, unknown>[]) => {
  const { data, error } = await db.rpc("replace_payroll_items", {
    target_period: periodId,
    payload: items,
  });
  if (error) throw new Error(error.message ?? "Không lưu được bảng lương.");
  return Number(data ?? 0);
};

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} đ`;

const formatDays = (value: number) =>
  Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const payslipStyles = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #1a2233; margin: 0; background: #fff; }
  .slip { padding: 32px; }
  .slip + .slip { border-top: 1px dashed #e2e8f0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
  .brand { font-size: 18px; font-weight: 700; color: #1d4ed8; letter-spacing: -.02em; }
  .muted { color: #64748b; font-size: 12px; }
  h1 { font-size: 22px; margin: 24px 0 4px; }
  .grid { display: flex; gap: 24px; margin: 18px 0 8px; flex-wrap: wrap; }
  .grid div { min-width: 160px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
  .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  th { text-align: left; background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; color: #475569; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .section { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #475569; margin-top: 22px; font-weight: 700; }
  .net { margin-top: 22px; display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; }
  .net .amount { font-size: 22px; font-weight: 700; color: #1d4ed8; }
  .note { margin-top: 18px; font-size: 11.5px; color: #475569; background: #f8fafc; border-left: 3px solid #93c5fd; padding: 8px 12px; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    .slip { break-after: page; page-break-after: always; }
    .slip:last-child { break-after: auto; page-break-after: auto; }
    .slip + .slip { border-top: 0; }
  }
`;

const payslipDocument = (title: string, body: string) =>
  `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>${payslipStyles}</style></head><body>${body}</body></html>`;

const payslipBody = (input: { companyName: string; period: PayrollPeriod; item: PayrollItem }) => {
  const { companyName, period, item } = input;
  const rows = [
    ["Lương cơ bản", item.base_salary],
    ["Phụ cấp chức vụ", item.position_allowance],
    ["Phụ cấp trách nhiệm", item.responsibility_allowance],
    ["Phụ cấp ăn ca / khác", item.other_allowance],
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => `<tr><td>${label}</td><td class="num">${money(Number(value))}</td></tr>`)
    .join("");

  const deductions = [
    ["Bảo hiểm nhân viên (10,5%)", item.insurance_employee],
    ["Thuế TNCN", item.tax_amount],
    ["Khấu trừ khác", item.other_deduction],
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => `<tr><td>${label}</td><td class="num">-${money(Number(value))}</td></tr>`)
    .join("");

  return `
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(companyName)}</div>
      <div class="muted">Phiếu lương nhân viên</div>
    </div>
    <div style="text-align:right">
      <div class="label">Kỳ lương</div>
      <div class="value">Tháng ${period.month}/${period.year}</div>
      <div class="muted">${period.standard_work_days} ngày công chuẩn</div>
    </div>
  </div>
  <h1>${escapeHtml(item.employee_name)}</h1>
  <div class="muted">${escapeHtml(item.employee_code ?? "")}${item.department ? ` · ${escapeHtml(item.department)}` : ""}</div>
  <div class="grid">
    <div><div class="label">Ngày công tính lương</div><div class="value">${formatDays(item.work_days)}</div></div>
    <div><div class="label">Chấm công / phép</div><div class="value">${formatDays(item.attendance_days)} + ${formatDays(item.leave_days)}</div></div>
    <div><div class="label">Lương đóng bảo hiểm</div><div class="value">${money(item.insurance_salary)}</div></div>
    <div><div class="label">Thu nhập chịu thuế</div><div class="value">${money(item.taxable_income)}</div></div>
  </div>
  <div class="section">Thu nhập</div>
  <table><thead><tr><th>Khoản mục</th><th class="num">Số tiền</th></tr></thead><tbody>${rows}
    <tr><td><strong>Tổng thu nhập</strong></td><td class="num"><strong>${money(item.gross_salary)}</strong></td></tr></tbody></table>
  <div class="section">Khấu trừ</div>
  <table><thead><tr><th>Khoản mục</th><th class="num">Số tiền</th></tr></thead><tbody>${deductions || '<tr><td colspan="2">Không có khấu trừ</td></tr>'}</tbody></table>
  <div class="net"><span>Thực nhận</span><span class="amount">${money(item.net_salary)}</span></div>
  ${item.note ? `<div class="note">Ghi chú: ${escapeHtml(item.note)}</div>` : ""}
  <div class="footer">Phiếu lương được tạo tự động bởi ONHRM · ${new Date().toLocaleDateString("vi-VN")}</div>`;
};

export const buildPayslipHtml = (input: {
  companyName: string;
  period: PayrollPeriod;
  item: PayrollItem;
}) =>
  payslipDocument(
    `Phiếu lương ${input.item.employee_name} - ${input.period.month}/${input.period.year}`,
    `<section class="slip">${payslipBody(input)}</section>`,
  );

/** In gộp toàn bộ phiếu lương của một kỳ, mỗi phiếu một trang. */
export const buildPayslipBatchHtml = (input: {
  companyName: string;
  period: PayrollPeriod;
  items: PayrollItem[];
}) =>
  payslipDocument(
    `Bảng lương tháng ${input.period.month}/${input.period.year}`,
    input.items
      .map(
        (item) =>
          `<section class="slip">${payslipBody({ companyName: input.companyName, period: input.period, item })}</section>`,
      )
      .join(""),
  );

/** Tham số lương có ngày hiệu lực (bảng payroll_parameters): mặc định hệ thống + riêng công ty. */
export interface PayrollParameter extends PayrollParameterRow {
  id: string;
  note: string | null;
}

export const listPayrollParameters = async (companyId: string): Promise<PayrollParameter[]> => {
  const { data, error } = await db
    .from("payroll_parameters")
    .select("*")
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .order("effective_date", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được tham số lương.");
  return (data ?? []) as PayrollParameter[];
};

/** Nạp tham số của công ty vào bộ tính lương phía giao diện (cùng quy tắc với máy chủ). */
export const loadPayrollParameters = async (companyId: string) => {
  const rows = await listPayrollParameters(companyId);
  applyPayrollParameters(rows);
  return rows;
};

export const savePayrollParameter = async (values: Record<string, unknown>, id?: string) => {
  const query = id
    ? db.from("payroll_parameters").update(values).eq("id", id)
    : db.from("payroll_parameters").insert(values);
  const { error } = await query;
  if (error) {
    if (error.code === "23505") throw new Error("Đã có bộ tham số cho ngày hiệu lực này.");
    throw new Error(error.message ?? "Không lưu được tham số lương.");
  }
};

export const deletePayrollParameter = async (id: string) => {
  const { error } = await db.from("payroll_parameters").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được tham số lương.");
};
