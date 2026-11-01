import { supabase } from "@/integrations/supabase/client";

export const SESSION_EXPIRED_MESSAGE = "Phiên đã hết hạn, vui lòng đăng nhập lại";

/** Kiểm tra phiên còn hiệu lực (tự refresh nếu sắp hết hạn) TRƯỚC thao tác ghi quan trọng. */
export async function ensureFreshSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;
    const expiresAt = (session.expires_at ?? 0) * 1000;
    if (expiresAt - Date.now() > 60_000) return true;
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    return !error && Boolean(refreshed.session);
  } catch {
    return false;
  }
}

export function isAuthError(message: string): boolean {
  return /đăng nhập|jwt|unauthori|401|session|phiên/i.test(message);
}
