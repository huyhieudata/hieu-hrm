import { Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";

/* SEC-04: MFA TOTP ở chế độ "khuyến nghị" — không bắt buộc vai trò nào.
 * Đường lui: chưa bật MFA ⇒ đăng nhập như cũ; mất app ⇒ quản trị nền tảng gỡ factor (docs/runbook-su-co-bao-mat.md). */

const errText = (e: unknown) => (e instanceof Error ? e.message : "Có lỗi xảy ra, thử lại.");

const verifiedTotp = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  return (data?.totp ?? []).filter((f) => f.status === "verified");
};

/** Khi tài khoản đã bật MFA mà phiên mới ở aal1 ⇒ yêu cầu nhập mã 6 số. Lỗi kiểm tra ⇒ cho qua (không khoá người dùng). */
export const MfaGate = ({ children }: { children: ReactNode }) => {
  const { session, signOut } = useAuth();
  const [need, setNeed] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = session?.access_token;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error || !data || data.currentLevel === data.nextLevel || data.nextLevel !== "aal2") return alive && setNeed(null);
        const factors = await verifiedTotp();
        if (alive) setNeed(factors[0]?.id ?? null);
      } catch {
        if (alive) setNeed(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (need === undefined || need === null) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: need, code: code.trim() });
      if (error) throw error;
      setNeed(null);
    } catch (err) {
      setError(errText(err) === "Invalid TOTP code entered" ? "Mã không đúng hoặc đã hết hạn." : errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Xác thực 2 lớp</h1>
        </div>
        <p className="text-[13px] text-muted-foreground">Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…).</p>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          autoFocus
        />
        {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        <Button type="submit" className="w-full gap-2" disabled={busy || code.length !== 6}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Xác nhận
        </Button>
        <p className="text-[11.5px] text-muted-foreground">
          Mất điện thoại? Liên hệ quản trị hệ thống để gỡ xác thực 2 lớp cho tài khoản của bạn.
        </p>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
          Đăng xuất
        </Button>
      </form>
    </div>
  );
};

/** Hộp thoại bật/tắt MFA TOTP. */
export const MfaDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const factors = await verifiedTotp();
    setEnrolled(factors[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!open) {
      setQr(null);
      setSecret(null);
      setCode("");
      setFactorId(null);
      return;
    }
    void refresh();
  }, [open, refresh]);

  const start = async () => {
    setBusy(true);
    try {
      // Dọn factor chưa xác minh cũ (nếu có) để enroll lại không lỗi.
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: res, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `ONHRM ${Date.now()}` });
      if (error) throw error;
      setFactorId(res.id);
      setQr(res.totp.qr_code);
      setSecret(res.totp.secret);
    } catch (e) {
      toast.error("Không bật được xác thực 2 lớp", { description: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!factorId) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (error) throw error;
      toast.success("Đã bật xác thực 2 lớp");
      setQr(null);
      await refresh();
    } catch {
      toast.error("Mã không đúng, thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!enrolled) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolled });
      if (error) throw error;
      toast.success("Đã tắt xác thực 2 lớp");
      await refresh();
    } catch (e) {
      toast.error("Không tắt được", { description: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Xác thực 2 lớp (khuyến nghị)</DialogTitle>
          <DialogDescription>
            Khi bật, mỗi lần đăng nhập cần thêm mã 6 số từ ứng dụng xác thực. Khuyến nghị cho Chủ sở hữu, Quản trị và HR.
          </DialogDescription>
        </DialogHeader>
        {enrolled ? (
          <p className="text-[13px]">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-primary" /> Tài khoản đã bật xác thực 2 lớp.
          </p>
        ) : qr ? (
          <div className="space-y-3 text-[13px]">
            <p>1. Quét mã QR bằng ứng dụng xác thực.</p>
            <img src={qr} alt="Mã QR xác thực 2 lớp" className="mx-auto h-44 w-44 rounded bg-white p-2" />
            <p className="break-all text-[11.5px] text-muted-foreground">Hoặc nhập khoá: {secret}</p>
            <p>2. Nhập mã 6 số đang hiện trong ứng dụng.</p>
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Chưa bật.</p>
        )}
        <DialogFooter>
          {enrolled ? (
            <Button variant="outline" onClick={() => void disable()} disabled={busy}>
              Tắt xác thực 2 lớp
            </Button>
          ) : qr ? (
            <Button onClick={() => void confirm()} disabled={busy || code.length !== 6}>
              Xác nhận bật
            </Button>
          ) : (
            <Button onClick={() => void start()} disabled={busy}>
              Bắt đầu bật
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Nhắc (không ép) Owner/Admin/HR bật MFA — 1 lần mỗi phiên trình duyệt. */
export const useMfaReminder = (openDialog: () => void) => {
  const { role } = useCompany();
  const { session } = useAuth();
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid || !(role === "owner" || role === "admin" || role === "hr")) return;
    const key = `mfa-reminded:${uid}`;
    if (sessionStorage.getItem(key)) return;
    void verifiedTotp().then((factors) => {
      if (factors.length) return;
      sessionStorage.setItem(key, "1");
      toast("Khuyến nghị bật xác thực 2 lớp", {
        id: "mfa-reminder",
        description: "Tài khoản quản trị nắm dữ liệu lương và hồ sơ nhân sự. Bật để chống lộ mật khẩu.",
        duration: 10000,
        action: { label: "Bật ngay", onClick: openDialog },
      });
    });
  }, [uid, role, openDialog]);
};
