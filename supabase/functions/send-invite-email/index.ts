// Gửi email mời tham gia công ty. Cấu hình (secrets của Edge Function), chọn một:
//   BREVO_API_KEY (+ MAIL_FROM, MAIL_FROM_NAME)   — gửi qua API Brevo
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (+ MAIL_FROM, MAIL_FROM_NAME) — gửi qua SMTP
//   APP_URL (mặc định https://hieu-hrm.vercel.app)
// Chưa cấu hình ⇒ trả { sent: false, reason: "NOT_CONFIGURED" } để giao diện dùng sao chép liên kết / mailto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ROLE_LABELS: Record<string, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr: "Nhân sự (HR)",
  admin: "Quản trị viên",
};
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
    if (!url || !serviceKey || !anonKey)
      return json({ error: "Thiếu cấu hình máy chủ." }, 500);

    const caller = createClient(url, anonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: "Bạn cần đăng nhập." }, 401);

    const { invite_id } = await req.json().catch(() => ({}));
    if (typeof invite_id !== "string")
      return json({ error: "Thiếu invite_id." }, 400);

    const admin = createClient(url, serviceKey);
    const { data: inv } = await admin
      .from("company_invites")
      .select(
        "id, company_id, email, role, job_title, department, token, expires_at, revoked, accepted_at, companies(name)",
      )
      .eq("id", invite_id)
      .maybeSingle();
    if (!inv || inv.revoked || inv.accepted_at || !inv.email)
      return json({ error: "Lời mời không còn hiệu lực." }, 404);

    // Chỉ owner/admin/HR của công ty được gửi.
    const { data: member } = await admin
      .from("company_members")
      .select("role")
      .eq("company_id", inv.company_id)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!member || !["owner", "admin", "hr"].includes(member.role))
      return json({ error: "Bạn không có quyền gửi lời mời." }, 403);

    const appUrl = (
      Deno.env.get("APP_URL") ?? "https://hieu-hrm.vercel.app"
    ).replace(/\/$/, "");
    const link = `${appUrl}/tham-gia/${inv.token}`;
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const company = ((inv as any).companies?.name as string) ?? "công ty";
    const from = Deno.env.get("MAIL_FROM");
    const fromName = Deno.env.get("MAIL_FROM_NAME") ?? "ONHRM";
    const subject = `Lời mời tham gia ${company} trên ONHRM`;
    const expires = new Date(inv.expires_at).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const detail = [
      ROLE_LABELS[inv.role] ?? inv.role,
      inv.job_title,
      inv.department,
    ]
      .filter(Boolean)
      .join(" · ");
    const text = `Xin chào,\n\nBạn được mời tham gia ${company} trên ONHRM (${detail}).\nBấm liên kết sau để tạo tài khoản bằng email ${inv.email} và tham gia:\n${link}\n\nLiên kết hết hạn ngày ${expires}.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0e2d58">
<h2 style="color:#0e2d58">Lời mời tham gia ${esc(company)}</h2>
<p>Bạn được mời tham gia <b>${esc(company)}</b> trên ONHRM với vai trò <b>${esc(detail)}</b>.</p>
<p>Đăng ký/đăng nhập bằng email <b>${esc(inv.email)}</b> rồi bấm nút dưới đây:</p>
<p><a href="${link}" style="display:inline-block;background:#f47b20;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Tham gia ngay</a></p>
<p style="font-size:12px;color:#667">Hoặc mở: ${link}<br/>Liên kết hết hạn ngày ${expires}.</p></div>`;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const smtpHost = Deno.env.get("SMTP_HOST");
    let status = "NOT_CONFIGURED";
    if (from && brevoKey) {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { email: from, name: fromName },
          to: [{ email: inv.email }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      status = res.ok ? "sent" : `error:brevo_${res.status}`;
    } else if (from && smtpHost) {
      const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
      const transport = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: {
          user: Deno.env.get("SMTP_USER"),
          pass: Deno.env.get("SMTP_PASS"),
        },
      });
      try {
        await transport.sendMail({
          from: `"${fromName}" <${from}>`,
          to: inv.email,
          subject,
          text,
          html,
        });
        status = "sent";
      } catch (_err) {
        status = "error:smtp";
      }
    }

    await admin
      .from("company_invites")
      .update({
        email_status: status,
        email_sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", inv.id);

    if (status === "NOT_CONFIGURED")
      return json({ sent: false, reason: "NOT_CONFIGURED", link });
    if (status !== "sent") return json({ sent: false, reason: status, link });
    return json({ sent: true, link });
  } catch (_err) {
    return json({ error: "Không gửi được email." }, 500);
  }
});
