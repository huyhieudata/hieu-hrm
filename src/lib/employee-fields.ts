import type { FieldDef } from "@/lib/field-defs";
import {
  DEPARTMENTS,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  JOB_LEVELS,
  MARITAL_LABELS,
  toOptions,
  type EmployeeRecord,
} from "@/lib/employee-records";

const selectOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

export const buildEmployeeFields = (
  colleagues: EmployeeRecord[],
  excludeId?: string,
  positionOptionsByDepartment?: Record<string, { value: string; label: string }[]>,
  departmentOptions?: string[],
): FieldDef[] => {
  const managerOptions = colleagues
    .filter((person) => person.id !== excludeId)
    .map((person) => ({ value: person.id, label: `${person.full_name} · ${person.code}` }));

  return [
    { name: "code", label: "Mã nhân viên", required: true, placeholder: "NV-1024", section: "Thông tin cơ bản" },
    { name: "full_name", label: "Họ và tên", required: true, placeholder: "Nguyễn Minh Anh", section: "Thông tin cơ bản" },
    {
      name: "gender",
      label: "Giới tính",
      type: "select",
      options: toOptions(GENDER_LABELS),
      section: "Thông tin cơ bản",
    },
    { name: "date_of_birth", label: "Ngày sinh", type: "date", section: "Thông tin cơ bản" },
    {
      name: "employment_type",
      label: "Hình thức làm việc",
      type: "select",
      options: toOptions(EMPLOYMENT_TYPE_LABELS),
      section: "Thông tin cơ bản",
    },
    { name: "phone", label: "Số điện thoại", type: "tel", required: true, placeholder: "0901 224 778", section: "Thông tin cơ bản" },
    { name: "work_email", label: "Email công việc", type: "email", required: true, placeholder: "nhanvien@congty.vn", section: "Thông tin cơ bản" },
    { name: "personal_email", label: "Email cá nhân", type: "email", section: "Thông tin cơ bản" },

    { name: "national_id", label: "Số CCCD / CMND", section: "Giấy tờ tuỳ thân" },
    { name: "national_id_issue_date", label: "Ngày cấp", type: "date", section: "Giấy tờ tuỳ thân" },
    { name: "national_id_issue_place", label: "Nơi cấp", section: "Giấy tờ tuỳ thân" },
    { name: "nationality", label: "Quốc tịch", placeholder: "Việt Nam", section: "Giấy tờ tuỳ thân" },
    {
      name: "marital_status",
      label: "Tình trạng hôn nhân",
      type: "select",
      options: toOptions(MARITAL_LABELS),
      section: "Giấy tờ tuỳ thân",
    },
    {
      name: "dependents_count",
      label: "Số người phụ thuộc",
      type: "number",
      placeholder: "0",
      section: "Giấy tờ tuỳ thân",
    },

    { name: "current_address", label: "Địa chỉ hiện tại", type: "textarea", section: "Địa chỉ liên hệ" },
    { name: "permanent_address", label: "Địa chỉ thường trú", type: "textarea", section: "Địa chỉ liên hệ" },

    {
      name: "department",
      label: "Phòng ban",
      type: "select",
      required: true,
      options: selectOptions(departmentOptions && departmentOptions.length > 0 ? departmentOptions : DEPARTMENTS),
      section: "Công việc",
    },
    {
      name: "position",
      label: "Chức danh",
      type: "select",
      required: true,
      dependsOn: "department",
      optionsByValue: positionOptionsByDepartment,
      options: (() => {
        const orgPositions = positionOptionsByDepartment
          ? Array.from(
              new Set<string>(
                Object.values(positionOptionsByDepartment)
                  .flat()
                  .map((option) => option.value),
              ),
            )
          : [];
        const fallback = orgPositions.length
          ? orgPositions
          : Array.from(
              new Set<string>(
                colleagues
                  .map((person) => person.position)
                  .filter((title): title is string => !!title),
              ),
            );
        return fallback.map((title) => ({ value: title, label: title }));
      })(),
      placeholder: "Chọn phòng ban trước",
      hint: "Danh sách vị trí hiển thị theo phòng ban đã chọn.",
      section: "Công việc",
    },
    { name: "job_level", label: "Cấp bậc", type: "select", options: selectOptions(JOB_LEVELS), section: "Công việc" },
    {
      name: "concurrent_positions",
      label: "Vị trí kiêm nhiệm",
      placeholder: "Trưởng phòng Kỹ thuật; Phụ trách an toàn thông tin",
      section: "Công việc",
      span: 2,
      hint: "Nhập một hoặc nhiều vị trí, cách nhau bằng dấu chấm phẩy.",
    },
    { name: "work_location", label: "Địa điểm làm việc", placeholder: "Hà Nội", section: "Công việc" },
    {
      name: "manager_id",
      label: "Quản lý trực tiếp",
      type: "select",
      options: managerOptions,
      section: "Công việc",
    },
    { name: "hire_date", label: "Ngày vào làm", type: "date", required: true, section: "Công việc" },
    { name: "probation_end_date", label: "Kết thúc thử việc", type: "date", section: "Công việc" },
    { name: "official_date", label: "Ngày chính thức", type: "date", section: "Công việc" },

    { name: "bank_name", label: "Ngân hàng", placeholder: "Vietcombank", section: "Lương & thanh toán" },
    { name: "bank_account", label: "Số tài khoản", section: "Lương & thanh toán" },
    { name: "bank_branch", label: "Chi nhánh", section: "Lương & thanh toán" },
    { name: "tax_code", label: "Mã số thuế TNCN", section: "Lương & thanh toán" },
    {
      name: "insurance_number",
      label: "Số sổ BHXH",
      placeholder: "0101001234",
      section: "Lương & thanh toán",
      hint: "Tự đồng bộ khi tạo giai đoạn bảo hiểm xã hội.",
    },

    {
      name: "education_level",
      label: "Trình độ học vấn",
      type: "select",
      options: selectOptions(EDUCATION_LEVELS),
      section: "Học vấn",
    },
    { name: "major", label: "Chuyên ngành", section: "Học vấn" },
    { name: "school", label: "Trường", section: "Học vấn" },

    { name: "emergency_contact_name", label: "Người liên hệ", section: "Liên hệ khẩn cấp" },
    { name: "emergency_contact_phone", label: "Số điện thoại", type: "tel", section: "Liên hệ khẩn cấp" },
    { name: "emergency_contact_relation", label: "Quan hệ", placeholder: "Vợ / Chồng", section: "Liên hệ khẩn cấp" },

    { name: "notes", label: "Ghi chú nội bộ", type: "textarea", section: "Khác" },
  ];
};
