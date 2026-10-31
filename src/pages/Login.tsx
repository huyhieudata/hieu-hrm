import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
  User,
} from "lucide-react";

import { OrbitDiagram } from "@/components/auth/orbit-diagram";
import { Avatar } from "@/components/common/avatar";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-provider";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "signin", label: "Đăng nhập" },
  { id: "signup", label: "Tạo tài khoản" },
] as const;

type Mode = (typeof tabs)[number]["id"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (!authLoading && session) navigate(redirectTarget, { replace: true });
  }, [authLoading, navigate, redirectTarget, session]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Email không hợp lệ. Ví dụ: ten@congty.vn");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (mode === "signup" && fullName.trim().length < 2) {
      setError("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp({ email: email.trim(), password, fullName });
        if (needsConfirmation) {
          toast.success("Kiểm tra hộp thư để xác thực tài khoản", {
            description: `Chúng tôi đã gửi liên kết xác thực tới ${email.trim()}.`,
          });
          return;
        }
        toast.success("Tài khoản đã được tạo", {
          description: "Bạn có thể tạo công ty hoặc tham gia công ty được mời.",
        });
      } else {
        await signIn(email, password);
        toast.success("Đăng nhập thành công");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] w-full bg-card lg:grid-cols-[1.06fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-panel p-10 lg:flex lg:flex-col xl:p-14">
        <div className="pointer-events-none absolute inset-0 opacity-[0.55] bg-grid mask-fade-b" />
        <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-chart-2/10 blur-3xl" />

        <div className="relative flex items-center justify-between">
          <Logo subtitle="People Platform" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-card/70 px-3 py-1.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            Bản 1.0
          </span>
        </div>

        <div className="relative mt-10 max-w-[540px] xl:mt-12">
          <h1 className="font-display text-[38px] font-semibold leading-[1.14] tracking-[-0.03em] text-foreground xl:text-[44px]">
            Nền tảng quản trị
            <br />
            nhân sự{" "}
            <span className="bg-brand bg-clip-text text-transparent">hiệu suất cao</span>
          </h1>
          <p className="mt-4 max-w-[430px] text-[14px] leading-7 text-muted-foreground">
            Một tài khoản cho nhiều công ty — phân quyền theo vai trò, dữ liệu nhân sự được tách biệt
            và bảo vệ cho từng doanh nghiệp.
          </p>
        </div>

        <div className="relative mt-6 flex-1">
          <OrbitDiagram />
        </div>

        <div className="relative mt-6 space-y-5">
          <div className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-soft backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
                <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-5 text-foreground">
                  “Chúng tôi rút ngắn 70% thời gian xử lý bảng lương mỗi tháng và không còn sai sót
                  chấm công.”
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <Avatar name="Trần Thu Hương" size="sm" />
                  <div className="text-[11px] leading-4">
                    <p className="font-semibold text-foreground">Trần Thu Hương</p>
                    <p className="text-muted-foreground">Giám đốc Vận hành · An Phát Group</p>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star key={star} className="h-3 w-3 fill-chart-4 text-chart-4" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Đa công ty, một tài khoản
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Phân quyền theo vai trò
            </span>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex min-h-[100dvh] flex-col bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 lg:min-h-0 lg:border-l lg:border-border/70">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo subtitle="People Platform" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Tiếng Việt
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[404px] animate-fade-up">
            <div className="mb-6 hidden h-12 w-12 items-center justify-center rounded-[14px] border border-border bg-muted/40 lg:flex">
              <LogoMark className="h-9 w-9 rounded-[11px]" />
            </div>

            <h2 className="font-display text-[28px] font-semibold leading-9 tracking-[-0.02em] text-foreground">
              {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-6 text-muted-foreground">
              {mode === "signin"
                ? "Chào mừng bạn quay trở lại. Tiếp tục quản lý đội ngũ của bạn."
                : "Chỉ mất một phút để bắt đầu không gian làm việc đầu tiên."}
            </p>

            <div className="mt-6 flex rounded-md border border-border/70 bg-muted/60 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setError(null);
                  }}
                  className={cn(
                    "flex-1 rounded-[9px] px-2 py-2 text-[12px] font-medium transition-all duration-200",
                    mode === tab.id
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="block text-[12.5px] font-medium text-foreground">
                    Họ và tên
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Nguyễn Minh Anh"
                      className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-3 text-[13.5px] text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary focus:shadow-focus"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[12.5px] font-medium text-foreground">
                  Email công việc
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@congty.vn"
                    className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-3 text-[13.5px] text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary focus:shadow-focus"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[12.5px] font-medium text-foreground">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "signin" ? "Nhập mật khẩu" : "Tối thiểu 6 ký tự"}
                    className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-11 text-[13.5px] text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary focus:shadow-focus"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2.5 text-[12px] leading-5 text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="mt-1 w-full justify-between px-4"
                disabled={loading}
              >
                <span className="flex items-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading
                    ? mode === "signin"
                      ? "Đang đăng nhập…"
                      : "Đang tạo tài khoản…"
                    : mode === "signin"
                      ? "Đăng nhập"
                      : "Tạo tài khoản"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-center text-[11.5px] leading-5 text-muted-foreground">
              Mỗi tài khoản có thể tham gia nhiều công ty với vai trò khác nhau. Dữ liệu của từng
              công ty được tách biệt hoàn toàn.
            </p>

            <p className="mt-5 text-center text-[12px] text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Chưa có tài khoản?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Tạo tài khoản mới
                  </button>
                </>
              ) : (
                <>
                  Đã có tài khoản?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Đăng nhập
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-4 text-[10.5px] text-muted-foreground sm:flex-row">
          <span>© 2026 ONHRM</span>
          <div className="flex items-center gap-4">
            <span>Bảo mật</span>
            <span>Điều khoản</span>
            <span>Trạng thái hệ thống</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
