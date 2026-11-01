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
  placeholder?: string;
  required?: boolean;
  /** 2 = full width inside the two-column dialog grid. */
  span?: 1 | 2;
  section?: string;
  hint?: string;
}
