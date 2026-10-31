import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FileDown,
  FileSpreadsheet,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog } from "@/components/employee/field-dialog";
import { RecruitmentShell } from "@/components/recruitment/module-shell";
import { SendFormDialog } from "@/components/recruitment/send-form-dialog";
import { CandidateStatusBadge } from "@/components/recruitment/status-badge";
import { buildCandidateFields } from "@/components/recruitment/candidate-fields";
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
import { exportExcel, exportPdf } from "@/lib/export-utils";
import {
  CANDIDATE_SOURCE_LABELS,
  CANDIDATE_STATUSES,
  createRow,
  deleteRow,
  formatDay,
  listRows,
  statusMeta,
  updateRow,
  type Campaign,
  type Candidate,
} from "@/lib/recruitment";
import { getErrorMessage } from "@/lib/utils";

const MAX_VISIBLE_STATS = 4;

const Candidates = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("recruitment");

  const [rows, setRows] = useState<Candidate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState(searchParams.get("chien-dich") ?? "all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [sendCandidate, setSendCandidate] = useState<Candidate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [candidateRows, campaignRows] = await Promise.all([
        listRows<Candidate>("candidates", companyId, "applied_at"),
        listRows<Campaign>("recruitment_campaigns", companyId, "created_at"),
      ]);
      setRows(candidateRows);
      setCampaigns(campaignRows);
    } catch (error) {
      toast.error("Không tải được danh sách ứng viên", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCampaignFilter(searchParams.get("chien-dich") ?? "all");
  }, [searchParams]);

  const campaignById = useMemo(() => new Map(campaigns.map((row) => [row.id, row])), [campaigns]);

  const fields = useMemo(
    () => buildCandidateFields(campaigns).filter((field) => field.name !== "status"),
    [campaigns],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.full_name.toLowerCase().includes(keyword) ||
        (row.email ?? "").toLowerCase().includes(keyword) ||
        (row.phone ?? "").toLowerCase().includes(keyword) ||
        (row.position_applied ?? "").toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesCampaign = campaignFilter === "all" || row.campaign_id === campaignFilter;
      const matchesSource = sourceFilter === "all" || row.source === sourceFilter;
      return matchesKeyword && matchesStatus && matchesCampaign && matchesSource;
    });
  }, [rows, query, statusFilter, campaignFilter, sourceFilter]);

  const stats = useMemo(() => {
    const count = (group: string) => filtered.filter((row) => statusMeta(row.status).group === group).length;
    return {
      total: filtered.length,
      interviewing: count("interview"),
      offer: count("offer"),
      hired: filtered.filter((row) => row.status === "started").length,
    };
  }, [filtered]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    try {
      if (editing) {
        await updateRow("candidates", editing.id, values);
        toast.success("Đã cập nhật hồ sơ ứng viên");
        setFormOpen(false);
        setEditing(null);
        await load();
      } else {
        const id = await createRow("candidates", {
          ...values,
          company_id: companyId,
          created_by: user?.id ?? null,
          status: "received",
          applied_at: new Date().toISOString(),
        });
        toast.success(`Đã thêm ứng viên ${values.full_name ?? ""}`.trim());
        setFormOpen(false);
        setEditing(null);
        await load();
        navigate(`/tuyen-dung/ung-vien/${id}`);
      }
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRow("candidates", pendingDelete.id);
      toast.success("Đã xoá ứng viên");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được ứng viên", { description: getErrorMessage(error) });
    }
  };

  const exportHeaders = [
    "Họ tên",
    "Email",
    "Điện thoại",
    "Vị trí",
    "Chiến dịch",
    "Nguồn",
    "Trạng thái",
    "Ngày ứng tuyển",
  ];
  const exportRows = () =>
    filtered.map((row) => [
      row.full_name,
      row.email ?? "",
      row.phone ?? "",
      row.position_applied ?? "",
      row.campaign_id ? campaignById.get(row.campaign_id)?.title ?? "" : "",
      row.source ? CANDIDATE_SOURCE_LABELS[row.source] ?? row.source : "",
      statusMeta(row.status).label,
      formatDay(row.applied_at),
    ]);

  const activeFilterCount = [statusFilter, campaignFilter, sourceFilter].filter((value) => value !== "all").length;

  return (
    <RecruitmentShell
      title="Ứng viên"
      description="Theo dõi hồ sơ, trạng thái pipeline và gửi biểu mẫu khai hồ sơ cho ứng viên."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm ứng viên
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng ứng viên", value: stats.total, tone: "text-foreground" },
          { label: "Đang phỏng vấn", value: stats.interviewing, tone: "text-info" },
          { label: "Offer", value: stats.offer, tone: "text-primary" },
          { label: "Đã nhận việc", value: stats.hired, tone: "text-success" },
        ]
          .slice(0, MAX_VISIBLE_STATS)
          .map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {item.label}
              </p>
              <p className={`mt-1 font-display text-[22px] font-semibold ${item.tone}`}>{item.value}</p>
            </Card>
          ))}
      </div>

      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên, email, điện thoại hoặc vị trí"
            className="h-9 pl-8 text-[12.5px]"
            aria-label="Tìm ứng viên"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-[12.5px] sm:w-[180px]" aria-label="Lọc trạng thái ứng viên">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              {CANDIDATE_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-9 text-[12.5px] sm:w-[190px]" aria-label="Lọc theo chiến dịch">
              <SelectValue placeholder="Chiến dịch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả chiến dịch</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="col-span-2 h-9 text-[12.5px] sm:col-span-1 sm:w-[150px]" aria-label="Lọc nguồn ứng viên">
              <SelectValue placeholder="Nguồn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi nguồn</SelectItem>
              {Object.entries(CANDIDATE_SOURCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <button
          type="button"
          className="text-left text-[11px] font-medium text-primary hover:underline"
          onClick={() => {
            setStatusFilter("all");
            setCampaignFilter("all");
            setSourceFilter("all");
          }}
        >
          Xoá {activeFilterCount} bộ lọc
        </button>
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải ứng viên…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <UserRound className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">
            {rows.length === 0 ? "Chưa có ứng viên" : "Không có ứng viên phù hợp"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {rows.length === 0
              ? "Thêm ứng viên hoặc gửi biểu mẫu để bắt đầu pipeline tuyển dụng."
              : "Thử đổi từ khoá hoặc bộ lọc."}
          </p>
        </Card>
      ) : (
        <Card className="hidden overflow-hidden p-0 md:block">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Ứng viên</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Vị trí / chiến dịch</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Nguồn</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Ứng tuyển</th>
                  <th className="w-[120px] px-3 py-2.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-border/50 hover:bg-muted/20"
                    onClick={() => navigate(`/tuyen-dung/ung-vien/${row.id}`)}
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-[12.5px] font-semibold text-foreground">{row.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {row.email ?? "Chưa có email"}
                        {row.phone ? ` · ${row.phone}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-[12px] text-foreground">{row.position_applied ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {row.campaign_id ? campaignById.get(row.campaign_id)?.title ?? "—" : "Chưa gắn chiến dịch"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {row.source ? CANDIDATE_SOURCE_LABELS[row.source] ?? row.source : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CandidateStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-muted-foreground">
                      {formatDay(row.applied_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Gửi biểu mẫu cho ${row.full_name}`}
                            onClick={() => setSendCandidate(row)}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Xoá ${row.full_name}`}
                            onClick={() => setPendingDelete(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
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

      {!loading && filtered.length > 0 && (
        <div className="space-y-2 md:hidden">
          {filtered.map((row) => (
            <Card
              key={row.id}
              className="cursor-pointer p-3.5"
              onClick={() => navigate(`/tuyen-dung/ung-vien/${row.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{row.full_name}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {row.position_applied ?? "Chưa chọn vị trí"}
                    {row.campaign_id ? ` · ${campaignById.get(row.campaign_id)?.title ?? ""}` : ""}
                  </p>
                </div>
                <CandidateStatusBadge status={row.status} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="text-[10.5px] text-muted-foreground">
                  <p>{row.email ?? row.phone ?? "Chưa có liên hệ"}</p>
                  <p>
                    {row.source ? CANDIDATE_SOURCE_LABELS[row.source] ?? row.source : "—"} ·{" "}
                    {formatDay(row.applied_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Gửi biểu mẫu cho ${row.full_name}`}
                      onClick={() => setSendCandidate(row)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xoá ${row.full_name}`}
                      onClick={() => setPendingDelete(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-9 gap-1.5 text-[12.5px]"
          disabled={filtered.length === 0}
          onClick={() => exportExcel("danh-sach-ung-vien", exportHeaders, exportRows(), "Ứng viên")}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </Button>
        <Button
          variant="outline"
          className="h-9 gap-1.5 text-[12.5px]"
          disabled={filtered.length === 0}
          onClick={() =>
            exportPdf(
              "Danh sách ứng viên",
              activeCompany?.name ?? "Công ty",
              exportHeaders,
              exportRows(),
            )
          }
        >
          <FileDown className="h-3.5 w-3.5" /> PDF
        </Button>
        <p className="text-[10.5px] text-muted-foreground">
          {filtered.length}/{rows.length} ứng viên
        </p>
      </div>

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa hồ sơ ứng viên" : "Thêm ứng viên"}
        description="Thông tin cơ bản dùng để liên hệ, xếp lịch phỏng vấn và tạo offer."
        fields={fields}
        initial={editing}
        submitLabel={editing ? "Lưu thay đổi" : "Thêm ứng viên"}
        onSubmit={handleSubmit}
      />

      <SendFormDialog
        candidate={sendCandidate}
        open={!!sendCandidate}
        onOpenChange={(open) => !open && setSendCandidate(null)}
        onSent={async () => {
          await load();
          setSendCandidate(null);
        }}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá ứng viên?</AlertDialogTitle>
            <AlertDialogDescription>
              Hồ sơ của “{pendingDelete?.full_name}” cùng lịch phỏng vấn, đánh giá và offer sẽ bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void remove()}
            >
              Xoá ứng viên
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RecruitmentShell>
  );
};

export default Candidates;
