// Gửi mail dùng chung: BREVO_API_KEY hoặc SMTP_* (+ MAIL_FROM, MAIL_FROM_NAME). Chưa cấu hình ⇒ "NOT_CONFIGURED".
import nodemailer from "npm:nodemailer@6.9.14";

export const mailConfigured = () =>
  Boolean(Deno.env.get("MAIL_FROM") && (Deno.env.get("BREVO_API_KEY") || Deno.env.get("SMTP_HOST")));

const escHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Thay {{bien}}; giá trị được escape HTML (trừ trong tiêu đề text). */
export const renderTemplate = (tpl: string, vars: Record<string, unknown>, html = true) =>
  tpl.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, k: string) => {
    const v = vars[k] == null ? "" : String(vars[k]);
    return html ? escHtml(v) : v;
  });

export const wrapEmail = (body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0e2d58;line-height:1.55">${body}<hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px"/><p style="font-size:11px;color:#667">Email tự động từ ONHRM</p></div>`;

export const htmlToText = (h: string) =>
  h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h[1-6]|li|div)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export const sendMail = async (to: string, subject: string, html: string): Promise<string> => {
  const from = Deno.env.get("MAIL_FROM");
  const fromName = Deno.env.get("MAIL_FROM_NAME") ?? "ONHRM";
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const smtpHost = Deno.env.get("SMTP_HOST");
  const text = htmlToText(html);
  if (from && brevoKey) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: { email: from, name: fromName }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    });
    return res.ok ? "sent" : `error:brevo_${res.status}`;
  }
  if (from && smtpHost) {
    const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const transport = nodemailer.createTransport({
      host: smtpHost, port, secure: port === 465,
      auth: { user: Deno.env.get("SMTP_USER"), pass: Deno.env.get("SMTP_PASS") },
    });
    try {
      await transport.sendMail({ from: `"${fromName}" <${from}>`, to, subject, text, html });
      return "sent";
    } catch (err) {
      return `error:smtp_${String((err as Error)?.message ?? "").slice(0, 120)}`;
    }
  }
  return "NOT_CONFIGURED";
};
