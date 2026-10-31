import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Loader2, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";

import { Logo, LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { ROLE_BADGE, ROLE_LABELS, type Role } from "@/lib/roles";

interface InviteInfo {
  company_id: string;
  company_name: string;
  role: Role;
  email: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked: boolean;
}

const INVITE_ERRORS: Record<string, string> = {
  INVITE_NOT_FOUND: "Liên kết mời không tồn tại hoặc đã bị xoá.",
  INVITE_REVOKED: "Lời mời này đã bị thu hồi bởi quản trị viên.",
  INVITE_USED: "Lời mời này đã được sử dụng.",
  INVITE_EXPIRED: "Lời mời đã hết hạn. Hãy yêu cầu quản trị viên tạo liên kết mới.",
  INVITE_EMAIL_MISMATCH: "Lời mời được gửi cho một địa chỉ email khác với tài khoản đang đăng nhập.",
  INVITE_IDENTITY_REQUIRED:
    "Lời mời quyền quản trị phải gắn email hoặc số điện thoại khớp với tài khoản. Hãy yêu cầu quản trị viên tạo lời mời mới.",
  AUTH_REQUIRED: "Bạn cần đăng nhập để tham gia công ty.",
};

const describeInviteError = (message: string) => {
  const key = Object.keys(INVITE_ERRORS).find((code) => message.includes(code));
  return key ? INVITE_ERRORS[key] : "Không thể xác thực lời mời. Vui lòng thử lại.";
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const JoinCompany = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { memberships, refreshMemberships } = useCompany();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const redirect = `/tham-gia/${token ?? ""}`;

  const loadInvite = useCallback(async () => {
    if (!token || !session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("peek_company_invite", {
        invite_token: token,
      });
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as unknown as InviteInfo[];
      if (rows.length === 0) {
        setError(INVITE_ERRORS.INVITE_NOT_FOUND);
        return;
      }
      setInvite(rows[0]);
    } catch (loadError) {
      setError(loadError instanceof Error ? describeInviteError(loadError.message) : "Không tải được lời mời.");
    } finally {
      setLoading(false);
    }
  }, [session, token]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const onAccept = async () => {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("accept_company_invite", { invite_token: token });
      if (rpcError) throw rpcError;

      await refreshMemberships();
      setJoined(true);
      toast.success("Đã tham gia công ty", {
        description: invite ? `${invite.company_name} đã được thêm vào tài khoản của bạn.` : undefined,
      });
      window.setTimeout(() => navigate("/", { replace: true }), 900);
    } catch (acceptError) {
      const message = acceptError instanceof Error ? acceptError.message : "";
      setError(describeInviteError(message));
    } finally {
      setJoining(false);
    }
  };

  const alreadyMember = invite ? memberships.some((m) => m.company_id === invite.company_id) : false;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex justify-center">
          <Logo subtitle="People Platform" />
        </div>

        <Card className="overflow-hidden p-0 shadow-overlay">
          <div className="border-b border-border/70 bg-muted/40 px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Lời mời tham gia
            </p>
            <h1 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              Tham gia không gian làm việc
            </h1>
          </div>

          <div className="px-6 py-6">
            {authLoading || (session && loading) ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang kiểm tra lời mời…
              </div>
            ) : !session ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-[12.5px] leading-6 text-muted-foreground">
                    Bạn đang mở một liên kết mời tham gia công ty trên ONHRM. Đăng nhập hoặc tạo tài
                    khoản bằng đúng email được mời để tiếp tục.
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Button asChild className="gap-2">
                    <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                      <LogIn className="h-4 w-4" />
                      Đăng nhập
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="gap-2">
                    <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                      Tạo tài khoản
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : joined ? (
              <div className="space-y-3 py-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <p className="text-[14px] font-semibold text-foreground">Bạn đã tham gia công ty</p>
                <p className="text-[12.5px] text-muted-foreground">Đang mở bảng điều khiển…</p>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive-subtle px-3.5 py-3 text-[12.5px] leading-6 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <div className="flex gap-2.5">
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/cong-ty", { replace: true })}>
                    Về danh sách công ty
                  </Button>
                </div>
              </div>
            ) : invite ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand text-[13px] font-semibold text-primary-foreground shadow-primary-glow">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">{invite.company_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                      <Badge variant={ROLE_BADGE[invite.role]}>{ROLE_LABELS[invite.role]}</Badge>
                      <span>Hết hạn {formatDate(invite.expires_at)}</span>
                    </div>
                  </div>
                </div>

                {invite.email && (
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11.5px] leading-5 text-muted-foreground">
                    Lời mời dành cho <span className="font-semibold text-foreground">{invite.email}</span>.
                  </p>
                )}

                {invite.revoked || invite.accepted_at ? (
                  <div className="flex items-start gap-2.5 rounded-md border border-warning/25 bg-warning-subtle px-3.5 py-3 text-[12.5px] leading-6 text-warning">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{invite.revoked ? INVITE_ERRORS.INVITE_REVOKED : INVITE_ERRORS.INVITE_USED}</span>
                  </div>
                ) : alreadyMember ? (
                  <Button className="w-full gap-2" onClick={() => navigate("/", { replace: true })}>
                    Bạn đã là thành viên · Mở bảng điều khiển
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="w-full gap-2" onClick={onAccept} disabled={joining}>
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {joining ? "Đang tham gia…" : `Tham gia với vai trò ${ROLE_LABELS[invite.role]}`}
                  </Button>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                Không tìm thấy lời mời.
              </p>
            )}
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-[10.5px] text-muted-foreground">
          <LogoMark className="h-5 w-5 rounded-[6px]" />
          ONHRM · Liên kết mời chỉ dùng được một lần
        </div>
      </div>
    </div>
  );
};

export default JoinCompany;
