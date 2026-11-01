// Gửi hàng đợi email_queue.
//  - Cron (pg_cron → pg_net) gọi với header x-cron-secret (bảng email_dispatch_config) ⇒ xử lý mọi công ty.
//  - Owner/admin/HR gọi bằng JWT: { mode: "process", company_id } hoặc { mode: "test", template_id } (gửi cho chính mình).
// Deploy với --no-verify-jwt (tự kiểm tra JWT/secret bên dưới).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mailConfigured, renderTemplate, sendMail, wrapEmail } from "../_shared/mailer.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

export const SAMPLE_VARS: Record<string, string> = {
  ten_nhan_vien: "Nguyễn Văn A", ma_nhan_vien: "NV001", email_nhan_vien: "a@congty.vn", phong_ban: "Kinh doanh",
  chuc_danh: "Chuyên viên", ten_quan_ly: "Trần Thị B", ngay_vao_lam: "01/11/2026", link_app: "https://hieu-hrm.vercel.app",
  link_loi_moi: "https://hieu-hrm.vercel.app/tham-gia/mau", han_loi_moi: "15/11/2026", vai_tro: "employee",
  ngay_sinh: "01/11", tuoi: "30", so_hop_dong: "HD-001", loai_hop_dong: "Xác định thời hạn", ngay_het_han: "30/11/2026",
  so_ngay_con_lai: "30", ngay_het_thu_viec: "30/11/2026", loai_don: "Nghỉ phép", tu_ngay: "03/11/2026", den_ngay: "04/11/2026",
  ly_do: "Việc gia đình", ghi_chu_duyet: "Đồng ý", so_lan_di_muon: "3", thang: "11/2026",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    let company: string | null = null;

    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret) {
      const { data: cfg } = await admin.from("email_dispatch_config").select("cron_secret").eq("id", 1).maybeSingle();
      if (!cfg || cfg.cron_secret !== cronSecret) return json({ error: "Sai secret." }, 403);
    } else {
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: u } = await caller.auth.getUser();
      if (!u?.user) return json({ error: "Bạn cần đăng nhập." }, 401);
      company = typeof body.company_id === "string" ? body.company_id : null;
      if (body.mode === "test") {
        const { data: tpl } = await admin.from("email_templates").select("*").eq("id", body.template_id).maybeSingle();
        if (!tpl) return json({ error: "Không tìm thấy mẫu." }, 404);
        company = tpl.company_id;
      }
      if (!company) return json({ error: "Thiếu company_id." }, 400);
      const { data: m } = await admin.from("company_members").select("role").eq("company_id", company)
        .eq("user_id", u.user.id).eq("status", "active").maybeSingle();
      if (!m || !["owner", "admin", "hr"].includes(m.role)) return json({ error: "Không có quyền." }, 403);

      if (body.mode === "test") {
        const { data: tpl } = await admin.from("email_templates").select("*").eq("id", body.template_id).single();
        const { data: co } = await admin.from("companies").select("name").eq("id", company).single();
        const vars = { ...SAMPLE_VARS, ten_cong_ty: co?.name ?? "Công ty", ngay: new Date().toLocaleDateString("vi-VN") };
        const to = u.user.email!;
        const subject = "[Thử] " + renderTemplate(tpl.subject, vars, false);
        const status = await sendMail(to, subject, wrapEmail(renderTemplate(tpl.body_html, vars)));
        await admin.from("email_logs").insert({ company_id: company, template_id: tpl.id, event_key: "test", to_email: to,
          subject, status: status === "sent" ? "sent" : "failed", error: status === "sent" ? null : status });
        return json({ sent: status === "sent", reason: status === "sent" ? undefined : status, to });
      }
    }

    const { data: batch, error } = await admin.rpc("email_claim_batch", { p_limit: 50, p_company: company });
    if (error) return json({ error: error.message }, 500);
    let sent = 0, failed = 0;
    const configured = mailConfigured();
    for (const q of batch ?? []) {
      const { data: tpl } = q.template_id
        ? await admin.from("email_templates").select("subject, body_html, active").eq("id", q.template_id).maybeSingle()
        : { data: null };
      let status: string; let subject = "";
      if (!tpl || !tpl.active) status = "skipped:TEMPLATE_INACTIVE";
      else if (!configured) status = "NOT_CONFIGURED";
      else {
        subject = renderTemplate(tpl.subject, q.vars ?? {}, false);
        status = await sendMail(q.to_email, subject, wrapEmail(renderTemplate(tpl.body_html, q.vars ?? {})));
      }
      const final = status === "sent" ? "sent" : status.startsWith("skipped") ? "skipped" : "failed";
      if (final === "sent") sent++; else failed++;
      await admin.from("email_queue").update({ status: final, error: final === "sent" ? null : status,
        sent_at: final === "sent" ? new Date().toISOString() : null }).eq("id", q.id);
      await admin.from("email_logs").insert({ company_id: q.company_id, queue_id: q.id, rule_id: q.rule_id,
        template_id: q.template_id, event_key: q.event_key, to_email: q.to_email, subject: subject || null,
        status: final, error: final === "sent" ? null : status });
    }
    return json({ processed: (batch ?? []).length, sent, failed, configured });
  } catch (_e) {
    return json({ error: "Lỗi xử lý hàng đợi." }, 500);
  }
});
