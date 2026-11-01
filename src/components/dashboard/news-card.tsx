import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper, Pin } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listHomeNews, type NewsPost } from "@/lib/news";

/** Tin nội bộ trên trang chủ (BR-5.1): tự tải, lỗi thì ẩn để không ảnh hưởng bảng điều khiển. */
export const NewsCard = ({ companyId }: { companyId: string }) => {
  const [posts, setPosts] = useState<NewsPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listHomeNews(companyId)
      .then((items) => !cancelled && setPosts(items))
      .catch(() => !cancelled && setPosts([]));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!posts || posts.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h3 className="text-[15px] font-semibold leading-6 text-foreground">Tin nội bộ</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Thông báo mới từ công ty</p>
        </div>
        <Link to="/tin-tuc" className="text-[12.5px] font-medium text-primary hover:underline">
          Xem tất cả
        </Link>
      </div>
      <ul className="divide-y divide-border/80 px-2 pb-2">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              to="/tin-tuc"
              className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted/50"
            >
              {post.cover_image_url ? (
                <img
                  src={post.cover_image_url}
                  alt=""
                  loading="lazy"
                  className="h-12 w-16 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Newspaper className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[13px] font-medium text-foreground">
                  {post.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                  <span className="truncate">{post.title}</span>
                </p>
                {post.summary && <p className="truncate text-[12px] text-muted-foreground">{post.summary}</p>}
                {post.published_at && (
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(post.published_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
};
