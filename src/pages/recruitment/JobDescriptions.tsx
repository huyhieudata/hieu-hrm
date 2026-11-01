import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { RecruitmentShell } from "@/components/recruitment/module-shell";
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
import { JOB_LEVELS } from "@/lib/employee-records";
import { printHtml } from "@/lib/employee-documents";
import { currency } from "@/lib/format";
import {
  JD_STATUS_LABELS,
  createRow,
  deleteRow,
  formatDay,
  listRows,
  toOptionsSafe,
  updateRow,
  type JobDescription,
} from "@/lib/recruitment";
import { listDepartments } from "@/lib/settings";
import { getErrorMessage } from "@/lib/utils";

const EMPLOYMENT_TYPES = [
  "Toàn thời gian",
  "Bán thời gian",
  "Thực tập",
  "Thời vụ",
  "Remote",
];
const statusOptions = Object.entries(JD_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const statusTone = (status: string) =>
  status === "open" ? "success" : status === "draft" ? "muted" : "outline";

const salaryLabel = (jd: JobDescription) => {
  if (!jd.salary_min && !jd.salary_max) return "Thương lượng";
  return `${jd.salary_min ? currency(Number(jd.salary_min), true) : "—"} – ${
    jd.salary_max ? currency(Number(jd.salary_max), true) : "—"
  }`;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const printJob = (jd: JobDescription, companyName: string) => {
  const section = (title: string, content: string | null) =>
    content
      ? `<section><h2>${title}</h2>${content
          .split("\n")
          .filter(Boolean)
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}</section>`
      : "";

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<title>${escapeHtml(jd.title)} — ${escapeHtml(companyName)}</title>
<style>
  body{font-family:"Segoe UI",system-ui,sans-serif;color:#111;margin:40px;line-height:1.65}
  h1{font-size:25px;margin:0 0 4px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin:24px 0 6px}
  p{margin:0 0 6px} .meta{color:#555;font-size:13px;margin-bottom:22px}
  .pill{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:2px 10px;margin:0 6px 6px 0;font-size:12px}
  footer{margin-top:32px;color:#888;font-size:11px;text-align:center}
</style></head><body>
<h1>${escapeHtml(jd.title)}</h1>
<div class="meta">${escapeHtml(companyName)}${jd.code ? ` · ${escapeHtml(jd.code)}` : ""}</div>
<div>
  ${jd.department ? `<span class="pill">${escapeHtml(jd.department)}</span>` : ""}
  ${jd.level ? `<span class="pill">${escapeHtml(jd.level)}</span>` : ""}
  ${jd.employment_type ? `<span class="pill">${escapeHtml(jd.employment_type)}</span>` : ""}
  ${jd.location ? `<span class="pill">${escapeHtml(jd.location)}</span>` : ""}
  <span class="pill">${salaryLabel(jd)}</span>
</div>
${section("Mục tiêu công việc", jd.summary)}
${section("Trách nhiệm chính", jd.responsibilities)}
${section("Yêu cầu ứng viên", jd.requirements)}
${section("Quyền lợi", jd.benefits)}
<footer>Mô tả công việc · ${formatDay(new Date().toISOString())}</footer>
</body></html>`;
  printHtml(html);
};

const JobDescriptions = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("recruitment");

  const [rows, setRows] = useState<JobDescription[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobDescription | null>(null);
  const [detail, setDetail] = useState<JobDescription | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JobDescription | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [jobs, deptRows] = await Promise.all([
        listRows<JobDescription>("job_descriptions", companyId, "created_at"),
        listDepartments(companyId),
      ]);
      setRows(jobs);
      setDepartments(deptRows.map((row) => row.name));
    } catch (error) {
      toast.error("Không tải được mô tả công việc", {
        description: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields: FieldDef[] = useMemo(
    () => [
      {
        name: "title",
        label: "Tên vị trí",
        required: true,
        span: 2,
        placeholder: "Chuyên viên phát triển phần mềm",
      },
      { name: "code", label: "Mã JD", placeholder: "JD-2026-014" },
      {
        name: "department",
        label: "Phòng ban",
        type: "select",
        options: toOptionsSafe(departments),
        hint: departments.length
          ? undefined
          : "Sơ đồ tổ chức trống — vào Cài đặt › Cơ cấu tổ chức để thiết lập.",
      },
      {
        name: "level",
        label: "Cấp bậc",
        type: "select",
        options: toOptionsSafe(JOB_LEVELS),
      },
      {
        name: "employment_type",
        label: "Hình thức làm việc",
        type: "select",
        options: toOptionsSafe(EMPLOYMENT_TYPES),
      },
      { name: "location", label: "Địa điểm", placeholder: "Hà Nội" },
      {
        name: "status",
        label: "Trạng thái",
        type: "select",
        options: statusOptions,
      },
      {
        name: "salary_min",
        label: "Lương tối thiểu",
        type: "currency",
        placeholder: "15000000",
      },
      {
        name: "salary_max",
        label: "Lương tối đa",
        type: "currency",
        placeholder: "25000000",
      },
      { name: "summary", label: "Mục tiêu công việc", type: "textarea" },
      {
        name: "responsibilities",
        label: "Trách nhiệm chính",
        type: "textarea",
        placeholder: "Mỗi dòng một nhiệm vụ",
      },
      { name: "requirements", label: "Yêu cầu ứng viên", type: "textarea" },
      { name: "benefits", label: "Quyền lợi", type: "textarea" },
    ],
    [departments],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.title.toLowerCase().includes(keyword) ||
        (row.code ?? "").toLowerCase().includes(keyword) ||
        (row.department ?? "").toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const handleSubmit = async (
    values: Record<string, string | number | null>,
  ) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    const min = Number(values.salary_min ?? 0);
    const max = Number(values.salary_max ?? 0);
    if (min > 0 && max > 0 && min > max) {
      throw new Error("Lương tối thiểu không được lớn hơn lương tối đa.");
    }
    try {
      const payload = { ...values, status: values.status ?? "draft" };
      if (editing) {
        await updateRow("job_descriptions", editing.id, payload);
        toast.success("Đã cập nhật mô tả công việc");
      } else {
        await createRow("job_descriptions", {
          ...payload,
          company_id: companyId,
          created_by: user?.id ?? null,
        });
        toast.success("Đã tạo mô tả công việc");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRow("job_descriptions", pendingDelete.id);
      toast.success("Đã xoá mô tả công việc");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được mô tả công việc", {
        description: getErrorMessage(error),
      });
    }
  };

  const openIn = rows.filter((row) => row.status === "open").length;

  return (
    <RecruitmentShell
      title="Mô tả công việc"
      description="Chuẩn hoá thông tin vị trí, yêu cầu và quyền lợi trước khi mở chiến dịch tuyển dụng."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm vị trí
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Tổng vị trí
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">
            {rows.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Đang áp dụng
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-success">
            {openIn}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Bản nháp
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-muted-foreground">
            {rows.filter((row) => row.status === "draft").length}
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên vị trí, mã JD hoặc phòng ban"
            className="h-9 pl-8 text-[12.5px]"
            aria-label="Tìm mô tả công việc"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="h-9 w-full text-[12.5px] sm:w-[190px]"
            aria-label="Lọc trạng thái"
          >
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải danh sách vị
          trí…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">
            {rows.length === 0
              ? "Chưa có mô tả công việc"
              : "Không có vị trí phù hợp"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {rows.length === 0
              ? "Tạo mô tả công việc đầu tiên để bắt đầu tuyển dụng."
              : "Thử đổi từ khoá hoặc bộ lọc trạng thái."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">
                    Vị trí
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Phòng ban / cấp bậc
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Khoảng lương
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Hình thức
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Trạng thái
                  </th>
                  <th className="w-[110px] px-3 py-2.5 text-right font-semibold">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border/50 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setDetail(row)}
                      >
                        <p className="text-[12.5px] font-semibold text-foreground hover:text-primary hover:underline">
                          {row.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {row.code ?? "Chưa có mã"} · Tạo{" "}
                          {formatDay(row.created_at)}
                        </p>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {row.department ?? "—"}
                      {row.level ? ` · ${row.level}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-foreground">
                      {salaryLabel(row)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {row.employment_type ?? "—"}
                      {row.location ? ` · ${row.location}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={statusTone(row.status)}>
                        {JD_STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`In mô tả ${row.title}`}
                          onClick={() =>
                            printJob(row, activeCompany?.name ?? "Công ty")
                          }
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Sửa ${row.title}`}
                              onClick={() => {
                                setEditing(row);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Xoá ${row.title}`}
                              onClick={() => setPendingDelete(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa mô tả công việc" : "Thêm mô tả công việc"}
        description="Thông tin này dùng để tạo chiến dịch, tin tuyển dụng và mô tả gửi ứng viên."
        fields={fields}
        initial={editing}
        submitLabel={editing ? "Lưu thay đổi" : "Tạo mô tả"}
        onSubmit={handleSubmit}
      />

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>
              {detail?.department ?? "Chưa xếp phòng ban"}
              {detail?.level ? ` · ${detail.level}` : ""} ·{" "}
              {detail ? salaryLabel(detail) : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-1">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={statusTone(detail.status)}>
                  {JD_STATUS_LABELS[detail.status] ?? detail.status}
                </Badge>
                {detail.employment_type && (
                  <Badge variant="outline">{detail.employment_type}</Badge>
                )}
                {detail.location && (
                  <Badge variant="outline">{detail.location}</Badge>
                )}
              </div>
              {[
                ["Mục tiêu công việc", detail.summary],
                ["Trách nhiệm chính", detail.responsibilities],
                ["Yêu cầu ứng viên", detail.requirements],
                ["Quyền lợi", detail.benefits],
              ].map(([label, content]) =>
                content ? (
                  <div key={label as string}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                      {label}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[12.5px] leading-6 text-foreground">
                      {content}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setDetail(null)}
            >
              Đóng
            </Button>
            {detail && (
              <Button
                variant="outline"
                className="h-9 gap-1.5"
                onClick={() =>
                  printJob(detail, activeCompany?.name ?? "Công ty")
                }
              >
                <Printer className="h-3.5 w-3.5" /> In mô tả
              </Button>
            )}
            {detail && canManage && (
              <Button
                className="h-9 gap-1.5"
                onClick={() => {
                  setEditing(detail);
                  setDetail(null);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Sửa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá mô tả công việc?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” sẽ bị xoá. Các chiến dịch đang dùng mô tả
              này có thể bị ảnh hưởng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void remove()}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RecruitmentShell>
  );
};

export default JobDescriptions;
