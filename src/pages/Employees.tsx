import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  FileDown,
  FileSpreadsheet,
  Moon,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog } from "@/components/employee/field-dialog";
import { ImportEmployeesDialog } from "@/components/employee/import-employees-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/common/avatar";
import { PageHeader } from "@/components/common/page-header";
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
import { SelectionBar } from "@/components/common/selection-bar";
import { InviteEmployeeDialog } from "@/components/employee/invite-employee-dialog";
import { useSelection } from "@/lib/use-selection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { buildEmployeeFields } from "@/lib/employee-fields";
import { useOrgStructure, withOrgFields } from "@/lib/use-org-structure";
import {
  EMPLOYEE_STATUS_META,
  CONTRACT_TYPE_LABELS,
  createEmployee,
  deleteEmployee,
  contractHealth,
  formatDate,
  listCompanyContractSummaries,
  listEmployees,
  updateEmployee,
  type EmployeeRecord,
  type EmployeeStatus,
} from "@/lib/employee-records";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import {
  buildEmployeeWarnings,
  REQUIRED_DOCUMENT_CATEGORIES,
} from "@/lib/employee-warnings";
import {
  listDepartmentPositions,
  listDepartments,
  listDocumentChecklist,
} from "@/lib/settings";
import { isManagerial } from "@/lib/roles";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const statusFilters: { id: "all" | EmployeeStatus; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ cập nhật" },
  { id: "active", label: "Đang làm việc" },
  { id: "maternity", label: "Nghỉ thai sản" },
  { id: "long_leave", label: "Nghỉ dài hạn" },
  { id: "resigned", label: "Đã nghỉ việc" },
];

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Đã xảy ra lỗi.";
  if (message.includes("Email đã tồn tại"))
    return "Email này đã được dùng cho nhân sự khác trong workspace.";
  if (message.includes("Số điện thoại đã tồn tại"))
    return "Số điện thoại này đã được dùng cho nhân sự khác trong workspace.";
  if (message.includes("duplicate key"))
    return "Mã nhân viên này đã tồn tại trong công ty.";
  if (message.includes("row-level security"))
    return "Bạn không có quyền thực hiện thao tác này.";
  return message;
};

const Employees = () => {
  const navigate = useNavigate();
  const { activeCompany, can, role, canManageModule } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("employees");
  const canDelete = isManagerial(role);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [contractsByEmployee, setContractsByEmployee] = useState<
    Record<
      string,
      {
        status: string;
        end_date: string | null;
        contract_type: string;
        start_date: string | null;
      }[]
    >
  >({});
  const [documentCategoriesByEmployee, setDocumentCategoriesByEmployee] =
    useState<Record<string, string[]>>({});
  const [requiredDocCategories, setRequiredDocCategories] = useState<string[]>(
    REQUIRED_DOCUMENT_CATEGORIES,
  );
  const [onboardingByEmployee, setOnboardingByEmployee] = useState<
    Record<
      string,
      { status: string; checklist: { completed: boolean }[] | null }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { selected, toggle, selectAll, clear, prune } = useSelection();
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [positionOptionsByDepartment, setPositionOptionsByDepartment] =
    useState<Record<string, { value: string; label: string }[]>>({});
  const [departmentNameOptions, setDepartmentNameOptions] = useState<string[]>(
    [],
  );
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [position, setPosition] = useState("all");
  const [status, setStatus] = useState<"all" | EmployeeStatus>("all");
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [removal, setRemoval] = useState<EmployeeRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") !== "1" || !canManage) return;
    setEditing(null);
    setFormOpen(true);
    const params = new URLSearchParams(searchParams);
    params.delete("new");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, canManage]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [
        people,
        contracts,
        checklistTemplates,
        documentResult,
        onboardingResult,
        departmentRows,
        positionRows,
      ] = await Promise.all([
        listEmployees(companyId),
        canManage
          ? listCompanyContractSummaries(companyId).catch(() => [])
          : Promise.resolve(
              [] as {
                employee_id: string;
                status: string;
                end_date: string | null;
                contract_type: string;
                start_date: string | null;
              }[],
            ),
        canManage
          ? listDocumentChecklist(companyId).catch(() => [])
          : Promise.resolve([] as { category: string }[]),
        canManage
          ? supabase
              .from("employee_documents")
              .select("employee_id, category")
              .eq("company_id", companyId)
          : Promise.resolve({
              data: [] as { employee_id: string; category: string }[],
            }),
        canManage
          ? supabase
              .from("onboarding_records")
              .select("employee_id, status, checklist")
              .eq("company_id", companyId)
          : Promise.resolve({
              data: [] as {
                employee_id: string | null;
                status: string;
                checklist: unknown;
              }[],
            }),
        listDepartments(companyId).catch(() => []),
        listDepartmentPositions(companyId).catch(() => []),
      ]);
      setEmployees(people);
      prune(people.map((person) => person.id));

      const departmentNameById = new Map<string, string>(
        departmentRows.map(
          (department) => [department.id, department.name] as [string, string],
        ),
      );
      const positionMap: Record<string, { value: string; label: string }[]> =
        {};
      positionRows.forEach((position) => {
        const departmentName = departmentNameById.get(position.department_id);
        if (!departmentName) return;
        positionMap[departmentName] = [
          ...(positionMap[departmentName] ?? []),
          { value: position.title, label: position.title },
        ];
      });
      setPositionOptionsByDepartment(positionMap);
      setDepartmentNameOptions(departmentRows.map((row) => row.name));
      if (checklistTemplates.length > 0) {
        setRequiredDocCategories(
          Array.from(new Set(checklistTemplates.map((row) => row.category))),
        );
      } else {
        setRequiredDocCategories(REQUIRED_DOCUMENT_CATEGORIES);
      }

      const grouped: Record<
        string,
        {
          status: string;
          end_date: string | null;
          contract_type: string;
          start_date: string | null;
        }[]
      > = {};
      contracts.forEach((contract) => {
        const list = grouped[contract.employee_id] ?? [];
        list.push({
          status: contract.status,
          end_date: contract.end_date,
          contract_type: contract.contract_type,
          start_date: contract.start_date,
        });
        grouped[contract.employee_id] = list;
      });
      setContractsByEmployee(grouped);

      const categories: Record<string, string[]> = {};
      (
        (documentResult.data ?? []) as {
          employee_id: string;
          category: string;
        }[]
      ).forEach((document) => {
        categories[document.employee_id] = [
          ...(categories[document.employee_id] ?? []),
          document.category,
        ];
      });
      setDocumentCategoriesByEmployee(categories);

      const onboardingMap: Record<
        string,
        { status: string; checklist: { completed: boolean }[] | null }
      > = {};
      (
        (onboardingResult.data ?? []) as {
          employee_id: string | null;
          status: string;
          checklist: { completed: boolean }[] | null;
        }[]
      ).forEach((record) => {
        if (record.employee_id && !onboardingMap[record.employee_id]) {
          onboardingMap[record.employee_id] = {
            status: record.status,
            checklist: record.checklist,
          };
        }
      });
      setOnboardingByEmployee(onboardingMap);
    } catch (loadError) {
      toast.error("Không tải được danh sách nhân viên", {
        description: friendlyError(loadError),
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, companyId, prune]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = window.localStorage.getItem(`employees-view-${companyId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        query?: string;
        department?: string;
        position?: string;
        status?: "all" | EmployeeStatus;
        pageSize?: number;
        sort?: string;
      };
      if (typeof saved.query === "string") setQuery(saved.query);
      if (typeof saved.department === "string") setDepartment(saved.department);
      if (typeof saved.position === "string") setPosition(saved.position);
      if (saved.status) setStatus(saved.status);
      if (saved.pageSize) setPageSize(saved.pageSize);
      if (saved.sort) setSort(saved.sort);
    } catch {
      /* ignore */
    }
  }, [companyId]);

  useEffect(() => {
    const searchQuery = searchParams.get("q");
    if (searchQuery === null) return;
    setQuery(searchQuery);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (!companyId) return;
    window.localStorage.setItem(
      `employees-view-${companyId}`,
      JSON.stringify({ query, department, position, status, pageSize, sort }),
    );
  }, [companyId, department, pageSize, position, query, sort, status]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return employees
      .filter((person) => {
        const matchesQuery =
          !keyword ||
          `${person.full_name} ${person.code} ${person.work_email ?? ""} ${person.personal_email ?? ""} ${person.position ?? ""} ${person.department ?? ""}`
            .toLowerCase()
            .includes(keyword);
        const matchesDepartment =
          department === "all" || person.department === department;
        const matchesPosition =
          position === "all" || person.position === position;
        const matchesStatus = status === "all" || person.status === status;
        return (
          matchesQuery && matchesDepartment && matchesPosition && matchesStatus
        );
      })
      .sort((a, b) => {
        if (sort === "name-desc")
          return b.full_name.localeCompare(a.full_name, "vi");
        if (sort === "newest")
          return (b.hire_date ?? "").localeCompare(a.hire_date ?? "");
        if (sort === "department")
          return (a.department ?? "").localeCompare(b.department ?? "", "vi");
        return a.full_name.localeCompare(b.full_name, "vi");
      });
  }, [department, employees, position, query, sort, status]);

  const positionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((person) => person.position)
            .filter((title): title is string => !!title),
        ),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [employees],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const warningsByEmployee = useMemo(() => {
    if (!canManage) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    employees.forEach((person) => {
      const count = buildEmployeeWarnings({
        employee: person,
        contracts: contractsByEmployee[person.id] ?? [],
        documentCategories: documentCategoriesByEmployee[person.id] ?? [],
        onboarding: onboardingByEmployee[person.id] ?? null,
        canSensitive: true,
        requiredCategories: requiredDocCategories,
      }).length;
      if (count > 0) map[person.id] = count;
    });
    return map;
  }, [
    canManage,
    contractsByEmployee,
    documentCategoriesByEmployee,
    employees,
    onboardingByEmployee,
    requiredDocCategories,
  ]);

  const stats = useMemo(
    () => ({
      total: employees.length,
      active: employees.filter((person) => person.status === "active").length,
      paused: employees.filter(
        (person) =>
          person.status === "maternity" || person.status === "long_leave",
      ).length,
      resigned: employees.filter((person) => person.status === "resigned")
        .length,
    }),
    [employees],
  );

  const handleSubmit = async (
    values: Record<string, string | number | null>,
  ) => {
    try {
      if (editing) {
        await updateEmployee(editing.id, values);
        toast.success("Đã cập nhật hồ sơ nhân viên");
      } else {
        if (!companyId) throw new Error("Chưa chọn công ty.");
        const createdId = await createEmployee({
          ...values,
          company_id: companyId,
          created_by: user?.id ?? null,
        });
        toast.success("Đã thêm nhân viên mới", {
          description:
            "Tiếp tục bổ sung quá trình công tác, lương và bảo hiểm trong hồ sơ 360°.",
        });
        setFormOpen(false);
        navigate(
          `/employees/${createdId}${role === "owner" || role === "admin" || role === "hr" ? "?moi=1" : ""}`,
        );
        return;
      }
      setFormOpen(false);
      await load();
    } catch (submitError) {
      throw new Error(friendlyError(submitError));
    }
  };

  const handleBulkDelete = async () => {
    if (!canDelete) return;
    try {
      await Promise.all(selected.map((id) => deleteEmployee(id)));
      toast.success(`Đã xoá ${selected.length} hồ sơ nhân viên`);
      clear();
      setBulkOpen(false);
      await load();
    } catch (error) {
      toast.error("Không xoá được hồ sơ", {
        description: friendlyError(error),
      });
    }
  };

  const handleDelete = async () => {
    if (!removal) return;
    try {
      await deleteEmployee(removal.id);
      toast.success("Đã xoá hồ sơ nhân viên");
      setRemoval(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được hồ sơ", {
        description: friendlyError(deleteError),
      });
    }
  };

  const org = useOrgStructure();
  const fields = withOrgFields(
    buildEmployeeFields(
      employees,
      editing?.id,
      positionOptionsByDepartment,
      departmentNameOptions,
    ),
    org,
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Nhân sự"
        title="Hồ sơ nhân viên"
        description={
          activeCompany
            ? `Hồ sơ 360° của ${activeCompany.name}: thông tin cá nhân, quá trình công tác, lương, bảo hiểm, khen thưởng, kỷ luật, đào tạo và tài liệu.`
            : "Hồ sơ 360° của nhân viên trong công ty."
        }
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportExcel(
                  "danh-sach-nhan-vien",
                  [
                    "Mã NV",
                    "Họ tên",
                    "Phòng ban",
                    "Vị trí",
                    "Trạng thái",
                    "Email",
                    "Điện thoại",
                    "Ngày vào làm",
                  ],
                  filtered.map((person) => [
                    person.code,
                    person.full_name,
                    person.department ?? "",
                    person.position ?? "",
                    EMPLOYEE_STATUS_META[person.status]?.label ?? person.status,
                    person.work_email ?? person.personal_email ?? "",
                    person.phone ?? "",
                    person.hire_date ?? "",
                  ]),
                  "Danh sách nhân viên",
                )
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportPdf(
                  "Danh sách nhân viên",
                  activeCompany?.name ?? "Công ty",
                  [
                    "Mã NV",
                    "Họ tên",
                    "Phòng ban",
                    "Vị trí",
                    "Trạng thái",
                    "Email",
                    "Điện thoại",
                    "Ngày vào làm",
                  ],
                  filtered.map((person) => [
                    person.code,
                    person.full_name,
                    person.department ?? "",
                    person.position ?? "",
                    EMPLOYEE_STATUS_META[person.status]?.label ?? person.status,
                    person.work_email ?? person.personal_email ?? "",
                    person.phone ?? "",
                    person.hire_date ?? "",
                  ]),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            {canManage && (
              <>
                <Button
                  variant="outline"
                  className="h-9 gap-2 text-[12.5px]"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import dữ liệu
                </Button>
                <Button
                  className="h-9 gap-1.5 text-[12.5px]"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Thêm nhân viên
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Tổng nhân sự",
            value: stats.total,
            icon: Users,
            tone: "primary",
          },
          {
            label: "Đang làm việc",
            value: stats.active,
            icon: UserCheck,
            tone: "success",
          },
          { label: "Đang nghỉ", value: stats.paused, icon: Moon, tone: "info" },
          {
            label: "Đã nghỉ việc",
            value: stats.resigned,
            icon: UserMinus,
            tone: "muted",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="flex items-center gap-3 p-4">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[11px]",
                  item.tone === "primary" &&
                    "bg-primary-subtle text-primary-subtle-foreground",
                  item.tone === "success" && "bg-success-subtle text-success",
                  item.tone === "info" && "bg-info-subtle text-info",
                  item.tone === "muted" && "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-display text-[22px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
                  {loading ? "—" : item.value}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {(role === "owner" || role === "admin" || role === "hr") &&
        selected.length > 0 && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[11.5px]"
              onClick={() => setBulkInviteOpen(true)}
            >
              <Send className="h-3.5 w-3.5" /> Gửi lời mời {selected.length}{" "}
              người
            </Button>
          </div>
        )}
      {canDelete && (
        <SelectionBar
          count={selected.length}
          label="hồ sơ"
          onClear={clear}
          onDelete={() => setBulkOpen(true)}
        />
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setStatus(filter.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                  status === filter.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm tên, mã NV, email…"
                className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground/80 hover:border-primary/30 focus:border-primary focus:shadow-focus sm:w-[240px]"
              />
            </label>
            <Select
              value={department}
              onValueChange={(value) => {
                setDepartment(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[176px]">
                <SelectValue placeholder="Phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả phòng ban</SelectItem>
                {departmentNameOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={position}
              onValueChange={(value) => {
                setPosition(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[176px]">
                <SelectValue placeholder="Vị trí" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vị trí</SelectItem>
                {positionOptions.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / trang
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Tên A → Z</SelectItem>
                <SelectItem value="name-desc">Tên Z → A</SelectItem>
                <SelectItem value="newest">Mới vào làm</SelectItem>
                <SelectItem value="department">Theo phòng ban</SelectItem>
              </SelectContent>
            </Select>
            {canDelete && rows.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={
                    rows.length > 0 &&
                    rows.every((person) => selected.includes(person.id))
                  }
                  onChange={() => selectAll(rows.map((person) => person.id))}
                />
                Chọn trang
              </label>
            )}
            {(query ||
              department !== "all" ||
              position !== "all" ||
              status !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1 text-[11.5px] text-muted-foreground"
                onClick={() => {
                  setQuery("");
                  setDepartment("all");
                  setPosition("all");
                  setStatus("all");
                  setPage(1);
                }}
              >
                <X className="h-3.5 w-3.5" /> Xoá bộ lọc
              </Button>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:flex">
          <span className="flex-1">Nhân viên</span>
          <span className="w-[150px] shrink-0">Phòng ban</span>
          <span className="w-[120px] shrink-0">Trạng thái</span>
          <span className="w-[110px] shrink-0">Vào làm</span>
          <span className="w-9 shrink-0" />
        </div>

        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="flex animate-pulse items-center gap-3 px-5 py-3"
              >
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-2.5 w-56 rounded bg-muted/70" />
                </div>
                <div className="h-5 w-20 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Users className="mx-auto h-6 w-6 text-muted-foreground/70" />
            <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">
              {employees.length === 0
                ? "Chưa có hồ sơ nhân viên nào"
                : "Không tìm thấy nhân viên phù hợp"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-muted-foreground">
              {employees.length === 0
                ? "Thêm hồ sơ đầu tiên để bắt đầu quản lý thông tin, hợp đồng, lương và bảo hiểm của đội ngũ."
                : "Thử từ khoá khác hoặc bỏ bộ lọc phòng ban."}
            </p>
            {canManage && employees.length === 0 && (
              <Button
                className="mt-4 h-9 gap-1.5 text-[12.5px]"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Thêm nhân viên
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((person) => {
              const meta = EMPLOYEE_STATUS_META[person.status];
              const health = canManage
                ? contractHealth(contractsByEmployee[person.id] ?? [])
                : null;
              const latestContract = canManage
                ? ([...(contractsByEmployee[person.id] ?? [])].sort((a, b) =>
                    (b.start_date ?? "").localeCompare(a.start_date ?? ""),
                  )[0] ?? null)
                : null;
              return (
                <li
                  key={person.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/25"
                >
                  {canDelete && (
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${person.full_name}`}
                      className="h-3.5 w-3.5 shrink-0 accent-primary"
                      checked={selected.includes(person.id)}
                      onChange={() => toggle(person.id)}
                    />
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={person.full_name} src={person.avatar_url} />
                    <div className="min-w-0">
                      <Link
                        to={`/employees/${person.id}`}
                        className="group flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground hover:text-primary"
                      >
                        <span className="truncate">{person.full_name}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                      <p className="flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                        <span className="truncate">
                          {person.code}
                          {person.position ? ` · ${person.position}` : ""}
                          {latestContract
                            ? ` · ${CONTRACT_TYPE_LABELS[latestContract.contract_type] ?? latestContract.contract_type}`
                            : ""}
                        </span>
                        {warningsByEmployee[person.id] ? (
                          <Link
                            to={`/employees/${person.id}?tab=warnings`}
                            title={`${warningsByEmployee[person.id]} cảnh báo hồ sơ`}
                            aria-label={`${warningsByEmployee[person.id]} cảnh báo hồ sơ`}
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-destructive-subtle px-1 text-[11px] font-semibold text-destructive hover:bg-destructive/15"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {warningsByEmployee[person.id]}
                          </Link>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground/90 lg:hidden">
                        {person.department ?? "Chưa xếp phòng ban"} ·{" "}
                        {meta.label}
                      </p>
                      {health &&
                        person.status !== "resigned" &&
                        health.state !== "ok" && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/employees/${person.id}?tab=work&section=contracts`,
                              )
                            }
                            title={health.label}
                            className={cn(
                              "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                              health.tone === "destructive"
                                ? "bg-destructive-subtle text-destructive hover:bg-destructive/15"
                                : "bg-warning-subtle text-warning hover:bg-warning/15",
                            )}
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {health.shortLabel}
                          </button>
                        )}
                    </div>
                  </div>

                  <span className="hidden w-[150px] shrink-0 truncate text-[12px] text-muted-foreground lg:block">
                    {person.department ?? "—"}
                  </span>

                  <span className="hidden w-[120px] shrink-0 lg:block">
                    <Badge variant={meta.tone}>{meta.label}</Badge>
                  </span>

                  <span className="hidden w-[110px] shrink-0 text-[12px] text-muted-foreground lg:block">
                    {formatDate(person.hire_date)}
                  </span>

                  <div className="w-9 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Thao tác ${person.full_name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px]"
                          asChild
                        >
                          <Link to={`/employees/${person.id}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" /> Mở hồ sơ
                            360°
                          </Link>
                        </DropdownMenuItem>
                        {canManage && (
                          <>
                            <DropdownMenuItem
                              className="gap-2 text-[12.5px]"
                              onSelect={() => {
                                setEditing(person);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa thông
                              tin
                            </DropdownMenuItem>
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                                  onSelect={() => setRemoval(person)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Xoá hồ sơ
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > pageSize && (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-[11.5px] text-muted-foreground">
            <span>
              {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} trong{" "}
              {filtered.length} nhân viên
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Trang trước"
                disabled={currentPage === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-1 text-[11.5px] font-medium text-foreground">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Trang sau"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {companyId && (
        <ImportEmployeesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          companyId={companyId}
          onImported={load}
        />
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Chỉnh sửa hồ sơ nhân viên" : "Thêm nhân viên mới"}
        description={
          editing
            ? "Cập nhật thông tin cá nhân, công việc và thanh toán. Các mục chi tiết nằm trong hồ sơ 360°."
            : "Chỉ cần thông tin cơ bản để tạo hồ sơ. Bạn có thể bổ sung hợp đồng, lương, bảo hiểm sau."
        }
        fields={fields}
        onFieldChange={(name, value, current) => {
          // Chọn phòng ban → gợi ý người quản lý trực tiếp = trưởng phòng trên sơ đồ.
          if (name !== "department" || current.manager_id) return;
          const manager = org.managerOf(value);
          if (manager?.employeeId) return { manager_id: manager.employeeId };
        }}
        initial={
          editing ?? {
            status: "active",
            employment_type: "full_time",
            nationality: "Việt Nam",
            dependents_count: 0,
          }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Tạo hồ sơ"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xoá {selected.length} hồ sơ nhân viên?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu liên quan (hợp đồng, lương, bảo hiểm, tài sản, tài
              liệu…) của các nhân sự đã chọn sẽ bị xoá. Hành động không thể hoàn
              tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleBulkDelete()}
            >
              Xoá đã chọn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!removal}
        onOpenChange={(open) => !open && setRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá hồ sơ nhân viên?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu của {removal?.full_name} — quá trình công tác,
              lương, bảo hiểm, khen thưởng, kỷ luật, đào tạo và tài liệu — sẽ bị
              xoá vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá hồ sơ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InviteEmployeeDialog
        open={bulkInviteOpen}
        onOpenChange={setBulkInviteOpen}
        employees={employees.filter((e) => selected.includes(e.id))}
        onDone={clear}
      />
    </AppShell>
  );
};

export default Employees;
