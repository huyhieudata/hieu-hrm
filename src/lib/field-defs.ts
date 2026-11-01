export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "month"
  | "datetime"
  | "textarea"
  | "select"
  | "multiselect"
  | "currency";

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  /** Select này phụ thuộc vào giá trị của field khác (ví dụ phòng ban → vị trí). */
  dependsOn?: string;
  optionsByValue?: Record<string, { value: string; label: string }[]>;
  /** Select: cho phép chọn "Khác" để nhập tay giá trị ngoài danh sách. */
  allowCustom?: boolean;
  /** Select: cho phép tạo mới ngay tại chỗ (vd "+ Tạo phòng ban mới…"). Trả về giá trị vừa tạo để tự chọn. */
  onCreate?: (input: { name: string; parentId: string | null }, values: Record<string, string>) => Promise<string>;
  createLabel?: string;
  /** Danh sách cha (vd phòng ban cha) hiện trong hộp thoại tạo mới. */
  createParentOptions?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** 2 = full width inside the two-column dialog grid. */
  span?: 1 | 2;
  section?: string;
  hint?: string;
  /** Trả về thông báo lỗi nếu giá trị (đã trim, khác rỗng) không hợp lệ. */
  validate?: (value: string, values: Record<string, string>) => string | null;
}

/** CCCD gắn chip: đúng 12 chữ số. */
export const validateNationalId = (value: string) =>
  /^\d{12}$/.test(value.trim()) ? null : "Số CCCD phải gồm đúng 12 chữ số.";

/** SĐT Việt Nam: 10 số bắt đầu bằng 0, hoặc +84 + 9 số (cho phép khoảng trắng, dấu chấm, gạch). */
export const validatePhone = (value: string) =>
  /^(0\d{9}|\+84\d{9})$/.test(value.replace(/[\s.-]/g, ""))
    ? null
    : "Số điện thoại không hợp lệ (10 số bắt đầu bằng 0, hoặc +84…).";

export const validateEmailAddress = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : "Email không hợp lệ. Ví dụ: ten@congty.vn";

/** MST cá nhân: 10 hoặc 13 chữ số (cho phép gạch nối 10-3). */
export const validateTaxCode = (value: string) =>
  /^(\d{10}|\d{13})$/.test(value.replace(/[-\s]/g, "")) ? null : "Mã số thuế phải gồm 10 hoặc 13 chữ số.";
