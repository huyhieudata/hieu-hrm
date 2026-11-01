import { listDepartmentPositions, listDepartments } from "@/lib/settings";
import {
  createEmployee,
  listEmployees,
  type EmployeeRecord,
} from "@/lib/employee-records";

export interface EmployeeImportRow {
  code: string;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  work_email: string | null;
  department: string | null;
  position: string | null;
  concurrent_positions: string | null;
  hire_date: string | null;
  work_location: string | null;
  national_id: string | null;
  bank_name: string | null;
  bank_account: string | null;
  tax_code: string | null;
  notes: string | null;
}

export const IMPORT_COLUMNS: { key: keyof EmployeeImportRow; label: string }[] =
  [
    { key: "code", label: "Mã nhân viên" },
    { key: "full_name", label: "Họ và tên" },
    { key: "gender", label: "Giới tính" },
    { key: "date_of_birth", label: "Ngày sinh" },
    { key: "phone", label: "Số điện thoại" },
    { key: "work_email", label: "Email công việc" },
    { key: "department", label: "Phòng ban" },
    { key: "position", label: "Chức danh" },
    { key: "concurrent_positions", label: "Vị trí kiêm nhiệm" },
    { key: "hire_date", label: "Ngày vào làm" },
    { key: "work_location", label: "Địa điểm làm việc" },
    { key: "national_id", label: "Số CCCD" },
    { key: "bank_name", label: "Ngân hàng" },
    { key: "bank_account", label: "Số tài khoản" },
    { key: "tax_code", label: "Mã số thuế" },
    { key: "notes", label: "Ghi chú" },
  ];

const escapeCsv = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const downloadEmployeeTemplate = () => {
  const headers = IMPORT_COLUMNS.map((column) => column.label);
  const sample = [
    "NV-2001",
    "Nguyễn Văn Mẫu",
    "Nam",
    "1995-05-20",
    "0901 234 567",
    "mau.nguyen@congty.vn",
    "Kỹ thuật",
    "Backend Engineer",
    "",
    "2026-11-01",
    "Hà Nội",
    "001195005678",
    "Vietcombank",
    "0123456789",
    "8012345678",
    "Nhân sự mới",
  ];

  const content = `\ufeff${headers.map(escapeCsv).join(",")}\n${sample.map(escapeCsv).join(",")}\n`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mau-import-nhan-vien.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Minimal CSV parser that understands quoted fields and escaped quotes. */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((line) => line.some((cell) => cell.trim() !== ""));
};

const normalizeDate = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
};

const normalizeGender = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  if (["nam", "male", "m"].includes(normalized)) return "male";
  if (["nữ", "nu", "female", "f"].includes(normalized)) return "female";
  if (["khác", "khac", "other"].includes(normalized)) return "other";
  return null;
};

export const parseEmployeeFile = (
  text: string,
): { rows: EmployeeImportRow[]; error: string | null } => {
  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      rows: [],
      error:
        "Tệp không có dữ liệu (cần dòng tiêu đề và ít nhất 1 dòng nhân sự).",
    };
  }

  const header = table[0].map((cell) => cell.trim().replace(/^\ufeff/, ""));
  const indexOf = (label: string) => header.findIndex((cell) => cell === label);
  const required = ["Mã nhân viên", "Họ và tên"];
  const missing = required.filter((label) => indexOf(label) === -1);
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Thiếu cột bắt buộc: ${missing.join(", ")}. Hãy dùng file mẫu để đảm bảo đúng định dạng.`,
    };
  }

  const rows = table.slice(1).map((line) => {
    const get = (label: string) => {
      const index = indexOf(label);
      return index >= 0 ? (line[index] ?? "").trim() : "";
    };

    return {
      code: get("Mã nhân viên"),
      full_name: get("Họ và tên"),
      gender: normalizeGender(get("Giới tính")),
      date_of_birth: normalizeDate(get("Ngày sinh")),
      phone: get("Số điện thoại") || null,
      work_email: get("Email công việc") || null,
      department: get("Phòng ban") || null,
      position: get("Chức danh") || null,
      concurrent_positions: get("Vị trí kiêm nhiệm") || null,
      hire_date: normalizeDate(get("Ngày vào làm")),
      work_location: get("Địa điểm làm việc") || null,
      national_id: get("Số CCCD") || null,
      bank_name: get("Ngân hàng") || null,
      bank_account: get("Số tài khoản") || null,
      tax_code: get("Mã số thuế") || null,
      notes: get("Ghi chú") || null,
    } satisfies EmployeeImportRow;
  });

  return { rows, error: null };
};

export interface ImportResult {
  created: number;
  errors: { line: number; message: string }[];
  /** Dòng vẫn được tạo nhưng phòng ban/chức danh không khớp sơ đồ tổ chức. */
  warnings: { line: number; message: string }[];
}

export const importEmployees = async (
  companyId: string,
  rows: EmployeeImportRow[],
): Promise<ImportResult> => {
  const existing: EmployeeRecord[] = await listEmployees(companyId);
  const codes = new Set(
    existing.map((employee) => employee.code.toLowerCase()),
  );
  const emails = new Set(
    existing
      .map((employee) => (employee.work_email ?? "").trim().toLowerCase())
      .filter((email) => email.length > 0),
  );

  const errors: ImportResult["errors"] = [];
  const warnings: ImportResult["warnings"] = [];
  let created = 0;
  const [departments, positions] = await Promise.all([
    listDepartments(companyId).catch(() => []),
    listDepartmentPositions(companyId).catch(() => []),
  ]);
  const norm = (v: string | null) => (v ?? "").trim().toLowerCase();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 2;

    if (!row.code || !row.full_name) {
      errors.push({ line, message: "Thiếu mã nhân viên hoặc họ tên." });
      continue;
    }
    if (codes.has(row.code.toLowerCase())) {
      errors.push({
        line,
        message: `Mã ${row.code} đã tồn tại trong công ty.`,
      });
      continue;
    }
    if (row.work_email && emails.has(row.work_email.toLowerCase())) {
      errors.push({ line, message: `Email ${row.work_email} đã được dùng.` });
      continue;
    }

    // Khớp tên với sơ đồ tổ chức (không phân biệt hoa thường) → lưu đúng tên chuẩn.
    let department = row.department;
    let position = row.position;
    const dep = department
      ? departments.find((d) => norm(d.name) === norm(department))
      : undefined;
    if (department && !dep)
      warnings.push({
        line,
        message: `Phòng ban "${department}" không có trên sơ đồ tổ chức.`,
      });
    if (dep) department = dep.name;
    if (position) {
      const pos =
        positions.find(
          (p) =>
            norm(p.title) === norm(position) &&
            (!dep || p.department_id === dep.id),
        ) ?? null;
      if (pos) position = pos.title;
      else
        warnings.push({
          line,
          message: `Chức danh "${position}" không có trong ${dep ? `phòng ${dep.name}` : "sơ đồ tổ chức"}.`,
        });
    }

    try {
      await createEmployee({
        company_id: companyId,
        code: row.code,
        full_name: row.full_name,
        gender: row.gender,
        date_of_birth: row.date_of_birth,
        phone: row.phone,
        work_email: row.work_email,
        department,
        position,
        concurrent_positions: row.concurrent_positions,
        hire_date: row.hire_date,
        work_location: row.work_location,
        national_id: row.national_id,
        bank_name: row.bank_name,
        bank_account: row.bank_account,
        tax_code: row.tax_code,
        notes: row.notes,
        status: "active",
        employment_type: "full_time",
      });

      codes.add(row.code.toLowerCase());
      if (row.work_email) emails.add(row.work_email.toLowerCase());
      created += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không tạo được hồ sơ.";
      errors.push({ line, message });
    }
  }

  return { created, errors, warnings };
};
