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

/** Mật khẩu tạm ngẫu nhiên 16 ký tự sinh bằng crypto, chỉ trả về một lần khi tạo tài khoản mới. */
const generatePassword = (length = 16) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const limit = 256 - (256 % alphabet.length);
  const chars: string[] = [];
  while (chars.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < limit && chars.length < length) chars.push(alphabet[byte % alphabet.length]);
    }
  }
  return chars.join("");
};

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

    const password = generatePassword();
    let userId: string | null = null;
    let createdAccount = false;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    });

    if (createError) {
      // Tra trực tiếp theo email (không phụ thuộc phân trang listUsers).
      const { data: existingId, error: lookupError } = await admin.rpc("find_auth_user_id_by_email", {
        p_email: email,
      });
      if (lookupError) {
        return json({ error: lookupError.message }, 500);
      }
      if (!existingId) {
        return json({ error: createError.message }, 400);
      }
      userId = existingId as string;
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
      // Chỉ trả mật khẩu tạm khi vừa tạo tài khoản mới; tài khoản có sẵn giữ nguyên mật khẩu cũ.
      temporary_password: createdAccount ? password : null,
      created_account: createdAccount,
    });
  } catch (error) {
    console.error("provision-workspace-admin failed", error);
    return json({ error: error instanceof Error ? error.message : "Lỗi không xác định." }, 500);
  }
});
