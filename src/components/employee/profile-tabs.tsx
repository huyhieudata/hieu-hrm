import { useOrgStructure, withOrgFields } from "@/lib/use-org-structure";
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  GraduationCap,
  HeartPulse,
  Banknote,
  Laptop,
  PackageCheck,
  Users,
  Wallet,
} from "lucide-react";

import { RecordsTab } from "@/components/employee/records-tab";
import type { FieldDef } from "@/components/employee/field-dialog";
import { validateNationalId, validateTaxCode } from "@/lib/field-defs";
import { Badge } from "@/components/ui/badge";
import { currency } from "@/lib/format";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITION_LABELS,
  ASSET_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  DEBT_CATEGORY_LABELS,
  DEBT_STATUS_LABELS,
  INSURANCE_STATUS_LABELS,
  INSURANCE_TYPE_LABELS,
  REWARD_CATEGORY_LABELS,
  TRAINING_CATEGORY_LABELS,
  TRAINING_RESULT_LABELS,
  WORK_EVENT_LABELS,
  debtOutstanding,
  formatDate,
  formatMonth,
  toOptions,
  updateRecord,
  DEPENDENT_RELATION_LABELS,
  daysUntil,
  type AssetRecord,
  type CertificateRecord,
  type ContractRecord,
  type DebtRecord,
  type DependentRecord,
  type InsuranceRecord,
  type RewardRecord,
  type SalaryRecord,
  type TrainingRecord,
  type WorkHistoryRecord,
} from "@/lib/employee-records";
import { todayIso } from "@/lib/attendance";

interface TabProps {
  employeeId: string;
  canManage: boolean;
  onChanged?: () => void | Promise<void>;
}

const numberOrNull = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

/* ----------------------------- Work history ----------------------------- */

const workFields: FieldDef[] = [
  {
    name: "event_type",
    label: "Loại sự kiện",
    type: "select",
    options: toOptions(WORK_EVENT_LABELS),
    required: true,
    hint: "Nghỉ việc sẽ tự cập nhật trạng thái nhân sự và chấm dứt hợp đồng đang hiệu lực. Bổ nhiệm/điều chuyển tự cập nhật chức danh, phòng ban.",
  },
  {
    name: "start_date",
    label: "Từ ngày",
    type: "date",
    required: true,
    hint: "Tự động khớp ngày kết thúc của sự kiện trước (tiếp nhận/quay lại ↔ nghỉ việc).",
  },
  {
    name: "title",
    label: "Tiêu đề",
    required: true,
    span: 2,
    placeholder: "Bổ nhiệm Trưởng phòng Kỹ thuật",
  },
  { name: "department", label: "Phòng ban", type: "select", required: true },
  {
    name: "position",
    label: "Chức danh",
    placeholder: "Trưởng phòng",
    required: true,
  },
  { name: "location", label: "Địa điểm", placeholder: "Hà Nội" },
  { name: "end_date", label: "Đến ngày", type: "date" },
  { name: "decision_no", label: "Số quyết định", placeholder: "QĐ-2026/014" },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const WorkHistoryTab = ({
  employeeId,
  canManage,
  onChanged,
}: TabProps) => {
  const org = useOrgStructure();
  return (
    <RecordsTab<WorkHistoryRecord>
      table="employee_work_history"
      employeeId={employeeId}
      title="Quá trình công tác"
      icon={BriefcaseBusiness}
      addLabel="Thêm mốc công tác"
      emptyText="Chưa có mốc công tác nào được ghi nhận."
      canManage={canManage}
      orderColumn="start_date"
      columns={[
        {
          key: "title",
          label: "Sự kiện",
          render: (row) => (
            <div>
              <p className="font-medium text-foreground">{row.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {WORK_EVENT_LABELS[row.event_type] ?? row.event_type} ·{" "}
                {formatDate(row.start_date)}
                {row.end_date ? ` → ${formatDate(row.end_date)}` : " → nay"}
              </p>
            </div>
          ),
        },
        {
          key: "department",
          label: "Phòng ban",
          width: "140px",
          render: (row) => row.department ?? "—",
        },
        {
          key: "decision_no",
          label: "Quyết định",
          width: "120px",
          render: (row) => row.decision_no ?? "—",
        },
      ]}
      fields={withOrgFields(workFields, org)}
      initialForEdit={(row) => ({
        event_type: row.event_type,
        title: row.title,
        department: row.department,
        position: row.position,
        location: row.location,
        start_date: row.start_date,
        end_date: row.end_date,
        decision_no: row.decision_no,
        note: row.note,
      })}
      createDefaults={{ event_type: "transfer" }}
      rowKeyText={(row) => row.title}
      onChanged={onChanged}
    />
  );
};

/* ------------------------------ Contracts ------------------------------- */

const contractFields: FieldDef[] = [
  { name: "contract_no", label: "Số hợp đồng", placeholder: "HĐLĐ-2026/032" },
  {
    name: "contract_type",
    label: "Loại hợp đồng",
    type: "select",
    options: toOptions(CONTRACT_TYPE_LABELS),
    required: true,
  },
  { name: "start_date", label: "Ngày bắt đầu", type: "date", required: true },
  { name: "end_date", label: "Ngày kết thúc", type: "date", hint: "Bỏ trống nếu không xác định thời hạn." },
  { name: "department", label: "Phòng ban", type: "select" },
  { name: "position", label: "Chức danh" },
  { name: "work_location", label: "Địa điểm làm việc", span: 2 },
  {
    name: "base_salary",
    label: "Lương cơ bản",
    type: "currency",
    section: "Điều khoản lương",
    placeholder: "15000000",
  },
  {
    name: "allowance",
    label: "Phụ cấp ăn ca",
    type: "currency",
    section: "Điều khoản lương",
    placeholder: "2000000",
  },
  {
    name: "insurance_salary",
    label: "Mức lương đóng BHXH",
    type: "currency",
    section: "Điều khoản lương",
    placeholder: "18000000",
    hint: "Dùng để tự điền mức đóng khi thêm giai đoạn bảo hiểm mới.",
  },
  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: toOptions(CONTRACT_STATUS_LABELS),
    section: "Trạng thái",
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const ContractsTab = ({ employeeId, canManage }: TabProps) => {
  const org = useOrgStructure();
  return (
    <RecordsTab<ContractRecord>
      table="employee_contracts"
      employeeId={employeeId}
      title="Hợp đồng lao động"
      icon={BadgeCheck}
      addLabel="Thêm hợp đồng"
      emptyText="Chưa có hợp đồng nào trong hồ sơ."
      canManage={canManage}
      orderColumn="start_date"
      columns={[
        {
          key: "contract_type",
          label: "Hợp đồng",
          render: (row) => (
            <div>
              <p className="font-medium text-foreground">
                {CONTRACT_TYPE_LABELS[row.contract_type] ?? row.contract_type}
                {row.contract_no ? ` · ${row.contract_no}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(row.start_date)} →{" "}
                {row.end_date ? formatDate(row.end_date) : "không thời hạn"}
              </p>
            </div>
          ),
        },
        {
          key: "salary",
          label: "Lương",
          width: "140px",
          render: (row) =>
            row.base_salary ? currency(Number(row.base_salary), true) : "—",
        },
        {
          key: "status",
          label: "Trạng thái",
          width: "120px",
          render: (row) => (
            <Badge
              variant={
                row.status === "active"
                  ? "success"
                  : row.status === "expired"
                    ? "warning"
                    : "muted"
              }
            >
              {CONTRACT_STATUS_LABELS[row.status] ?? row.status}
            </Badge>
          ),
        },
      ]}
      fields={withOrgFields(contractFields, org)}
      initialForEdit={(row) => ({
        contract_no: row.contract_no,
        contract_type: row.contract_type,
        start_date: row.start_date,
        end_date: row.end_date,
        department: row.department,
        position: row.position,
        work_location: row.work_location ?? "",
        base_salary: numberOrNull(row.base_salary),
        allowance: numberOrNull(row.allowance),
        insurance_salary: numberOrNull(row.insurance_salary),
        status: row.status,
        note: row.note,
      })}
      createDefaults={{ contract_type: "fixed_term", status: "active" }}
      rowKeyText={(row) =>
        row.contract_no ?? CONTRACT_TYPE_LABELS[row.contract_type] ?? "Hợp đồng"
      }
    />
  );
};

/* -------------------------------- Salary -------------------------------- */

const salaryFields: FieldDef[] = [
  {
    name: "effective_date",
    label: "Ngày hiệu lực",
    type: "date",
    required: true,
    hint: "Tự động khớp ngày kết thúc của mức lương trước; mức lương trước sẽ kết thúc đúng ngày này.",
  },
  { name: "decision_no", label: "Số quyết định", placeholder: "QĐ-2026/021" },
  {
    name: "base_salary",
    label: "Lương cơ bản",
    type: "currency",
    required: true,
    placeholder: "18000000",
  },
  {
    name: "insurance_salary",
    label: "Lương đóng BH",
    type: "currency",
    placeholder: "18000000",
  },
  {
    name: "position_allowance",
    label: "Phụ cấp chức vụ",
    type: "currency",
    placeholder: "0",
  },
  {
    name: "responsibility_allowance",
    label: "Phụ cấp trách nhiệm",
    type: "currency",
    placeholder: "0",
  },
  {
    name: "other_allowance",
    label: "Phụ cấp ăn ca",
    type: "currency",
    placeholder: "0",
  },
  {
    name: "kpi_bonus",
    label: "Thưởng KPI",
    type: "currency",
    placeholder: "0",
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const SalaryTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<SalaryRecord>
    table="employee_salary_records"
    employeeId={employeeId}
    title="Lịch sử lương"
    icon={Wallet}
    addLabel="Thêm mức lương"
    emptyText="Chưa có dữ liệu lương. Hãy thêm mức lương đầu tiên."
    canManage={canManage}
    orderColumn="effective_date"
    columns={[
      {
        key: "effective_date",
        label: "Mức lương",
        render: (row) => {
          const total =
            Number(row.base_salary) +
            Number(row.position_allowance ?? 0) +
            Number(row.responsibility_allowance ?? 0) +
            Number(row.other_allowance ?? 0) +
            Number(row.kpi_bonus ?? 0);
          return (
            <div>
              <p className="font-medium text-foreground">
                {currency(total)} / tháng
              </p>
              <p className="text-[11px] text-muted-foreground">
                Hiệu lực {formatDate(row.effective_date)} →{" "}
                {row.end_date ? formatDate(row.end_date) : "nay"}
                {row.decision_no ? ` · ${row.decision_no}` : ""}
              </p>
            </div>
          );
        },
      },
      {
        key: "base_salary",
        label: "Lương cơ bản",
        width: "132px",
        render: (row) => currency(Number(row.base_salary), true),
      },
      {
        key: "insurance_salary",
        label: "Lương đóng BH",
        width: "132px",
        render: (row) =>
          row.insurance_salary
            ? currency(Number(row.insurance_salary), true)
            : "—",
      },
    ]}
    fields={salaryFields}
    initialForEdit={(row) => ({
      effective_date: row.effective_date,
      decision_no: row.decision_no,
      base_salary: numberOrNull(row.base_salary),
      insurance_salary: numberOrNull(row.insurance_salary),
      position_allowance: numberOrNull(row.position_allowance),
      responsibility_allowance: numberOrNull(row.responsibility_allowance),
      other_allowance: numberOrNull(row.other_allowance),
      kpi_bonus: numberOrNull(row.kpi_bonus),
      note: row.note,
    })}
    rowKeyText={(row) => `Mức lương ${formatDate(row.effective_date)}`}
  />
);

/* ------------------------------- Insurance ------------------------------ */

const insuranceFields: FieldDef[] = [
  {
    name: "insurance_type",
    label: "Loại bảo hiểm",
    type: "select",
    options: toOptions(INSURANCE_TYPE_LABELS),
    required: true,
  },
  {
    name: "insurance_number",
    label: "Số sổ / mã",
    required: true,
    placeholder: "0123456789",
    hint: "Bắt buộc ở giai đoạn đầu; các giai đoạn sau tự đồng bộ số sổ của giai đoạn trước.",
  },
  { name: "start_date", label: "Từ tháng", type: "month", required: true },
  { name: "end_date", label: "Đến tháng", type: "month" },
  {
    name: "salary_base",
    label: "Mức lương đóng",
    type: "currency",
    placeholder: "18000000",
  },
  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: toOptions(INSURANCE_STATUS_LABELS),
  },
  {
    name: "employee_rate",
    label: "Tỷ lệ NLĐ đóng (%)",
    type: "number",
    placeholder: "8",
  },
  {
    name: "employer_rate",
    label: "Tỷ lệ DN đóng (%)",
    type: "number",
    placeholder: "17.5",
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const InsuranceTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<InsuranceRecord>
    table="employee_insurance_records"
    employeeId={employeeId}
    title="Lịch sử bảo hiểm"
    description="Mỗi loại bảo hiểm chỉ có một giai đoạn đang mở — chốt sổ giai đoạn trước để tạo giai đoạn mới"
    icon={HeartPulse}
    addLabel="Thêm giai đoạn"
    emptyText="Chưa có giai đoạn đóng bảo hiểm nào."
    canManage={canManage}
    orderColumn="start_date"
    columns={[
      {
        key: "insurance_type",
        label: "Bảo hiểm",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">
              {INSURANCE_TYPE_LABELS[row.insurance_type] ?? row.insurance_type}
              {row.insurance_number ? ` · ${row.insurance_number}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Từ {formatMonth(row.start_date)} →{" "}
              {row.end_date ? formatMonth(row.end_date) : "nay"}
            </p>
          </div>
        ),
      },
      {
        key: "salary_base",
        label: "Mức đóng",
        width: "132px",
        render: (row) =>
          row.salary_base ? currency(Number(row.salary_base), true) : "—",
      },
      {
        key: "status",
        label: "Trạng thái",
        width: "110px",
        render: (row) => (
          <Badge
            variant={
              row.status === "active"
                ? "success"
                : row.status === "paused"
                  ? "warning"
                  : "muted"
            }
          >
            {INSURANCE_STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        ),
      },
    ]}
    fields={insuranceFields}
    initialForEdit={(row) => ({
      insurance_type: row.insurance_type,
      insurance_number: row.insurance_number,
      start_date: row.start_date,
      end_date: row.end_date,
      salary_base: numberOrNull(row.salary_base),
      status: row.status,
      employee_rate: numberOrNull(row.employee_rate),
      employer_rate: numberOrNull(row.employer_rate),
      note: row.note,
    })}
    createDefaults={{
      insurance_type: "social",
      status: "active",
      employee_rate: "8",
      employer_rate: "17.5",
    }}
    rowKeyText={(row) =>
      INSURANCE_TYPE_LABELS[row.insurance_type] ?? "Bảo hiểm"
    }
  />
);

/* -------------------------------- Rewards ------------------------------- */

const rewardFields: FieldDef[] = [
  {
    name: "title",
    label: "Nội dung",
    required: true,
    span: 2,
    placeholder: "Nhân viên xuất sắc quý III",
  },
  {
    name: "category",
    label: "Hình thức",
    type: "select",
    options: toOptions(REWARD_CATEGORY_LABELS),
    required: true,
  },
  {
    name: "reward_date",
    label: "Ngày khen thưởng",
    type: "date",
    required: true,
  },
  {
    name: "amount",
    label: "Mức thưởng",
    type: "currency",
    placeholder: "3000000",
  },
  { name: "decision_no", label: "Số quyết định", placeholder: "QĐ-2026/045" },
  { name: "description", label: "Mô tả", type: "textarea" },
];

export const RewardsTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<RewardRecord>
    table="employee_rewards"
    employeeId={employeeId}
    title="Khen thưởng"
    icon={Award}
    addLabel="Thêm khen thưởng"
    emptyText="Chưa có khen thưởng nào."
    canManage={canManage}
    orderColumn="reward_date"
    columns={[
      {
        key: "title",
        label: "Khen thưởng",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(row.reward_date)}
              {row.decision_no ? ` · ${row.decision_no}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "category",
        label: "Hình thức",
        width: "130px",
        render: (row) => (
          <Badge variant="success">
            {REWARD_CATEGORY_LABELS[row.category] ?? row.category}
          </Badge>
        ),
      },
      {
        key: "amount",
        label: "Giá trị",
        width: "120px",
        render: (row) =>
          row.amount ? currency(Number(row.amount), true) : "—",
      },
    ]}
    fields={rewardFields}
    initialForEdit={(row) => ({
      title: row.title,
      category: row.category,
      reward_date: row.reward_date,
      amount: numberOrNull(row.amount),
      decision_no: row.decision_no,
      description: row.description,
    })}
    createDefaults={{ category: "bonus" }}
    rowKeyText={(row) => row.title}
  />
);

/* -------------------------------- Training ------------------------------ */

const trainingFields: FieldDef[] = [
  {
    name: "course_name",
    label: "Khoá đào tạo",
    required: true,
    span: 2,
    placeholder: "Kỹ năng quản lý đội ngũ",
  },
  {
    name: "provider",
    label: "Đơn vị đào tạo",
    placeholder: "Trung tâm đào tạo",
  },
  {
    name: "category",
    label: "Loại",
    type: "select",
    options: toOptions(TRAINING_CATEGORY_LABELS),
  },
  { name: "start_date", label: "Bắt đầu", type: "date" },
  { name: "end_date", label: "Kết thúc", type: "date" },
  { name: "cost", label: "Chi phí", type: "currency", placeholder: "2500000" },
  {
    name: "result",
    label: "Kết quả",
    type: "select",
    options: toOptions(TRAINING_RESULT_LABELS),
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const TrainingTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<TrainingRecord>
    table="employee_training_records"
    employeeId={employeeId}
    title="Đào tạo & phát triển"
    icon={GraduationCap}
    addLabel="Thêm khoá đào tạo"
    emptyText="Chưa có khoá đào tạo nào."
    canManage={canManage}
    orderColumn="start_date"
    columns={[
      {
        key: "course_name",
        label: "Khoá đào tạo",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.course_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.provider ?? "—"} · {formatDate(row.start_date)} →{" "}
              {formatDate(row.end_date)}
            </p>
          </div>
        ),
      },
      {
        key: "category",
        label: "Loại",
        width: "140px",
        render: (row) => (
          <Badge variant="subtle">
            {TRAINING_CATEGORY_LABELS[row.category] ?? row.category}
          </Badge>
        ),
      },
      {
        key: "result",
        label: "Kết quả",
        width: "120px",
        render: (row) => (
          <Badge
            variant={
              row.result === "passed"
                ? "success"
                : row.result === "failed"
                  ? "destructive"
                  : row.result === "cancelled"
                    ? "muted"
                    : "info"
            }
          >
            {TRAINING_RESULT_LABELS[row.result ?? "in_progress"] ?? row.result}
          </Badge>
        ),
      },
    ]}
    fields={trainingFields}
    initialForEdit={(row) => ({
      course_name: row.course_name,
      provider: row.provider,
      category: row.category,
      start_date: row.start_date,
      end_date: row.end_date,
      cost: numberOrNull(row.cost),
      result: row.result,
      note: row.note,
    })}
    createDefaults={{ category: "internal", result: "in_progress" }}
    rowKeyText={(row) => row.course_name}
  />
);

/* ------------------------------ Certificates ----------------------------- */

const certificateFields: FieldDef[] = [
  { name: "name", label: "Tên chứng chỉ", required: true, span: 2, placeholder: "Chứng chỉ An toàn lao động nhóm 3" },
  { name: "issuer", label: "Đơn vị cấp" },
  { name: "certificate_no", label: "Số hiệu" },
  { name: "issue_date", label: "Ngày cấp", type: "date" },
  { name: "expiry_date", label: "Ngày hết hạn", type: "date", hint: "Bỏ trống nếu không thời hạn." },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const CertificatesTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<CertificateRecord>
    table="employee_certificates"
    employeeId={employeeId}
    title="Chứng chỉ & giấy phép hành nghề"
    icon={Award}
    addLabel="Thêm chứng chỉ"
    emptyText="Chưa có chứng chỉ nào."
    canManage={canManage}
    orderColumn="expiry_date"
    columns={[
      {
        key: "name",
        label: "Chứng chỉ",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {[row.issuer, row.certificate_no].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ),
      },
      {
        key: "expiry_date",
        label: "Hiệu lực",
        width: "170px",
        render: (row) => {
          const days = daysUntil(row.expiry_date);
          return (
            <div className="text-[11.5px]">
              <p>{formatDate(row.issue_date)} → {row.expiry_date ? formatDate(row.expiry_date) : "không thời hạn"}</p>
              {days !== null && days < 0 && <Badge variant="destructive">Đã hết hạn</Badge>}
              {days !== null && days >= 0 && days <= 30 && <Badge variant="warning">Còn {days} ngày</Badge>}
            </div>
          );
        },
      },
    ]}
    fields={certificateFields}
    initialForEdit={(row) => ({
      name: row.name,
      issuer: row.issuer,
      certificate_no: row.certificate_no,
      issue_date: row.issue_date,
      expiry_date: row.expiry_date,
      note: row.note,
    })}
    rowKeyText={(row) => row.name}
  />
);

/* --------------------------------- Assets ------------------------------- */

const assetFields: FieldDef[] = [
  {
    name: "name",
    label: "Tên tài sản",
    required: true,
    span: 2,
    placeholder: 'MacBook Pro 14" M3',
  },
  { name: "asset_code", label: "Mã tài sản", placeholder: "TS-2026-014" },
  {
    name: "category",
    label: "Loại tài sản",
    type: "select",
    options: toOptions(ASSET_CATEGORY_LABELS),
    required: true,
  },
  { name: "serial_number", label: "Số serial", placeholder: "C02XK1ABCD" },
  {
    name: "value",
    label: "Giá trị",
    type: "currency",
    placeholder: "45000000",
  },
  {
    name: "assigned_date",
    label: "Ngày bàn giao",
    type: "date",
    required: true,
  },
  { name: "return_date", label: "Ngày thu hồi", type: "date" },
  {
    name: "condition",
    label: "Tình trạng",
    type: "select",
    options: toOptions(ASSET_CONDITION_LABELS),
  },
  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: toOptions(ASSET_STATUS_LABELS),
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const AssetsTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<AssetRecord>
    table="employee_assets"
    employeeId={employeeId}
    title="Tài sản bàn giao"
    icon={Laptop}
    addLabel="Bàn giao tài sản"
    emptyText="Chưa có tài sản nào được bàn giao cho nhân viên này."
    canManage={canManage}
    orderColumn="assigned_date"
    columns={[
      {
        key: "name",
        label: "Tài sản",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">
              {row.name}
              {row.asset_code ? ` · ${row.asset_code}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.serial_number ? `SN ${row.serial_number} · ` : ""}
              {ASSET_CONDITION_LABELS[row.condition] ?? row.condition} · Bàn
              giao {formatDate(row.assigned_date)}
            </p>
          </div>
        ),
      },
      {
        key: "category",
        label: "Loại",
        width: "150px",
        render: (row) => (
          <Badge variant="subtle">
            {ASSET_CATEGORY_LABELS[row.category] ?? row.category}
          </Badge>
        ),
      },
      {
        key: "status",
        label: "Trạng thái",
        width: "130px",
        render: (row) => (
          <Badge
            variant={
              row.status === "assigned"
                ? "success"
                : row.status === "returned"
                  ? "muted"
                  : row.status === "lost"
                    ? "destructive"
                    : "warning"
            }
          >
            {ASSET_STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        ),
      },
      {
        key: "value",
        label: "Giá trị",
        width: "120px",
        render: (row) => (row.value ? currency(Number(row.value), true) : "—"),
      },
    ]}
    fields={assetFields}
    initialForEdit={(row) => ({
      name: row.name,
      asset_code: row.asset_code,
      category: row.category,
      serial_number: row.serial_number,
      value: numberOrNull(row.value),
      assigned_date: row.assigned_date,
      return_date: row.return_date,
      condition: row.condition,
      status: row.status,
      note: row.note,
    })}
    createDefaults={{
      category: "laptop",
      condition: "new",
      status: "assigned",
    }}
    rowKeyText={(row) => row.name}
    quickAction={{
      label: "Thu hồi tài sản",
      icon: PackageCheck,
      isAvailable: (row) => row.status !== "returned",
      run: (row) =>
        updateRecord("employee_assets", row.id, {
          status: "returned",
          return_date: todayIso(),
        }),
      successMessage: "Đã thu hồi tài sản",
    }}
  />
);

/* --------------------------------- Debts -------------------------------- */

const debtFields: FieldDef[] = [
  {
    name: "title",
    label: "Nội dung công nợ",
    required: true,
    span: 2,
    placeholder: "Tạm ứng lương tháng 10/2026",
  },
  {
    name: "category",
    label: "Loại công nợ",
    type: "select",
    options: toOptions(DEBT_CATEGORY_LABELS),
    required: true,
  },
  {
    name: "amount",
    label: "Số tiền",
    type: "currency",
    required: true,
    placeholder: "5000000",
  },
  {
    name: "settled_amount",
    label: "Đã tất toán",
    type: "currency",
    placeholder: "0",
  },
  { name: "due_date", label: "Hạn tất toán", type: "date" },
  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: toOptions(DEBT_STATUS_LABELS),
  },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const DebtsTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<DebtRecord>
    table="employee_debts"
    employeeId={employeeId}
    title="Công nợ"
    icon={Banknote}
    addLabel="Thêm công nợ"
    emptyText="Nhân sự không có công nợ nào với công ty."
    canManage={canManage}
    orderColumn="created_at"
    columns={[
      {
        key: "title",
        label: "Công nợ",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {DEBT_CATEGORY_LABELS[row.category] ?? row.category}
              {row.due_date ? ` · hạn ${formatDate(row.due_date)}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "amount",
        label: "Số tiền",
        width: "132px",
        render: (row) => currency(Number(row.amount)),
      },
      {
        key: "outstanding",
        label: "Còn lại",
        width: "132px",
        render: (row) => (
          <span
            className={
              debtOutstanding(row) > 0
                ? "font-semibold text-warning"
                : "text-muted-foreground"
            }
          >
            {currency(debtOutstanding(row))}
          </span>
        ),
      },
      {
        key: "status",
        label: "Trạng thái",
        width: "130px",
        render: (row) => (
          <Badge
            variant={
              row.status === "settled"
                ? "success"
                : row.status === "cancelled"
                  ? "muted"
                  : "warning"
            }
          >
            {DEBT_STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        ),
      },
    ]}
    fields={debtFields}
    initialForEdit={(row) => ({
      title: row.title,
      category: row.category,
      amount: numberOrNull(row.amount),
      settled_amount: numberOrNull(row.settled_amount),
      due_date: row.due_date,
      status: row.status,
      note: row.note,
    })}
    createDefaults={{ category: "advance", status: "open", settled_amount: 0 }}
    rowKeyText={(row) => row.title}
    quickAction={{
      label: "Tất toán công nợ",
      icon: PackageCheck,
      isAvailable: (row) => row.status === "open" && debtOutstanding(row) > 0,
      run: (row) =>
        updateRecord("employee_debts", row.id, {
          status: "settled",
          settled_amount: Number(row.amount),
        }),
      successMessage: "Đã tất toán công nợ",
    }}
  />
);

/* ------------------------------ Dependents ------------------------------ */

const dependentFields: FieldDef[] = [
  {
    name: "full_name",
    label: "Họ và tên",
    required: true,
    span: 2,
    placeholder: "Nguyễn Minh Khoa",
  },
  {
    name: "relationship",
    label: "Quan hệ",
    type: "select",
    options: toOptions(DEPENDENT_RELATION_LABELS),
    required: true,
  },
  { name: "date_of_birth", label: "Ngày sinh", type: "date" },
  {
    name: "gender",
    label: "Giới tính",
    type: "select",
    options: [
      { value: "male", label: "Nam" },
      { value: "female", label: "Nữ" },
      { value: "other", label: "Khác" },
    ],
  },
  { name: "national_id", label: "Số CCCD / mã định danh", validate: validateNationalId },
  { name: "tax_code", label: "Mã số thuế", placeholder: "8012345678-001", validate: validateTaxCode },
  {
    name: "registered_for_deduction",
    label: "Đăng ký giảm trừ gia cảnh",
    type: "select",
    options: [
      { value: "true", label: "Có" },
      { value: "false", label: "Không" },
    ],
  },
  { name: "effective_from", label: "Hiệu lực từ", type: "date" },
  { name: "effective_to", label: "Hiệu lực đến", type: "date" },
  { name: "note", label: "Ghi chú", type: "textarea" },
];

export const DependentsTab = ({ employeeId, canManage }: TabProps) => (
  <RecordsTab<DependentRecord>
    table="employee_dependents"
    employeeId={employeeId}
    title="Người phụ thuộc"
    icon={Users}
    addLabel="Thêm người phụ thuộc"
    emptyText="Nhân sự chưa khai báo người phụ thuộc."
    canManage={canManage}
    orderColumn="created_at"
    columns={[
      {
        key: "full_name",
        label: "Người phụ thuộc",
        render: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.full_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {DEPENDENT_RELATION_LABELS[row.relationship] ?? row.relationship}
              {row.date_of_birth
                ? ` · sinh ${formatDate(row.date_of_birth)}`
                : ""}
            </p>
          </div>
        ),
      },
      {
        key: "registered_for_deduction",
        label: "Giảm trừ",
        width: "130px",
        render: (row) => (
          <Badge variant={row.registered_for_deduction ? "success" : "muted"}>
            {row.registered_for_deduction ? "Đã đăng ký" : "Không"}
          </Badge>
        ),
      },
      {
        key: "tax_code",
        label: "Mã số thuế",
        width: "140px",
        render: (row) => row.tax_code ?? "—",
      },
    ]}
    fields={dependentFields}
    initialForEdit={(row) => ({
      full_name: row.full_name,
      relationship: row.relationship,
      date_of_birth: row.date_of_birth,
      gender: row.gender,
      national_id: row.national_id,
      tax_code: row.tax_code,
      registered_for_deduction: row.registered_for_deduction ? "true" : "false",
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      note: row.note,
    })}
    createDefaults={{ relationship: "child", registered_for_deduction: "true" }}
    rowKeyText={(row) => row.full_name}
    quickAction={{
      label: "Bật / tắt giảm trừ",
      icon: Users,
      isAvailable: () => true,
      run: (row) =>
        updateRecord("employee_dependents", row.id, {
          registered_for_deduction: !row.registered_for_deduction,
        }),
      successMessage: "Đã cập nhật trạng thái giảm trừ",
    }}
  />
);
