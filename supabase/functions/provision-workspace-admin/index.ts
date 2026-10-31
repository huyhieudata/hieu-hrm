import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;

    if (!url || !anonKey || !serviceKey) {
      return json({ error: "Thiếu cấu hình máy chủ." }, 500);
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Bạn cần đăng nhập." }, 401);
    }

    const admin = createClient(url, serviceKey);

    const { data: platformAdmin } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!platformAdmin) {
      return json({ error: "Chỉ quản trị viên hệ thống được cấp tài khoản workspace." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const companyId = String(body.company_id ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const fullName = String(body.full_name ?? "").trim() || email.split("@")[0];

    if (!companyId || !email || !phone) {
      return json({ error: "Thiếu workspace, email hoặc số điện thoại." }, 400);
    }

    const { data: company } = await admin
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) {
      return json({ error: "Workspace không tồn tại." }, 404);
    }

    const password = "123456";
    let userId: string | null = null;
    let createdAccount = false;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    });

    if (createError) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        return json({ error: listError.message }, 500);
      }
      const existing = list?.users?.find((item) => (item.email ?? "").toLowerCase() === email);
      if (!existing) {
        return json({ error: createError.message }, 400);
      }
      userId = existing.id;
    } else {
      userId = created.user?.id ?? null;
      createdAccount = true;
    }

    if (!userId) {
      return json({ error: "Không tạo được tài khoản quản trị viên." }, 500);
    }

    const { data: employeeId, error: rpcError } = await admin.rpc("provision_workspace_admin_profile", {
      p_company: companyId,
      p_user: userId,
      p_name: fullName,
      p_email: email,
      p_phone: phone,
    });
    if (rpcError) {
      return json({ error: rpcError.message }, 400);
    }

    return json({
      user_id: userId,
      employee_id: employeeId,
      email,
      phone,
      password,
      created_account: createdAccount,
    });
  } catch (error) {
    console.error("provision-workspace-admin failed", error);
    return json({ error: error instanceof Error ? error.message : "Lỗi không xác định." }, 500);
  }
});
