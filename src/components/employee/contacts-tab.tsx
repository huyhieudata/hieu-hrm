import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, MessageSquare, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/lib/auth-provider";
import {
  createRecord,
  fetchRecords,
  getDocumentSignedUrl,
  removeRecord,
  updateRecord,
  uploadEmployeeFile,
} from "@/lib/employee-records";

interface ContactRow {
  id: string;
  company_id: string;
  employee_id: string;
  contact_date: string;
  channel: string;
  state: string;
  result: string | null;
  note: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  author_name: string | null;
  created_at: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  mail: "Gửi thư",
  email: "Email",
  sms: "SMS",
  call: "Gọi điện",
  direct: "Trực tiếp",
  work: "Công việc",
};

const STATE_LABELS: Record<string, string> = {
  appointment: "Lịch hẹn",
  contacted: "Đã liên hệ",
  unreachable: "Không liên hệ được",
  cancelled: "Hủy",
};

const stateTone = (state: string) =>
  state === "contacted" ? "success" : state === "unreachable" ? "destructive" : state === "cancelled" ? "muted" : "warning";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface ContactsTabProps {
  employeeId: string;
  companyId: string;
  canManage: boolean;
}

const ContactsTab = ({ employeeId, companyId, canManage }: ContactsTabProps) => {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [detail, setDetail] = useState<ContactRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContactRow | null>(null);

  const [contactDate, setContactDate] = useState(todayIso());
  const [channel, setChannel] = useState("email");
  const [state, setState] = useState("appointment");
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecords<ContactRow>("employee_contacts", employeeId, "contact_date");
      setRows(data.sort((a, b) => b.contact_date.localeCompare(a.contact_date)));
    } catch (loadError) {
      toast.error("Không tải được lịch sử trao đổi", { description: getErrorMessage(loadError) });
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setContactDate(todayIso());
    setChannel("email");
    setState("appointment");
    setResult("");
    setNote("");
    setFile(null);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (row: ContactRow) => {
    setEditing(row);
    setContactDate(row.contact_date);
    setChannel(row.channel);
    setState(row.state);
    setResult(row.result ?? "");
    setNote(row.note ?? "");
    setFile(null);
    setError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!contactDate) {
      setError("Vui lòng chọn ngày liên lạc.");
      return;
    }
    setSaving(true);
    try {
      let attachmentPath = editing?.attachment_path ?? null;
      let attachmentName = editing?.attachment_name ?? null;
      if (file) {
        attachmentPath = await uploadEmployeeFile({ companyId, employeeId, file });
        attachmentName = file.name;
      }

      const payload = {
        company_id: companyId,
        employee_id: employeeId,
        contact_date: contactDate,
        channel,
        state,
        result: result.trim() || null,
        note: note.trim() || null,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        ...(editing ? {} : { author_name: profile?.full_name ?? user?.email?.split("@")[0] ?? "Thành viên" }),
      };

      if (editing) {
        await updateRecord("employee_contacts", editing.id, payload);
        toast.success("Đã cập nhật bản ghi liên lạc");
      } else {
        await createRecord("employee_contacts", payload);
        toast.success("Đã thêm bản ghi liên lạc");
      }
      setFormOpen(false);
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await removeRecord("employee_contacts", pendingDelete.id);
      toast.success("Đã xoá bản ghi liên lạc");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được", { description: getErrorMessage(deleteError) });
    }
  };

  const openAttachment = async (path: string) => {
    try {
      const url = await getDocumentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Không mở được tài liệu");
    }
  };

  const counts = useMemo(
    () => ({
      total: rows.length,
      appointment: rows.filter((row) => row.state === "appointment").length,
      contacted: rows.filter((row) => row.state === "contacted").length,
    }),
    [rows],
  );

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" /> Lịch sử trao đổi
            </h3>
            <p className="text-[11.5px] text-muted-foreground">
              {counts.total} bản ghi · {counts.appointment} lịch hẹn · {counts.contacted} đã liên hệ
            </p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-[12px]" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Thêm liên lạc
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">Chưa có lịch sử trao đổi.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((row) => {
              const overdue = row.state === "appointment" && row.contact_date < todayIso();
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setDetail(row)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold ${
                        overdue ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(`${row.contact_date}T00:00:00`).toLocaleDateString("vi-VN")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-foreground">
                        {CHANNEL_LABELS[row.channel] ?? row.channel}
                        {row.result ? ` · ${row.result}` : ""}
                      </span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">
                        {row.note ?? "Không có ghi chú"}
                      </span>
                    </span>
                  </button>

                  {row.attachment_path && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Mở tài liệu đính kèm"
                      onClick={() => void openAttachment(row.attachment_path as string)}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Badge variant={stateTone(row.state)}>{STATE_LABELS[row.state] ?? row.state}</Badge>
                  {canManage && (
                    <>
                      <Button variant="ghost" size="icon-sm" aria-label="Sửa liên lạc" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Xoá liên lạc"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa bản ghi liên lạc" : "Thêm bản ghi liên lạc"}</DialogTitle>
            <DialogDescription>Ghi lại lịch sử trao đổi với nhân sự.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Ngày liên lạc</Label>
              <Input type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Hình thức</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Trạng thái</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Tài liệu đính kèm</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-10 py-2 text-[12px]" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[12px]">Kết quả liên hệ</Label>
              <Textarea rows={2} value={result} onChange={(e) => setResult(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[12px]">Ghi chú</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive sm:col-span-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setFormOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Lưu thay đổi" : "Thêm bản ghi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Chi tiết liên lạc</DialogTitle>
            <DialogDescription>
              {detail ? new Date(`${detail.contact_date}T00:00:00`).toLocaleDateString("vi-VN") : ""} ·{" "}
              {detail ? CHANNEL_LABELS[detail.channel] ?? detail.channel : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 py-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Trạng thái</span>
                <Badge variant={stateTone(detail.state)}>{STATE_LABELS[detail.state] ?? detail.state}</Badge>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Kết quả liên hệ</p>
                <p className="mt-0.5 text-[12.5px] text-foreground">{detail.result || "—"}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Ghi chú</p>
                <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{detail.note || "—"}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Người thao tác</p>
                <p className="mt-0.5 text-[12px] text-foreground">
                  {detail.author_name ?? "—"} · {new Date(detail.created_at).toLocaleString("vi-VN")}
                </p>
              </div>
              {detail.attachment_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[11.5px]"
                  onClick={() => void openAttachment(detail.attachment_path as string)}
                >
                  <Paperclip className="h-3.5 w-3.5" /> {detail.attachment_name ?? "Tài liệu đính kèm"}
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setDetail(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bản ghi liên lạc?</AlertDialogTitle>
            <AlertDialogDescription>Bản ghi này sẽ bị xoá khỏi lịch sử trao đổi.</AlertDialogDescription>
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
    </div>
  );
};

export default ContactsTab;
