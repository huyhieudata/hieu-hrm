// SEC-10: CORS theo danh sách cho phép. Cấu hình bằng secret ALLOWED_ORIGINS (phân cách dấu phẩy).
// Mặc định: app chính + preview Vercel của dự án + localhost khi dev.
const DEFAULT_ORIGINS = "https://hieu-hrm.vercel.app";
const PREVIEW_RE = /^https:\/\/hieu-hrm-[a-z0-9-]+\.vercel\.app$/;
const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const allowed = () =>
  (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);

export const pickOrigin = (origin: string | null): string => {
  const list = allowed();
  if (origin && (list.includes(origin) || PREVIEW_RE.test(origin) || LOCAL_RE.test(origin))) return origin;
  return list[0] ?? DEFAULT_ORIGINS;
};

/** Bọc handler: ghi đè Access-Control-Allow-Origin theo Origin của request (không dùng "*"). */
export const withCors = (handler: (req: Request) => Promise<Response> | Response) => async (req: Request) => {
  const res = await handler(req);
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", pickOrigin(req.headers.get("origin")));
  headers.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
