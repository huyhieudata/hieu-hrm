import { toast } from "sonner";

const RECONNECT_TOAST = "net-reconnecting";

/** Chạy một truy vấn khởi động với timeout + thử lại nhẹ; hiện "Đang kết nối lại…" thay vì treo. */
export async function withRetry<T>(
  run: () => PromiseLike<T>,
  { timeoutMs = 8000, retries = 2 }: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve(run()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      if (attempt > 0) toast.dismiss(RECONNECT_TOAST);
      return result;
    } catch (error) {
      if (attempt >= retries) {
        toast.dismiss(RECONNECT_TOAST);
        throw error;
      }
      attempt += 1;
      toast.loading("Đang kết nối lại…", { id: RECONNECT_TOAST, description: "Máy chủ phản hồi chậm, đang thử lại." });
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Hiện thông báo kết nối lại nếu promise chưa xong sau `afterMs` (không huỷ promise). */
export function noticeIfSlow<T>(promise: PromiseLike<T>, afterMs = 6000): Promise<T> {
  const timer = setTimeout(
    () => toast.loading("Đang kết nối lại…", { id: RECONNECT_TOAST, description: "Máy chủ phản hồi chậm." }),
    afterMs,
  );
  return Promise.resolve(promise).finally(() => {
    clearTimeout(timer);
    toast.dismiss(RECONNECT_TOAST);
  });
}
