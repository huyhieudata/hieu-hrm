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
export const INSTALL_REOPEN_EVENT = "onhrm:install";

export const registerServiceWorker = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!import.meta.env.PROD && localHost) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
};
