import { useState, type FormEvent } from "react";
import { Copy, Link2, Loader2, Send } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { copyInviteLink, inviteLink } from "@/lib/invite-link";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  actorId: string;
  onCreated: () => void;
  allowedRoles?: Role[];
}

export const InviteDialog = ({
  open,
  onOpenChange,
  companyId,
  actorId,
  onCreated,
  allowedRoles = ASSIGNABLE_ROLES,
}: InviteDialogProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setRole("employee");
    setJobTitle("");
    setDepartment("");
    setError(null);
    setCreatedToken(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Email không hợp lệ. Để trống nếu bạn muốn mời bằng liên kết công khai.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from("company_invites")
        .insert({
          company_id: companyId,
          email: trimmedEmail || null,
          role,
          job_title: jobTitle.trim() || null,
          department: department.trim() || null,
          invited_by: actorId,
        })
        .select("token")
        .single();

      if (insertError) throw insertError;

      setCreatedToken(data.token);
      onCreated();
    } catch (insertError) {
      const message = insertError instanceof Error ? insertError.message : "Không tạo được lời mời.";
      setError(
        message.includes("row-level security")
          ? "Bạn không có quyền mời thành viên trong công ty này."
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {createdToken ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Liên kết mời đã sẵn sàng
              </DialogTitle>
              <DialogDescription>
                Gửi liên kết này cho người bạn muốn mời. Liên kết dùng được một lần và hết hạn sau 14
                ngày.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="break-all font-mono text-[11.5px] leading-5 text-foreground">
                  {inviteLink(createdToken)}
                </p>
              </div>
              <div className="rounded-md border border-dashed border-border bg-card p-3 text-[11.5px] leading-5 text-muted-foreground">
                Vai trò khi tham gia: <span className="font-semibold text-foreground">{ROLE_LABELS[role]}</span>
                <br />
                {ROLE_DESCRIPTIONS[role]}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={reset}>
                Tạo lời mời khác
              </Button>
              <Button className="gap-2" onClick={() => void copyInviteLink(createdToken)}>
                <Copy className="h-4 w-4" />
                Sao chép liên kết
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Mời thành viên</DialogTitle>
              <DialogDescription>
                Lời mời được gửi qua liên kết bảo mật. Bạn có thể gửi trước, sau đó gán thêm thông tin
                khi họ tham gia.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-[12.5px]">
                  Email (không bắt buộc)
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nhanvien@congty.vn"
                  className="h-10"
                />
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Nếu nhập email, chỉ tài khoản đăng nhập bằng email này mới dùng được liên kết.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Vai trò</Label>
                <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((item) => (
                      <SelectItem key={item} value={item}>
                        {ROLE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-4 text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-title" className="text-[12.5px]">
                    Chức danh
                  </Label>
                  <Input
                    id="invite-title"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    placeholder="Chuyên viên nhân sự"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-department" className="text-[12.5px]">
                    Phòng ban
                  </Label>
                  <Input
                    id="invite-department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="Nhân sự"
                    className="h-10"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Huỷ
              </Button>
              <Button type="submit" className="gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Đang tạo…" : "Tạo liên kết mời"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
