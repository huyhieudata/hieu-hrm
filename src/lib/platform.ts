import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ServicePlan {
  id: string;
  name: string;
  code: string | null;
  price_monthly: number;
  price_yearly: number;
  max_members: number | null;
  max_workspaces: number;
  duration_months: number;
  duration_days: number | null;
  features: string[];
  active: boolean;
  created_at: string;
}

export interface PlatformWorkspace {
  id: string;
  name: string;
  slug: string | null;
  plan_id: string | null;
  plan_name: string | null;
  subscription_expires_at: string | null;
  workspace_status: string;
  created_at: string;
  member_count: number;
}

export const WORKSPACE_STATUS_LABELS: Record<string, string> = {
  active: "Đang hoạt động",
  trial: "Dùng thử",
  suspended: "Tạm dừng",
};

export const usePlatformAdmin = () => {
  const { user } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setIsPlatformAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    db.from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: { data: { user_id: string } | null }) => {
        if (!active) return;
        setIsPlatformAdmin(!!data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  return { isPlatformAdmin, loading };
};

export const listServicePlans = async (): Promise<ServicePlan[]> => {
  const { data, error } = await db
    .from("service_plans")
    .select("*")
    .order("price_monthly", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được gói dịch vụ.");
  return (data ?? []) as ServicePlan[];
};

export const createServicePlan = async (values: Record<string, unknown>) => {
  const { data, error } = await db.from("service_plans").insert(values).select("id").single();
  if (error) throw new Error(error.message ?? "Không tạo được gói dịch vụ.");
  return data.id as string;
};

export const updateServicePlan = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("service_plans").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được gói dịch vụ.");
};

export const deleteServicePlan = async (id: string) => {
  const { error } = await db.from("service_plans").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được gói dịch vụ.");
};

export const listWorkspaces = async (): Promise<PlatformWorkspace[]> => {
  const { data, error } = await db
    .from("companies")
    .select(
      "id, name, slug, plan_id, subscription_expires_at, workspace_status, created_at, service_plans(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Không tải được danh sách workspace.");

  const { data: members } = await db.from("company_members").select("company_id");
  const counts = new Map<string, number>();
  ((members ?? []) as { company_id: string }[]).forEach((row) => {
    counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
  });

  return ((data ?? []) as (Omit<PlatformWorkspace, "plan_name" | "member_count"> & {
    service_plans?: { name: string | null } | null;
  })[]).map((row) => ({
    ...row,
    plan_name: row.service_plans?.name ?? null,
    member_count: counts.get(row.id) ?? 0,
  }));
};

export const createWorkspace = async (values: {
  name: string;
  plan_id: string | null;
  subscription_expires_at: string | null;
  workspace_status: string;
  created_by: string | null;
}) => {
  const { data, error } = await db
    .from("companies")
    .insert({
      name: values.name,
      plan_id: values.plan_id,
      subscription_expires_at: values.subscription_expires_at,
      workspace_status: values.workspace_status,
      created_by: values.created_by,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message ?? "Không tạo được workspace.");
  return data.id as string;
};

export const updateWorkspace = async (id: string, values: Record<string, unknown>) => {
  const { error } = await db.from("companies").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được workspace.");
};

export const deleteWorkspace = async (id: string) => {
  const { error } = await db.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được workspace.");
};

export interface ProvisionedAdmin {
  user_id: string;
  employee_id: string;
  email: string;
  phone: string;
  /** Mật khẩu tạm ngẫu nhiên, chỉ có khi vừa tạo tài khoản mới (null nếu email đã có tài khoản). */
  temporary_password: string | null;
  created_account: boolean;
}

/** Tạo tài khoản đăng nhập + hồ sơ nhân sự đầu tiên cho workspace (qua backend function). */
export const provisionWorkspaceAdmin = async (input: {
  company_id: string;
  full_name: string;
  email: string;
  phone: string;
}): Promise<ProvisionedAdmin> => {
  const { data, error } = await supabase.functions.invoke("provision-workspace-admin", { body: input });
  if (error) throw new Error(error.message ?? "Không tạo được tài khoản quản trị viên.");
  if (data?.error) throw new Error(data.error);
  return data as ProvisionedAdmin;
};

export const createWorkspaceAdminInvite = async (input: {
  companyId: string;
  email: string | null;
  phone: string | null;
  invitedBy: string | null;
}) => {
  const { data, error } = await db
    .from("company_invites")
    .insert({
      company_id: input.companyId,
      role: "owner",
      email: input.email,
      phone: input.phone,
      invited_by: input.invitedBy,
    })
    .select("token")
    .single();
  if (error) throw new Error(error.message ?? "Không tạo được lời mời quản trị viên.");
  return data.token as string;
};

export const workspaceDaysLeft = (expiresAt: string | null) => {
  if (!expiresAt) return null;
  const end = new Date(`${expiresAt}T00:00:00`).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  return Math.ceil((end - today) / 86400000);
};
