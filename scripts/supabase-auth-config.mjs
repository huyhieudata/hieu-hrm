// Cấu hình Supabase Auth qua Management API. Không bao giờ in token/mật khẩu.
// MODE=check|apply. Mỗi nhóm PATCH riêng để một nhóm lỗi (vd. tính năng cần gói Pro) không chặn nhóm khác.
import { readFileSync } from "node:fs";
const ref = process.env.PROJECT_REF, token = process.env.SUPABASE_ACCESS_TOKEN, mode = process.env.MODE || "check";
const SITE = process.env.SITE_URL || "https://hieu-hrm.vercel.app";
const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const SAFE = ["site_url","uri_allow_list","jwt_exp","refresh_token_rotation_enabled","security_refresh_token_reuse_interval",
  "password_hibp_enabled","password_min_length","password_required_characters","mfa_totp_enroll_enabled","mfa_totp_verify_enabled",
  "mfa_max_enrolled_factors","rate_limit_email_sent","rate_limit_otp","rate_limit_token_refresh","rate_limit_verify","external_email_enabled",
  "mailer_autoconfirm","mailer_otp_exp","smtp_admin_email","smtp_sender_name","smtp_host","smtp_port","security_captcha_enabled",
  "mailer_subjects_confirmation","mailer_subjects_recovery","disable_signup"];
const show = async (label) => {
  const r = await fetch(api, { headers: h });
  if (!r.ok) throw new Error(`GET ${r.status}`);
  const c = await r.json();
  const out = Object.fromEntries(SAFE.map((k) => [k, c[k]]));
  out.smtp_user_set = Boolean(c.smtp_user); out.smtp_pass_set = Boolean(c.smtp_pass);
  console.log(`== ${label}\n` + JSON.stringify(out, null, 2));
  return c;
};
const patch = async (name, body) => {
  const r = await fetch(api, { method: "PATCH", headers: h, body: JSON.stringify(body) });
  const t = r.ok ? "" : (await r.text()).slice(0, 300);
  console.log(`PATCH ${name}: ${r.status} ${t}`);
  return r.ok;
};
const cur = await show("trước");
if (mode !== "apply") process.exit(0);
const tpl = (k) => readFileSync(`supabase/templates/${k}.html`, "utf8");
const subj = JSON.parse(readFileSync("supabase/templates/subjects.json", "utf8"));
const allow = new Set(String(cur.uri_allow_list || "").split(",").map((s) => s.trim()).filter(Boolean)
  .filter((u) => u !== "*" && !/^https?:\/\/\*/.test(u)));
[SITE, `${SITE}/**`, `${SITE}/dat-lai-mat-khau`].forEach((u) => allow.add(u));
await patch("url", { site_url: SITE, uri_allow_list: [...allow].join(",") });
await patch("templates", Object.fromEntries(Object.keys(subj).flatMap((k) => [
  [`mailer_subjects_${k}`, subj[k]], [`mailer_templates_${k}_content`, tpl(k)]])));
await patch("session", { jwt_exp: 3600, refresh_token_rotation_enabled: true, security_refresh_token_reuse_interval: 10 });
await patch("mfa", { mfa_totp_enroll_enabled: true, mfa_totp_verify_enabled: true });
await patch("password_min", { password_min_length: 8 });
await patch("password_hibp", { password_hibp_enabled: true });
if (process.env.AUTH_SMTP_PASS && process.env.AUTH_SMTP_USER) {
  await patch("smtp", {
    smtp_admin_email: process.env.AUTH_SMTP_FROM || process.env.AUTH_SMTP_USER, smtp_sender_name: "ONHRM",
    smtp_host: process.env.AUTH_SMTP_HOST, smtp_port: String(process.env.AUTH_SMTP_PORT || "587"),
    smtp_user: process.env.AUTH_SMTP_USER, smtp_pass: process.env.AUTH_SMTP_PASS,
    rate_limit_email_sent: 30,
  });
} else console.log("SMTP: thiếu AUTH_SMTP_USER/AUTH_SMTP_PASS – bỏ qua.");
await show("sau");
