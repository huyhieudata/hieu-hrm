import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Lock,
  MoreHorizontal,
  PencilLine,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Unlock,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { listEmployees } from "@/lib/employee-records";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { printHtml } from "@/lib/employee-documents";
import { cn, getErrorMessage } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DEPENDENT_DEDUCTION,
  INSURANCE_EMPLOYEE_RATE,
  PAYROLL_STATUS_LABELS,
  PERSONAL_DEDUCTION,
  applyPayrollAdjustment,
  buildPayslipBatchHtml,
  buildPayslipHtml,
  calculatePayroll,
  createPayrollPeriod,
  deletePayrollPeriod,
  listPayrollItems,
  listPayrollPeriods,
  payrollPeriodRange,
  replacePayrollItems,
  updatePayrollItem,
  updatePayrollPeriod,
  type PayrollAttendanceInput,
  type PayrollEmployeeInput,
  type PayrollItem,
  type PayrollLeaveInput,
  type PayrollPeriod,
  type PayrollSalaryInput,
  type PayrollShiftInput,
  type PayrollWarning,
  type PayrollWarningCode,
} from "@/lib/payroll";

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const money = (value: number) =>
  value ? `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} đ` : "—";

const compactMoney = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2).replace(".", ",")} tỷ`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} tr`;
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} đ`;
};

const dayCount = (value: number) => {
  const numeric = Number(value ?? 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const statusTone = (status: string) =>
  status === "paid" ? "success" : status === "locked" ? "info" : "muted";

const moneyDelta = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${new Intl.NumberFormat("vi-VN").format(Math.abs(Math.round(value)))} đ`;

const adjustedLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const WARNING_LABEL: Record<PayrollWarningCode, string> = {
  no_salary: "Thiếu lương",
  no_attendance: "Thiếu chấm công",
  mid_month: "Vào giữa kỳ",
  resigned_in_period: "Nghỉ trong kỳ",
};

type SortKey = "name" | "net" | "days";

const sortLabels: Record<SortKey, string> = {
  name: "Tên A → Z",
  net: "Thực nhận cao nhất",
  days: "Nhiều ngày công",
};

interface CalcReport {
  period: PayrollPeriod;
  count: number;
  net: number;
  tax: number;
  insurance: number;
  warnings: PayrollWarning[];
  missing: number;
  hasAttendanceData: boolean;
}

interface PeriodMenuProps {
  period: PayrollPeriod;
  itemCount: number;
  busy: boolean;
  canManage: boolean;
  onView: () => void;
  onGenerate: () => void;
  onRequestLock: () => void;
  onMarkPaid: () => void;
  onUnlock: () => void;
  onRevert: () => void;
  onDelete: () => void;
}

const PeriodMenu = ({
  period,
  itemCount,
  busy,
  canManage,
  onView,
  onGenerate,
  onRequestLock,
  onMarkPaid,
  onUnlock,
  onRevert,
  onDelete,
}: PeriodMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác kỳ lương tháng ${period.month}/${period.year}`}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[230px]">
      <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={onView}>
        Xem bảng lương
      </DropdownMenuItem>
      {canManage && period.status === "draft" && (
        <DropdownMenuItem className="gap-2 text-[12.5px]" disabled={busy} onSelect={onGenerate}>
          <Calculator className="h-3.5 w-3.5" /> Tính / tính lại lương
        </DropdownMenuItem>
      )}
      {canManage && period.status === "draft" && (
        <DropdownMenuItem className="gap-2 text-[12.5px]" disabled={itemCount === 0} onSelect={onRequestLock}>
          <Lock className="h-3.5 w-3.5" /> Chốt kỳ lương
        </DropdownMenuItem>
      )}
      {canManage && period.status === "locked" && (
        <>
          <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={onMarkPaid}>
            <BadgeCheck className="h-3.5 w-3.5" /> Đánh dấu đã chi trả
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={onUnlock}>
            <Unlock className="h-3.5 w-3.5" /> Mở khoá kỳ lương
          </DropdownMenuItem>
        </>
      )}
      {canManage && period.status === "paid" && (
        <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={onRevert}>
          <RotateCcw className="h-3.5 w-3.5" /> Hoàn tác chi trả
        </DropdownMenuItem>
      )}
      {canManage && period.status === "draft" && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Xoá kỳ lương
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const Payroll = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("payroll");

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PayrollPeriod | null>(null);
  const [pendingLock, setPendingLock] = useState<PayrollPeriod | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<PayrollPeriod | null>(null);
  const [report, setReport] = useState<CalcReport | null>(null);
  const [adjustItem, setAdjustItem] = useState<PayrollItem | null>(null);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [periodRows, itemRows] = await Promise.all([
        listPayrollPeriods(companyId),
        listPayrollItems(companyId),
      ]);
      setPeriods(periodRows);
      setItems(itemRows);
    } catch (error) {
      toast.error("Không tải được dữ liệu lương", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSearch("");
    setDepartment("all");
    setSort("name");
  }, [detailPeriod?.id]);

  const itemsByPeriod = useMemo(() => {
    const map = new Map<string, PayrollItem[]>();
    items.forEach((item) => {
      const list = map.get(item.period_id);
      if (list) list.push(item);
      else map.set(item.period_id, [item]);
    });
    return map;
  }, [items]);

  const periodTotals = useCallback(
    (periodId: string) => {
      const list = itemsByPeriod.get(periodId) ?? [];
      return {
        count: list.length,
        gross: list.reduce((sum, item) => sum + Number(item.gross_salary), 0),
        net: list.reduce((sum, item) => sum + Number(item.net_salary), 0),
        tax: list.reduce((sum, item) => sum + Number(item.tax_amount), 0),
        insurance: list.reduce((sum, item) => sum + Number(item.insurance_employee), 0),
        zeroDays: list.filter((item) => Number(item.work_days) <= 0).length,
      };
    },
    [itemsByPeriod],
  );

  const latestTotals = useMemo(
    () => (periods[0] ? periodTotals(periods[0].id) : { count: 0, gross: 0, net: 0, tax: 0, insurance: 0, zeroDays: 0 }),
    [periods, periodTotals],
  );
  const previousTotals = useMemo(
    () => (periods[1] ? periodTotals(periods[1].id) : null),
    [periods, periodTotals],
  );

  const percentChange = (current: number, before?: number) =>
    before && before > 0 ? Math.round(((current - before) / before) * 1000) / 10 : undefined;

  const netDelta = percentChange(latestTotals.net, previousTotals?.net);
  const countDelta = percentChange(latestTotals.count, previousTotals?.count);
  const taxDelta = percentChange(latestTotals.tax, previousTotals?.tax);
  const insuranceDelta = percentChange(latestTotals.insurance, previousTotals?.insurance);

  const trend = useMemo(() => {
    const values = periods.slice(0, 6).reverse().map((period) => periodTotals(period.id));
    const series = (key: "net" | "count" | "tax" | "insurance") => {
      const data = values.map((value) => value[key]);
      if (data.length === 0) return [0, 0];
      return data.length >= 2 ? data : [data[0], data[0]];
    };
    return { net: series("net"), count: series("count"), tax: series("tax"), insurance: series("insurance") };
  }, [periods, periodTotals]);

  const detailItems = useMemo(
    () => (detailPeriod ? itemsByPeriod.get(detailPeriod.id) ?? [] : []),
    [detailPeriod, itemsByPeriod],
  );

  const previousPeriod = useMemo(() => {
    if (!detailPeriod) return null;
    const index = periods.findIndex((period) => period.id === detailPeriod.id);
    return index >= 0 ? periods[index + 1] ?? null : null;
  }, [periods, detailPeriod]);

  const previousItems = useMemo(() => {
    const map = new Map<string, PayrollItem>();
    (previousPeriod ? itemsByPeriod.get(previousPeriod.id) ?? [] : []).forEach((item) =>
      map.set(item.employee_id, item),
    );
    return map;
  }, [previousPeriod, itemsByPeriod]);

  const departments = useMemo(
    () =>
      Array.from(new Set(detailItems.map((item) => item.department).filter((value): value is string => !!value))).sort(
        (a, b) => a.localeCompare(b, "vi"),
      ),
    [detailItems],
  );

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = detailItems.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.employee_name.toLowerCase().includes(keyword) ||
        (item.employee_code ?? "").toLowerCase().includes(keyword);
      const matchesDepartment = department === "all" || item.department === department;
      return matchesKeyword && matchesDepartment;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "net") return Number(b.net_salary) - Number(a.net_salary);
      if (sort === "days") return Number(b.work_days) - Number(a.work_days);
      return a.employee_name.localeCompare(b.employee_name, "vi");
    });
  }, [detailItems, search, department, sort]);

  const detailTotals = useMemo(
    () =>
      visibleItems.reduce(
        (acc, item) => ({
          base: acc.base + Number(item.base_salary),
          allowance:
            acc.allowance +
            Number(item.position_allowance) +
            Number(item.responsibility_allowance) +
            Number(item.other_allowance),
          gross: acc.gross + Number(item.gross_salary),
          insurance: acc.insurance + Number(item.insurance_employee),
          tax: acc.tax + Number(item.tax_amount),
          net: acc.net + Number(item.net_salary),
          delta: acc.delta + (previousItems.get(item.employee_id)
            ? Number(item.net_salary) - Number(previousItems.get(item.employee_id)?.net_salary ?? 0)
            : 0),
        }),
        { base: 0, allowance: 0, gross: 0, insurance: 0, tax: 0, net: 0, delta: 0 },
      ),
    [visibleItems, previousItems],
  );

  const periodFields: FieldDef[] = [
    {
      name: "month",
      label: "Kỳ lương",
      type: "month",
      required: true,
      span: 2,
      hint: "Chọn tháng cần tính lương. Mỗi tháng chỉ có một kỳ lương.",
    },
    { name: "standard_work_days", label: "Ngày công chuẩn", type: "number", placeholder: "26" },
    { name: "note", label: "Ghi chú", placeholder: "Kỳ lương tháng…" },
  ];

  const adjustmentFields: FieldDef[] = [
    {
      name: "other_allowance",
      label: "Phụ cấp khác (đ)",
      type: "currency",
      placeholder: "0",
      hint: "Cộng thêm vào tổng thu nhập của phiếu lương.",
    },
    {
      name: "other_deduction",
      label: "Khấu trừ khác (đ)",
      type: "currency",
      placeholder: "0",
      hint: "Tạm ứng, phạt… trừ vào thực nhận.",
    },
    {
      name: "note",
      label: "Ghi chú điều chỉnh",
      type: "textarea",
      span: 2,
      placeholder: "Ví dụ: thưởng dự án tháng 10",
    },
  ];

  const handleCreatePeriod = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    const raw = String(values.month ?? "");
    if (!raw) throw new Error("Vui lòng chọn kỳ lương.");
    const [year, month] = raw.split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) throw new Error("Kỳ lương không hợp lệ.");
    const standardDays = Number(values.standard_work_days ?? 26);
    if (!Number.isFinite(standardDays) || standardDays <= 0 || standardDays > 31) {
      throw new Error("Ngày công chuẩn phải trong khoảng 1 – 31.");
    }

    try {
      await createPayrollPeriod({
        company_id: companyId,
        year,
        month,
        standard_work_days: standardDays,
        note: (values.note as string) || null,
        created_by: user?.id ?? null,
      });
      toast.success(`Đã tạo kỳ lương tháng ${month}/${year}`, {
        description: "Bấm “Tính lương” để tạo bảng lương từ chấm công và hợp đồng.",
      });
      setFormOpen(false);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const generate = async (period: PayrollPeriod) => {
    if (!companyId) return;
    if (period.status !== "draft") {
      toast.error("Kỳ lương đã chốt", { description: "Mở khoá kỳ lương trước khi tính lại." });
      return;
    }
    setBusyId(period.id);
    try {
      const { start, end } = payrollPeriodRange(period.year, period.month);
      const employeeRows = await listEmployees(companyId);

      const [salaryResult, attendanceResult, shiftResult, typeResult, leaveResult] = await Promise.all([
        supabase
          .from("employee_salary_records")
          .select(
            "employee_id, effective_date, base_salary, position_allowance, responsibility_allowance, other_allowance, insurance_salary",
          )
          .eq("company_id", companyId)
          .lte("effective_date", end),
        supabase
          .from("attendance_records")
          .select("employee_id, work_date, check_in, check_out, shift_id")
          .eq("company_id", companyId)
          .gte("work_date", start)
          .lte("work_date", end),
        supabase.from("work_shifts").select("id, work_credit, forgot_checkout_credit").eq("company_id", companyId),
        supabase.from("request_types").select("id, category, deduct_leave").eq("company_id", companyId),
        supabase
          .from("requests")
          .select("employee_id, start_date, end_date, leave_days, status, request_type_id")
          .eq("company_id", companyId)
          .eq("status", "approved")
          .lte("start_date", end)
          .gte("end_date", start),
      ]);

      const failure = [salaryResult, attendanceResult, shiftResult, typeResult, leaveResult].find(
        (result) => result.error,
      )?.error;
      if (failure) throw new Error(failure.message);

      const typeById = new Map(
        ((typeResult.data ?? []) as { id: string; category: string | null; deduct_leave: boolean | null }[]).map(
          (row) => [row.id, row],
        ),
      );
      const leaves: PayrollLeaveInput[] = (
        (leaveResult.data ?? []) as {
          employee_id: string;
          start_date: string;
          end_date: string;
          leave_days: number | null;
          status: string;
          request_type_id: string | null;
        }[]
      ).flatMap((row) => {
        const type = row.request_type_id ? typeById.get(row.request_type_id) : null;
        if (!type) return [];
        return [
          {
            employee_id: row.employee_id,
            start_date: row.start_date,
            end_date: row.end_date,
            leave_days: row.leave_days,
            status: row.status,
            category: type.category,
            deduct_leave: type.deduct_leave,
          },
        ];
      });

      const { items: calculated, warnings, hasAttendanceData } = calculatePayroll({
        companyId,
        period,
        employees: employeeRows as PayrollEmployeeInput[],
        salaries: (salaryResult.data ?? []) as PayrollSalaryInput[],
        attendance: (attendanceResult.data ?? []) as PayrollAttendanceInput[],
        shifts: (shiftResult.data ?? []) as PayrollShiftInput[],
        leaves,
      });

      await replacePayrollItems(period.id, calculated as unknown as Record<string, unknown>[]);
      await load();

      setReport({
        period,
        count: calculated.length,
        net: calculated.reduce((sum, item) => sum + Number(item.net_salary), 0),
        tax: calculated.reduce((sum, item) => sum + Number(item.tax_amount), 0),
        insurance: calculated.reduce((sum, item) => sum + Number(item.insurance_employee), 0),
        warnings,
        missing: warnings.filter((warning) => warning.code === "no_salary").length,
        hasAttendanceData,
      });

      if (calculated.length === 0) {
        toast.warning("Chưa tính được phiếu lương nào", {
          description: "Kiểm tra bảng lương và dữ liệu chấm công của kỳ này.",
        });
      }
    } catch (error) {
      toast.error("Không tính được bảng lương", { description: getErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  const setPeriodStatus = async (
    period: PayrollPeriod,
    status: PayrollPeriod["status"],
    message: string,
  ) => {
    try {
      await updatePayrollPeriod(period.id, { status });
      toast.success(message);
      await load();
    } catch (error) {
      toast.error("Không cập nhật được kỳ lương", { description: getErrorMessage(error) });
    }
  };

  const requestLock = (period: PayrollPeriod) => {
    if (periodTotals(period.id).count === 0) {
      toast.error("Chưa có bảng lương", { description: "Tính lương trước khi chốt kỳ." });
      return;
    }
    setPendingLock(period);
  };

  const confirmLock = async () => {
    if (!pendingLock) return;
    await setPeriodStatus(pendingLock, "locked", "Đã chốt kỳ lương");
    setPendingLock(null);
  };

  const removePeriod = async () => {
    if (!pendingDelete) return;
    try {
      await deletePayrollPeriod(pendingDelete.id);
      toast.success("Đã xoá kỳ lương");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được kỳ lương", { description: getErrorMessage(error) });
    }
  };

  const handleAdjust = async (values: Record<string, string | number | null>) => {
    if (!adjustItem) throw new Error("Không tìm thấy phiếu lương.");
    try {
      const patch = applyPayrollAdjustment(adjustItem, {
        other_allowance: Number(values.other_allowance ?? 0),
        other_deduction: Number(values.other_deduction ?? 0),
        note: (values.note as string) || null,
      });
      await updatePayrollItem(adjustItem.id, patch);
      toast.success(`Đã lưu điều chỉnh cho ${adjustItem.employee_name}`, {
        description: `Thực nhận mới: ${money(patch.net_salary)}`,
      });
      setAdjustItem(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const printAll = () => {
    if (!detailPeriod || detailItems.length === 0) return;
    printHtml(
      buildPayslipBatchHtml({
        companyName: activeCompany?.name ?? "Công ty",
        period: detailPeriod,
        items: detailItems,
      }),
    );
  };

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    "Công chấm công",
    "Ngày phép",
    "Công tính lương",
    "Lương cơ bản",
    "Phụ cấp",
    "Tổng thu nhập",
    "BH nhân viên",
    "Thuế TNCN",
    "Thực nhận",
    "Ghi chú",
  ];
  const exportRows = (rows: PayrollItem[]) =>
    rows.map((item) => [
      item.employee_code ?? "",
      item.employee_name,
      item.department ?? "",
      Number(item.attendance_days),
      Number(item.leave_days),
      Number(item.work_days),
      Number(item.base_salary),
      Number(item.position_allowance) + Number(item.responsibility_allowance) + Number(item.other_allowance),
      Number(item.gross_salary),
      Number(item.insurance_employee),
      Number(item.tax_amount),
      Number(item.net_salary),
      item.note ?? "",
    ]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Tính lương"
        title="Kỳ lương"
        description="Tính lương theo tháng từ hợp đồng, chấm công, BHXH và thuế TNCN; kiểm tra dữ liệu trước khi chốt và in phiếu lương."
        actions={
          canManage && (
            <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Tạo kỳ lương
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Thực nhận kỳ gần nhất"
          value={periods[0] ? compactMoney(latestTotals.net) : "—"}
          delta={netDelta}
          deltaLabel={
            periods[0] ? (periods[1] ? "so với kỳ trước" : "Kỳ đầu tiên") : "Chưa có kỳ lương"
          }
          icon={Wallet}
          tone="primary"
          data={trend.net}
        />
        <StatCard
          label="Nhân sự được tính lương"
          value={String(latestTotals.count)}
          unit={periods[0] ? "người" : undefined}
          delta={countDelta}
          deltaLabel={periods[0] ? (periods[1] ? "so với kỳ trước" : "Kỳ đầu tiên") : "Chưa có kỳ lương"}
          icon={Users}
          tone="teal"
          data={trend.count}
        />
        <StatCard
          label="Thuế TNCN kỳ gần nhất"
          value={periods[0] ? compactMoney(latestTotals.tax) : "—"}
          delta={taxDelta}
          positiveIsGood={false}
          deltaLabel={periods[0] ? (periods[1] ? "so với kỳ trước" : "Kỳ đầu tiên") : "Chưa có kỳ lương"}
          icon={ReceiptText}
          tone="amber"
          data={trend.tax}
        />
        <StatCard
          label="Bảo hiểm nhân viên"
          value={periods[0] ? compactMoney(latestTotals.insurance) : "—"}
          delta={insuranceDelta}
          positiveIsGood={false}
          deltaLabel={periods[0] ? (periods[1] ? "so với kỳ trước" : "Kỳ đầu tiên") : "Chưa có kỳ lương"}
          icon={ShieldCheck}
          tone="violet"
          data={trend.insurance}
        />
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải kỳ lương…
        </Card>
      ) : periods.length === 0 ? (
        <Card className="p-12 text-center">
          <Calculator className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có kỳ lương</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tạo kỳ lương tháng để bắt đầu tính lương.</p>
          {canManage && (
            <Button className="mt-3 h-9 gap-1.5 text-[12.5px]" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Tạo kỳ lương
            </Button>
          )}
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <div className="scrollbar-slim overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Kỳ lương</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Nhân sự</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Quỹ lương</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Thuế TNCN</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Thực nhận</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                    <th className="w-[150px] px-3 py-2.5 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => {
                    const totals = periodTotals(period.id);
                    const emptyDraft = period.status === "draft" && totals.count === 0;
                    return (
                      <tr key={period.id} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => setDetailPeriod(period)}
                            className="text-[12.5px] font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            Tháng {period.month}/{period.year}
                          </button>
                          <p className="text-[10px] text-muted-foreground">{period.standard_work_days} ngày công chuẩn</p>
                        </td>
                        <td className="px-3 py-2.5 text-center text-[12px] text-muted-foreground">{totals.count}</td>
                        <td className="px-3 py-2.5 text-right text-[12px] text-foreground">{money(totals.gross)}</td>
                        <td className="px-3 py-2.5 text-right text-[12px] text-muted-foreground">{money(totals.tax)}</td>
                        <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-foreground">{money(totals.net)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={statusTone(period.status)}>
                            {PAYROLL_STATUS_LABELS[period.status] ?? period.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && emptyDraft && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[11px]"
                                disabled={busyId === period.id}
                                onClick={() => void generate(period)}
                              >
                                {busyId === period.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Calculator className="h-3 w-3" />
                                )}
                                Tính lương
                              </Button>
                            )}
                            <PeriodMenu
                              period={period}
                              itemCount={totals.count}
                              busy={busyId === period.id}
                              canManage={canManage}
                              onView={() => setDetailPeriod(period)}
                              onGenerate={() => void generate(period)}
                              onRequestLock={() => requestLock(period)}
                              onMarkPaid={() => void setPeriodStatus(period, "paid", "Đã đánh dấu chi trả")}
                              onUnlock={() => void setPeriodStatus(period, "draft", "Đã mở khoá kỳ lương")}
                              onRevert={() => void setPeriodStatus(period, "locked", "Đã hoàn tác chi trả")}
                              onDelete={() => setPendingDelete(period)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-2 md:hidden">
            {periods.map((period) => {
              const totals = periodTotals(period.id);
              return (
                <Card key={period.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => setDetailPeriod(period)}>
                      <p className="text-[13px] font-semibold text-foreground">Tháng {period.month}/{period.year}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {period.standard_work_days} ngày công chuẩn · {totals.count} nhân sự
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={statusTone(period.status)}>
                        {PAYROLL_STATUS_LABELS[period.status] ?? period.status}
                      </Badge>
                      <PeriodMenu
                        period={period}
                        itemCount={totals.count}
                        busy={busyId === period.id}
                        canManage={canManage}
                        onView={() => setDetailPeriod(period)}
                        onGenerate={() => void generate(period)}
                        onRequestLock={() => requestLock(period)}
                        onMarkPaid={() => void setPeriodStatus(period, "paid", "Đã đánh dấu chi trả")}
                        onUnlock={() => void setPeriodStatus(period, "draft", "Đã mở khoá kỳ lương")}
                        onRevert={() => void setPeriodStatus(period, "locked", "Đã hoàn tác chi trả")}
                        onDelete={() => setPendingDelete(period)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Thực nhận</p>
                      <p className="tabular mt-0.5 text-[15px] font-semibold text-foreground">{money(totals.net)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Thuế TNCN</p>
                      <p className="tabular mt-0.5 text-[12px] text-muted-foreground">{money(totals.tax)}</p>
                    </div>
                  </div>
                  {canManage && period.status === "draft" && totals.count === 0 && (
                    <Button
                      variant="outline"
                      className="mt-3 h-8 w-full gap-1.5 text-[12px]"
                      disabled={busyId === period.id}
                      onClick={() => void generate(period)}
                    >
                      {busyId === period.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Calculator className="h-3.5 w-3.5" />
                      )}
                      Tính lương kỳ này
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Tạo kỳ lương"
        description="Mỗi tháng chỉ có một kỳ lương. Sau khi tạo, bấm Tính lương để sinh bảng lương."
        fields={periodFields}
        initial={{ month: currentMonth(), standard_work_days: 26 }}
        submitLabel="Tạo kỳ lương"
        onSubmit={handleCreatePeriod}
      />

      <FieldDialog
        open={!!adjustItem}
        onOpenChange={(open) => !open && setAdjustItem(null)}
        title={adjustItem ? `Điều chỉnh phiếu lương · ${adjustItem.employee_name}` : "Điều chỉnh phiếu lương"}
        description="Phụ cấp và khấu trừ được cộng/trừ vào phiếu lương; thuế và thực nhận tự tính lại."
        fields={adjustmentFields}
        initial={
          adjustItem
            ? {
                other_allowance: Number(adjustItem.other_allowance),
                other_deduction: Number(adjustItem.other_deduction),
                note: adjustItem.note ?? "",
              }
            : null
        }
        submitLabel="Lưu điều chỉnh"
        onSubmit={handleAdjust}
      />

      <Dialog open={!!detailPeriod} onOpenChange={(open) => !open && setDetailPeriod(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1180px]">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Bảng lương tháng {detailPeriod?.month}/{detailPeriod?.year}</DialogTitle>
              {detailPeriod && (
                <Badge variant={statusTone(detailPeriod.status)}>
                  {PAYROLL_STATUS_LABELS[detailPeriod.status] ?? detailPeriod.status}
                </Badge>
              )}
            </div>
            <DialogDescription>
              {detailItems.length} nhân sự · {detailPeriod?.standard_work_days ?? 0} ngày công chuẩn · tổng thực nhận{" "}
              {money(detailItems.reduce((sum, item) => sum + Number(item.net_salary), 0))}
            </DialogDescription>
          </DialogHeader>

          {detailItems.length === 0 ? (
            <div className="px-2 py-10 text-center">
              <p className="text-[12.5px] text-muted-foreground">Chưa có dữ liệu lương cho kỳ này.</p>
              {canManage && detailPeriod?.status === "draft" && (
                <Button
                  className="mt-3 h-9 gap-1.5 text-[12.5px]"
                  disabled={busyId === detailPeriod.id}
                  onClick={() => detailPeriod && void generate(detailPeriod)}
                >
                  {busyId === detailPeriod?.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  Tính lương kỳ này
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo tên hoặc mã nhân sự"
                    className="h-9 pl-8 text-[12.5px]"
                    aria-label="Tìm nhân sự trong bảng lương"
                  />
                </div>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[190px]" aria-label="Lọc phòng ban">
                    <SelectValue placeholder="Phòng ban" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả phòng ban</SelectItem>
                    {departments.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                  <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[180px]" aria-label="Sắp xếp bảng lương">
                    <SelectValue placeholder="Sắp xếp" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(sortLabels) as SortKey[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {sortLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-[10.5px] leading-4 text-muted-foreground">
                Lương và phụ cấp tính theo ngày công chấm công + phép hưởng lương, tối đa{" "}
                {detailPeriod?.standard_work_days ?? 0} ngày công chuẩn · BHNV{" "}
                {(INSURANCE_EMPLOYEE_RATE * 100).toLocaleString("vi-VN")}% · giảm trừ bản thân{" "}
                {(PERSONAL_DEDUCTION / 1_000_000).toLocaleString("vi-VN")} triệu, mỗi người phụ thuộc{" "}
                {(DEPENDENT_DEDUCTION / 1_000_000).toLocaleString("vi-VN")} triệu.
              </p>

              {visibleItems.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-muted-foreground">
                  Không có nhân sự phù hợp bộ lọc.
                </p>
              ) : (
                <div className="scrollbar-slim max-h-[54vh] overflow-auto rounded-lg border border-border/60">
                  <table className="w-full min-w-[1040px] border-collapse text-[11.5px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-muted text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                        <th className="px-3 py-2 text-left font-semibold">Nhân sự</th>
                        <th className="px-2 py-2 text-center font-semibold">Công</th>
                        <th className="px-2 py-2 text-right font-semibold">Lương CB</th>
                        <th className="px-2 py-2 text-right font-semibold">Phụ cấp</th>
                        <th className="px-2 py-2 text-right font-semibold">Tổng thu nhập</th>
                        <th className="px-2 py-2 text-right font-semibold">BHNV</th>
                        <th className="px-2 py-2 text-right font-semibold">Thuế</th>
                        <th className="px-2 py-2 text-right font-semibold">Thực nhận</th>
                        <th className="px-2 py-2 text-right font-semibold">So kỳ trước</th>
                        <th className="w-[72px] px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => {
                        const before = previousItems.get(item.employee_id);
                        const delta = before ? Number(item.net_salary) - Number(before.net_salary) : null;
                        return (
                          <tr key={item.id} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[12px] font-medium text-foreground">{item.employee_name}</p>
                                {item.adjusted_at && (
                                  <span title={`Điều chỉnh lần cuối ${adjustedLabel(item.adjusted_at)}`}>
                                    <PencilLine className="h-3 w-3 text-info" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {item.employee_code ?? ""}
                                {item.department ? ` · ${item.department}` : ""}
                                {item.note ? ` · ${item.note}` : ""}
                              </p>
                            </td>
                            <td className="px-2 py-2 text-center text-muted-foreground">
                              <span
                                title={`Chấm công ${dayCount(item.attendance_days)} · Phép hưởng lương ${dayCount(
                                  item.leave_days,
                                )}`}
                              >
                                {dayCount(item.work_days)}
                              </span>
                              {Number(item.leave_days) > 0 && (
                                <span className="block text-[9.5px] font-medium text-info">
                                  +{dayCount(item.leave_days)} phép
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">{money(Number(item.base_salary))}</td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              {money(
                                Number(item.position_allowance) +
                                  Number(item.responsibility_allowance) +
                                  Number(item.other_allowance),
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">{money(Number(item.gross_salary))}</td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              {money(Number(item.insurance_employee))}
                            </td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              {money(Number(item.tax_amount))}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold text-foreground">
                              {money(Number(item.net_salary))}
                            </td>
                            <td
                              className={cn(
                                "tabular px-2 py-2 text-right text-[11px]",
                                delta === null
                                  ? "text-muted-foreground"
                                  : delta > 0
                                    ? "text-success"
                                    : delta < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                              )}
                            >
                              {delta === null
                                ? previousItems.size > 0
                                  ? "Mới"
                                  : "—"
                                : moneyDelta(delta)}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center justify-end gap-0.5">
                                {detailPeriod?.status === "draft" && canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Điều chỉnh phiếu lương ${item.employee_name}`}
                                    onClick={() => setAdjustItem(item)}
                                  >
                                    <PencilLine className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`In phiếu lương ${item.employee_name}`}
                                  onClick={() =>
                                    detailPeriod &&
                                    printHtml(
                                      buildPayslipHtml({
                                        companyName: activeCompany?.name ?? "Công ty",
                                        period: detailPeriod,
                                        item,
                                      }),
                                    )
                                  }
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="border-t border-border bg-card text-[11.5px] font-semibold text-foreground shadow-[0_-1px_0_hsl(var(--border))]">
                        <td className="px-3 py-2">
                          Tổng cộng · {visibleItems.length} nhân sự
                          {visibleItems.length !== detailItems.length ? ` / ${detailItems.length}` : ""}
                        </td>
                        <td />
                        <td className="px-2 py-2 text-right">{money(detailTotals.base)}</td>
                        <td className="px-2 py-2 text-right">{money(detailTotals.allowance)}</td>
                        <td className="px-2 py-2 text-right">{money(detailTotals.gross)}</td>
                        <td className="px-2 py-2 text-right">{money(detailTotals.insurance)}</td>
                        <td className="px-2 py-2 text-right">{money(detailTotals.tax)}</td>
                        <td className="px-2 py-2 text-right text-primary">{money(detailTotals.net)}</td>
                        <td
                          className={cn(
                            "tabular px-2 py-2 text-right",
                            detailTotals.delta > 0
                              ? "text-success"
                              : detailTotals.delta < 0
                                ? "text-destructive"
                                : "text-muted-foreground",
                          )}
                        >
                          {previousItems.size > 0 ? moneyDelta(detailTotals.delta) : "—"}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" className="h-9" onClick={() => setDetailPeriod(null)}>
              Đóng
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              disabled={detailItems.length === 0}
              onClick={printAll}
            >
              <Printer className="h-3.5 w-3.5" /> In tất cả phiếu
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              disabled={visibleItems.length === 0}
              onClick={() =>
                detailPeriod &&
                exportExcel(
                  `bang-luong-${detailPeriod.month}-${detailPeriod.year}`,
                  exportHeaders,
                  exportRows(visibleItems),
                  "Bảng lương",
                )
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              disabled={visibleItems.length === 0}
              onClick={() =>
                detailPeriod &&
                exportPdf(
                  `Bảng lương tháng ${detailPeriod.month}/${detailPeriod.year}`,
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(visibleItems),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!report} onOpenChange={(open) => !open && setReport(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              Đã tính lương tháng {report?.period.month}/{report?.period.year}
            </DialogTitle>
            <DialogDescription>
              {report?.count ?? 0} phiếu lương được tạo từ chấm công, phép và bảng lương hiện có.
              {report && report.missing > 0
                ? ` Bỏ qua ${report.missing} nhân sự chưa có bảng lương.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Thực nhận</p>
              <p className="tabular mt-1 text-[15px] font-semibold text-foreground">{money(report?.net ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Thuế TNCN</p>
              <p className="tabular mt-1 text-[15px] font-semibold text-foreground">{money(report?.tax ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Bảo hiểm</p>
              <p className="tabular mt-1 text-[15px] font-semibold text-foreground">{money(report?.insurance ?? 0)}</p>
            </div>
          </div>

          {report && !report.hasAttendanceData && (
            <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-[11.5px] leading-5 text-warning">
              Kỳ này chưa có dữ liệu chấm công. Lương được tạm tính theo thời gian làm việc trong tháng.
            </p>
          )}

          {report && report.warnings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5 text-warning" />
                <p className="text-[12px] font-semibold text-foreground">
                  {report.warnings.length} mục cần kiểm tra
                </p>
              </div>
              <ul className="scrollbar-slim max-h-[260px] space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {report.warnings.map((warning) => (
                  <li
                    key={`${warning.employee_id}-${warning.code}`}
                    className="flex items-start justify-between gap-3 rounded-md bg-card px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-foreground">{warning.employee_name}</p>
                      <p className="text-[10.5px] text-muted-foreground">{warning.detail}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-warning-subtle px-2 py-0.5 text-[9.5px] font-semibold text-warning">
                      {WARNING_LABEL[warning.code]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" className="h-9" onClick={() => setReport(null)}>
              Đóng
            </Button>
            <Button
              className="h-9 gap-1.5"
              onClick={() => {
                if (report) setDetailPeriod(report.period);
                setReport(null);
              }}
            >
              Xem bảng lương
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingLock} onOpenChange={(open) => !open && setPendingLock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Chốt kỳ lương tháng {pendingLock?.month}/{pendingLock?.year}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLock ? periodTotals(pendingLock.id).count : 0} nhân sự · tổng thực nhận{" "}
              {pendingLock ? money(periodTotals(pendingLock.id).net) : "—"}. Sau khi chốt, bảng lương không thể
              sửa cho tới khi mở khoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingLock && periodTotals(pendingLock.id).zeroDays > 0 && (
            <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-[11.5px] leading-5 text-warning">
              {periodTotals(pendingLock.id).zeroDays} phiếu chưa có ngày công. Kiểm tra lại trước khi chốt.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction className="gap-2" onClick={() => void confirmLock()}>
              <Lock className="h-4 w-4" /> Chốt kỳ lương
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá kỳ lương?</AlertDialogTitle>
            <AlertDialogDescription>
              Kỳ lương tháng {pendingDelete?.month}/{pendingDelete?.year} và toàn bộ bảng lương sẽ bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removePeriod()}
            >
              Xoá kỳ lương
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Payroll;
