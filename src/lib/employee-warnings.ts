import { contractHealth, type EmployeeRecord } from "@/lib/employee-records";
import { onboardingProgress } from "@/lib/recruitment";

export const REQUIRED_DOCUMENT_CATEGORIES = [
  "contract",
  "identity",
  "degree",
  "certificate",
  "insurance",
  "medical",
  "other",
];

export interface EmployeeWarning {
  key: string;
  severity: "high" | "medium";
  title: string;
  description: string;
  /** Employee profile tab to open when the warning is clicked. */
  tab: "work" | "salary" | "personal" | "documents" | "onboarding";
}

export interface EmployeeWarningContext {
  employee: EmployeeRecord;
  contracts: { status: string; end_date: string | null }[];
  documentCategories: string[];
  onboarding: { status: string; checklist: { completed: boolean }[] | null } | null;
  canSensitive: boolean;
  /** Categories configured in Settings → Checklist hồ sơ (falls back to the defaults). */
  requiredCategories?: string[];
}

export const buildEmployeeWarnings = (context: EmployeeWarningContext): EmployeeWarning[] => {
  const { employee, contracts, documentCategories, onboarding, canSensitive } = context;
  const warnings: EmployeeWarning[] = [];

  if (employee.status !== "resigned") {
    const health = contractHealth(contracts);
    if (health.state !== "ok") {
      warnings.push({
        key: "contract",
        severity: health.tone === "destructive" ? "high" : "medium",
        title: health.label,
        description: "Bấm để mở mục quản lý hợp đồng và cập nhật gia hạn hoặc hợp đồng mới.",
        tab: "work",
      });
    }
  }

  const missingPayment = [
    !employee.bank_name && "ngân hàng",
    !employee.bank_account && "số tài khoản",
    !employee.tax_code && "mã số thuế",
  ].filter(Boolean) as string[];

  if (canSensitive && missingPayment.length > 0) {
    warnings.push({
      key: "payment",
      severity: "medium",
      title: "Thiếu thông tin thanh toán",
      description: `Chưa có ${missingPayment.join(", ")} — bổ sung để chuyển lương và kê khai thuế.`,
      tab: "salary",
    });
  }

  const missingProfile = [
    employee.phone,
    employee.work_email,
    employee.date_of_birth,
    employee.national_id,
    employee.department,
    employee.position,
    employee.hire_date,
    employee.current_address,
  ].filter((value) => !value || String(value).trim() === "").length;

  if (missingProfile > 0) {
    warnings.push({
      key: "profile",
      severity: "medium",
      title: `Hồ sơ còn thiếu ${missingProfile} thông tin cơ bản`,
      description: "Bổ sung điện thoại, ngày sinh, CCCD, phòng ban… để hoàn thiện hồ sơ.",
      tab: "personal",
    });
  }

  const required = context.requiredCategories?.length
    ? Array.from(new Set(context.requiredCategories))
    : REQUIRED_DOCUMENT_CATEGORIES;
  const categories = new Set(documentCategories);
  const documentsDone = required.filter((category) => categories.has(category)).length;

  if (canSensitive && documentsDone < required.length) {
    warnings.push({
      key: "documents",
      severity: "medium",
      title: `Giấy tờ hồ sơ mới đủ ${documentsDone}/${required.length}`,
      description: "Tải thêm tài liệu trong tab Tài liệu để hoàn tất checklist hồ sơ.",
      tab: "documents",
    });
  }

  if (canSensitive && employee.status !== "resigned") {
    if (!onboarding) {
      warnings.push({
        key: "onboarding",
        severity: "medium",
        title: "Chưa có bản ghi hội nhập",
        description: "Tạo bản ghi hội nhập để theo dõi checklist tiếp nhận nhân sự.",
        tab: "onboarding",
      });
    } else {
      const progress = onboardingProgress(onboarding);
      if (!progress.completed && onboarding.status !== "cancelled") {
        warnings.push({
          key: "onboarding",
          severity: "medium",
          title: `Hội nhập chưa hoàn thành (${progress.percent}%)`,
          description: `${progress.done}/${progress.total} đầu việc đã hoàn tất — bấm để tiếp tục.`,
          tab: "onboarding",
        });
      }
    }
  }

  return warnings;
};
