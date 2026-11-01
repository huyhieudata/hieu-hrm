import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/** Supabase/PostgREST errors are plain objects, not Error instances. */
const COLUMN_LABELS: Record<string, string> = {
  name: "Tên",
  full_name: "Họ và tên",
  title: "Tiêu đề",
  priority: "Mức ưu tiên",
  status: "Trạng thái",
  email: "Email",
  phone: "Số điện thoại",
  company_id: "Công ty",
  employee_id: "Nhân sự",
  department: "Phòng ban",
  position: "Chức danh",
  start_date: "Ngày bắt đầu",
  end_date: "Ngày kết thúc",
  issue_date: "Ngày cấp",
  issued_date: "Ngày cấp",
  expiry_date: "Ngày hết hạn",
  year: "Năm",
  month: "Tháng",
  amount: "Số tiền",
  quantity: "Số lượng",
};

const CONSTRAINT_MESSAGES: Record<string, string> = {
  employee_certificates_dates: "Ngày hết hạn phải sau ngày cấp.",
};

/** Dịch lỗi thô của Postgres/PostgREST/mạng sang tiếng Việt; trả null nếu không nhận ra. */
export const translateDbError = (raw: string): string | null => {
  for (const [constraint, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (raw.includes(constraint)) return message;
  }
  const notNull = raw.match(/null value in column "([^"]+)"(?: of relation "[^"]+")? violates not-null constraint/i);
  if (notNull) return `Thiếu thông tin bắt buộc: ${COLUMN_LABELS[notNull[1]] ?? notNull[1]}.`;
  if (/duplicate key value violates unique constraint/i.test(raw)) return "Dữ liệu này đã tồn tại (bị trùng). Vui lòng kiểm tra lại.";
  if (/violates foreign key constraint/i.test(raw)) {
    return /update or delete/i.test(raw)
      ? "Không thể xoá/sửa vì dữ liệu đang được dùng ở nơi khác."
      : "Dữ liệu liên kết không tồn tại hoặc đã bị xoá.";
  }
  const check = raw.match(/violates check constraint "([^"]+)"/i);
  if (check) return `Giá trị không hợp lệ (ràng buộc ${check[1]}).`;
  if (/row-level security|permission denied/i.test(raw)) return "Bạn không có quyền thực hiện thao tác này.";
  if (/invalid input syntax for type/i.test(raw)) return "Giá trị nhập sai định dạng.";
  if (/value too long for type/i.test(raw)) return "Nội dung quá dài so với giới hạn cho phép.";
  if (/date\/time field value out of range|invalid input value for enum/i.test(raw)) return "Giá trị nhập không hợp lệ.";
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return "Mất kết nối mạng. Vui lòng kiểm tra Internet và thử lại.";
  if (/^timeout$|statement timeout|canceling statement/i.test(raw)) return "Máy chủ phản hồi quá lâu. Vui lòng thử lại.";
  return null;
};

export const getErrorMessage = (error: unknown, fallback = "Không lưu được dữ liệu."): string => {
  let raw = "";
  if (error instanceof Error && error.message) raw = error.message;
  else if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") raw = message.trim();
  } else if (typeof error === "string") raw = error.trim();
  if (!raw) return fallback;
  return translateDbError(raw) ?? raw;
};
