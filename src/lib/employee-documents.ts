import { printViaFrame } from "@/lib/print-frame";
import { toast } from "sonner";

import { DEPENDENT_RELATION_LABELS } from "@/lib/employee-records";
import { currency } from "@/lib/format";
import type {
  AssetRecord,
  ContractRecord,
  DebtRecord,
  DependentRecord,
  DisciplineRecord,
  DocumentRecord,
  EmployeeRecord,
  InsuranceRecord,
  RewardRecord,
  SalaryRecord,
  TrainingRecord,
  WorkHistoryRecord,
} from "@/lib/employee-records";
import type { OnboardingRecord } from "@/lib/recruitment";

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const day = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const month = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

const money = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : currency(Number(value));

const today = () => new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const styles = `
  @page{size:A4;margin:18mm}
  body{font-family:"Times New Roman",Georgia,serif;color:#111;line-height:1.6;margin:0}
  .brand{display:flex;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:20px}
  .brand h1{font-size:16px;margin:0;letter-spacing:.04em;color:#1d4ed8}
  .brand p{margin:2px 0 0;font-size:11px;color:#555;font-family:"Segoe UI",sans-serif}
  .meta{text-align:right;font-size:11px;color:#555;font-family:"Segoe UI",sans-serif}
  h2{text-align:center;font-size:19px;margin:0 0 2px;letter-spacing:.06em}
  .sub{text-align:center;font-size:11.5px;color:#666;margin:0 0 18px;font-family:"Segoe UI",sans-serif}
  h3{font-size:12.5px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#1f2937}
  table{border-collapse:collapse;width:100%;margin:6px 0 4px}
  th,td{border:1px solid #d6dae1;padding:5px 7px;font-size:11.5px;text-align:left;vertical-align:top}
  th{background:#f2f5fa;font-weight:600}
  .kv th{width:32%;background:#f7f9fc;font-weight:600}
  .muted{color:#555;font-size:12px}
  .sign{display:flex;justify-content:space-between;gap:28px;margin-top:34px;text-align:center}
  .sign div{flex:1}
  .sign .role{font-size:12px;font-weight:600}
  .sign .hint{font-size:10.5px;color:#888}
  .line{margin-top:52px;border-top:1px dashed #bbb;padding-top:5px;font-size:10.5px;color:#555}
  footer{margin-top:20px;border-top:1px solid #e6e9ef;padding-top:8px;font-size:10px;color:#888;font-family:"Segoe UI",sans-serif}
  .empty{font-size:11.5px;color:#777;font-style:italic}
`;

const shell = (companyName: string, docNo: string, title: string, subtitle: string, body: string) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><title>${esc(title)}</title><style>${styles}</style></head>
<body>
  <div class="brand">
    <div>
      <h1>${esc(companyName).toUpperCase()}</h1>
      <p>Phòng Nhân sự</p>
    </div>
    <div class="meta">Số: ${esc(docNo)}<br />Ngày: ${today()}</div>
  </div>
  <h2>${esc(title)}</h2>
  <p class="sub">${esc(subtitle)}</p>
  ${body}
  <footer>${esc(companyName)} · Tài liệu in từ ONHRM ngày ${today()}</footer>
</body></html>`;

const kv = (pairs: [string, string][]) =>
  `<table class="kv"><tbody>${pairs
    .map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`)
    .join("")}</tbody></table>`;

const grid = (headers: string[], rows: (string | number)[][]) =>
  rows.length === 0
    ? `<p class="empty">Không có dữ liệu.</p>`
    : `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>
       <tbody>${rows
         .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
         .join("")}</tbody></table>`;

const signatures = (left: string, right: string, hintLeft = "(Ký, ghi rõ họ tên)", hintRight = "(Ký, ghi rõ họ tên)") => `
  <div class="sign">
    <div><p class="role">${esc(left)}</p><p class="hint">${esc(hintLeft)}</p><div class="line">&nbsp;</div></div>
    <div><p class="role">${esc(right)}</p><p class="hint">${esc(hintRight)}</p><div class="line">&nbsp;</div></div>
  </div>`;

export const printHtml = (html: string) => {
  printViaFrame(html);
};

export const downloadHtml = (html: string, filename: string) => {
  const blob = new Blob(["\ufeff", html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Đã tải tài liệu", { description: "Mở tệp bằng trình duyệt và chọn In → Lưu thành PDF." });
};

/* ----------------------------- Asset handover ----------------------------- */

export const buildAssetHandoverHtml = (
  employee: EmployeeRecord,
  assets: AssetRecord[],
  companyName: string,
) => {
  const total = assets.reduce((sum, asset) => sum + Number(asset.value ?? 0), 0);
  const body = `
    ${kv([
      ["Họ và tên", employee.full_name],
      ["Mã nhân viên", employee.code],
      ["Phòng ban", employee.department ?? "—"],
      ["Chức danh", [employee.position, employee.concurrent_positions].filter(Boolean).join("; ") || "—"],
    ])}
    <h3>Tài sản bàn giao</h3>
    ${grid(
      ["STT", "Tên tài sản", "Mã", "Serial", "Ngày bàn giao", "Tình trạng", "Giá trị", "Trạng thái"],
      assets.map((asset, index) => [
        index + 1,
        asset.name,
        asset.asset_code ?? "—",
        asset.serial_number ?? "—",
        day(asset.assigned_date),
        asset.condition === "new" ? "Mới" : asset.condition === "good" ? "Tốt" : asset.condition === "fair" ? "Khá" : "Hư hỏng",
        money(asset.value),
        asset.status === "returned"
          ? `Đã thu hồi ${day(asset.return_date)}`
          : asset.status === "lost"
            ? "Mất"
            : asset.status === "damaged"
              ? "Hư hỏng"
              : "Đang sử dụng",
      ]),
    )}
    <p class="muted"><strong>Tổng giá trị tài sản:</strong> ${money(total)} · <strong>Số lượng:</strong> ${assets.length}</p>
    <p class="muted">Người nhận bàn giao cam kết bảo quản, sử dụng đúng mục đích và hoàn trả đầy đủ khi có yêu cầu hoặc khi kết thúc làm việc tại công ty.</p>
    ${signatures("Đại diện Công ty", "Người nhận tài sản")}
  `;

  return shell(
    companyName,
    `BB-TS-${employee.code}`,
    "BIÊN BẢN BÀN GIAO TÀI SẢN",
    `Nhân sự: ${employee.full_name} · ${employee.code}`,
    body,
  );
};

/* --------------------------- Debt confirmation --------------------------- */

export const buildDebtConfirmationHtml = (
  employee: EmployeeRecord,
  debts: DebtRecord[],
  companyName: string,
) => {
  const outstanding = debts
    .filter((debt) => debt.status === "open")
    .reduce((sum, debt) => sum + Math.max(Number(debt.amount) - Number(debt.settled_amount ?? 0), 0), 0);

  const body = `
    ${kv([
      ["Họ và tên", employee.full_name],
      ["Mã nhân viên", employee.code],
      ["Phòng ban", employee.department ?? "—"],
      ["Chức danh", employee.position ?? "—"],
    ])}
    <h3>Chi tiết công nợ</h3>
    ${grid(
      ["STT", "Nội dung", "Loại", "Số tiền", "Đã tất toán", "Còn lại", "Hạn", "Trạng thái"],
      debts.map((debt, index) => [
        index + 1,
        debt.title,
        debt.category === "advance"
          ? "Tạm ứng"
          : debt.category === "loan"
            ? "Vay"
            : debt.category === "penalty"
              ? "Bồi thường"
              : debt.category === "equipment"
                ? "Tài sản hư hỏng"
                : "Khác",
        money(debt.amount),
        money(debt.settled_amount),
        money(Math.max(Number(debt.amount) - Number(debt.settled_amount ?? 0), 0)),
        day(debt.due_date),
        debt.status === "settled" ? "Đã tất toán" : debt.status === "cancelled" ? "Đã huỷ" : "Chưa tất toán",
      ]),
    )}
    <p class="muted"><strong>Tổng công nợ còn lại:</strong> ${money(outstanding)}</p>
    <p class="muted">Hai bên xác nhận các khoản công nợ nêu trên là đúng thực tế. Người lao động cam kết tất toán đầy đủ theo hạn ghi trong bảng hoặc theo thoả thuận với công ty.</p>
    ${signatures("Đại diện Công ty", "Người xác nhận công nợ")}
  `;

  return shell(
    companyName,
    `BB-CN-${employee.code}`,
    "BIÊN BẢN XÁC NHẬN CÔNG NỢ",
    `Nhân sự: ${employee.full_name} · ${employee.code}`,
    body,
  );
};

/* ---------------------------- Employee summary --------------------------- */

interface EmployeeSummaryData {
  employee: EmployeeRecord;
  contracts: ContractRecord[];
  salaries: SalaryRecord[];
  insurance: InsuranceRecord[];
  workHistory: WorkHistoryRecord[];
  onboarding: OnboardingRecord[];
  assets: AssetRecord[];
  debts: DebtRecord[];
  dependents: DependentRecord[];
  rewards: RewardRecord[];
  discipline: DisciplineRecord[];
  training: TrainingRecord[];
  documents: DocumentRecord[];
  companyName: string;
}

export const buildEmployeeSummaryHtml = (data: EmployeeSummaryData) => {
  const { employee } = data;

  const personal = kv([
    ["Họ và tên", employee.full_name],
    ["Mã nhân viên", employee.code],
    ["Giới tính", employee.gender === "male" ? "Nam" : employee.gender === "female" ? "Nữ" : employee.gender ?? "—"],
    ["Ngày sinh", day(employee.date_of_birth)],
    ["CCCD / CMND", employee.national_id ?? "—"],
    ["Điện thoại", employee.phone ?? "—"],
    ["Email", employee.work_email ?? employee.personal_email ?? "—"],
    ["Địa chỉ", employee.current_address ?? "—"],
    ["Tình trạng hôn nhân", employee.marital_status ?? "—"],
    ["Người phụ thuộc", String(employee.dependents_count ?? 0)],
    ["Liên hệ khẩn cấp", [employee.emergency_contact_name, employee.emergency_contact_relation, employee.emergency_contact_phone].filter(Boolean).join(" · ") || "—"],
  ]);

  const job = kv([
    ["Trạng thái", employee.status === "active" ? "Đang làm việc" : employee.status === "resigned" ? "Đã nghỉ việc" : employee.status === "maternity" ? "Nghỉ thai sản" : employee.status === "long_leave" ? "Nghỉ dài hạn" : "Chờ cập nhật"],
    ["Phòng ban", employee.department ?? "—"],
    ["Chức danh", employee.position ?? "—"],
    ["Vị trí kiêm nhiệm", employee.concurrent_positions ?? "—"],
    ["Cấp bậc", employee.job_level ?? "—"],
    ["Hình thức làm việc", employee.employment_type ?? "—"],
    ["Ngày vào làm", day(employee.hire_date)],
    ["Địa điểm làm việc", employee.work_location ?? "—"],
    ["Quản lý trực tiếp", data.workHistory.length ? "" : ""],
  ].filter(([label]) => label !== "Quản lý trực tiếp") as [string, string][]);

  const latestSalary = data.salaries[0] ?? null;

  const salarySection = kv([
    ["Mức lương hiện tại", latestSalary ? money(latestSalary.base_salary) : "—"],
    ["Phụ cấp", latestSalary ? money(latestSalary.position_allowance) : "—"],
    ["Lương đóng bảo hiểm", latestSalary ? money(latestSalary.insurance_salary) : "—"],
    ["Ngân hàng", [employee.bank_name, employee.bank_account].filter(Boolean).join(" · ") || "—"],
    ["Mã số thuế", employee.tax_code ?? "—"],
    ["Số sổ BHXH", employee.insurance_number ?? "—"],
  ]);

  const body = `
    ${personal}

    <h3>Người phụ thuộc</h3>
    ${grid(
      ["Họ tên", "Quan hệ", "Ngày sinh", "Mã số thuế", "Giảm trừ gia cảnh"],
      data.dependents.map((item) => [
        item.full_name,
        DEPENDENT_RELATION_LABELS[item.relationship] ?? item.relationship,
        day(item.date_of_birth),
        item.tax_code ?? "—",
        item.registered_for_deduction ? "Đã đăng ký" : "Không",
      ]),
    )}

    <h3>Thông tin công việc</h3>
    ${job}

    <h3>Tài liệu hồ sơ</h3>
    ${
      data.documents.length === 0
        ? "<p>Chưa có tài liệu đính kèm.</p>"
        : grid(
            ["Tên tài liệu", "Danh mục", "Dung lượng", "Ngày tải"],
            data.documents.map((document) => [
              document.name,
              document.category,
              document.size_bytes ? `${Math.round(Number(document.size_bytes) / 1024)} KB` : "—",
              day(document.created_at),
            ]),
          )
    }

    <h3>Lương &amp; thanh toán</h3>
    ${salarySection}
    ${grid(
      ["Ngày hiệu lực", "Lương cơ bản", "Phụ cấp", "Lương đóng BH", "Thưởng KPI"],
      data.salaries.map((salary) => [
        day(salary.effective_date),
        money(salary.base_salary),
        money(
          Number(salary.position_allowance ?? 0) +
            Number(salary.responsibility_allowance ?? 0) +
            Number(salary.other_allowance ?? 0),
        ),
        money(salary.insurance_salary),
        money(salary.kpi_bonus),
      ]),
    )}

    <h3>Hợp đồng lao động</h3>
    ${grid(
      ["Số hợp đồng", "Loại", "Bắt đầu", "Kết thúc", "Lương", "Trạng thái"],
      data.contracts.map((contract) => [
        contract.contract_no ?? "—",
        contract.contract_type === "indefinite"
          ? "Không thời hạn"
          : contract.contract_type === "fixed_term"
            ? "Xác định thời hạn"
            : contract.contract_type === "probation"
              ? "Thử việc"
              : contract.contract_type,
        day(contract.start_date),
        contract.end_date ? day(contract.end_date) : "Không thời hạn",
        money(contract.base_salary),
        contract.status === "active" ? "Hiệu lực" : contract.status === "expired" ? "Hết hạn" : "Đã chấm dứt",
      ]),
    )}

    <h3>Quá trình công tác</h3>
    ${grid(
      ["Từ ngày", "Đến ngày", "Sự kiện", "Phòng ban", "Chức danh"],
      data.workHistory.map((item) => [
        day(item.start_date),
        item.end_date ? day(item.end_date) : "nay",
        item.title,
        item.department ?? "—",
        item.position ?? "—",
      ]),
    )}

    <h3>Bảo hiểm</h3>
    ${grid(
      ["Loại", "Số sổ", "Từ tháng", "Đến tháng", "Mức đóng", "Trạng thái"],
      data.insurance.map((item) => [
        item.insurance_type === "social" ? "BHXH" : item.insurance_type === "health" ? "BHYT" : item.insurance_type === "unemployment" ? "BHTN" : "BHTNLĐ",
        item.insurance_number ?? "—",
        month(item.start_date),
        item.end_date ? month(item.end_date) : "nay",
        money(item.salary_base),
        item.status === "active" ? "Đang đóng" : item.status === "paused" ? "Tạm dừng" : "Đã chốt",
      ]),
    )}

    <h3>Hội nhập</h3>
    ${grid(
      ["Ngày nhận việc", "Vị trí", "Quản lý", "Trạng thái", "Checklist"],
      data.onboarding.map((item) => [
        day(item.hire_date),
        item.position ?? "—",
        item.manager_name ?? "—",
        item.status === "completed" ? "Hoàn thành" : item.status === "cancelled" ? "Đã huỷ" : "Chưa hoàn thành",
        `${(item.checklist ?? []).filter((step) => step.completed).length}/${(item.checklist ?? []).length || 0}`,
      ]),
    )}

    <h3>Tài sản đang quản lý</h3>
    ${grid(
      ["Tài sản", "Mã", "Ngày bàn giao", "Giá trị", "Trạng thái"],
      data.assets.map((asset) => [
        asset.name,
        asset.asset_code ?? "—",
        day(asset.assigned_date),
        money(asset.value),
        asset.status === "returned" ? "Đã thu hồi" : asset.status === "lost" ? "Mất" : asset.status === "damaged" ? "Hư hỏng" : "Đang sử dụng",
      ]),
    )}

    <h3>Công nợ</h3>
    ${grid(
      ["Nội dung", "Số tiền", "Đã tất toán", "Còn lại", "Hạn", "Trạng thái"],
      data.debts.map((debt) => [
        debt.title,
        money(debt.amount),
        money(debt.settled_amount),
        money(Math.max(Number(debt.amount) - Number(debt.settled_amount ?? 0), 0)),
        day(debt.due_date),
        debt.status === "settled" ? "Đã tất toán" : debt.status === "cancelled" ? "Đã huỷ" : "Chưa tất toán",
      ]),
    )}

    <h3>Khen thưởng · Kỷ luật · Đào tạo</h3>
    ${grid(
      ["Loại", "Nội dung", "Ngày", "Giá trị"],
      [
        ...data.rewards.map((reward) => ["Khen thưởng", reward.title, day(reward.reward_date), money(reward.amount)] as (string | number)[]),
        ...data.discipline.map((item) => ["Kỷ luật", item.title, day(item.effective_date), "—"] as (string | number)[]),
        ...data.training.map((item) => ["Đào tạo", item.course_name, day(item.start_date), money(item.cost)] as (string | number)[]),
      ],
    )}

    ${signatures("Người lập hồ sơ", "Xác nhận của nhân sự")}
  `;

  return shell(
    data.companyName,
    `TY-${employee.code}`,
    "TRÍCH YẾU HỒ SƠ NHÂN SỰ",
    `${employee.full_name} · ${employee.code} · ${employee.department ?? ""}`,
    body,
  );
};


/* --------------------------- Insurance history --------------------------- */

export interface InsurancePeriodRow {
  insurance_number: string | null;
  start_date: string | null;
  end_date: string | null;
  salary_base: number | null;
  employee_rate: number | null;
  employer_rate: number | null;
  status: string;
  note: string | null;
}

const insuranceStatusLabel = (status: string) =>
  status === "active" ? "Đang đóng" : status === "paused" ? "Ngừng đóng" : "Đã chốt sổ";

export const buildInsuranceHistoryHtml = (
  employee: Pick<EmployeeRecord, "code" | "full_name" | "department" | "position">,
  periods: InsurancePeriodRow[],
  companyName: string,
) => {
  const active = periods.find((period) => period.status === "active") ?? null;

  const body = `
    ${kv([
      ["Họ và tên", employee.full_name],
      ["Mã nhân viên", employee.code],
      ["Phòng ban", employee.department ?? "—"],
      ["Chức danh", employee.position ?? "—"],
    ])}
    <h3>Quá trình đóng bảo hiểm xã hội</h3>
    ${grid(
      ["Số sổ BHXH", "Từ tháng", "Đến tháng", "Mức đóng", "NLĐ (%)", "DN (%)", "Trạng thái"],
      periods.map((period) => [
        period.insurance_number ?? "—",
        month(period.start_date),
        period.end_date ? month(period.end_date) : "nay",
        money(period.salary_base),
        period.employee_rate ?? "—",
        period.employer_rate ?? "—",
        insuranceStatusLabel(period.status),
      ]),
    )}
    <p class="muted"><strong>Tổng số giai đoạn:</strong> ${periods.length} · <strong>Mức đóng hiện tại:</strong> ${
      active ? money(active.salary_base) : "—"
    }</p>
    <p class="muted">Bảng kê này tổng hợp toàn bộ giai đoạn đóng bảo hiểm xã hội của người lao động tại công ty, dùng để đối chiếu với cơ quan bảo hiểm khi cần.</p>
    ${signatures("Đại diện Công ty", "Người lao động")}
  `;

  return shell(
    companyName,
    `BH-${employee.code}`,
    "BẢNG KÊ QUÁ TRÌNH ĐÓNG BHXH",
    `Nhân sự: ${employee.full_name} · ${employee.code}`,
    body,
  );
};
