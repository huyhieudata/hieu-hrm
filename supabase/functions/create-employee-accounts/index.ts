// Admin/HR tạo tài khoản đăng nhập cho nhân viên (thay cho gửi mail mời).
// POST { company_id, action: "create", rows: [{ employee_id } | { email, full_name }] }  (tối đa 200 dòng)
// POST { company_id, action: "reset", employee_id }  — đặt lại mật khẩu tạm và gửi lại email
// Bảo mật: kiểm tra JWT + membership owner/admin/hr phía server; mật khẩu không ghi log/DB;
// mật khẩu chỉ trả về client khi gửi email thất bại (để admin tải CSV một lần).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderTemplate, sendMail, wrapEmail } from "../_shared/mailer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_ROWS = 200;
const RATE_WINDOW_MIN = 10;
const RATE_MAX = 400;
const EMAIL_RE = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** Mật khẩu tạm dễ đọc: 3 nhóm 4 ký tự, bỏ ký tự dễ nhầm (0/O, 1/l/I). Ví dụ: Kx7m-Qp3d-Wr9t */
const generatePassword = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    const chars: string[] = [];
    while (chars.length < 12) {
      for (const b of crypto.getRandomValues(new Uint8Array(32))) {
        if (b < limit && chars.length < 12) chars.push(alphabet[b % alphabet.length]);
      }
    }
    const pw = `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) return pw;
  }
};

type Row = { key: string; employee_id?: string; email?: string; full_name?: string };
type Result = {
  key: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  result: "created" | "exists" | "linked" | "reset" | "error";
  message: string;
  mail_status?: string;
  temporary_password?: string;
};

const DEFAULT_SUBJECT = "Tài khoản ONHRM của bạn tại {{ten_cong_ty}}";
const DEFAULT_BODY =
  "<h2>Tài khoản ONHRM của bạn</h2><p>Xin chào {{ten_nhan_vien}},</p><p><strong>{{ten_cong_ty}}</strong> đã tạo tài khoản ONHRM cho bạn.</p><p>Tên đăng nhập: <strong>{{ten_dang_nhap}}</strong><br/>Mật khẩu tạm: <strong>{{mat_khau_tam}}</strong></p><p><a href=\"{{link_dang_nhap}}\">Đăng nhập ngay</a></p><p><strong>Hệ thống sẽ yêu cầu bạn đổi mật khẩu ngay ở lần đăng nhập đầu tiên.</strong></p>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
    if (!url || !serviceKey || !anonKey) return json({ error: "Thiếu cấu hình máy chủ." }, 500);

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await caller.auth.getUser();
    const actor = userData?.user;
    if (!actor) return json({ error: "Bạn cần đăng nhập." }, 401);

    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.company_id === "string" ? body.company_id : "";
    const action = body.action === "reset" ? "reset" : "create";
    if (!companyId) return json({ error: "Thiếu công ty." }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: member } = await admin
      .from("company_members").select("role")
      .eq("company_id", companyId).eq("user_id", actor.id).eq("status", "active").maybeSingle();
    if (!member || !["owner", "admin", "hr"].includes(member.role))
      return json({ error: "Chỉ Chủ sở hữu / Quản trị / Nhân sự được tạo tài khoản." }, 403);

    const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
    const { count } = await admin
      .from("account_provision_logs").select("id", { count: "exact", head: true })
      .eq("actor_id", actor.id).gte("created_at", since);
    if ((count ?? 0) >= RATE_MAX)
      return json({ error: `Bạn đã tạo quá nhiều tài khoản trong ${RATE_WINDOW_MIN} phút. Vui lòng thử lại sau.` }, 429);

    const { data: company } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
    const companyName = company?.name ?? "công ty";
    const appUrl = (Deno.env.get("APP_URL") ?? "https://hieu-hrm.vercel.app").replace(/\/$/, "");
    const { data: tpl } = await admin
      .from("email_templates").select("id, subject, body_html, active")
      .eq("company_id", companyId).eq("code", "tai_khoan_moi").maybeSingle();
    const useTpl = tpl?.active && tpl.body_html ? tpl : null;

    const ctx: Ctx = { admin, companyId, companyName, appUrl, actorId: actor.id, actorRole: member.role, tpl: useTpl };

    if (action === "reset") {
      const employeeId = typeof body.employee_id === "string" ? body.employee_id : "";
      if (!employeeId) return json({ error: "Thiếu nhân viên." }, 400);
      return json({ results: [await resetOne(ctx, employeeId)] });
    }

    const rows: Row[] = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) return json({ error: "Không có dòng nào." }, 400);
    if (rows.length > MAX_ROWS) return json({ error: `Tối đa ${MAX_ROWS} dòng mỗi lần.` }, 400);
    const results: Result[] = [];
    const seen = new Set<string>();
    for (const [i, raw] of rows.entries()) {
      const row: Row = { ...raw, key: String(raw?.key ?? i) };
      results.push(await createOne(ctx, row, seen));
    }
    return json({ results });
  } catch (err) {
    console.error("create-employee-accounts failed", (err as Error)?.message);
    return json({ error: "Lỗi máy chủ khi tạo tài khoản." }, 500);
  }
});

type Ctx = {
  admin: SupabaseClient;
  companyId: string;
  companyName: string;
  appUrl: string;
  actorId: string;
  actorRole: string;
  tpl: { id: string; subject: string; body_html: string } | null;
};

const log = (ctx: Ctx, r: Result, action: "create" | "reset", targetUserId: string | null) =>
  ctx.admin.from("account_provision_logs").insert({
    company_id: ctx.companyId, actor_id: ctx.actorId, employee_id: r.employee_id, target_user_id: targetUserId,
    email: r.email || null, action, result: r.result, mail_status: r.mail_status ?? null, detail: r.message.slice(0, 300),
  });

async function sendCredentials(ctx: Ctx, email: string, fullName: string, password: string) {
  const vars = {
    ten_nhan_vien: fullName || email, ten_cong_ty: ctx.companyName, ten_dang_nhap: email, email_nhan_vien: email,
    mat_khau_tam: password, link_dang_nhap: `${ctx.appUrl}/login`, link_app: ctx.appUrl,
    ngay: new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
  };
  const subject = renderTemplate(ctx.tpl?.subject ?? DEFAULT_SUBJECT, vars, false) || "Tài khoản ONHRM của bạn";
  const html = wrapEmail(renderTemplate(ctx.tpl?.body_html ?? DEFAULT_BODY, vars));
  const status = await sendMail(email, subject, html);
  // Chỉ ghi tiêu đề + trạng thái; nội dung (có mật khẩu) không lưu. Che mật khẩu trong lỗi nếu có.
  await ctx.admin.from("email_logs").insert({
    company_id: ctx.companyId, template_id: ctx.tpl?.id ?? null, event_key: "account_created", to_email: email,
    subject, status: status === "sent" ? "sent" : "failed",
    error: status === "sent" ? null : status.split(password).join("********"),
  });
  return status;
}

async function ensureMembership(ctx: Ctx, userId: string, jobTitle: string | null) {
  const { data: existing } = await ctx.admin
    .from("company_members").select("id").eq("company_id", ctx.companyId).eq("user_id", userId).maybeSingle();
  if (existing) return;
  const { error } = await ctx.admin.from("company_members").insert({
    company_id: ctx.companyId, user_id: userId, role: "employee", job_title: jobTitle, invited_by: ctx.actorId,
  });
  if (error) throw new Error(`Không thêm được vào công ty: ${error.message}`);
}

async function createOne(ctx: Ctx, row: Row, seen: Set<string>): Promise<Result> {
  const r: Result = { key: row.key, employee_id: null, full_name: (row.full_name ?? "").trim(), email: "", result: "error", message: "" };
  let targetUserId: string | null = null;
  try {
    let emp: { id: string; full_name: string; user_id: string | null; work_email: string | null; personal_email: string | null; job_title?: string | null } | null = null;
    if (row.employee_id) {
      const { data } = await ctx.admin.from("employees")
        .select("id, full_name, user_id, work_email, personal_email")
        .eq("company_id", ctx.companyId).eq("id", row.employee_id).maybeSingle();
      if (!data) throw new Error("Không tìm thấy hồ sơ nhân viên trong công ty.");
      emp = data;
      r.email = (data.work_email || data.personal_email || "").trim().toLowerCase();
    } else {
      r.email = (row.email ?? "").trim().toLowerCase();
      if (r.email && !EMAIL_RE.test(r.email)) throw new Error("Email không hợp lệ.");
      if (r.email) {
        const pattern = r.email.replace(/_/g, "\\_");
        const { data } = await ctx.admin.from("employees")
          .select("id, full_name, user_id, work_email, personal_email")
          .eq("company_id", ctx.companyId)
          .or(`work_email.ilike.${pattern},personal_email.ilike.${pattern}`)
          .limit(1);
        emp = data?.[0] ?? null;
      }
    }
    if (emp) { r.employee_id = emp.id; r.full_name = emp.full_name || r.full_name; }
    if (!r.email) throw new Error("Hồ sơ chưa có email.");
    if (!EMAIL_RE.test(r.email)) throw new Error("Email không hợp lệ.");
    if (seen.has(r.email)) throw new Error("Trùng email với dòng khác trong lần này.");
    seen.add(r.email);
    if (emp?.user_id) {
      r.result = "exists"; r.message = "Nhân viên đã có tài khoản.";
      targetUserId = emp.user_id;
      return r;
    }

    const { data: existingId } = await ctx.admin.rpc("find_auth_user_id_by_email", { p_email: r.email });
    if (existingId) {
      targetUserId = existingId as string;
      await ensureMembership(ctx, targetUserId, null);
      if (emp) await ctx.admin.from("employees").update({ user_id: targetUserId }).eq("id", emp.id).is("user_id", null);
      r.result = "linked";
      r.message = "Email đã có tài khoản — đã gắn vào hồ sơ, giữ nguyên mật khẩu của người dùng.";
      return r;
    }

    const password = generatePassword();
    const { data: created, error: createError } = await ctx.admin.auth.admin.createUser({
      email: r.email, password, email_confirm: true,
      user_metadata: { full_name: r.full_name || r.email.split("@")[0] },
      app_metadata: { provisioned_company: ctx.companyId },
    });
    if (createError || !created.user) throw new Error(createError?.message ?? "Không tạo được tài khoản.");
    targetUserId = created.user.id;
    await ctx.admin.from("profiles").update({ must_change_password: true }).eq("id", targetUserId);
    await ensureMembership(ctx, targetUserId, null);
    if (emp) {
      const { error } = await ctx.admin.from("employees").update({ user_id: targetUserId }).eq("id", emp.id).is("user_id", null);
      if (error) throw new Error(`Đã tạo tài khoản nhưng chưa gắn được hồ sơ: ${error.message}`);
    }
    r.result = "created";
    r.mail_status = await sendCredentials(ctx, r.email, r.full_name, password);
    if (r.mail_status === "sent") {
      r.message = emp ? "Đã tạo và gửi email." : "Đã tạo và gửi email (chưa khớp hồ sơ nhân viên nào).";
    } else {
      r.message = r.mail_status === "NOT_CONFIGURED" ? "Đã tạo; chưa cấu hình gửi mail." : "Đã tạo; gửi email lỗi.";
      r.temporary_password = password; // chỉ trả khi mail lỗi, để admin tải CSV một lần
    }
    return r;
  } catch (err) {
    r.result = "error";
    r.message = (err as Error)?.message ?? "Lỗi không xác định.";
    return r;
  } finally {
    await log(ctx, r, "create", targetUserId);
  }
}

async function resetOne(ctx: Ctx, employeeId: string): Promise<Result> {
  const r: Result = { key: employeeId, employee_id: employeeId, full_name: "", email: "", result: "error", message: "" };
  let targetUserId: string | null = null;
  try {
    const { data: emp } = await ctx.admin.from("employees")
      .select("id, full_name, user_id").eq("company_id", ctx.companyId).eq("id", employeeId).maybeSingle();
    if (!emp) throw new Error("Không tìm thấy hồ sơ nhân viên.");
    r.full_name = emp.full_name;
    if (!emp.user_id) throw new Error("Nhân viên chưa có tài khoản — hãy dùng Tạo tài khoản.");
    const uid: string = emp.user_id;
    targetUserId = uid;
    if (uid === ctx.actorId) throw new Error("Không đặt lại mật khẩu của chính bạn ở đây; dùng Quên mật khẩu.");
    const { data: tm } = await ctx.admin.from("company_members").select("role")
      .eq("company_id", ctx.companyId).eq("user_id", uid).maybeSingle();
    if (!tm) throw new Error("Tài khoản không thuộc công ty này.");
    if (["owner", "admin"].includes(tm.role) && ctx.actorRole !== "owner")
      throw new Error("Chỉ Chủ sở hữu được đặt lại mật khẩu của Quản trị viên.");
    const { data: u } = await ctx.admin.auth.admin.getUserById(uid);
    r.email = (u?.user?.email ?? "").toLowerCase();
    if (!r.email) throw new Error("Tài khoản không có email.");
    const password = generatePassword();
    const { error } = await ctx.admin.auth.admin.updateUserById(uid, { password });
    if (error) throw new Error(error.message);
    await ctx.admin.from("profiles").update({ must_change_password: true }).eq("id", targetUserId);
    r.result = "reset";
    r.mail_status = await sendCredentials(ctx, r.email, r.full_name, password);
    if (r.mail_status === "sent") r.message = "Đã đặt lại và gửi email.";
    else {
      r.message = r.mail_status === "NOT_CONFIGURED" ? "Đã đặt lại; chưa cấu hình gửi mail." : "Đã đặt lại; gửi email lỗi.";
      r.temporary_password = password;
    }
    return r;
  } catch (err) {
    r.message = (err as Error)?.message ?? "Lỗi không xác định.";
    return r;
  } finally {
    await log(ctx, r, "reset", targetUserId);
  }
}
