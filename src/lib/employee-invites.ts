import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type InviteState = "none" | "sent" | "joined" | "expired" | "revoked";

export interface EmployeeInviteStatus {
  employee_id: string;
  invite_id: string | null;
  status: InviteState;
  email: string | null;
  role: Role | null;
  token: string | null;
  created_at: string | null;
  expires_at: string | null;
  email_sent_at: string | null;
  email_status: string | null;
  linked: boolean;
}

export const INVITE_STATE_META: Record<
  InviteState,
  {
    label: string;
    tone: "muted" | "info" | "success" | "warning" | "destructive";
  }
> = {
  none: { label: "Chưa mời", tone: "muted" },
  sent: { label: "Đã gửi lời mời", tone: "info" },
  joined: { label: "Đã tham gia", tone: "success" },
  expired: { label: "Lời mời hết hạn", tone: "warning" },
  revoked: { label: "Đã thu hồi", tone: "destructive" },
};

export const INVITE_ERRORS: Record<string, string> = {
  INVITE_IDENTITY_REQUIRED:
    "Cần email để mời (vai trò HR/Quản trị bắt buộc email khớp tài khoản).",
  INVALID_EMAIL: "Email không hợp lệ.",
  ROLE_NOT_ALLOWED: "Bạn không được mời với vai trò này.",
  EMPLOYEE_ALREADY_LINKED: "Hồ sơ đã liên kết tài khoản.",
  FORBIDDEN: "Chỉ chủ sở hữu, quản trị viên hoặc HR được mời.",
};

export const friendlyInviteError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error);
  const key = Object.keys(INVITE_ERRORS).find((k) => message.includes(k));
  return key ? INVITE_ERRORS[key] : message;
};

export const inviteUrl = (token: string) =>
  `${window.location.origin}/tham-gia/${token}`;

export const loadEmployeeInviteStatus = async (
  companyId: string,
): Promise<EmployeeInviteStatus[]> => {
  const { data, error } = await db.rpc("employee_invite_status", {
    p_company: companyId,
  });
  if (error) throw error;
  return (data ?? []) as EmployeeInviteStatus[];
};

export const inviteEmployee = async (input: {
  employeeId: string;
  email: string;
  role: Role;
  jobTitle?: string | null;
  department?: string | null;
}): Promise<{ invite_id: string; token: string; expires_at: string }> => {
  const { data, error } = await db.rpc("invite_employee", {
    p_employee: input.employeeId,
    p_email: input.email,
    p_role: input.role,
    p_job_title: input.jobTitle ?? null,
    p_department: input.department ?? null,
  });
  if (error) throw error;
  return (
    data as { invite_id: string; token: string; expires_at: string }[]
  )[0];
};

export type SendResult = { sent: boolean; reason?: string };

/** Gọi Edge Function gửi email. Nếu chưa cấu hình SMTP/Brevo ⇒ sent=false, reason=NOT_CONFIGURED. */
export const sendInviteEmail = async (
  inviteId: string,
): Promise<SendResult> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "send-invite-email",
      { body: { invite_id: inviteId } },
    );
    if (error) return { sent: false, reason: "FUNCTION_ERROR" };
    return { sent: Boolean(data?.sent), reason: data?.reason };
  } catch {
    return { sent: false, reason: "FUNCTION_ERROR" };
  }
};

export const revokeEmployeeInvite = async (inviteId: string) => {
  const { error } = await db.rpc("revoke_employee_invite", {
    p_invite: inviteId,
  });
  if (error) throw error;
};

export const inviteMailto = (
  email: string,
  token: string,
  companyName: string,
) => {
  const subject = `Lời mời tham gia ${companyName} trên ONHRM`;
  const body = `Xin chào,\n\nBạn được mời tham gia ${companyName} trên ONHRM. Đăng ký/đăng nhập bằng email ${email} rồi mở liên kết:\n${inviteUrl(token)}\n\nLiên kết dùng một lần, hết hạn sau 14 ngày.`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
