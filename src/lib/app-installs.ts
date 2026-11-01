import { supabase } from "@/integrations/supabase/client";
import { getDeviceHash } from "@/lib/attendance-verify";
import { isIosDevice } from "@/lib/pwa";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type InstallEvent = "open" | "installed";

export interface AppInstallStatus {
  user_id: string;
  employee_id: string | null;
  installed: boolean;
  device_count: number;
  platforms: string[];
  first_installed_at: string | null;
  last_opened_at: string | null;
}

export const PLATFORM_LABELS: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  desktop: "Máy tính",
  other: "Khác",
};

const LOG_KEY = "onhrm.install.reported";
const MAX_PER_DAY = 3;
const MIN_GAP_MS = 2 * 60 * 60 * 1000;

export const currentDisplayMode = () => {
  if (typeof window === "undefined") return "browser";
  if (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true
  )
    return "standalone";
  for (const mode of [
    "standalone",
    "fullscreen",
    "minimal-ui",
    "window-controls-overlay",
  ]) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode;
  }
  return "browser";
};

export const currentPlatform = () => {
  if (typeof navigator === "undefined") return "other";
  if (isIosDevice()) return "ios";
  if (/android/i.test(navigator.userAgent)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(navigator.userAgent))
    return "desktop";
  return "other";
};

/** Giới hạn: tối đa 3 lần/ngày/công ty, cách nhau ≥ 2 giờ; sự kiện "installed" luôn gửi. */
const shouldReport = (companyId: string, event: InstallEvent) => {
  if (event === "installed") return true;
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}") as Record<
      string,
      number[]
    >;
    const today = new Date().toDateString();
    const times = (log[companyId] ?? []).filter(
      (t) => new Date(t).toDateString() === today,
    );
    if (times.length >= MAX_PER_DAY) return false;
    if (times.length && Date.now() - times[times.length - 1] < MIN_GAP_MS)
      return false;
    return true;
  } catch {
    return true;
  }
};

const remember = (companyId: string) => {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}") as Record<
      string,
      number[]
    >;
    const today = new Date().toDateString();
    log[companyId] = [
      ...(log[companyId] ?? []).filter(
        (t) => new Date(t).toDateString() === today,
      ),
      Date.now(),
    ];
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* bỏ qua */
  }
};

export const reportAppInstall = async (
  companyId: string,
  event: InstallEvent,
) => {
  const mode = currentDisplayMode();
  if (event === "open" && mode === "browser") return;
  if (!shouldReport(companyId, event)) return;
  remember(companyId);
  const { error } = await db.rpc("report_app_install", {
    p_company: companyId,
    p_device_hash: await getDeviceHash(),
    p_platform: currentPlatform(),
    p_display_mode: mode,
    p_event: event,
  });
  if (error) throw error;
};

export const loadAppInstallStatus = async (
  companyId: string,
): Promise<AppInstallStatus[]> => {
  const { data, error } = await db.rpc("app_install_status", {
    p_company: companyId,
  });
  if (error) throw error;
  return (data ?? []) as AppInstallStatus[];
};
