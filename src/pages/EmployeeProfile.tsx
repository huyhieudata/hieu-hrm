import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AlertTriangle,
  MessageSquare,
  StickyNote,
  ArrowLeft,
  Award,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  FileText,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  History,
  IdCard,
  ClipboardList,
  Download,
  Laptop,
  Link2,
  ListChecks,
  Loader2,
  KeyRound,
  LayoutDashboard,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
  UserMinus,
  UserRound,
  Users,
  Camera,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog } from "@/components/employee/field-dialog";
import RequestsTab from "@/components/employee/requests-tab";
import PermissionsTab from "@/components/employee/permissions-tab";
import ContactsTab from "@/components/employee/contacts-tab";
import NotesTab from "@/components/employee/notes-tab";
import {
  ChangeRequestsReview,
  SensitiveAuditCard,
} from "@/components/employee/change-requests";
import { BankInfoCard } from "@/components/employee/bank-info-card";
import { OnboardingTab } from "@/components/employee/onboarding-tab";
import { ResignationDialog } from "@/components/employee/resignation-dialog";
import { AccountStatusBar } from "@/components/employee/account-dialog";
import { DisciplineTab } from "@/components/employee/discipline-tab";
import { DocumentsTab } from "@/components/employee/documents-tab";
import { EmployeeEvaluationsTab } from "@/components/employee/evaluations-tab";
import {
  AssetsTab,
  CertificatesTab,
  ContractsTab,
  DebtsTab,
  DependentsTab,
  InsuranceTab,
  RewardsTab,
  SalaryTab,
  TrainingTab,
  WorkHistoryTab,
} from "@/components/employee/profile-tabs";
import { ActivityTimeline } from "@/components/common/activity-timeline";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/common/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import {
  buildEmployeeWarnings,
  REQUIRED_DOCUMENT_CATEGORIES,
} from "@/lib/employee-warnings";
import {
  listDepartments,
  listDocumentChecklist,
  type DepartmentRecord,
} from "@/lib/settings";
import {
  buildAssetHandoverHtml,
  buildDebtConfirmationHtml,
  buildEmployeeSummaryHtml,
  downloadHtml,
  printHtml,
} from "@/lib/employee-documents";
import {
  listRows,
  onboardingProgress,
  type OnboardingRecord,
} from "@/lib/recruitment";
import { buildEmployeeFields } from "@/lib/employee-fields";
import { useOrgStructure, withOrgFields } from "@/lib/use-org-structure";
import {
  EMPLOYEE_STATUS_META,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  INSURANCE_TYPE_LABELS,
  MARITAL_LABELS,
  CONTRACT_TYPE_LABELS,
  contractHealth,
  countRecords,
  debtOutstanding,
  DEPENDENT_RELATION_LABELS,
  deleteEmployee,
  uploadEmployeeAvatar,
  fetchRecords,
  formatDate,
  getEmployee,
  listEmployees,
  updateEmployee,
  type AssetRecord,
  type ContractRecord,
  type DebtRecord,
  type DependentRecord,
  type DocumentRecord,
  type DisciplineRecord,
  type EmployeeRecord,
  type InsuranceRecord,
  type RewardRecord,
  type SalaryRecord,
  type TrainingRecord,
  type WorkHistoryRecord,
} from "@/lib/employee-records";
import { currency } from "@/lib/format";
import { isManagerial } from "@/lib/roles";
import { cn } from "@/lib/utils";

type TabId =
  | "overview"
  | "warnings"
  | "personal"
  | "work"
  | "onboarding"
  | "salary"
  | "insurance"
  | "rewards"
  | "training"
  | "evaluations"
  | "assets"
  | "debts"
  | "dependents"
  | "documents"
  | "requests"
  | "permissions"
  | "contacts"
  | "notes"
  | "history";

const tenure = (from: string | null, to: string | null) => {
  if (!from) return "—";
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const months = Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()),
  );
  if (months < 12) return `${months} tháng`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} năm ${rest} tháng` : `${years} năm`;
};

const InfoRow = ({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 break-words text-[12.5px] font-medium text-foreground">
      {value?.trim() || "—"}
    </p>
  </div>
);

const EditableInfoRow = ({
  label,
  field,
  employee,
  kind = "text",
  options,
  display,
  canEdit,
  onSaved,
}: {
  label: string;
  field: keyof EmployeeRecord;
  employee: EmployeeRecord;
  kind?: "text" | "date" | "number" | "email" | "tel" | "select";
  options?: { value: string; label: string }[];
  display?: (value: string | number | null | undefined) => string | null;
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const raw = employee[field] as string | number | null | undefined;
  const shown = display
    ? display(raw)
    : kind === "date"
      ? formatDate(raw as string | null)
      : raw;

  const start = () => {
    if (!canEdit) return;
    setDraft(
      raw == null
        ? ""
        : kind === "date"
          ? String(raw).slice(0, 10)
          : String(raw),
    );
    setEditing(true);
  };

  const save = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const next =
        value.trim() === "" ? null : kind === "number" ? Number(value) : value;
      await updateEmployee(employee.id, { [field]: next });
      toast.success("Đã cập nhật thông tin");
      setEditing(false);
      await onSaved();
    } catch (error) {
      toast.error("Không lưu được thông tin", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {kind === "select" ? (
          <select
            autoFocus
            value={draft}
            disabled={busy}
            onChange={(event) => {
              setDraft(event.target.value);
              void save(event.target.value);
            }}
            className="mt-1 h-8 w-full rounded-md border border-primary bg-card px-2 text-[12.5px] text-foreground outline-none focus:shadow-focus"
          >
            <option value="">—</option>
            {(options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={kind}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void save(draft)}
            onKeyDown={(event) => {
              if (event.key === "Enter")
                (event.target as HTMLInputElement).blur();
              if (event.key === "Escape") setEditing(false);
            }}
            className="mt-1 h-8 w-full rounded-md border border-primary bg-card px-2 text-[12.5px] text-foreground outline-none focus:shadow-focus"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-w-0 rounded-md",
        canEdit && "-mx-1 cursor-text px-1 py-0.5 hover:bg-muted/50",
      )}
      onDoubleClick={start}
      title={canEdit ? "Nháy đúp để sửa" : undefined}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[12.5px] font-medium text-foreground">
        {shown ?? "—"}
      </p>
    </div>
  );
};

const SectionCard = ({
  title,
  description,
  icon: Icon,
  onEdit,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Users;
  onEdit?: () => void;
  children: ReactNode;
}) => (
  <Card className="p-5 transition-shadow hover:shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-[11.5px] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-[11px]"
          aria-label={`Sửa ${title}`}
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" /> Sửa
        </Button>
      )}
    </div>
    <div className="mt-4">{children}</div>
  </Card>
);

const EmployeeProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeCompany, can, role, canManageModule } = useCompany();
  const org = useOrgStructure();
  const canInvite = role === "owner" || role === "admin" || role === "hr";
  const canManage = canManageModule("employees");
  const canManagePermissions =
    role === "owner" || role === "admin" || role === "hr";
  const canDelete = isManagerial(role);

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [colleagues, setColleagues] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [requiredDocCategories, setRequiredDocCategories] = useState<string[]>(
    REQUIRED_DOCUMENT_CATEGORIES,
  );
  const [summary, setSummary] = useState<{
    contract: ContractRecord | null;
    salary: SalaryRecord | null;
    insurance: InsuranceRecord[];
    contracts: ContractRecord[];
    dependents: DependentRecord[];
    documents: DocumentRecord[];
    onboarding: OnboardingRecord[];
    counts: Record<string, number>;
  }>({
    contract: null,
    salary: null,
    insurance: [],
    contracts: [],
    dependents: [],
    documents: [],
    onboarding: [],
    counts: {},
  });

  const canSensitive = canManage || employee?.user_id === user?.id;

  useEffect(() => {
    if (!activeCompany?.id) return;
    let active = true;
    void listDocumentChecklist(activeCompany.id)
      .then((rows) => {
        if (active && rows.length > 0) {
          setRequiredDocCategories(
            Array.from(new Set(rows.map((row) => row.category))),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeCompany?.id]);

  const warnings = employee
    ? buildEmployeeWarnings({
        employee,
        contracts: summary.contracts,
        documentCategories: summary.documents.map(
          (document) => document.category,
        ),
        onboarding: summary.onboarding[0] ?? null,
        canSensitive,
        requiredCategories: requiredDocCategories,
      })
    : [];

  const load = useCallback(async () => {
    if (!id || !activeCompany) return;
    setLoading(true);
    try {
      const [record, team, departmentRows] = await Promise.all([
        getEmployee(id),
        listEmployees(activeCompany.id),
        listDepartments(activeCompany.id).catch(() => []),
      ]);
      if (!record) {
        setNotFound(true);
        setEmployee(null);
        return;
      }
      setEmployee(record);
      setColleagues(team);
      setDepartments(departmentRows);
      setNotFound(false);
    } catch (loadError) {
      toast.error("Không tải được hồ sơ", {
        description: loadError instanceof Error ? loadError.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompany, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || !employee) return;
    let active = true;

    const loadSummary = async () => {
      try {
        const [
          contracts,
          salaries,
          insurance,
          work,
          rewards,
          discipline,
          training,
          assets,
          dependents,
          debts,
          documents,
          onboardingRows,
        ] = await Promise.all([
          fetchRecords<ContractRecord>(
            "employee_contracts",
            id,
            "start_date",
          ).catch(() => []),
          canSensitive
            ? fetchRecords<SalaryRecord>(
                "employee_salary_records",
                id,
                "effective_date",
              ).catch(() => [])
            : Promise.resolve([] as SalaryRecord[]),
          canSensitive
            ? fetchRecords<InsuranceRecord>(
                "employee_insurance_records",
                id,
                "start_date",
              ).catch(() => [])
            : Promise.resolve([] as InsuranceRecord[]),
          countRecords("employee_work_history", id).catch(() => 0),
          countRecords("employee_rewards", id).catch(() => 0),
          countRecords("employee_discipline_records", id).catch(() => 0),
          countRecords("employee_training_records", id).catch(() => 0),
          countRecords("employee_assets", id).catch(() => 0),
          fetchRecords<DependentRecord>(
            "employee_dependents",
            id,
            "created_at",
          ).catch(() => []),
          canSensitive
            ? fetchRecords<DebtRecord>("employee_debts", id, "due_date").catch(
                () => [] as DebtRecord[],
              )
            : Promise.resolve([] as DebtRecord[]),
          canSensitive
            ? fetchRecords<DocumentRecord>(
                "employee_documents",
                id,
                "created_at",
              ).catch(() => [] as DocumentRecord[])
            : Promise.resolve([] as DocumentRecord[]),
          listRows<OnboardingRecord>(
            "onboarding_records",
            activeCompany?.id ?? "",
            "created_at",
          ).catch(() => [] as OnboardingRecord[]),
        ]);

        if (!active) return;
        setSummary({
          contract: contracts[0] ?? null,
          salary: salaries[0] ?? null,
          insurance,
          contracts,
          dependents,
          documents,
          onboarding: onboardingRows.filter((row) => row.employee_id === id),
          counts: {
            work,
            rewards,
            discipline,
            training,
            assets,
            documents: documents.length,
            debts: debts.filter(
              (debt) => debt.status === "open" && debtOutstanding(debt) > 0,
            ).length,
          },
        });
      } catch (summaryError) {
        console.error(summaryError);
      }
    };

    void loadSummary();
    return () => {
      active = false;
    };
  }, [activeCompany?.id, canSensitive, employee, id]);

  const manager = useMemo(() => {
    if (!employee) return null;
    const department =
      departments.find((item) => item.name === employee.department) ?? null;
    let managerId = employee.manager_id;
    if (department) {
      const isDepartmentManager =
        department.manager_employee_id === employee.id;
      const parent = department.parent_id
        ? (departments.find((item) => item.id === department.parent_id) ?? null)
        : null;
      managerId =
        isDepartmentManager && parent?.manager_employee_id
          ? parent.manager_employee_id
          : (department.manager_employee_id ?? managerId);
    }
    return colleagues.find((person) => person.id === managerId) ?? null;
  }, [colleagues, departments, employee]);

  const tabBarRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: typeof Users }[] = [
      { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
      {
        id: "warnings",
        label:
          warnings.length > 0 ? `Cảnh báo (${warnings.length})` : "Cảnh báo",
        icon: AlertTriangle,
      },
      { id: "personal", label: "Thông tin cá nhân", icon: UserRound },
      { id: "dependents", label: "Người phụ thuộc", icon: Users },
      { id: "contacts", label: "Lịch sử trao đổi", icon: MessageSquare },
      { id: "notes", label: "Ghi chú", icon: StickyNote },
      { id: "work", label: "Công tác & hợp đồng", icon: BriefcaseBusiness },
      { id: "requests", label: "Đơn từ", icon: FileText },
    ];
    if (canSensitive) {
      list.push({ id: "onboarding", label: "Hội nhập", icon: ListChecks });
      list.push({ id: "salary", label: "Lương & phúc lợi", icon: Wallet });
      list.push({ id: "insurance", label: "Bảo hiểm", icon: HeartPulse });
    }
    list.push({ id: "rewards", label: "Khen thưởng & kỷ luật", icon: Award });
    list.push({ id: "training", label: "Đào tạo & chứng chỉ", icon: GraduationCap });
    list.push({ id: "evaluations", label: "Đánh giá", icon: ClipboardCheck });
    list.push({ id: "assets", label: "Tài sản", icon: Laptop });
    if (canSensitive)
      list.push({ id: "permissions", label: "Phân quyền", icon: KeyRound });
    if (canSensitive)
      list.push({ id: "debts", label: "Công nợ", icon: Banknote });
    if (canSensitive)
      list.push({ id: "documents", label: "Tài liệu", icon: FolderOpen });
    list.push({ id: "history", label: "Lịch sử", icon: History });
    return list;
  }, [canSensitive, warnings.length]);

  useEffect(() => {
    const container = tabBarRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [tab]);

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file || !employee || !activeCompany) return;
    setAvatarBusy(true);
    try {
      const url = await uploadEmployeeAvatar({
        companyId: activeCompany.id,
        employeeId: employee.id,
        file,
      });
      await updateEmployee(employee.id, { avatar_url: url });
      toast.success("Đã cập nhật ảnh hồ sơ");
      await load();
    } catch (uploadError) {
      toast.error("Không tải được ảnh hồ sơ", {
        description:
          uploadError instanceof Error ? uploadError.message : undefined,
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    setRemoving(true);
    try {
      await deleteEmployee(employee.id);
      toast.success("Đã xoá hồ sơ nhân viên", {
        description: `${employee.full_name} cùng toàn bộ dữ liệu liên quan đã được xoá.`,
      });
      navigate("/employees");
    } catch (deleteError) {
      toast.error("Không xoá được hồ sơ", {
        description:
          deleteError instanceof Error ? deleteError.message : undefined,
      });
    } finally {
      setRemoving(false);
      setRemoveOpen(false);
    }
  };

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab && tabs.some((item) => item.id === requestedTab)) {
      setTab(requestedTab as TabId);
    }
    if (searchParams.get("section") === "contracts") {
      window.setTimeout(() => {
        document
          .getElementById("contracts")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [searchParams, tabs]);


  const loadDocumentData = async () => {
    if (!employee || !activeCompany) return null;
    const [
      contracts,
      salaries,
      insurance,
      workHistory,
      onboardingRows,
      assets,
      debts,
      dependents,
      rewards,
      discipline,
      training,
      documents,
    ] = await Promise.all([
      fetchRecords<ContractRecord>(
        "employee_contracts",
        employee.id,
        "start_date",
      ).catch(() => []),
      fetchRecords<SalaryRecord>(
        "employee_salary_records",
        employee.id,
        "effective_date",
      ).catch(() => []),
      fetchRecords<InsuranceRecord>(
        "employee_insurance_records",
        employee.id,
        "start_date",
      ).catch(() => []),
      fetchRecords<WorkHistoryRecord>(
        "employee_work_history",
        employee.id,
        "start_date",
      ).catch(() => []),
      listRows<OnboardingRecord>(
        "onboarding_records",
        activeCompany.id,
        "created_at",
      ).catch(() => []),
      fetchRecords<AssetRecord>(
        "employee_assets",
        employee.id,
        "assigned_date",
      ).catch(() => []),
      fetchRecords<DebtRecord>("employee_debts", employee.id, "due_date").catch(
        () => [],
      ),
      fetchRecords<DependentRecord>(
        "employee_dependents",
        employee.id,
        "created_at",
      ).catch(() => []),
      fetchRecords<RewardRecord>(
        "employee_rewards",
        employee.id,
        "reward_date",
      ).catch(() => []),
      fetchRecords<DisciplineRecord>(
        "employee_discipline_records",
        employee.id,
        "effective_date",
      ).catch(() => []),
      fetchRecords<TrainingRecord>(
        "employee_training_records",
        employee.id,
        "start_date",
      ).catch(() => []),
      fetchRecords<DocumentRecord>(
        "employee_documents",
        employee.id,
        "created_at",
      ).catch(() => []),
    ]);

    return {
      employee,
      contracts,
      salaries,
      insurance,
      workHistory,
      onboarding: onboardingRows.filter(
        (row) => row.employee_id === employee.id,
      ),
      assets,
      debts,
      dependents,
      rewards,
      discipline,
      training,
      documents,
      companyName: activeCompany.name,
    };
  };

  const handlePrintSummary = async () => {
    const data = await loadDocumentData();
    if (data) printHtml(buildEmployeeSummaryHtml(data));
  };

  const handleDownloadSummary = async () => {
    const data = await loadDocumentData();
    if (data) {
      downloadHtml(
        buildEmployeeSummaryHtml(data),
        `trich-yeu-ho-so-${employee.code.toLowerCase()}`,
      );
    }
  };

  const handlePrintAssets = async () => {
    if (!employee || !activeCompany) return;
    const assets = await fetchRecords<AssetRecord>(
      "employee_assets",
      employee.id,
      "assigned_date",
    );
    printHtml(buildAssetHandoverHtml(employee, assets, activeCompany.name));
  };

  const handleDownloadAssets = async () => {
    if (!employee || !activeCompany) return;
    const assets = await fetchRecords<AssetRecord>(
      "employee_assets",
      employee.id,
      "assigned_date",
    );
    downloadHtml(
      buildAssetHandoverHtml(employee, assets, activeCompany.name),
      `bien-ban-ban-giao-${employee.code.toLowerCase()}`,
    );
  };

  const handlePrintDebts = async () => {
    if (!employee || !activeCompany) return;
    const debts = await fetchRecords<DebtRecord>(
      "employee_debts",
      employee.id,
      "due_date",
    );
    printHtml(buildDebtConfirmationHtml(employee, debts, activeCompany.name));
  };

  const handleDownloadDebts = async () => {
    if (!employee || !activeCompany) return;
    const debts = await fetchRecords<DebtRecord>(
      "employee_debts",
      employee.id,
      "due_date",
    );
    downloadHtml(
      buildDebtConfirmationHtml(employee, debts, activeCompany.name),
      `bien-ban-cong-no-${employee.code.toLowerCase()}`,
    );
  };

  const handleSave = async (values: Record<string, string | number | null>) => {
    if (!employee) return;
    try {
      await updateEmployee(employee.id, values);
      toast.success("Đã cập nhật hồ sơ");
      setEditOpen(false);
      await load();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Không lưu được.";
      throw new Error(
        message.includes("duplicate key")
          ? "Mã nhân viên đã tồn tại."
          : message,
      );
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (notFound || !employee) {
    return (
      <AppShell>
        <Card className="p-10 text-center">
          <Users className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-[14px] font-semibold text-foreground">
            Không tìm thấy hồ sơ nhân viên
          </p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Hồ sơ có thể đã bị xoá hoặc bạn không có quyền truy cập.
          </p>
          <Button
            className="mt-4 h-9 gap-1.5 text-[12.5px]"
            onClick={() => navigate("/employees")}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Về danh sách nhân viên
          </Button>
        </Card>
      </AppShell>
    );
  }

  const meta = EMPLOYEE_STATUS_META[employee.status];
  const activeInsurance = summary.insurance.filter(
    (item) => item.status === "active",
  );
  return (
    <AppShell>
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <Link
          to="/employees"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Hồ sơ nhân viên
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">
          {employee.full_name}
        </span>
      </div>

      <Card className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/[0.09] via-primary/[0.04] to-transparent" />
        <div className="relative flex flex-col gap-4 p-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <label
              className={cn(
                "group relative inline-flex shrink-0 items-center justify-center",
                canManage && "cursor-pointer",
              )}
              title={canManage ? "Bấm để tải ảnh hồ sơ" : employee.full_name}
            >
              <Avatar
                name={employee.full_name}
                src={employee.avatar_url}
                size="lg"
                className="h-14 w-14 text-[15px]"
              />
              {canManage && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 text-background opacity-0 transition-opacity group-hover:opacity-100">
                  {avatarBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </span>
              )}
              {canManage && (
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleAvatarUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              )}
            </label>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                  {employee.full_name}
                </h1>
                <Badge variant={meta.tone}>{meta.label}</Badge>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {employee.code}
                </Badge>
                {warnings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab("warnings")}
                    title={`${warnings.length} cảnh báo hồ sơ`}
                    aria-label={`${warnings.length} cảnh báo hồ sơ`}
                    className="inline-flex items-center gap-1 rounded-full bg-destructive-subtle px-1.5 py-0.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/15"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {warnings.length}
                  </button>
                )}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {[employee.position, employee.department]
                  .filter(Boolean)
                  .join(" · ") || "Chưa cập nhật vị trí"}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
                {employee.work_email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {employee.work_email}
                  </span>
                )}
                {employee.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {employee.phone}
                  </span>
                )}
                {employee.work_location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> {employee.work_location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Vào làm{" "}
                  {formatDate(employee.hire_date)}
                </span>
                {employee.status === "resigned" && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-warning">
                    <CalendarDays className="h-3 w-3" /> Nghỉ việc{" "}
                    {formatDate(employee.resignation_date)}
                    {employee.resignation_reason
                      ? ` · ${employee.resignation_reason}`
                      : ""}
                  </span>
                )}
                {activeCompany && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> {activeCompany.name}
                  </span>
                )}
              </div>
              {canInvite && activeCompany && (
                <div className="mt-3">
                  <AccountStatusBar
                    companyId={activeCompany.id}
                    employee={employee}
                    onChanged={load}
                  />
                </div>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:shrink-0">
              {employee.status !== "resigned" && (
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 border-warning/40 text-[12.5px] text-warning hover:bg-warning-subtle hover:text-warning"
                  onClick={() => setResignOpen(true)}
                >
                  <UserMinus className="h-3.5 w-3.5" /> Nghỉ việc
                </Button>
              )}
              <Button
                className="h-9 gap-1.5 text-[12.5px]"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa hồ sơ
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 gap-1.5 text-[12.5px]"
                  >
                    <MoreHorizontal className="h-4 w-4" /> Thao tác
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px]">
                  <DropdownMenuItem
                    className="gap-2 text-[12.5px]"
                    onSelect={async () => {
                      const url = `${window.location.origin}/employees/${employee.id}?tab=personal`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Đã sao chép link hoàn thiện hồ sơ", {
                          description: employee.work_email
                            ? `Gửi cho ${employee.work_email}`
                            : "Gửi cho nhân sự để cập nhật thông tin.",
                        });
                      } catch {
                        toast.error("Không sao chép được liên kết.");
                      }
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Gửi link hoàn thiện hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-[12.5px]"
                    onSelect={() => void handlePrintSummary()}
                  >
                    <Printer className="h-3.5 w-3.5" /> In trích yếu hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-[12.5px]"
                    onSelect={() => void handleDownloadSummary()}
                  >
                    <Download className="h-3.5 w-3.5" /> Tải trích yếu hồ sơ
                  </DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setRemoveOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá hồ sơ
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="sticky top-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur">
          <div
            ref={tabBarRef}
            className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2"
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-active={isActive ? "true" : "false"}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[12px] font-medium transition-colors",
                    isActive
                      ? "bg-primary-subtle text-primary-subtle-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {tab === "warnings" && (
        <div className="space-y-3">
          {warnings.length === 0 ? (
            <Card className="p-10 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-success" />
              <p className="mt-2 text-[13.5px] font-semibold text-foreground">
                Hồ sơ không có cảnh báo
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Hợp đồng, thông tin thanh toán, giấy tờ và hội nhập đều đã đầy
                đủ.
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
              {warnings.map((warning, index) => (
                <button
                  key={warning.key}
                  type="button"
                  onClick={() => setTab(warning.tab as TabId)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                    index > 0 && "border-t border-border/60",
                    warning.severity === "high"
                      ? "hover:bg-destructive-subtle/60"
                      : "hover:bg-warning-subtle/60",
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      warning.severity === "high"
                        ? "text-destructive"
                        : "text-warning",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[12.5px] font-semibold",
                        warning.severity === "high"
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {warning.title}
                    </span>
                    <span className="block text-[11.5px] leading-5 text-muted-foreground">
                      {warning.description}
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] leading-5 text-muted-foreground">
            Cảnh báo được tính tự động từ hợp đồng, thông tin thanh toán, mức
            đầy đủ hồ sơ, checklist giấy tờ và tiến độ hội nhập.
          </p>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Thâm niên
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                {tenure(employee.hire_date, employee.resignation_date)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {EMPLOYMENT_TYPE_LABELS[employee.employment_type ?? ""] ??
                  "Chưa cập nhật hình thức"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Hợp đồng hiện tại
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                {summary.contract
                  ? (CONTRACT_TYPE_LABELS[summary.contract.contract_type] ??
                    "—")
                  : "Chưa có"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {summary.contract
                  ? formatDate(summary.contract.start_date)
                  : "Thêm hợp đồng trong tab Công tác"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Mức lương hiện tại
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                {canSensitive && summary.salary
                  ? currency(Number(summary.salary.base_salary), true)
                  : "•••"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {canSensitive && summary.salary
                  ? `Hiệu lực ${formatDate(summary.salary.effective_date)}`
                  : "Bạn không có quyền xem lương"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Bảo hiểm đang đóng
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                {canSensitive ? activeInsurance.length : "•••"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {canSensitive
                  ? activeInsurance
                      .map(
                        (item) =>
                          INSURANCE_TYPE_LABELS[item.insurance_type] ??
                          item.insurance_type,
                      )
                      .join(" · ") || "Chưa tham gia"
                  : "Thông tin nội bộ"}
              </p>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card
              className={cn(
                "p-5 transition-colors",
                canManage && "cursor-pointer hover:border-primary/40",
              )}
              onClick={() => {
                if (canManage) setEditOpen(true);
              }}
              title={canManage ? "Bấm để chỉnh sửa thông tin" : undefined}
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
                    <UserRound
                      className="h-[17px] w-[17px]"
                      strokeWidth={1.9}
                    />
                  </span>
                  <div>
                    <h3 className="text-[13.5px] font-semibold text-foreground">
                      Thông tin nhanh
                    </h3>
                    <p className="text-[11.5px] text-muted-foreground">
                      Dữ liệu cốt lõi của hồ sơ
                      {canManage ? " · bấm để chỉnh sửa" : ""}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <EditableInfoRow
                  label="Email công việc"
                  field="work_email"
                  kind="email"
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
                <InfoRow label="Số điện thoại" value={employee.phone} />
                <InfoRow label="Phòng ban" value={employee.department} />
                <InfoRow label="Chức danh" value={employee.position} />
                <InfoRow
                  label="Vị trí kiêm nhiệm"
                  value={employee.concurrent_positions}
                />
                <InfoRow
                  label="Quản lý trực tiếp"
                  value={manager?.full_name ?? "—"}
                />
                <EditableInfoRow
                  label="Địa điểm làm việc"
                  field="work_location"
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
                <InfoRow
                  label="Ngày vào làm"
                  value={formatDate(employee.hire_date)}
                />
                <InfoRow
                  label="Ngày chính thức"
                  value={formatDate(employee.official_date)}
                />
                <EditableInfoRow
                  label="Ngày sinh"
                  field="date_of_birth"
                  kind="date"
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
                <EditableInfoRow
                  label="Giới tính"
                  field="gender"
                  kind="select"
                  options={[
                    { value: "male", label: "Nam" },
                    { value: "female", label: "Nữ" },
                  ]}
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
                  <BadgeCheck className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="text-[13.5px] font-semibold text-foreground">
                    Độ đầy đủ hồ sơ
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground">
                    Số bản ghi đã ghi nhận
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {[
                  {
                    label: "Mốc công tác",
                    value: summary.counts.work ?? 0,
                    tab: "work" as TabId,
                  },
                  {
                    label: "Khen thưởng",
                    value: summary.counts.rewards ?? 0,
                    tab: "rewards" as TabId,
                  },
                  {
                    label: "Bản ghi kỷ luật",
                    value: summary.counts.discipline ?? 0,
                    tab: "rewards" as TabId,
                  },
                  {
                    label: "Khoá đào tạo",
                    value: summary.counts.training ?? 0,
                    tab: "training" as TabId,
                  },
                  {
                    label: "Tài sản bàn giao",
                    value: summary.counts.assets ?? 0,
                    tab: "assets" as TabId,
                  },
                  ...(canSensitive
                    ? [
                        {
                          label: "Công nợ chưa tất toán",
                          value: summary.counts.debts ?? 0,
                          tab: "debts" as TabId,
                        },
                      ]
                    : []),
                  ...(canSensitive
                    ? [
                        {
                          label: "Tài liệu đính kèm",
                          value: summary.counts.documents ?? 0,
                          tab: "documents" as TabId,
                        },
                      ]
                    : []),
                ].map((row) => (
                  <li key={row.label}>
                    <button
                      type="button"
                      onClick={() => setTab(row.tab)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="text-[12px] text-muted-foreground">
                        {row.label}
                      </span>
                      <span className="text-[12.5px] font-semibold text-foreground">
                        {row.value}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {employee.notes && (
            <Card className="p-5">
              <h3 className="text-[13.5px] font-semibold text-foreground">
                Ghi chú nội bộ
              </h3>
              <p className="mt-2 whitespace-pre-line text-[12.5px] leading-6 text-muted-foreground">
                {employee.notes}
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === "personal" && canInvite && activeCompany && (
        <div className="mb-5">
          <ChangeRequestsReview
            companyId={activeCompany.id}
            employeeId={employee.id}
            onApplied={load}
          />
        </div>
      )}
      {tab === "personal" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard
            title="Thông tin cá nhân"
            onEdit={canManage ? () => setEditOpen(true) : undefined}
            description="Giấy tờ tuỳ thân và tình trạng hôn nhân"
            icon={IdCard}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableInfoRow
                label="Họ và tên"
                field="full_name"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Mã nhân viên"
                field="code"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Ngày sinh"
                field="date_of_birth"
                kind="date"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Giới tính"
                field="gender"
                kind="select"
                options={[
                  { value: "male", label: "Nam" },
                  { value: "female", label: "Nữ" },
                ]}
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Số CCCD / CMND"
                field="national_id"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Ngày cấp"
                field="national_id_issue_date"
                kind="date"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Nơi cấp"
                field="national_id_issue_place"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Quốc tịch"
                field="nationality"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Hôn nhân"
                field="marital_status"
                kind="select"
                options={Object.entries(MARITAL_LABELS).map(
                  ([value, label]) => ({ value, label }),
                )}
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Người phụ thuộc"
                field="dependents_count"
                kind="number"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Số sổ BHXH"
                field="insurance_number"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Liên hệ"
            onEdit={canManage ? () => setEditOpen(true) : undefined}
            description="Email, điện thoại và địa chỉ"
            icon={Mail}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableInfoRow
                label="Email công việc"
                field="work_email"
                kind="email"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Email cá nhân"
                field="personal_email"
                kind="email"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Điện thoại"
                field="phone"
                kind="tel"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Địa điểm làm việc"
                field="work_location"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <div className="sm:col-span-2">
                <EditableInfoRow
                  label="Địa chỉ hiện tại"
                  field="current_address"
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
              </div>
              <div className="sm:col-span-2">
                <EditableInfoRow
                  label="Địa chỉ thường trú"
                  field="permanent_address"
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Học vấn"
            onEdit={canManage ? () => setEditOpen(true) : undefined}
            description="Trình độ và chuyên ngành"
            icon={GraduationCap}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableInfoRow
                label="Trình độ"
                field="education_level"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Chuyên ngành"
                field="major"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <div className="sm:col-span-2">
                <EditableInfoRow
                  label="Trường"
                  field="school"
                  employee={employee}
                  canEdit={canManage}
                  onSaved={load}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Người phụ thuộc"
            description="Đăng ký giảm trừ gia cảnh và thông tin người phụ thuộc"
            icon={Users}
          >
            {summary.dependents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
                <p className="text-[12px] text-muted-foreground">
                  Nhân sự chưa khai báo người phụ thuộc.
                </p>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 gap-1.5 text-[11.5px]"
                    onClick={() => setTab("dependents")}
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm người phụ thuộc
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <ul className="divide-y divide-border/60 rounded-md border border-border">
                  {summary.dependents.map((dependent) => (
                    <li
                      key={dependent.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-foreground">
                          {dependent.full_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {DEPENDENT_RELATION_LABELS[dependent.relationship] ??
                            dependent.relationship}
                          {dependent.date_of_birth
                            ? ` · sinh ${formatDate(dependent.date_of_birth)}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          dependent.registered_for_deduction
                            ? "success"
                            : "muted"
                        }
                      >
                        {dependent.registered_for_deduction
                          ? "Giảm trừ"
                          : "Không"}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-full text-[11.5px]"
                  onClick={() => setTab("dependents")}
                >
                  Quản lý người phụ thuộc
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Liên hệ khẩn cấp"
            onEdit={canManage ? () => setEditOpen(true) : undefined}
            description="Người cần liên hệ khi có sự cố"
            icon={ShieldAlert}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableInfoRow
                label="Họ tên"
                field="emergency_contact_name"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Quan hệ"
                field="emergency_contact_relation"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
              <EditableInfoRow
                label="Điện thoại"
                field="emergency_contact_phone"
                kind="tel"
                employee={employee}
                canEdit={canManage}
                onSaved={load}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "contacts" && activeCompany && (
        <ContactsTab
          employeeId={employee.id}
          companyId={activeCompany.id}
          canManage={canManage}
        />
      )}

      {tab === "notes" && activeCompany && (
        <NotesTab
          employeeId={employee.id}
          companyId={activeCompany.id}
          canManage={canManage}
        />
      )}

      {tab === "work" && (
        <div className="space-y-5">
          {employee.status === "resigned" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-[11.5px] leading-5 text-warning">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Nhân sự đã nghỉ việc từ {formatDate(employee.resignation_date)}
                {employee.resignation_reason
                  ? ` · Lý do: ${employee.resignation_reason}`
                  : ""}
                . Hợp đồng đang hiệu lực đã được chấm dứt tự động; mọi thay đổi
                trạng thái đều được ghi vào quá trình công tác.
              </span>
            </div>
          )}
          <WorkHistoryTab
            employeeId={employee.id}
            canManage={canManage}
            onChanged={load}
          />
          <div id="contracts" className="scroll-mt-24">
            <ContractsTab employeeId={employee.id} canManage={canManage} />
          </div>
        </div>
      )}

      {tab === "onboarding" && canSensitive && activeCompany && (
        <OnboardingTab
          employeeId={employee.id}
          companyId={activeCompany.id}
          canManage={canManage}
        />
      )}

      {tab === "salary" && canSensitive && (
        <div className="space-y-5">
          <SalaryTab employeeId={employee.id} canManage={canManage} />
          <BankInfoCard
            employee={employee}
            canManage={canManage}
            onUpdated={load}
          />
        </div>
      )}

      {tab === "insurance" && canSensitive && (
        <InsuranceTab employeeId={employee.id} canManage={canManage} />
      )}

      {tab === "dependents" && (
        <DependentsTab employeeId={employee.id} canManage={canManage} />
      )}

      {tab === "permissions" && canSensitive && activeCompany && (
        <PermissionsTab
          employeeId={employee.id}
          companyId={activeCompany.id}
          canManage={canManagePermissions}
        />
      )}

      {tab === "requests" && activeCompany && (
        <RequestsTab
          employeeId={employee.id}
          companyId={activeCompany.id}
          canManage={canManage}
        />
      )}

      {tab === "rewards" && (
        <div className="space-y-5">
          <RewardsTab employeeId={employee.id} canManage={canManage} />
          <DisciplineTab employeeId={employee.id} canManage={canManage} />
        </div>
      )}

      {tab === "training" && (
        <div className="space-y-5">
          <TrainingTab employeeId={employee.id} canManage={canManage} />
          <CertificatesTab employeeId={employee.id} canManage={canManage} />
        </div>
      )}
      {tab === "evaluations" && activeCompany && (
        <EmployeeEvaluationsTab
          employeeId={employee.id}
          isSelf={employee.user_id === user?.id}
        />
      )}

      {tab === "evaluations" && activeCompany && (
        <EmployeeEvaluationsTab
          employeeId={employee.id}
          isSelf={employee.user_id === user?.id}
        />
      )}

      {tab === "assets" && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-3.5">
            <p className="text-[11.5px] text-muted-foreground">
              In hoặc tải biên bản bàn giao toàn bộ tài sản của nhân sự.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[11.5px]"
                onClick={() => void handlePrintAssets()}
              >
                <Printer className="h-3.5 w-3.5" /> In biên bản
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tải biên bản bàn giao"
                onClick={() => void handleDownloadAssets()}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
          <AssetsTab employeeId={employee.id} canManage={canManage} />
        </div>
      )}

      {tab === "debts" && canSensitive && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-3.5">
            <p className="text-[11.5px] text-muted-foreground">
              In hoặc tải biên bản xác nhận công nợ của nhân sự.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[11.5px]"
                onClick={() => void handlePrintDebts()}
              >
                <Printer className="h-3.5 w-3.5" /> In biên bản
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tải biên bản công nợ"
                onClick={() => void handleDownloadDebts()}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
          <DebtsTab employeeId={employee.id} canManage={canManage} />
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-5">
          {canInvite && <SensitiveAuditCard employeeId={employee.id} />}
          <ActivityTimeline entityType="employee" entityId={employee.id} />
        </div>
      )}

      {tab === "documents" && canSensitive && activeCompany && (
        <DocumentsTab
          employeeId={employee.id}
          companyId={activeCompany.id}
          canManage={canManage}
        />
      )}

      <ResignationDialog
        open={resignOpen}
        onOpenChange={setResignOpen}
        employee={employee}
        onDone={load}
        onRequestAssetReturn={() => setTab("assets")}
        onRequestDebtSettle={() => setTab("debts")}
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá hồ sơ nhân viên?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu của {employee.full_name} — quá trình công tác, hợp
              đồng, lương, bảo hiểm, khen thưởng, kỷ luật, đào tạo và tài liệu —
              sẽ bị xoá vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing}
              onClick={() => void handleDelete()}
            >
              {removing ? "Đang xoá…" : "Xoá hồ sơ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FieldDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Chỉnh sửa hồ sơ nhân viên"
        description="Cập nhật thông tin cá nhân, công việc và thanh toán."
        fields={withOrgFields(
          buildEmployeeFields(colleagues, employee.id),
          org,
        )}
        onFieldChange={(name, value, current) => {
          // Chọn phòng ban → gợi ý người quản lý trực tiếp = trưởng phòng trên sơ đồ.
          if (name !== "department" || current.manager_id) return;
          const manager = org.managerOf(value);
          if (manager?.employeeId) return { manager_id: manager.employeeId };
        }}
        initial={employee}
        submitLabel="Lưu thay đổi"
        onSubmit={handleSave}
      />
    </AppShell>
  );
};

export default EmployeeProfile;
