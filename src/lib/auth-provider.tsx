import { clearQueryCache } from "@/lib/query-cache";
/* eslint-disable react-refresh/only-export-components */
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { noticeIfSlow } from "./net-retry";
import { beginSignOutGuard, supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  avatar_url: string | null;
}

const PROFILE_COLUMNS = "id, full_name, email, phone, job_title, avatar_url";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
  }) => Promise<{ needsConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "full_name" | "phone" | "job_title">>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ERROR_MESSAGES: { match: RegExp; message: string }[] = [
  { match: /invalid login credentials/i, message: "Email hoặc mật khẩu không đúng." },
  { match: /email not confirmed/i, message: "Email chưa được xác thực. Vui lòng kiểm tra hộp thư." },
  { match: /user already registered/i, message: "Email này đã có tài khoản. Hãy đăng nhập." },
  { match: /password should be at least/i, message: "Mật khẩu phải có ít nhất 6 ký tự." },
  { match: /unable to validate email|invalid email/i, message: "Email không hợp lệ." },
  { match: /rate limit|too many requests/i, message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút." },
  { match: /signups? not allowed|signup is disabled/i, message: "Hệ thống đang tạm khoá đăng ký mới." },
];

export const describeAuthError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const known = AUTH_ERROR_MESSAGES.find((entry) => entry.match.test(raw));
  return known?.message ?? (raw || "Đã xảy ra lỗi. Vui lòng thử lại.");
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileFor = useRef<string | null>(null);
  const loadProfile = useCallback(async (currentUser: User) => {
    // INITIAL_SESSION + getSession + TOKEN_REFRESHED cùng bắn ⇒ chỉ tải hồ sơ 1 lần cho mỗi user.
    if (profileFor.current === currentUser.id) {
      setLoading(false);
      return;
    }
    profileFor.current = currentUser.id;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        return;
      }

      const metadataName = currentUser.user_metadata?.full_name;
      const fallbackName =
        (typeof metadataName === "string" && metadataName.trim()) ||
        currentUser.email?.split("@")[0] ||
        "Người dùng ONHRM";

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({ id: currentUser.id, full_name: fallbackName, email: currentUser.email })
        .select(PROFILE_COLUMNS)
        .single();

      if (createError) throw createError;
      setProfile(created);
    } catch (error) {
      profileFor.current = null;
      console.error("Không tải được hồ sơ người dùng", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      // Giữ nguyên object user khi chỉ refresh token ⇒ không làm re-render/refetch toàn app.
      setUser((current) => (current && nextSession?.user && current.id === nextSession.user.id ? current : nextSession?.user ?? null));

      if (!nextSession?.user) {
        profileFor.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      // Mở giao diện ngay khi đã có phiên. Hồ sơ tải nền, không chặn màn chờ.
      setLoading(false);
      const nextUser = nextSession.user;
      // Deferred: calling the client inside this callback deadlocks the auth client.
      setTimeout(() => {
        if (active) void loadProfile(nextUser);
      }, 0);
    });

    void noticeIfSlow(supabase.auth.getSession()).then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        setLoading(false);
        return;
      }
      setSession(data.session);
      setUser((current) => (current && current.id === data.session!.user.id ? current : data.session!.user));
      setLoading(false);
      const restoredUser = data.session.user;
      setTimeout(() => {
        if (active) void loadProfile(restoredUser);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(describeAuthError(error));
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName.trim() },
      },
    });

    if (error) throw new Error(describeAuthError(error));
    return { needsConfirmation: !data.session };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
    });
    if (error) throw new Error(describeAuthError(error));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(describeAuthError(error));
  }, []);

  const signOut = useCallback(async () => {
    // 1) Khoá ghi phiên + dừng refresh ⇒ không gì ghi lại token sau khi xoá.
    beginSignOutGuard();
    try {
      supabase.auth.stopAutoRefresh();
    } catch {
      /* bỏ qua */
    }
    const wipe = () => {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        try {
          Object.keys(storage)
            .filter((key) => key.startsWith("sb-") || key.includes("supabase") || key.includes("auth-token"))
            .forEach((key) => storage.removeItem(key));
        } catch {
          /* storage bị chặn */
        }
      }
      try {
        document.cookie.split(";").forEach((c) => {
          const name = c.split("=")[0]?.trim();
          if (name && (name.startsWith("sb-") || name.includes("auth"))) {
            document.cookie = `${name}=; Max-Age=0; path=/`;
          }
        });
      } catch {
        /* bỏ qua */
      }
    };
    wipe();
    // 2) Huỷ phiên (local) – tối đa 1.5s, rồi xoá lại lần nữa phòng khi có ghi muộn.
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
      new Promise((resolve) => window.setTimeout(resolve, 1500)),
    ]);
    setProfile(null);
    clearQueryCache();
    wipe();
    window.location.replace("/login");
  }, []);

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>(
    async (patch) => {
      if (!user) throw new Error("Bạn cần đăng nhập để cập nhật hồ sơ.");
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select(PROFILE_COLUMNS)
        .single();

      if (error) throw error;
      setProfile(data);
    },
    [user],
  );

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [loadProfile, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, requestPasswordReset, session, signIn, signOut, signUp, updatePassword, updateProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return context;
};

export const displayName = (profile: Profile | null, fallback?: string | null) =>
  profile?.full_name?.trim() || fallback?.split("@")[0] || "Người dùng ONHRM";
