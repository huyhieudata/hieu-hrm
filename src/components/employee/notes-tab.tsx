import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Send, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-provider";
import { getErrorMessage } from "@/lib/utils";
import { createRecord, fetchRecords, removeRecord, updateRecord } from "@/lib/employee-records";

interface NoteRow {
  id: string;
  company_id: string;
  employee_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface NotesTabProps {
  employeeId: string;
  companyId: string;
  canManage: boolean;
}

const NotesTab = ({ employeeId, companyId, canManage }: NotesTabProps) => {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState<NoteRow | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchRecords<NoteRow>("employee_notes", employeeId, "created_at");
      setNotes(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      toast.error("Không tải được ghi chú", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addNote = async () => {
    if (!user?.id || !draft.trim()) return;
    setPosting(true);
    try {
      await createRecord("employee_notes", {
        company_id: companyId,
        employee_id: employeeId,
        author_id: user.id,
        author_name: profile?.full_name ?? user.email?.split("@")[0] ?? "Thành viên",
        content: draft.trim(),
      });
      setDraft("");
      toast.success("Đã thêm ghi chú");
      await load();
    } catch (error) {
      toast.error("Không thêm được ghi chú", { description: getErrorMessage(error) });
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async (note: NoteRow) => {
    if (!editDraft.trim()) return;
    setBusyId(note.id);
    try {
      await updateRecord("employee_notes", note.id, { content: editDraft.trim() });
      setEditing(null);
      toast.success("Đã cập nhật ghi chú");
      await load();
    } catch (error) {
      toast.error("Không cập nhật được ghi chú", { description: getErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  const removeNote = async (note: NoteRow) => {
    setBusyId(note.id);
    try {
      await removeRecord("employee_notes", note.id);
      toast.success("Đã xoá ghi chú");
      await load();
    } catch (error) {
      toast.error("Không xoá được ghi chú", { description: getErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border/70 px-5 py-4">
        <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          <StickyNote className="h-4 w-4 text-primary" /> Ghi chú
        </h3>
        <p className="text-[11.5px] text-muted-foreground">{notes.length} ghi chú · có ngày giờ và người ghi chú</p>
      </div>

      <div className="border-b border-border/70 px-5 py-4">
        <Textarea
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nhập ghi chú về nhân sự…"
        />
        <div className="mt-2 flex justify-end">
          <Button className="h-9 gap-1.5" onClick={() => void addNote()} disabled={posting || !draft.trim()}>
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Gửi ghi chú
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải ghi chú…
        </div>
      ) : notes.length === 0 ? (
        <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">Chưa có ghi chú nào.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {notes.map((note) => {
            const canEdit = canManage || note.author_id === user?.id;
            return (
              <li key={note.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-semibold text-foreground">
                      {note.author_name ?? "Thành viên"}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {new Date(note.created_at).toLocaleString("vi-VN")}
                      </span>
                    </p>
                    {editing?.id === note.id ? (
                      <div className="mt-1.5 space-y-2">
                        <Textarea
                          rows={2}
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(null)}>
                            Huỷ
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => void saveEdit(note)}
                            disabled={busyId === note.id}
                          >
                            {busyId === note.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            Lưu
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-line text-[12px] leading-5 text-foreground/90">
                        {note.content}
                      </p>
                    )}
                  </div>
                  {canEdit && editing?.id !== note.id && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Sửa ghi chú"
                        onClick={() => {
                          setEditing(note);
                          setEditDraft(note.content);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Xoá ghi chú"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => void removeNote(note)}
                        disabled={busyId === note.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default NotesTab;
