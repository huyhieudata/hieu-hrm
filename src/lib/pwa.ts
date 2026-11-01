export const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // iOS Safari exposes this flag instead of display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export const isIosDevice = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as Window & { MSStream?: unknown }).MSStream;

export const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

export const isInAppBrowser = () =>
  typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|Zalo|Line\/|Twitter/i.test(navigator.userAgent);

export const INSTALL_DISMISS_KEY = "onhrm.install.dismissedAt";
export const INSTALL_DONE_KEY = "onhrm.install.installed";
export const INSTALL_NEVER_KEY = "onhrm.install.never";
export const INSTALL_REOPEN_EVENT = "onhrm:install";

export const registerServiceWorker = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!import.meta.env.PROD && localHost) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => undefined);
  });
};

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** Bắt beforeinstallprompt ngay khi tải module (trước khi React mount) để nút cài không bị "chết". */
let deferredInstall: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("onhrm:install-ready"));
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
  });
}
export const getDeferredInstall = () => deferredInstall;
export const clearDeferredInstall = () => {
  deferredInstall = null;
};
