/**
 * Cache nhẹ cho truy vấn đọc dùng chung giữa các trang:
 *  - gộp các lời gọi trùng đang chạy (in-flight dedupe),
 *  - giữ kết quả trong `ttlMs`,
 *  - tự xoá TOÀN BỘ khi client gửi bất kỳ request ghi nào (xem `isWriteRequest`) ⇒ không bao giờ hiện dữ liệu cũ sau khi sửa.
 */
type Entry = { at: number; promise: Promise<unknown> };
const store = new Map<string, Entry>();

export const cached = <T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> => {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = fn().catch((error) => {
    if (store.get(key)?.promise === promise) store.delete(key);
    throw error;
  });
  store.set(key, { at: Date.now(), promise });
  return promise;
};

export const clearQueryCache = () => store.clear();

/** RPC chỉ đọc — không làm mất cache. */
const READ_RPCS = new Set([
  "employee_sensitive_fields",
  "my_permissions",
  "effective_permission_keys",
  "default_role_permissions",
  "employee_duplicate_check",
  "home_dashboard_summary",
  "employee_invite_status",
  "app_install_status",
  "peek_company_invite",
  "peek_candidate_form",
  "log_activity",
  "my_payslips",
]);

export const isWriteRequest = (url: string, method: string) => {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") return false;
  if (!url.includes("/rest/v1/")) return m !== "POST" || !url.includes("/auth/v1/token");
  const rpc = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i);
  if (rpc) return !READ_RPCS.has(rpc[1]);
  return true;
};

export const cachingFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
  if (isWriteRequest(url, method)) clearQueryCache();
  return fetch(input, init);
};
