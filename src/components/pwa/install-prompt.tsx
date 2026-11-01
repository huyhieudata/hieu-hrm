import { useCallback, useEffect, useState } from "react";
import { Check, Download, MoreVertical, Share, X } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-provider";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_DONE_KEY,
  INSTALL_NEVER_KEY,
  INSTALL_REOPEN_EVENT,
  isInAppBrowser,
  isIosDevice,
  isStandalone,
} from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** Minh hoạ Safari iOS: thanh dưới có nút Chia sẻ → mục “Thêm vào Màn hình chính”. */
const IosShareIllustration = () => (
  <div className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy/80 p-3 text-white">
    <div className="w-[118px] rounded-[18px] border-2 border-white/40 bg-white/10 p-1.5">
      <div className="h-14 rounded-lg bg-white/15" />
      <div className="mt-1.5 flex items-center justify-around rounded-md bg-white/20 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange ring-2 ring-white">
          <Share className="h-3.5 w-3.5" />
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
      </div>
    </div>
    <span className="text-[18px] font-bold text-brand-orange">→</span>
    <div className="w-[128px] space-y-1 rounded-xl bg-white p-2 text-[11px] font-semibold text-brand-navy">
      <div className="rounded-md bg-muted px-2 py-1 text-muted-foreground">Sao chép</div>
      <div className="flex items-center justify-between rounded-md bg-brand-orange/10 px-2 py-1 ring-1 ring-brand-orange">
        Thêm vào MH chính <span className="text-[12px]">＋</span>
      </div>
      <div className="rounded-md bg-muted px-2 py-1 text-muted-foreground">Dấu trang</div>
    </div>
  </div>
);

const BENEFITS = [
  "Mở nhanh từ màn hình chính",
  "Toàn màn hình, không thanh địa chỉ",
  "Giữ đăng nhập trên thiết bị",
];

const readKey = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeKey = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore private-mode storage errors */
  }
};

const SNOOZE_DAYS = 3;
const HIDDEN_PATHS = ["/login", "/ung-tuyen", "/xem-truoc-nhan-vien", "/tham-gia"];
const onHiddenPath = () => HIDDEN_PATHS.some((path) => window.location.pathname.startsWith(path));

const dismissedRecently = () => {
  const value = readKey(INSTALL_DISMISS_KEY);
  if (!value) return false;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
};

export const InstallPrompt = () => {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id);
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const dismiss = useCallback(() => {
    writeKey(INSTALL_DISMISS_KEY, String(Date.now()));
    setOpen(false);
    setInstructions(false);
  }, []);

  const never = useCallback(() => {
    writeKey(INSTALL_NEVER_KEY, "1");
    setOpen(false);
    setInstructions(false);
  }, []);

  // Luôn lắng nghe để không lỡ sự kiện beforeinstallprompt (bắn sớm, trước khi đăng nhập xong).
  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      writeKey(INSTALL_DONE_KEY, "1");
      setDeferred(null);
      setOpen(false);
      setInstructions(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signedIn) {
      setOpen(false);
      return;
    }
    if (isStandalone() || readKey(INSTALL_DONE_KEY)) return;
    if (onHiddenPath()) return;

    const installParam = new URLSearchParams(window.location.search).get("install");
    const forceGuide = installParam === "guide" || installParam === "guide-ios";
    let timer: number | undefined;
    if (forceGuide) {
      setInstructions(true);
      setOpen(true);
    } else if (!readKey(INSTALL_NEVER_KEY) && !dismissedRecently()) {
      // Hiện sau khi đăng nhập, trên cả điện thoại và máy tính; bỏ qua nếu đang ở trang công khai.
      timer = window.setTimeout(() => {
        if (!isStandalone() && !onHiddenPath()) setOpen(true);
      }, 1500);
    }

    const onReopen = () => {
      if (isStandalone()) return;
      setInstructions(false);
      setOpen(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener(INSTALL_REOPEN_EVENT, onReopen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(INSTALL_REOPEN_EVENT, onReopen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [signedIn]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !signedIn) return null;

  const ios =
    isIosDevice() || new URLSearchParams(window.location.search).get("install") === "guide-ios";
  const inApp = isInAppBrowser();

  const install = async () => {
    if (!deferred) {
      setInstructions(true);
      return;
    }
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        writeKey(INSTALL_DONE_KEY, "1");
        setOpen(false);
      } else {
        setInstructions(true);
      }
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-overlay/45 backdrop-blur-[3px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cài ONHRM vào màn hình chính"
      onClick={(event) => event.currentTarget === event.target && dismiss()}
    >
      <div className="w-full max-w-md animate-in slide-in-from-bottom rounded-t-[26px] border border-border/80 bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-overlay duration-300 sm:rounded-[26px] sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12 rounded-[14px]" />
            <div>
              <p className="text-[15px] font-semibold leading-5 text-foreground">
                {instructions ? "Thêm ONHRM vào màn hình chính" : "Cài ONHRM như một ứng dụng"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {instructions
                  ? "Chỉ mất vài giây trên điện thoại"
                  : "Mở nhanh, toàn màn hình, không cần App Store"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Đóng"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {instructions ? (
          <div className="mt-4 space-y-2.5">
            {inApp && (
              <p className="rounded-lg border border-warning/25 bg-warning-subtle px-3 py-2 text-[11.5px] leading-5 text-warning">
                Bạn đang mở trong ứng dụng khác. Hãy mở liên kết bằng Safari hoặc Chrome để cài đặt.
              </p>
            )}
            {ios ? <IosShareIllustration /> : null}
            {ios ? (
              <ol className="space-y-2.5">
                {[
                  { icon: Share, title: "Nhấn nút Chia sẻ", detail: "Biểu tượng ô vuông có mũi tên trên Safari." },
                  { icon: MoreVertical, title: "Chọn “Thêm vào Màn hình chính”", detail: "Cuộn xuống trong bảng chia sẻ." },
                  { icon: Check, title: "Nhấn “Thêm”", detail: "Biểu tượng ONHRM sẽ xuất hiện trên màn hình chính." },
                ].map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-[12px] font-semibold text-foreground">
                          {index + 1}. {step.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                          {step.detail}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ol className="space-y-2.5">
                {[
                  { title: "Mở menu trình duyệt", detail: "Nhấn dấu ba chấm ở góc trên bên phải." },
                  { title: "Chọn “Cài đặt ứng dụng”", detail: "Hoặc “Thêm vào màn hình chính” tùy trình duyệt." },
                  { title: "Xác nhận cài đặt", detail: "ONHRM sẽ nằm cùng các ứng dụng khác trên máy." },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[12px] font-semibold text-foreground">{step.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{step.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button className="h-10" onClick={dismiss}>
                Đã hiểu
              </Button>
              <Button variant="ghost" className="h-10 text-[12px] text-muted-foreground" onClick={never}>
                Không hiện lại
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-[11.5px] text-foreground">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-subtle text-success">
                    <Check className="h-3 w-3" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-2">
              <Button className="h-10 gap-2" onClick={() => void install()} disabled={installing}>
                <Download className={installing ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                {deferred ? "Cài đặt ngay" : "Thêm vào màn hình chính"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11 text-[13px]" onClick={dismiss}>
                  Để sau
                </Button>
                <Button variant="ghost" className="h-11 text-[13px] text-muted-foreground" onClick={never}>
                  Không hiện lại
                </Button>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
              Không cần App Store hay CH Play. “Để sau” sẽ nhắc lại sau 3 ngày.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
