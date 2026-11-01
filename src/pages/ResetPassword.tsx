import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { clearMustChangePassword } from "@/lib/employee-accounts";
import { passwordProblem } from "@/lib/password-rules";
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FieldKey = "password" | "confirm";

/** Trang đích của liên kết "Quên mật khẩu" (Supabase PASSWORD_RECOVERY). */
const ResetPassword = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading, updatePassword } = useAuth();
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const linkError = (() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("error_description") || query.get("error_description");
  })();

  const ready = !!session || recovery;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!password) errors.password = "Vui lòng nhập mật khẩu mới.";
    else if (passwordProblem(password)) errors.password = passwordProblem(password) ?? undefined;
    if (!confirm) errors.confirm = "Vui lòng nhập lại mật khẩu.";
    else if (confirm !== password) errors.confirm = "Mật khẩu nhập lại không khớp.";
    setFieldErrors(errors);
    const first = (["password", "confirm"] as FieldKey[]).find((key) => errors[key]);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      await clearMustChangePassword().catch(() => undefined);
      toast.success("Đã đặt lại mật khẩu");
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không đặt lại được mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: FieldKey, label: string, value: string, setter: (v: string) => void) => (
    <div className="space-y-1.5">
      <label htmlFor={key} className="block text-[12.5px] font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={key}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(event) => {
            setter(event.target.value);
            setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
          }}
          aria-invalid={!!fieldErrors[key]}
          aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-md border bg-card pl-10 pr-11 text-[13.5px] outline-none focus:border-primary focus:shadow-focus",
            fieldErrors[key] ? "border-destructive" : "border-input",
          )}
        />
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {fieldErrors[key] && (
        <p id={`${key}-error`} role="alert" className="text-[11.5px] font-medium text-destructive">
          {fieldErrors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px] rounded-xl border bg-card p-6 shadow-sm">
        <Logo />
        <h1 className="mt-5 text-[20px] font-semibold tracking-tight">Đặt lại mật khẩu</h1>
        {linkError ? (
          <div className="mt-4 space-y-3 text-[13px]">
            <p className="flex gap-2 rounded-md border border-destructive/25 bg-destructive-subtle p-3 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.
            </p>
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Quay lại Đăng nhập
            </Link>
          </div>
        ) : !ready ? (
          <div className="mt-4 space-y-3 text-[13px] text-muted-foreground">
            {authLoading ? (
              <p className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang xác thực liên kết…
              </p>
            ) : (
              <>
                <p>Không tìm thấy phiên đặt lại mật khẩu. Hãy mở trang này từ liên kết trong email.</p>
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Quay lại Đăng nhập
                </Link>
              </>
            )}
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
            <p className="text-[13px] text-muted-foreground">Nhập mật khẩu mới (tối thiểu 8 ký tự, có chữ và số).</p>
            {field("password", "Mật khẩu mới", password, setPassword)}
            {field("confirm", "Xác nhận mật khẩu", confirm, setConfirm)}
            {error && (
              <p role="alert" className="text-[12px] text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Đang lưu…" : "Lưu mật khẩu mới"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
