import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  CalendarClock,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
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
import {
  CAMPAIGN_PRIORITY_LABELS,
  CAMPAIGN_STATUS_LABELS,
  campaignCountdown,
  createRow,
  deleteRow,
  listRows,
  toOptionsSafe,
  updateRow,
  type Campaign,
  type Candidate,
  type JobDescription,
} from "@/lib/recruitment";
import { listDepartments } from "@/lib/settings";
import { cn, getErrorMessage } from "@/lib/utils";

const priorityTone = (value: string) =>
  value === "high" ? "destructive" : value === "low" ? "muted" : "info";
const campaignTone = (value: string) =>
  value === "open"
    ? "success"
    : value === "on_hold"
      ? "warning"
      : value === "closed"
        ? "muted"
        : "outline";

const Campaigns = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("recruitment");

  const [rows, setRows] = useState<Campaign[]>([]);
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [campaignRows, jobRows, candidateRows, deptRows] =
        await Promise.all([
          listRows<Campaign>("recruitment_campaigns", companyId, "created_at"),
          listRows<JobDescription>("job_descriptions", companyId, "created_at"),
          listRows<Candidate>("candidates", companyId, "applied_at"),
          listDepartments(companyId),
        ]);
      setRows(campaignRows);
      setJobs(jobRows);
      setCandidates(candidateRows);
      setDepartments(deptRows.map((row) => row.name));
    } catch (error) {
      toast.error("Không tải được chiến dịch tuyển dụng", {
        description: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const jobById = useMemo(
    () => new Map(jobs.map((job) => [job.id, job])),
    [jobs],
  );

  const statsFor = useCallback(
    (campaignId: string) => {
      const list = candidates.filter(
        (candidate) => candidate.campaign_id === campaignId,
      );
      const hired = list.filter(
        (candidate) =>
          candidate.status === "offer_accepted" ||
          candidate.status === "started",
      ).length;
      return { total: list.length, hired };
    },
    [candidates],
  );

  const fields: FieldDef[] = useMemo(
    () => [
      {
        name: "title",
        label: "Tên chiến dịch",
        required: true,
        span: 2,
        placeholder: "Tuyển 3 Backend Engineer Q4/2026",
      },
      {
        name: "job_description_id",
        label: "Mô tả công việc",
        type: "select",
        options: jobs.map((job) => ({ value: job.id, label: job.title })),
      },
      { name: "code", label: "Mã chiến dịch", placeholder: "CD-2026-004" },
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
        name: "headcount",
        label: "Số lượng cần tuyển",
        type: "number",
        placeholder: "3",
      },
      {
        name: "priority",
        label: "Mức ưu tiên",
        type: "select",
        options: Object.entries(CAMPAIGN_PRIORITY_LABELS).map(
          ([value, label]) => ({ value, label }),
        ),
      },
      {
        name: "status",
        label: "Trạng thái",
        type: "select",
        options: Object.entries(CAMPAIGN_STATUS_LABELS).map(
          ([value, label]) => ({ value, label }),
        ),
      },
      { name: "start_date", label: "Ngày bắt đầu", type: "date" },
      { name: "end_date", label: "Ngày kết thúc", type: "date" },
      {
        name: "hiring_manager",
        label: "Người phụ trách",
        placeholder: "Trần Quốc Bảo",
      },
      {
        name: "sla_days",
        label: "SLA tuyển dụng (ngày)",
        type: "number",
        placeholder: "30",
        hint: "Dùng để tính hạn tuyển và cảnh báo quá hạn.",
      },
      { name: "description", label: "Ghi chú chiến dịch", type: "textarea" },
    ],
    [departments, jobs],
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
    const headcount = Math.floor(Number(values.headcount ?? 1) || 1);
    const slaDays = Math.floor(Number(values.sla_days ?? 30) || 30);
    if (headcount < 1) throw new Error("Số lượng cần tuyển phải lớn hơn 0.");
    if (slaDays < 1 || slaDays > 365)
      throw new Error("SLA tuyển dụng phải trong khoảng 1 – 365 ngày.");
    const payload = {
      ...values,
      status: values.status ?? "open",
      headcount,
      sla_days: slaDays,
    };
    try {
      if (editing) {
        await updateRow("recruitment_campaigns", editing.id, payload);
        toast.success("Đã cập nhật chiến dịch");
      } else {
        await createRow("recruitment_campaigns", {
          ...payload,
          company_id: companyId,
          created_by: user?.id ?? null,
        });
        toast.success("Đã tạo chiến dịch tuyển dụng");
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
      await deleteRow("recruitment_campaigns", pendingDelete.id);
      toast.success("Đã xoá chiến dịch");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được chiến dịch", {
        description: getErrorMessage(error),
      });
    }
  };

  const openRows = rows.filter((row) => row.status === "open");
  const totalHeadcount = openRows.reduce(
    (sum, row) => sum + Number(row.headcount ?? 0),
    0,
  );

  return (
    <RecruitmentShell
      title="Chiến dịch tuyển dụng"
      description="Theo dõi nhu cầu tuyển, tiến độ tiếp nhận ứng viên và hạn tuyển theo SLA."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tạo chiến dịch
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Đang tuyển
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-success">
            {openRows.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Chỉ tiêu
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">
            {totalHeadcount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Ứng viên
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">
            {candidates.length}
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm chiến dịch theo tên, mã hoặc phòng ban"
            className="h-9 pl-8 text-[12.5px]"
            aria-label="Tìm chiến dịch"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="h-9 w-full text-[12.5px] sm:w-[190px]"
            aria-label="Lọc trạng thái chiến dịch"
          >
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải chiến dịch…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">
            {rows.length === 0
              ? "Chưa có chiến dịch tuyển dụng"
              : "Không có chiến dịch phù hợp"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {rows.length === 0
              ? "Tạo chiến dịch để gom ứng viên theo từng nhu cầu tuyển."
              : "Thử đổi từ khoá hoặc bộ lọc trạng thái."}
          </p>
          {rows.length === 0 && canManage && (
            <Button
              className="mt-3 h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Tạo chiến dịch
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const stats = statsFor(row.id);
            const job = row.job_description_id
              ? jobById.get(row.job_description_id)
              : null;
            const countdown = campaignCountdown(row);
            const percent =
              row.headcount > 0
                ? Math.min(Math.round((stats.hired / row.headcount) * 100), 100)
                : 0;
            return (
              <Card key={row.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.code ?? "Chưa có mã"}
                      {row.department ? ` · ${row.department}` : ""}
                    </p>
                  </div>
                  <Badge variant={campaignTone(row.status)}>
                    {CAMPAIGN_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={priorityTone(row.priority)}>
                    Ưu tiên{" "}
                    {CAMPAIGN_PRIORITY_LABELS[row.priority] ?? row.priority}
                  </Badge>
                  <Badge variant={countdown.tone}>{countdown.label}</Badge>
                  {job && (
                    <Badge variant="outline" className="max-w-full truncate">
                      {job.title}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {stats.total} ứng viên
                    </span>
                    <span>
                      {stats.hired}/{row.headcount} đã nhận
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <Link
                    to={`/tuyen-dung/ung-vien?chien-dich=${row.id}`}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
                  >
                    <Briefcase className="h-3.5 w-3.5" /> Xem ứng viên
                  </Link>
                  <div className="flex items-center gap-1">
                    {row.start_date && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(row.start_date).toLocaleDateString("vi-VN")}
                      </span>
                    )}
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
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa chiến dịch" : "Tạo chiến dịch tuyển dụng"}
        description="Chiến dịch gom ứng viên theo nhu cầu tuyển và giúp theo dõi chỉ tiêu, hạn tuyển."
        fields={fields}
        initial={editing}
        submitLabel={editing ? "Lưu thay đổi" : "Tạo chiến dịch"}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá chiến dịch?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” sẽ bị xoá. Ứng viên đã gắn với chiến dịch
              có thể mất liên kết.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              onClick={() => void remove()}
            >
              Xoá chiến dịch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RecruitmentShell>
  );
};

export default Campaigns;
