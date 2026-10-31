import { useCallback, useEffect, useState } from "react";
import { Check, Download, MoreVertical, Share, X } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_DONE_KEY,
  INSTALL_REOPEN_EVENT,
  isInAppBrowser,
  isIosDevice,
  isMobileViewport,
  isStandalone,
} from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

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

const dismissedRecently = () => {
  const value = readKey(INSTALL_DISMISS_KEY);
  if (!value) return false;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000;
};

export const InstallPrompt = () => {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const dismiss = useCallback(() => {
    writeKey(INSTALL_DISMISS_KEY, String(Date.now()));
    setOpen(false);
    setInstructions(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || readKey(INSTALL_DONE_KEY)) return;
    if (window.location.pathname.startsWith("/ung-tuyen")) return;

    const installParam = new URLSearchParams(window.location.search).get("install");
    const forceGuide = installParam === "guide" || installParam === "guide-ios";
    let timer: number | undefined;
    if (forceGuide) {
      setInstructions(true);
      setOpen(true);
    } else if (isMobileViewport() && !dismissedRecently()) {
      timer = window.setTimeout(() => setOpen(true), 900);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      writeKey(INSTALL_DONE_KEY, "1");
      setOpen(false);
      setInstructions(false);
    };
    const onReopen = () => {
      if (!isMobileViewport() || isStandalone()) return;
      setInstructions(false);
      setOpen(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(INSTALL_REOPEN_EVENT, onReopen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(INSTALL_REOPEN_EVENT, onReopen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
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
            {ios ? (
              <ol className="space-y-2.5">
                {[
                  { icon: Share, title: "Nhấn nút Chia sẻ", detail: "Biểu tượng ô vuông có mũi tên trên Safari." },
                  { icon: MoreVertical, title: "Chọn “Thêm vào MH chính”", detail: "Cuộn xuống trong bảng chia sẻ." },
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
                        <span className="mt-0.5 block text-[10.5px] leading-4 text-muted-foreground">
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
                      <span className="mt-0.5 block text-[10.5px] leading-4 text-muted-foreground">{step.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <Button className="mt-2 h-10 w-full" onClick={dismiss}>
              Đã hiểu
            </Button>
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
              <Button variant="ghost" className="h-9 text-[12px] text-muted-foreground" onClick={dismiss}>
                Để sau
              </Button>
            </div>
            <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
              Không cần tải từ App Store hay CH Play. Bạn có thể cài lại trong mục “Thêm”.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
