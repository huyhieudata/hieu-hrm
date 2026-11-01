import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Mail, Send } from "lucide-react";
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
import { useCompany } from "@/lib/company-provider";
import type { EmployeeRecord } from "@/lib/employee-records";
import {
  friendlyInviteError,
  inviteEmployee,
  inviteMailto,
  inviteUrl,
  sendInviteEmail,
} from "@/lib/employee-invites";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { listDepartments } from "@/lib/settings";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeRecord[];
  onDone?: () => void;
}

interface Created {
  name: string;
  email: string;
  token: string;
  sent: boolean;
}

/** Popup gửi lời mời cho 1 hoặc nhiều hồ sơ nhân viên. */
export const InviteEmployeeDialog = ({
  open,
  onOpenChange,
  employees,
  onDone,
}: Props) => {
  const { activeCompany, role: actorRole } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const single = employees.length === 1 ? employees[0] : null;
  const allowedRoles: Role[] =
    actorRole === "owner" || actorRole === "admin"
      ? ["employee", "manager", "hr", "admin"]
      : ["employee", "manager"];

  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [departments, setDepartments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setCreated([]);
    setSkipped([]);
    setRole("employee");
    setEmail(single?.work_email ?? single?.personal_email ?? "");
    setDepartment(single?.department ?? "");
    setJobTitle(single?.position ?? "");
    if (companyId)
      void listDepartments(companyId)
        .then((rows) => setDepartments(rows.map((r) => r.name)))
        .catch(() => setDepartments([]));
  }, [open, single, companyId]);

  const targets = useMemo(
    () => employees.filter((e) => !e.user_id),
    [employees],
  );

  const submit = async () => {
    if (single && !EMAIL_PATTERN.test(email.trim())) {
      toast.error("Nhập email hợp lệ của nhân viên để gửi lời mời.");
      return;
    }
    setBusy(true);
    const done: Created[] = [];
    const skip: string[] = employees
      .filter((e) => e.user_id)
      .map((e) => `${e.full_name}: đã có tài khoản`);
    for (const emp of targets) {
      const target = single
        ? email.trim()
        : (emp.work_email ?? emp.personal_email ?? "").trim();
      if (!EMAIL_PATTERN.test(target)) {
        skip.push(`${emp.full_name}: thiếu email`);
        continue;
      }
      try {
        const inv = await inviteEmployee({
          employeeId: emp.id,
          email: target,
          role,
          jobTitle: single ? jobTitle : emp.position,
          department: single ? department : emp.department,
        });
        const result = await sendInviteEmail(inv.invite_id);
        done.push({
          name: emp.full_name,
          email: target,
          token: inv.token,
          sent: result.sent,
        });
      } catch (error) {
        skip.push(`${emp.full_name}: ${friendlyInviteError(error)}`);
      }
    }
    setBusy(false);
    setCreated(done);
    setSkipped(skip);
    if (done.length) {
      const sentCount = done.filter((d) => d.sent).length;
      toast.success(`Đã tạo ${done.length} lời mời`, {
        description: sentCount
          ? `Đã gửi email cho ${sentCount} người.`
          : "Chưa cấu hình máy chủ gửi email — hãy sao chép liên kết hoặc mở ứng dụng email.",
      });
      onDone?.();
    }
  };

  const companyName = activeCompany?.name ?? "công ty";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {single
              ? `Gửi lời mời cho ${single.full_name}`
              : `Gửi lời mời cho ${employees.length} nhân viên`}
          </DialogTitle>
          <DialogDescription>
            Nhân viên nhận email có liên kết tham gia, đăng ký bằng đúng email
            này và được gắn vào hồ sơ. Liên kết hết hạn sau 14 ngày.
          </DialogDescription>
        </DialogHeader>

        {created.length || skipped.length ? (
          <div className="space-y-2">
            {created.map((c) => (
              <div
                key={c.token}
                className="rounded-lg border border-border p-3 text-[12px]"
              >
                <p className="font-semibold">
                  {c.name} · {c.email}
                </p>
                <p className={c.sent ? "text-success" : "text-warning"}>
                  {c.sent
                    ? "Đã gửi email mời"
                    : "Chưa gửi được email tự động (chưa cấu hình SMTP)"}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {inviteUrl(c.token)}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(inviteUrl(c.token))
                        .then(() => toast.success("Đã sao chép liên kết"))
                    }
                  >
                    <Copy className="h-3.5 w-3.5" /> Sao chép
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    asChild
                  >
                    <a href={inviteMailto(c.email, c.token, companyName)}>
                      <Mail className="h-3.5 w-3.5" /> Mở email
                    </a>
                  </Button>
                </div>
              </div>
            ))}
            {skipped.length > 0 && (
              <div className="rounded-lg bg-warning-subtle p-3 text-[12px] text-warning">
                <p className="font-semibold">Bỏ qua:</p>
                {skipped.map((s) => (
                  <p key={s}>• {s}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Xong</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {single ? (
              <>
                <div className="space-y-1">
                  <Label>Email nhận lời mời *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten@congty.vn"
                  />
                  {!single.work_email && !single.personal_email && (
                    <p className="text-[11px] text-warning">
                      Hồ sơ chưa có email — vui lòng nhập.
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Phòng ban</Label>
                    <Input
                      list="invite-departments"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                    <datalist id="invite-departments">
                      {departments.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <Label>Vị trí / chức danh</Label>
                    <Input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-muted/50 p-3 text-[12px] text-muted-foreground">
                Dùng email, phòng ban, vị trí có sẵn trong từng hồ sơ. Hồ sơ
                thiếu email hoặc đã có tài khoản sẽ được bỏ qua.
              </p>
            )}
            <div className="space-y-1">
              <Label>Quyền khi tham gia</Label>
              <div className="flex flex-wrap gap-2">
                {allowedRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      role === r
                        ? "border-primary bg-primary-subtle text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Để sau
              </Button>
              <Button
                className="gap-2"
                disabled={busy || targets.length === 0}
                onClick={() => void submit()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}{" "}
                Gửi lời mời
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
