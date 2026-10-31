import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Loader2, Pencil, Plus, Search, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { RecruitmentShell } from "@/components/recruitment/module-shell";
import { CandidateStatusBadge } from "@/components/recruitment/status-badge";
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
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_STATUS_LABELS,
  candidateStageIndex,
  createRow,
  deleteRow,
  formatDateTime,
  listRows,
  updateRow,
  type Candidate,
  type Interview,
} from "@/lib/recruitment";
import { getErrorMessage } from "@/lib/utils";

const STATUS_TONES: Record<string, "info" | "success" | "muted" | "destructive"> = {
  scheduled: "info",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
};

const Interviews = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user } = useAuth();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("recruitment");

  const [rows, setRows] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Interview | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [interviewRows, candidateRows] = await Promise.all([
        listRows<Interview>("candidate_interviews", companyId, "scheduled_at", true),
        listRows<Candidate>("candidates", companyId, "applied_at"),
      ]);
      setRows(interviewRows);
      setCandidates(candidateRows);
    } catch (error) {
      toast.error("Không tải được lịch phỏng vấn", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const candidateById = useMemo(() => new Map(candidates.map((row) => [row.id, row])), [candidates]);

  const fields: FieldDef[] = useMemo(
    () => [
      {
        name: "candidate_id",
        label: "Ứng viên",
        type: "select",
        required: true,
        span: 2,
        options: candidates.map((candidate) => ({
          value: candidate.id,
          label: `${candidate.full_name}${candidate.position_applied ? ` · ${candidate.position_applied}` : ""}`,
        })),
      },
      { name: "scheduled_at", label: "Thời gian phỏng vấn", type: "datetime", required: true },
      { name: "duration_minutes", label: "Thời lượng (phút)", type: "number", placeholder: "60" },
      {
        name: "mode",
        label: "Hình thức",
        type: "select",
        options: Object.entries(INTERVIEW_MODE_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        name: "status",
        label: "Trạng thái",
        type: "select",
        options: Object.entries(INTERVIEW_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
      { name: "location", label: "Địa điểm / liên kết", placeholder: "Phòng họp 2 hoặc link Google Meet" },
      { name: "interviewer", label: "Người phỏng vấn", placeholder: "Trần Quốc Bảo" },
      { name: "note", label: "Ghi chú", type: "textarea" },
    ],
    [candidates],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const candidate = candidateById.get(row.candidate_id);
      return (
        (candidate?.full_name ?? "").toLowerCase().includes(keyword) ||
        (row.interviewer ?? "").toLowerCase().includes(keyword) ||
        (row.location ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [rows, query, candidateById]);

  const now = Date.now();
  const upcoming = filtered
    .filter((row) => row.status === "scheduled" && new Date(row.scheduled_at).getTime() >= now - 60 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = filtered.filter((row) => !upcoming.includes(row));

  const completedThisMonth = rows.filter((row) => {
    if (row.status !== "completed") return false;
    const date = new Date(row.scheduled_at);
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  }).length;

  const syncCandidate = async (candidateId: string, interviewStatus: string) => {
    const candidate = candidateById.get(candidateId);
    if (!candidate) return;
    const stage = candidateStageIndex(candidate.status);
    if (stage < 0) return;
    let nextStatus: string | null = null;
    if (interviewStatus === "scheduled" && stage < 3) nextStatus = "interview_scheduled";
    if (interviewStatus === "completed" && stage < 4) nextStatus = "interview_attended";
    if (interviewStatus === "no_show" && stage >= 0 && stage < 5) nextStatus = "interview_no_show";
    if (interviewStatus === "cancelled" && stage >= 0 && stage <= 3) nextStatus = "interview_declined";
    if (nextStatus && nextStatus !== candidate.status) {
      await updateRow("candidates", candidateId, { status: nextStatus });
    }
  };

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    if (!values.candidate_id) throw new Error("Vui lòng chọn ứng viên.");
    const payload = {
      ...values,
      status: values.status ?? "scheduled",
      mode: values.mode ?? "onsite",
      duration_minutes: Number(values.duration_minutes ?? 60) || 60,
    };
    try {
      if (editing) {
        await updateRow("candidate_interviews", editing.id, payload);
        toast.success("Đã cập nhật lịch phỏng vấn");
      } else {
        await createRow("candidate_interviews", {
          ...payload,
          company_id: companyId,
          created_by: user?.id ?? null,
        });
        toast.success("Đã tạo lịch phỏng vấn");
      }
      await syncCandidate(String(values.candidate_id), String(values.status ?? "scheduled"));
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
      await deleteRow("candidate_interviews", pendingDelete.id);
      toast.success("Đã xoá lịch phỏng vấn");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được lịch phỏng vấn", { description: getErrorMessage(error) });
    }
  };

  const renderInterview = (row: Interview) => {
    const candidate = candidateById.get(row.candidate_id);
    return (
      <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {candidate ? (
              <Link
                to={`/tuyen-dung/ung-vien/${candidate.id}`}
                className="text-[12.5px] font-semibold text-foreground hover:text-primary hover:underline"
              >
                {candidate.full_name}
              </Link>
            ) : (
              <span className="text-[12.5px] font-semibold text-muted-foreground">Ứng viên đã xoá</span>
            )}
            {candidate && <CandidateStatusBadge status={candidate.status} />}
            <Badge variant={STATUS_TONES[row.status] ?? "muted"}>
              {INTERVIEW_STATUS_LABELS[row.status] ?? row.status}
            </Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> {formatDateTime(row.scheduled_at)}
            </span>
            <span>· {row.duration_minutes} phút</span>
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" /> {INTERVIEW_MODE_LABELS[row.mode] ?? row.mode}
            </span>
            {row.interviewer && <span>· {row.interviewer}</span>}
            {row.location && <span className="truncate">· {row.location}</span>}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sửa lịch phỏng vấn"
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
              aria-label="Xoá lịch phỏng vấn"
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <RecruitmentShell
      title="Lịch hẹn phỏng vấn"
      description="Tổ chức lịch phỏng vấn, theo dõi người tham gia và kết quả từng buổi."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Đặt lịch phỏng vấn
          </Button>
        )
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sắp tới</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-info">{upcoming.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Hoàn thành tháng này
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold text-success">{completedThisMonth}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tổng lịch hẹn</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{rows.length}</p>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo ứng viên, người phỏng vấn hoặc địa điểm"
          className="h-9 pl-8 text-[12.5px]"
          aria-label="Tìm lịch phỏng vấn"
        />
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch phỏng vấn…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có lịch phỏng vấn</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Đặt lịch cho ứng viên đã vượt qua vòng sàng lọc.
          </p>
          {canManage && (
            <Button
              className="mt-3 h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Đặt lịch phỏng vấn
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border/60 bg-muted/25 px-4 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">Sắp tới</p>
              </div>
              <ul className="divide-y divide-border/50">{upcoming.map(renderInterview)}</ul>
            </Card>
          )}
          {past.length > 0 && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border/60 bg-muted/25 px-4 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Đã qua / đã huỷ
                </p>
              </div>
              <ul className="divide-y divide-border/50">{past.map(renderInterview)}</ul>
            </Card>
          )}
        </div>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa lịch phỏng vấn" : "Đặt lịch phỏng vấn"}
        description="Khi lưu, trạng thái ứng viên được cập nhật theo kết quả buổi phỏng vấn."
        fields={fields}
        initial={editing}
        submitLabel={editing ? "Lưu thay đổi" : "Tạo lịch hẹn"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá lịch phỏng vấn?</AlertDialogTitle>
            <AlertDialogDescription>Buổi phỏng vấn này sẽ bị xoá khỏi lịch của ứng viên.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void remove()}
            >
              Xoá lịch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RecruitmentShell>
  );
};

export default Interviews;
