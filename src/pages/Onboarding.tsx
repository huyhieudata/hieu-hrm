import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  Check,
  Eye,
  FileDown,
  FileSpreadsheet,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  History,
  Paperclip,
  Search,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-provider";
import { listActivity, type ActivityLog } from "@/lib/activity";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-provider";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/utils";
import {
  getOnboardingFormUrl,
  listOnboardingTemplates,
  type OnboardingTemplate,
} from "@/lib/settings";
import {
  ONBOARDING_STATUS_LABELS,
  createRow,
  deleteRow,
  deleteRows,
  formatDay,
  listRows,
  updateRow,
  type OnboardingRecord,
} from "@/lib/recruitment";
import { todayIso } from "@/lib/attendance";

interface OnboardingComment {
  id: string;
  onboarding_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  attachment_path?: string | null;
  attachment_name?: string | null;
}

const STATUS_OPTIONS = Object.keys(ONBOARDING_STATUS_LABELS);
const PAGE_SIZES = [10, 20, 30, 50];

const statusTone = (status: string) =>
  status === "completed" ? "success" : status === "in_progress" ? "info" : status === "cancelled" ? "muted" : "warning";


const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const Onboarding = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefilledRef = useRef(false);
  const detailPrefilledRef = useRef(false);
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("onboarding");

  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OnboardingRecord | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [hireDate, setHireDate] = useState(todayIso());
  const [expectedDate, setExpectedDate] = useState(addDays(todayIso(), 3));
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OnboardingRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OnboardingRecord | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detail, setDetail] = useState<OnboardingRecord | null>(null);
  const [comments, setComments] = useState<OnboardingComment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [recordRows, employeeRows, templateRows] = await Promise.all([
        listRows<OnboardingRecord>("onboarding_records", companyId, "created_at"),
        listEmployees(companyId),
        listOnboardingTemplates(companyId).catch(() => []),
      ]);
      setRecords(recordRows);
      setEmployees(employeeRows);
      setSelected((prev) => prev.filter((id) => recordRows.some((record) => record.id === id)));
      setTemplates(templateRows);
    } catch (loadError) {
      toast.error("Không tải được hồ sơ hội nhập", { description: getErrorMessage(loadError) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mergeChecklist = useCallback((record: OnboardingRecord): ChecklistItem[] => {
    const stored = (record.checklist ?? []) as ChecklistItem[];
    if (templates.length === 0) return stored;
    return templates.map((template) => {
      const match = stored.find(
        (item) => item.label.trim().toLowerCase() === template.label.trim().toLowerCase(),
      );
      return {
        id: match?.id ?? `tpl-${template.id}`,
        label: template.label,
        required: template.required,
        completed: match?.completed ?? false,
        attachment_path: template.attachment_path,
        attachment_name: template.attachment_name,
      };
    });
  }, [templates]);

  const progressOf = useCallback((record: OnboardingRecord) => {
    const items = mergeChecklist(record);
    const total = items.length;
    const done = items.filter((item) => item.completed).length;
    return {
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      completed: total > 0 && done === total,
    };
  }, [mergeChecklist]);

  const progressBarTone = (percent: number) =>
    percent >= 100 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-destructive";

  const statusOf = useCallback((record: OnboardingRecord) => {
    if (record.status === "cancelled") return "cancelled";
    const progress = progressOf(record);
    if (progress.total > 0 && progress.done === progress.total) return "completed";
    if (progress.done > 0) return "in_progress";
    return "pending";
  }, [progressOf]);

  useEffect(() => {
    const preselected = searchParams.get("employee");
    if (!preselected || prefilledRef.current || employees.length === 0) return;
    const employee = employees.find((item) => item.id === preselected);
    if (!employee) return;
    prefilledRef.current = true;

    setEditing(null);
    setEmployeeId(employee.id);
    setHireDate(employee.hire_date ?? todayIso());
    setExpectedDate(addDays(employee.hire_date ?? todayIso(), 3));
    setNote("");
    setError(null);
    setFormOpen(true);

    if (companyId) {
      listOnboardingTemplates(companyId)
        .then((templateRows) =>
          setChecklist(
            templateRows.map((template) => ({
              id: crypto.randomUUID(),
              label: template.label,
              required: template.required,
              completed: false,
            })),
          ),
        )
        .catch(() => setChecklist([]));
    }
  }, [companyId, employees, searchParams]);

  useEffect(() => {
    const recordId = searchParams.get("record");
    if (!recordId || detailPrefilledRef.current || records.length === 0) return;
    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    detailPrefilledRef.current = true;
    void openDetail(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, searchParams]);

  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees]);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(records.map((item) => item.department).filter((value): value is string => !!value))).sort(
        (a, b) => a.localeCompare(b, "vi"),
      ),
    [records],
  );

  const positionOptions = useMemo(
    () =>
      Array.from(new Set(records.map((item) => item.position).filter((value): value is string => !!value))).sort(
        (a, b) => a.localeCompare(b, "vi"),
      ),
    [records],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "all" && statusOf(record) !== statusFilter) return false;
      if (departmentFilter !== "all" && record.department !== departmentFilter) return false;
      if (positionFilter !== "all" && record.position !== positionFilter) return false;
      if (fromDate && (!record.hire_date || record.hire_date < fromDate)) return false;
      if (toDate && (!record.hire_date || record.hire_date > toDate)) return false;
      if (!keyword) return true;
      const employee = record.employee_id ? employeeById.get(record.employee_id) : null;
      return `${record.full_name} ${employee?.code ?? ""} ${record.position ?? ""} ${record.department ?? ""}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [departmentFilter, employeeById, fromDate, positionFilter, query, records, statusFilter, statusOf, toDate]);

  const stats = useMemo(
    () => ({
      pending: records.filter((record) => statusOf(record) === "pending").length,
      inProgress: records.filter((record) => statusOf(record) === "in_progress").length,
      completed: records.filter((record) => statusOf(record) === "completed").length,
      cancelled: records.filter((record) => statusOf(record) === "cancelled").length,
    }),
    [records, statusOf],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = async () => {
    setEditing(null);
    setEmployeeId("");
    setHireDate(todayIso());
    setExpectedDate(addDays(todayIso(), 3));
    setNote("");
    setError(null);
    try {
      const templates = companyId ? await listOnboardingTemplates(companyId) : [];
      setChecklist(
        templates.map((template) => ({
          id: crypto.randomUUID(),
          label: template.label,
          required: template.required,
          completed: false,
        })),
      );
    } catch {
      setChecklist([]);
    }
    setFormOpen(true);
  };

  const openEdit = (record: OnboardingRecord) => {
    if (record.status === "cancelled") {
      toast.error("Hồ sơ đã hủy hội nhập, không thể chỉnh sửa.");
      return;
    }
    setEditing(record);
    setEmployeeId(record.employee_id ?? "");
    setHireDate(record.hire_date ?? todayIso());
    setExpectedDate(record.expected_completion_date ?? addDays(record.hire_date ?? todayIso(), 3));
    setNote(record.note ?? "");
    setChecklist(mergeChecklist(record));
    setError(null);
    setFormOpen(true);
  };

  const pickEmployee = (value: string) => {
    setEmployeeId(value);
    const employee = employees.find((item) => item.id === value);
    if (employee) {
      if (employee.hire_date) {
        setHireDate(employee.hire_date);
        setExpectedDate(addDays(employee.hire_date, 3));
      }
    }
  };

  const toggleChecklist = (id: string) =>
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    );

  const save = async () => {
    if (!companyId) return;
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      setError("Vui lòng chọn nhân viên.");
      return;
    }

    setSaving(true);
    try {
      const done = checklist.filter((item) => item.completed).length;
      const autoStatus =
        checklist.length > 0 && done === checklist.length
          ? "completed"
          : done > 0
            ? "in_progress"
            : "pending";
      const finalStatus = editing?.status === "cancelled" ? "cancelled" : autoStatus;
      const payload = {
        company_id: companyId,
        employee_id: employee.id,
        full_name: employee.full_name,
        email: employee.work_email ?? employee.personal_email ?? null,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        hire_date: hireDate || null,
        expected_completion_date: expectedDate || null,
        status: finalStatus,
        note: note.trim() || null,
        checklist,
      };

      const creating = !editing;
      if (editing) {
        await updateRow("onboarding_records", editing.id, payload);
        toast.success("Đã cập nhật hồ sơ hội nhập");
      } else {
        await createRow("onboarding_records", payload);
        toast.success("Đã thêm hồ sơ hội nhập");
      }
      setFormOpen(false);
      await load();

      const returnTo = searchParams.get("return");
      if (creating && returnTo) {
        navigate(returnTo, { replace: true });
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRow("onboarding_records", pendingDelete.id);
      toast.success("Đã xoá hồ sơ hội nhập");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được hồ sơ", { description: getErrorMessage(deleteError) });
    }
  };

  const closeForm = () => {
    const returnTo = searchParams.get("return");
    const wasEditing = !!editing;
    setFormOpen(false);
    setEditing(null);
    if (!wasEditing && returnTo && searchParams.get("employee")) {
      navigate(returnTo, { replace: true });
    }
  };

  const closeDetail = () => {
    const returnTo = searchParams.get("return");
    const openedFromLink = !!searchParams.get("record");
    setDetail(null);
    if (returnTo && openedFromLink) navigate(returnTo, { replace: true });
  };

  const openDetail = async (record: OnboardingRecord) => {
    setDetail(record);
    setCommentText("");
    if (!companyId) return;
    try {
      const [all, logs] = await Promise.all([
        listRows<OnboardingComment>("onboarding_comments", companyId, "created_at"),
        listActivity("onboarding", record.id).catch(() => []),
      ]);
      setComments(all.filter((item) => item.onboarding_id === record.id));
      setActivity(logs);
    } catch {
      setComments([]);
      setActivity([]);
    }
  };

  const reloadActivity = async (recordId: string) => {
    try {
      setActivity(await listActivity("onboarding", recordId));
    } catch {
      setActivity([]);
    }
  };

  const toggleDetailItem = async (itemId: string) => {
    if (!detail) return;
    if (detail.status === "cancelled") {
      toast.error("Hồ sơ đã hủy hội nhập, không thể tích checklist.");
      return;
    }
    const next = mergeChecklist(detail).map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    const allDone = next.length > 0 && next.every((item) => item.completed);
    const anyDone = next.some((item) => item.completed);
    const nextStatus =
      detail.status === "cancelled" ? "cancelled" : allDone ? "completed" : anyDone ? "in_progress" : "pending";

    try {
      await updateRow("onboarding_records", detail.id, { checklist: next, status: nextStatus });
      setDetail({ ...detail, checklist: next, status: nextStatus });
      await load();
      await reloadActivity(detail.id);
    } catch (updateError) {
      toast.error("Không cập nhật được checklist", { description: getErrorMessage(updateError) });
    }
  };

  const openAttachment = async (path: string) => {
    try {
      const url = await getOnboardingFormUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Không mở được tài liệu");
    }
  };

  const addComment = async () => {
    if (!detail || !companyId || !commentText.trim() || !user?.id) return;
    setCommentBusy(true);
    try {
      await createRow("onboarding_comments", {
        company_id: companyId,
        onboarding_id: detail.id,
        author_id: user.id,
        author_name: profile?.full_name ?? user.email?.split("@")[0] ?? "Thành viên",
        content: commentText.trim(),
      });
      setCommentText("");
      const all = await listRows<OnboardingComment>("onboarding_comments", companyId, "created_at");
      setComments(all.filter((item) => item.onboarding_id === detail.id));
    } catch (commentError) {
      toast.error("Không gửi được bình luận", { description: getErrorMessage(commentError) });
    } finally {
      setCommentBusy(false);
    }
  };

  const removeComment = async (comment: OnboardingComment) => {
    try {
      await deleteRow("onboarding_comments", comment.id);
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
    } catch (commentError) {
      toast.error("Không xoá được bình luận", { description: getErrorMessage(commentError) });
    }
  };

  const exportDetailPdf = (record: OnboardingRecord) => {
    const items = mergeChecklist(record);
    const progress = progressOf(record);
    exportPdf(
      `Phiếu hội nhập — ${record.full_name}`,
      `${record.position ?? "—"} · ${record.department ?? "—"} · Nhận việc ${
        record.hire_date ? formatDay(record.hire_date) : "—"
      } · Dự kiến hoàn thành ${
        record.expected_completion_date ? formatDay(record.expected_completion_date) : "—"
      } · Tiến độ ${progress.done}/${progress.total} (${progress.percent}%) · ${
        ONBOARDING_STATUS_LABELS[statusOf(record)] ?? statusOf(record)
      }`,
      ["STT", "Mục checklist", "Bắt buộc", "Hoàn thành"],
      items.map((item, index) => [
        index + 1,
        item.label,
        item.required ? "Có" : "Không",
        item.completed ? "Đã hoàn thành" : "Chưa hoàn thành",
      ]),
    );
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const toggleAllRows = () => {
    const pageIds = rows.map((record) => record.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    setSelected((prev) =>
      allSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])),
    );
  };

  const confirmBulkDelete = async () => {
    try {
      await deleteRows("onboarding_records", selected);
      toast.success(`Đã xoá ${selected.length} bản ghi hội nhập`);
      setSelected([]);
      setBulkDeleteOpen(false);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được bản ghi", { description: getErrorMessage(deleteError) });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await updateRow("onboarding_records", cancelTarget.id, { status: "cancelled" });
      if (detail?.id === cancelTarget.id) {
        setDetail({ ...detail, status: "cancelled" });
        await reloadActivity(detail.id);
      }
      toast.success("Đã hủy hội nhập", { description: cancelTarget.full_name });
      setCancelTarget(null);
      await load();
    } catch (cancelError) {
      toast.error("Không hủy được hội nhập", { description: getErrorMessage(cancelError) });
    }
  };

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Vị trí",
    "Bộ phận",
    "Ngày nhận việc",
    "Dự kiến hoàn thành",
    "Trạng thái",
    "Checklist hoàn thành",
    "Tiến độ (%)",
  ];

  const exportRows = () =>
    filtered.map((record) => {
      const progress = progressOf(record);
      return [
        record.employee_id ? employeeById.get(record.employee_id)?.code ?? "" : "",
        record.full_name,
        record.position ?? "",
        record.department ?? "",
        record.hire_date ?? "",
        record.expected_completion_date ?? "",
        ONBOARDING_STATUS_LABELS[statusOf(record)] ?? statusOf(record),
        `${progress.done}/${progress.total}`,
        progress.percent,
      ];
    });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Quản lý nhân sự"
        title="Hội nhập"
        description="Theo dõi hồ sơ hội nhập nhân sự mới, checklist và tiến độ hoàn thành."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => exportExcel("hoi-nhap-nhan-su", exportHeaders, exportRows(), "Hội nhập nhân sự")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportPdf("Hội nhập nhân sự", activeCompany?.name ?? "Công ty", exportHeaders, exportRows())
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            {canManage && (
              <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => void openCreate()}>
                <Plus className="h-4 w-4" /> Thêm hội nhập
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Chờ hội nhập", value: stats.pending, tone: "text-warning" },
          { label: "Đang hội nhập", value: stats.inProgress, tone: "text-info" },
          { label: "Hoàn thành", value: stats.completed, tone: "text-success" },
          { label: "Đã huỷ", value: stats.cancelled, tone: "text-muted-foreground" },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {item.label}
            </p>
            <p className={`mt-1 font-display text-[22px] font-semibold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm nhân viên, vị trí…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[240px]"
          />
        </label>

        <select
          value={departmentFilter}
          onChange={(event) => {
            setDepartmentFilter(event.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả bộ phận</option>
          {departmentOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={positionFilter}
          onChange={(event) => {
            setPositionFilter(event.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả vị trí</option>
          {positionOptions.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {ONBOARDING_STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={fromDate}
          onChange={(event) => {
            setFromDate(event.target.value);
            setPage(1);
          }}
          className="h-9 w-[150px] text-[12px]"
          aria-label="Ngày nhận việc từ"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(event) => {
            setToDate(event.target.value);
            setPage(1);
          }}
          className="h-9 w-[150px] text-[12px]"
          aria-label="Ngày nhận việc đến"
        />

        <select
          value={String(pageSize)}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} / trang
            </option>
          ))}
        </select>

        <span className="ml-auto text-[11.5px] text-muted-foreground">{filtered.length} bản ghi</span>
      </Card>

      {canManage && selected.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
          <p className="text-[12px] font-medium text-foreground">Đã chọn {selected.length} bản ghi</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-[11.5px]" onClick={() => setSelected([])}>
              Bỏ chọn
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Xoá đã chọn
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải hồ sơ hội nhập…
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <UserPlus className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có hồ sơ hội nhập phù hợp</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                  {canManage && (
                    <th className="w-[40px] px-2 py-2.5 text-center font-semibold">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả bản ghi trên trang"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={rows.length > 0 && rows.every((record) => selected.includes(record.id))}
                        onChange={toggleAllRows}
                      />
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-left font-semibold">Nhân viên</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Vị trí</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Bộ phận</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Ngày nhận việc</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Dự kiến hoàn thành</th>
                  <th className="w-[190px] px-3 py-2.5 text-left font-semibold">Tiến độ hội nhập</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                  <th className="w-[48px] px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => {
                  const progress = progressOf(record);
                  const employee = record.employee_id ? employeeById.get(record.employee_id) : null;
                  return (
                    <tr key={record.id} className="border-t border-border/50 hover:bg-muted/20">
                      {canManage && (
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${record.full_name}`}
                            className="h-3.5 w-3.5 accent-primary"
                            checked={selected.includes(record.id)}
                            onChange={() => toggleSelected(record.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => void openDetail(record)}
                          className="text-left text-[12px] font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {record.full_name}
                        </button>
                        <p className="text-[11px] text-muted-foreground">{employee?.code ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-foreground">{record.position ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{record.department ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-foreground">
                        {record.hire_date ? formatDay(record.hire_date) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                        {record.expected_completion_date ? formatDay(record.expected_completion_date) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${progressBarTone(progress.percent)}`}
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] font-medium text-muted-foreground">
                            {progress.percent}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {progress.done}/{progress.total} mục
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant={statusTone(statusOf(record))}>
                          {ONBOARDING_STATUS_LABELS[statusOf(record)] ?? statusOf(record)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Thao tác hội nhập">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[210px]">
                            <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => void openDetail(record)}>
                              <Eye className="h-3.5 w-3.5" /> Xem chi tiết
                            </DropdownMenuItem>
                            {record.employee_id && (
                              <DropdownMenuItem className="gap-2 text-[12.5px]" asChild>
                                <Link to={`/employees/${record.employee_id}?tab=onboarding`}>
                                  Mở hồ sơ nhân viên
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <>
                                {statusOf(record) !== "cancelled" && statusOf(record) !== "completed" && (
                                  <DropdownMenuItem
                                    className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                                    onSelect={() => setCancelTarget(record)}
                                  >
                                    Hủy hội nhập
                                  </DropdownMenuItem>
                                )}
                                {record.status !== "cancelled" && (
                                  <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => openEdit(record)}>
                                    <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                                  onSelect={() => setPendingDelete(record)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Xoá bản ghi
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-[11.5px] text-muted-foreground">
            <span>
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} trong{" "}
              {filtered.length} bản ghi
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Trang trước"
                disabled={currentPage === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                ‹
              </Button>
              <span className="px-1 text-[11.5px] font-medium text-foreground">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Trang sau"
                disabled={currentPage === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                ›
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {detail?.full_name}
              {detail && (
                <Badge variant={statusTone(statusOf(detail))} title="Trạng thái tự động theo tiến độ hội nhập">
                  {ONBOARDING_STATUS_LABELS[statusOf(detail)] ?? statusOf(detail)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detail?.position ?? "—"}
              {detail?.department ? ` · ${detail.department}` : ""} · Nhận việc{" "}
              {detail?.hire_date ? formatDay(detail.hire_date) : "—"} · Dự kiến hoàn thành{" "}
              {detail?.expected_completion_date ? formatDay(detail.expected_completion_date) : "—"}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-5 py-1">
              <div>
                <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span>Tiến độ hội nhập</span>
                  <span>
                    {progressOf(detail).done}/{progressOf(detail).total} mục ·{" "}
                    {progressOf(detail).percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${progressBarTone(progressOf(detail).percent)}`}
                    style={{ width: `${progressOf(detail).percent}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Checklist hội nhập
                </p>
                {detail.status === "cancelled" && (
                  <p className="mt-1 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11px] text-destructive">
                    Hồ sơ đã hủy hội nhập — không thể chỉnh sửa hoặc tích checklist.
                  </p>
                )}
                <div className="mt-2 space-y-1 rounded-md border border-border p-2">
                  {mergeChecklist(detail).length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11.5px] text-muted-foreground">
                      Chưa có mục checklist. Thêm tại Cài đặt check list → Checklist hội nhập.
                    </p>
                  ) : (
                    mergeChecklist(detail).map((item) => (
                      <div key={item.id} className="flex items-start gap-2 rounded px-1.5 py-1 hover:bg-muted/50">
                        <button
                          type="button"
                          disabled={!canManage || detail.status === "cancelled"}
                          onClick={() => void toggleDetailItem(item.id)}
                          className="flex flex-1 items-start gap-2 text-left disabled:cursor-default"
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              item.completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                            }`}
                          >
                            {item.completed && <Check className="h-3 w-3" />}
                          </span>
                          <span className="text-[11.5px] text-foreground">
                            {item.label}
                            {item.required && <span className="ml-1 text-[11px] text-destructive">*</span>}
                          </span>
                        </button>
                        {item.attachment_path && (
                          <button
                            type="button"
                            onClick={() => void openAttachment(item.attachment_path as string)}
                            className="inline-flex max-w-[140px] shrink-0 items-center gap-1 truncate text-[11px] text-primary hover:underline"
                            title={item.attachment_name ?? "Tài liệu đính kèm"}
                          >
                            <Paperclip className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.attachment_name ?? "Tài liệu"}</span>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Bình luận ({comments.length})
                </p>
                <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="rounded-md border border-border px-3 py-4 text-center text-[11.5px] text-muted-foreground">
                      Chưa có bình luận.
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-semibold text-foreground">
                            {comment.author_name ?? "Thành viên"}
                          </p>
                          <p className="whitespace-pre-line text-[11.5px] text-muted-foreground">{comment.content}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                            {new Date(comment.created_at).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        {(canManage || comment.author_id === user?.id) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Xoá bình luận"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => void removeComment(comment)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <Textarea
                    rows={2}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Viết bình luận về quá trình hội nhập…"
                  />
                  <Button
                    className="h-9 gap-1.5"
                    onClick={() => void addComment()}
                    disabled={commentBusy || !commentText.trim()}
                  >
                    {commentBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Gửi
                  </Button>
                </div>
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Lịch sử thao tác ({activity.length})
                </p>
                <div className="mt-2 max-h-[200px] space-y-1.5 overflow-y-auto">
                  {activity.length === 0 ? (
                    <p className="rounded-md border border-border px-3 py-4 text-center text-[11.5px] text-muted-foreground">
                      Chưa có thao tác nào được ghi nhận.
                    </p>
                  ) : (
                    activity.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                        <p className="text-[11.5px] text-foreground">{entry.summary}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {entry.actor_name ?? "Hệ thống"} · {new Date(entry.created_at).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {detail.employee_id && (
                <Link
                  to={`/employees/${detail.employee_id}?tab=onboarding`}
                  className="inline-flex text-[11.5px] font-medium text-primary hover:underline"
                >
                  Mở tab hội nhập trong hồ sơ nhân viên
                </Link>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={closeDetail}>
              Đóng
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => detail && exportDetailPdf(detail)}
            >
              <FileDown className="h-3.5 w-3.5" /> Xuất PDF
            </Button>
            {canManage && detail && statusOf(detail) !== "cancelled" && statusOf(detail) !== "completed" && (
              <Button
                variant="outline"
                className="h-9 text-destructive hover:text-destructive"
                onClick={() => setCancelTarget(detail)}
              >
                Hủy hội nhập
              </Button>
            )}
            {canManage && detail && detail.status !== "cancelled" && (
              <Button
                className="h-9 gap-1.5"
                onClick={() => {
                  const record = detail;
                  setDetail(null);
                  openEdit(record);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa hồ sơ hội nhập" : "Thêm hồ sơ hội nhập"}</DialogTitle>
            <DialogDescription>
              Vị trí và bộ phận tự đồng bộ theo nhân viên được chọn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px]">Nhân viên *</Label>
                <Select value={employeeId} onValueChange={pickEmployee}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Chọn nhân viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name} · {employee.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Vị trí</Label>
                <Input
                  value={employees.find((item) => item.id === employeeId)?.position ?? ""}
                  readOnly
                  className="h-10 bg-muted/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Bộ phận</Label>
                <Input
                  value={employees.find((item) => item.id === employeeId)?.department ?? ""}
                  readOnly
                  className="h-10 bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Ngày nhận việc</Label>
                <Input
                  type="date"
                  value={hireDate}
                  onChange={(event) => {
                    setHireDate(event.target.value);
                    if (event.target.value) setExpectedDate(addDays(event.target.value, 3));
                  }}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Ngày hoàn thành dự kiến</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(event) => setExpectedDate(event.target.value)}
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">Mặc định: ngày nhận việc + 3 ngày.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Trạng thái</Label>
                <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-[12px] text-muted-foreground">
                  Tự động theo tiến độ checklist
                </div>
                <p className="text-[11px] text-muted-foreground">
                  0%: Chờ hội nhập · &gt;0%: Đang hội nhập · 100%: Hoàn thành.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px]">Checklist hội nhập</Label>
                <span className="text-[11px] text-muted-foreground">
                  {checklist.filter((item) => item.completed).length}/{checklist.length} mục
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${progressBarTone(
                    checklist.length
                      ? Math.round((checklist.filter((item) => item.completed).length / checklist.length) * 100)
                      : 0,
                  )}`}
                  style={{
                    width: `${checklist.length ? Math.round((checklist.filter((item) => item.completed).length / checklist.length) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {checklist.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11.5px] text-muted-foreground">
                    Chưa có mục checklist — thêm tại Cài đặt check list → Checklist hội nhập.
                  </p>
                ) : (
                  checklist.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklist(item.id)}
                      className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-muted/50"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          item.completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                        }`}
                      >
                        {item.completed && <Check className="h-3 w-3" />}
                      </span>
                      <span className="text-[11.5px] text-foreground">
                        {item.label}
                        {item.required && <span className="ml-1 text-[11px] text-destructive">*</span>}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px]">Ghi chú</Label>
              <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={closeForm} disabled={saving}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Lưu thay đổi" : "Thêm hồ sơ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá hồ sơ hội nhập?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.full_name} sẽ bị xoá khỏi danh sách hội nhập. Hồ sơ nhân viên vẫn được giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeRecord()}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy hội nhập?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.full_name} sẽ chuyển sang trạng thái “Đã hủy”. Checklist và bình luận được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmCancel()}
            >
              Hủy hội nhập
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {selected.length} bản ghi hội nhập?</AlertDialogTitle>
            <AlertDialogDescription>
              Các bản ghi đã chọn sẽ bị xoá khỏi danh sách hội nhập. Hồ sơ nhân viên vẫn được giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmBulkDelete()}
            >
              Xoá đã chọn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppShell>
  );
};

export default Onboarding;
