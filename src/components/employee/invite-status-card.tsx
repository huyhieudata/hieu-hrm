import { useCallback, useEffect, useState } from "react";
import { Ban, Copy, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  INVITE_STATE_META,
  friendlyInviteError,
  inviteUrl,
  loadEmployeeInviteStatus,
  revokeEmployeeInvite,
  type EmployeeInviteStatus,
} from "@/lib/employee-invites";
import { ROLE_LABELS } from "@/lib/roles";

const fmt = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";

/** Trạng thái lời mời trên hồ sơ + gửi lại / thu hồi. Chỉ hiển thị cho owner/admin/HR. */
export const InviteStatusBar = ({
  companyId,
  employeeId,
  reloadKey,
  onInvite,
}: {
  companyId: string;
  employeeId: string;
  reloadKey: number;
  onInvite: () => void;
}) => {
  const [status, setStatus] = useState<EmployeeInviteStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await loadEmployeeInviteStatus(companyId);
      setStatus(rows.find((r) => r.employee_id === employeeId) ?? null);
    } catch {
      setStatus(null);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (!status) return null;
  const meta = INVITE_STATE_META[status.status];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-[11.5px]">
      <Badge variant={meta.tone}>{meta.label}</Badge>
      {status.status !== "none" && status.status !== "joined" && (
        <span className="text-muted-foreground">
          {status.email} · {status.role ? ROLE_LABELS[status.role] : ""} · gửi{" "}
          {fmt(status.created_at)} · hết hạn {fmt(status.expires_at)}
          {status.status === "sent" &&
            (status.email_sent_at
              ? " · email đã gửi"
              : " · email chưa gửi tự động")}
        </span>
      )}
      {status.status !== "joined" && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px]"
          onClick={onInvite}
        >
          {status.status === "none" ? (
            <Send className="h-3 w-3" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          {status.status === "none" ? "Gửi lời mời" : "Gửi lại"}
        </Button>
      )}
      {status.status === "sent" && status.token && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-[11px]"
            onClick={() =>
              void navigator.clipboard
                .writeText(inviteUrl(status.token!))
                .then(() => toast.success("Đã sao chép liên kết"))
            }
          >
            <Copy className="h-3 w-3" /> Liên kết
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-[11px] text-destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await revokeEmployeeInvite(status.invite_id!);
                toast.success("Đã thu hồi lời mời");
                await load();
              } catch (error) {
                toast.error(friendlyInviteError(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Ban className="h-3 w-3" />
            )}{" "}
            Thu hồi
          </Button>
        </>
      )}
    </div>
  );
};
