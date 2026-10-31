import type { FieldDef } from "@/lib/field-defs";
import { CANDIDATE_SOURCE_LABELS, MANUAL_CANDIDATE_STATUSES, type Campaign } from "@/lib/recruitment";

export const buildCandidateFields = (campaigns: Campaign[]): FieldDef[] => [
  { name: "full_name", label: "Họ và tên", required: true, span: 2, section: "Thông tin cá nhân" },
  { name: "email", label: "Email", type: "email", placeholder: "ungvien@email.com", section: "Thông tin cá nhân" },
  { name: "phone", label: "Số điện thoại", type: "tel", placeholder: "0901 234 567", section: "Thông tin cá nhân" },
  { name: "date_of_birth", label: "Ngày sinh", type: "date", section: "Thông tin cá nhân" },
  {
    name: "gender",
    label: "Giới tính",
    type: "select",
    options: [
      { value: "male", label: "Nam" },
      { value: "female", label: "Nữ" },
      { value: "other", label: "Khác" },
    ],
    section: "Thông tin cá nhân",
  },
  { name: "address", label: "Địa chỉ", type: "textarea", section: "Thông tin cá nhân" },

  {
    name: "campaign_id",
    label: "Chiến dịch",
    type: "select",
    options: campaigns.map((campaign) => ({ value: campaign.id, label: campaign.title })),
    section: "Vị trí ứng tuyển",
  },
  { name: "position_applied", label: "Vị trí", placeholder: "Backend Engineer", section: "Vị trí ứng tuyển" },
  {
    name: "source",
    label: "Nguồn",
    type: "select",
    options: Object.entries(CANDIDATE_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
    section: "Vị trí ứng tuyển",
  },
  {
    name: "experience_years",
    label: "Số năm kinh nghiệm",
    type: "number",
    placeholder: "3",
    section: "Vị trí ứng tuyển",
  },
  { name: "education", label: "Học vấn", placeholder: "Đại học Bách Khoa", section: "Vị trí ứng tuyển" },

  { name: "current_salary", label: "Lương hiện tại", type: "currency", section: "Lương mong muốn" },
  { name: "expected_salary", label: "Lương mong muốn", type: "currency", section: "Lương mong muốn" },

  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: MANUAL_CANDIDATE_STATUSES.map((item) => ({ value: item.value, label: item.label })),
    section: "Quy trình",
  },
  { name: "cv_url", label: "Liên kết CV", placeholder: "https://…", section: "Quy trình" },
  { name: "note", label: "Ghi chú", type: "textarea", section: "Quy trình" },
];

