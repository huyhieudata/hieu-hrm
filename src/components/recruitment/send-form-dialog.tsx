import { useState } from "react";
import { Copy, Link2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { candidateFormLink, createRow, updateRow, type Candidate } from "@/lib/recruitment";

interface SendFormDialogProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void | Promise<void>;
}

export const SendFormDialog = ({ candidate, open, onOpenChange, onSent }: SendFormDialogProps) => {
  const [subject, setSubject] = useState("Mời hoàn thiện hồ sơ ứng tuyển");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = candidate?.form_token ? candidateFormLink(candidate.form_token) : "";

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Đã sao chép liên kết", { description: link });
    } catch {
      toast.message("Liên kết ứng tuyển", { description: link });
    }
  };

  const handleSend = async () => {
    if (!candidate) return;
    setSending(true);
    setError(null);
    try {
      const content =
        body.trim() ||
        `Kính gửi ${candidate.full_name},\n\nVui lòng truy cập liên kết dưới đây để hoàn thiện hồ sơ ứng tuyển:\n${link}\n\nTrân trọng.`;

      await createRow("candidate_emails", {
        candidate_id: candidate.id,
        subject: subject.trim() || "Mời hoàn thiện hồ sơ ứng tuyển",
        body: content,
        sent_to: candidate.email,
        template: "form_link",
        status: "sent",
      });

      await updateRow("candidates", candidate.id, { form_sent_at: new Date().toISOString() });
      await copyLink();
      toast.success("Đã ghi nhận gửi liên kết", {
        description: "Liên kết đã được sao chép — dán vào email/Zalo để gửi ứng viên.",
      });
      await onSent?.();
      onOpenChange(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Không ghi nhận được.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Gửi liên kết khai hồ sơ
          </DialogTitle>
          <DialogDescription>
            Ứng viên tự điền thông tin qua liên kết, dữ liệu cập nhật thẳng vào hồ sơ và được lưu vào lịch sử email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Liên kết dành cho {candidate?.full_name ?? "ứng viên"}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] leading-5 text-foreground">{link || "—"}</p>
            <Button size="sm" variant="outline" className="mt-2 h-8 gap-1.5 text-[11.5px]" onClick={() => void copyLink()}>
              <Copy className="h-3.5 w-3.5" /> Sao chép liên kết
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="form-email" className="text-[12px]">
              Gửi tới
            </Label>
            <Input id="form-email" value={candidate?.email ?? "Ứng viên chưa có email"} readOnly className="h-10 text-[13px]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="form-subject" className="text-[12px]">
              Tiêu đề
            </Label>
            <Input
              id="form-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="form-body" className="text-[12px]">
              Nội dung (tuỳ chọn)
            </Label>
            <Textarea
              id="form-body"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Để trống sẽ dùng mẫu mặc định kèm liên kết."
              className="text-[13px]"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button className="gap-2" onClick={() => void handleSend()} disabled={sending || !candidate}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Đang xử lý…" : "Ghi nhận đã gửi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
