import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Notice = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
};

/** Chuông thông báo trong app (đơn được duyệt / từ chối / huỷ). Lỗi tải ⇒ im lặng, coi như không có thông báo. */
export const NotificationBell = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const navigate = useNavigate();
  const [items, setItems] = useState<Notice[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await db
      .from("user_notifications")
      .select("id,title,body,link,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setItems((data ?? []) as Notice[]);
  }, [userId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const unread = items.filter((item) => !item.read_at).length;

  const markAllRead = async () => {
    if (!unread) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    await db.from("user_notifications").update({ read_at: now }).is("read_at", null);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Thông báo (${unread} chưa đọc)` : "Thông báo"}
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors touch:h-11 touch:w-11 hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] rounded-lg p-0 shadow-overlay">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Thông báo</p>
          {unread > 0 && (
            <button type="button" className="text-[11.5px] text-primary hover:underline" onClick={() => void markAllRead()}>
              Đánh dấu đã đọc
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[12.5px] font-medium text-foreground">Chưa có thông báo mới</p>
            <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">Kết quả duyệt đơn của bạn sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y divide-border/60 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full px-4 py-2.5 text-left hover:bg-muted ${item.read_at ? "" : "bg-primary-subtle/40"}`}
                  onClick={() => {
                    if (!item.read_at) {
                      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
                      void db.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id);
                    }
                    if (item.link) navigate(item.link);
                  }}
                >
                  <p className="text-[12.5px] font-medium text-foreground">{item.title}</p>
                  {item.body && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{item.body}</p>}
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{timeAgo(item.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
