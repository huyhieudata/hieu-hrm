import { useOrgStructure } from "@/lib/use-org-structure";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeDollarSign,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  HeartPulse,
  History,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectionBar } from "@/components/common/selection-bar";
import { useSelection } from "@/lib/use-selection";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/lib/company-provider";
import { formatMonth } from "@/lib/employee-records";
import {
  buildInsuranceHistoryHtml,
  downloadHtml,
  printHtml,
} from "@/lib/employee-documents";
import { exportExcel, exportPdf } from "@/lib/export-utils";
import { currency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { todayIso } from "@/lib/attendance";

interface InsuranceRow {
  id: string;
  employee_id: string;
  insurance_number: string | null;
  start_date: string | null;
  end_date: string | null;
  salary_base: number | null;
  employee_rate: number | null;
  employer_rate: number | null;
  status: string;
  note: string | null;
  employee: {
    id: string;
    code: string;
    full_name: string;
    department: string | null;
    position: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Đang đóng",
  paused: "Ngừng đóng",
  closed: "Đã chốt sổ",
};

const statusTone = (status: string) =>
  status === "active" ? "success" : status === "paused" ? "warning" : "muted";

const Insurance = () => {
  const org = useOrgStructure();
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("insurance");

  const [rows, setRows] = useState<InsuranceRow[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { selected, toggle, selectAll, clear, prune } = useSelection();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "paused" | "closed">(
    "all",
  );
  const [detail, setDetail] = useState<{
    employee: NonNullable<InsuranceRow["employee"]>;
    records: InsuranceRow[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_insurance_records")
        .select(
          "id, employee_id, insurance_number, start_date, end_date, salary_base, employee_rate, employer_rate, status, note, employee:employees(id, code, full_name, department, position)",
        )
        .eq("company_id", companyId)
        .eq("insurance_type", "social")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setRows(
        ((data ?? []) as unknown as InsuranceRow[]).filter(
          (row) => row.employee,
        ),
      );
    } catch (error) {
      toast.error("Không tải được dữ liệu bảo hiểm", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only the latest coverage period per employee is listed on this page.
  const groups = useMemo(() => {
    const map = new Map<string, InsuranceRow[]>();
    rows.forEach((row) => {
      const list = map.get(row.employee_id) ?? [];
      list.push(row);
      map.set(row.employee_id, list);
    });

    return Array.from(map.values()).map((list) => {
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.start_date ?? 0).getTime() -
          new Date(a.start_date ?? 0).getTime(),
      );
      return {
        employee: sorted[0].employee as NonNullable<InsuranceRow["employee"]>,
        latest: sorted[0],
        records: sorted,
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return groups.filter((group) => {
      const person = group.employee;
      const matchesQuery =
        !keyword ||
        `${person.full_name} ${person.code} ${group.latest.insurance_number ?? ""} ${person.position ?? ""}`
          .toLowerCase()
          .includes(keyword);
      const matchesDepartment =
        department === "all" || person.department === department;
      const matchesStatus = status === "all" || group.latest.status === status;
      return matchesQuery && matchesDepartment && matchesStatus;
    });
  }, [department, groups, query, status]);

  const stats = useMemo(() => {
    const active = groups.filter((group) => group.latest.status === "active");
    return {
      active: active.length,
      paused: groups.filter((group) => group.latest.status === "paused").length,
      closed: groups.filter((group) => group.latest.status === "closed").length,
      fund: active.reduce(
        (sum, group) => sum + Number(group.latest.salary_base ?? 0),
        0,
      ),
    };
  }, [groups]);

  const exportRows = () =>
    filtered.map((group) => [
      group.employee.code,
      group.employee.full_name,
      group.employee.department ?? "",
      group.employee.position ?? "",
      group.latest.insurance_number ?? "",
      formatMonth(group.latest.start_date),
      group.latest.salary_base ? Number(group.latest.salary_base) : "",
      group.latest.employee_rate ?? "",
      group.latest.employer_rate ?? "",
      STATUS_LABELS[group.latest.status] ?? group.latest.status,
      group.latest.end_date ? formatMonth(group.latest.end_date) : "",
      group.records.length,
    ]);

  const exportHeaders = [
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    "Chức danh",
    "Số sổ BHXH",
    "Bắt đầu đóng",
    "Mức đóng (VND)",
    "NLĐ đóng (%)",
    "DN đóng (%)",
    "Trạng thái",
    "Kết thúc",
    "Số giai đoạn",
  ];

  const handleBulkDelete = async () => {
    try {
      const ids = filtered
        .filter((group) => selected.includes(group.employee.id))
        .flatMap((group) => group.records.map((record) => record.id));
      if (ids.length > 0) {
        const { error } = await supabase
          .from("employee_insurance_records")
          .delete()
          .in("id", ids);
        if (error) throw error;
      }
      toast.success(`Đã xoá bảo hiểm của ${selected.length} nhân sự`);
      clear();
      setBulkOpen(false);
      await load();
    } catch (error) {
      toast.error("Không xoá được dữ liệu bảo hiểm", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Quản lý nhân sự"
        title="Bảo hiểm xã hội"
        description="Danh sách nhân sự tham gia BHXH, mức đóng và tình trạng đóng của công ty."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() =>
                exportExcel(
                  `bao-hiem-${todayIso()}`,
                  exportHeaders,
                  exportRows(),
                  "Bảo hiểm",
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
                  "Danh sách tham gia BHXH",
                  activeCompany?.name ?? "Công ty",
                  exportHeaders,
                  exportRows(),
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Đang đóng BHXH",
            value: stats.active,
            icon: ShieldCheck,
            tone: "success",
          },
          {
            label: "Ngừng đóng",
            value: stats.paused,
            icon: ShieldOff,
            tone: "warning",
          },
          {
            label: "Đã chốt sổ",
            value: stats.closed,
            icon: HeartPulse,
            tone: "muted",
          },
          {
            label: "Quỹ lương đóng BHXH",
            value: currency(stats.fund, true),
            icon: BadgeDollarSign,
            tone: "primary",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="flex items-center gap-3 p-4">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[11px]",
                  item.tone === "success" && "bg-success-subtle text-success",
                  item.tone === "warning" && "bg-warning-subtle text-warning",
                  item.tone === "muted" && "bg-muted text-muted-foreground",
                  item.tone === "primary" &&
                    "bg-primary-subtle text-primary-subtle-foreground",
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

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "Tất cả" },
              { id: "active", label: "Đang đóng" },
              { id: "paused", label: "Ngừng đóng" },
              { id: "closed", label: "Đã chốt sổ" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id as typeof status)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                  status === item.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên, mã NV, số sổ BHXH…"
                className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground/80 hover:border-primary/30 focus:border-primary focus:shadow-focus sm:w-[250px]"
              />
            </label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[180px]">
                <SelectValue placeholder="Phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả phòng ban</SelectItem>
                {org.departmentOptions.map(({ value: name }) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:flex">
          <span className="flex-1">Nhân sự</span>
          <span className="w-[130px] shrink-0">Số sổ BHXH</span>
          <span className="w-[110px] shrink-0">Bắt đầu đóng</span>
          <span className="w-[130px] shrink-0">Mức đóng</span>
          <span className="w-[100px] shrink-0">Tỷ lệ</span>
          <span className="w-[120px] shrink-0">Trạng thái</span>
          <span className="w-[110px] shrink-0">Giai đoạn</span>
        </div>

        {canManage && (
          <SelectionBar
            count={selected.length}
            label="nhân sự"
            onClear={clear}
            onDelete={() => setBulkOpen(true)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dữ liệu BHXH…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <HeartPulse className="mx-auto h-6 w-6 text-muted-foreground/70" />
            <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">
              Không có nhân sự phù hợp
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {rows.length === 0
                ? "Chưa có dữ liệu đóng BHXH. Thêm trong hồ sơ nhân viên → tab Bảo hiểm."
                : "Thử đổi bộ lọc hoặc từ khoá tìm kiếm."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((group) => {
              const latest = group.latest;
              return (
                <li
                  key={group.employee.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/25"
                >
                  {canManage && (
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${group.employee.full_name}`}
                      className="h-3.5 w-3.5 shrink-0 accent-primary"
                      checked={selected.includes(group.employee.id)}
                      onChange={() => toggle(group.employee.id)}
                    />
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[11px] font-semibold text-primary-subtle-foreground">
                      {group.employee.full_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          setDetail({
                            employee: group.employee,
                            records: group.records,
                          })
                        }
                        className="flex items-center gap-1 truncate text-[13px] font-semibold text-foreground hover:text-primary"
                      >
                        {group.employee.full_name}
                        <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                      </button>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {group.employee.code}
                        {group.employee.position
                          ? ` · ${group.employee.position}`
                          : ""}
                        {group.employee.department
                          ? ` · ${group.employee.department}`
                          : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground/90 lg:hidden">
                        Từ {formatMonth(latest.start_date)} ·{" "}
                        {latest.salary_base
                          ? currency(Number(latest.salary_base), true)
                          : "—"}{" "}
                        · {STATUS_LABELS[latest.status] ?? latest.status}
                      </p>
                    </div>
                  </div>

                  <span className="hidden w-[130px] shrink-0 truncate font-mono text-[11.5px] text-muted-foreground lg:block">
                    {latest.insurance_number ?? "—"}
                  </span>
                  <span className="hidden w-[110px] shrink-0 text-[12px] text-muted-foreground lg:block">
                    {formatMonth(latest.start_date)}
                  </span>
                  <span className="hidden w-[130px] shrink-0 text-[12px] font-medium text-foreground lg:block">
                    {latest.salary_base
                      ? currency(Number(latest.salary_base))
                      : "—"}
                  </span>
                  <span className="hidden w-[100px] shrink-0 text-[11.5px] text-muted-foreground lg:block">
                    {latest.employee_rate ?? "—"}% /{" "}
                    {latest.employer_rate ?? "—"}%
                  </span>
                  <span className="hidden w-[120px] shrink-0 lg:block">
                    <Badge variant={statusTone(latest.status)}>
                      {STATUS_LABELS[latest.status] ?? latest.status}
                    </Badge>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDetail({
                        employee: group.employee,
                        records: group.records,
                      })
                    }
                    className="hidden w-[110px] shrink-0 text-left text-[11.5px] text-primary hover:underline lg:block"
                  >
                    {group.records.length} giai đoạn
                  </button>
                  <span className="shrink-0 lg:hidden">
                    <Badge variant={statusTone(latest.status)}>
                      {STATUS_LABELS[latest.status] ?? latest.status}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-[11.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {filtered.length} / {groups.length} nhân sự theo bộ lọc
          </span>
          <span>
            Bấm tên nhân sự để xem toàn bộ giai đoạn đóng và in/PDF bảng kê.
          </span>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {detail?.employee.full_name}
              <Badge variant="muted" className="font-mono text-[10.5px]">
                {detail?.employee.code}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {[detail?.employee.position, detail?.employee.department]
                .filter(Boolean)
                .join(" · ") || "Quá trình đóng bảo hiểm xã hội"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] text-muted-foreground">
                {detail?.records.length ?? 0} giai đoạn đóng BHXH
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[11.5px]"
                  onClick={() => {
                    if (!detail) return;
                    printHtml(
                      buildInsuranceHistoryHtml(
                        detail.employee,
                        detail.records,
                        activeCompany?.name ?? "Công ty",
                      ),
                    );
                  }}
                >
                  <Printer className="h-3.5 w-3.5" /> In / PDF
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Tải bảng kê BHXH"
                  onClick={() => {
                    if (!detail) return;
                    downloadHtml(
                      buildInsuranceHistoryHtml(
                        detail.employee,
                        detail.records,
                        activeCompany?.name ?? "Công ty",
                      ),
                      `bang-ke-bhxh-${detail.employee.code.toLowerCase()}`,
                    );
                  }}
                >
                  <FileDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[11.5px]">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-2 text-left font-semibold">
                      Số sổ
                    </th>
                    <th className="px-2.5 py-2 text-left font-semibold">
                      Từ tháng
                    </th>
                    <th className="px-2.5 py-2 text-left font-semibold">
                      Đến tháng
                    </th>
                    <th className="px-2.5 py-2 text-left font-semibold">
                      Mức đóng
                    </th>
                    <th className="px-2.5 py-2 text-left font-semibold">
                      NLĐ / DN
                    </th>
                    <th className="px-2.5 py-2 text-left font-semibold">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(detail?.records ?? []).map((record) => (
                    <tr key={record.id}>
                      <td className="px-2.5 py-2 font-mono text-[10.5px] text-muted-foreground">
                        {record.insurance_number ?? "—"}
                      </td>
                      <td className="px-2.5 py-2 text-muted-foreground">
                        {formatMonth(record.start_date)}
                      </td>
                      <td className="px-2.5 py-2 text-muted-foreground">
                        {record.end_date ? formatMonth(record.end_date) : "nay"}
                      </td>
                      <td className="px-2.5 py-2 font-medium text-foreground">
                        {record.salary_base
                          ? currency(Number(record.salary_base))
                          : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-muted-foreground">
                        {record.employee_rate ?? "—"}% /{" "}
                        {record.employer_rate ?? "—"}%
                      </td>
                      <td className="px-2.5 py-2">
                        <Badge variant={statusTone(record.status)}>
                          {STATUS_LABELS[record.status] ?? record.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10.5px] leading-5 text-muted-foreground">
              Bảng kê gồm mọi giai đoạn đóng BHXH của nhân sự. Hiện chỉ giai
              đoạn gần nhất được hiển thị ở danh sách chính.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              asChild
              variant="outline"
              className="h-9 gap-1.5 text-[12px]"
            >
              <Link
                to={detail ? `/employees/${detail.employee.id}` : "/employees"}
              >
                <History className="h-3.5 w-3.5" /> Mở hồ sơ nhân viên
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xoá bảo hiểm của {selected.length} nhân sự?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ giai đoạn bảo hiểm của các nhân sự đã chọn sẽ bị xoá khỏi
              hệ thống.
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
    </AppShell>
  );
};

export default Insurance;
