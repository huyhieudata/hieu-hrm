import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type NewsStatus = "draft" | "published" | "hidden";

export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  draft: "Nháp",
  published: "Đã đăng",
  hidden: "Ẩn",
};

export interface NewsCategory {
  id: string;
  company_id: string;
  name: string;
  sort_order: number;
}

export interface NewsPost {
  id: string;
  company_id: string;
  category_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  cover_image_url: string | null;
  status: NewsStatus;
  show_on_home: boolean;
  pinned: boolean;
  published_at: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsPostInput {
  category_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  cover_image_url: string | null;
  status: NewsStatus;
  show_on_home: boolean;
  pinned: boolean;
  published_at: string | null;
}

const POST_COLUMNS =
  "id, company_id, category_id, title, summary, content, cover_image_url, status, show_on_home, pinned, published_at, author_name, created_at, updated_at";

/** Ghim trước, rồi bài mới đăng trước (bài chưa đăng xếp theo ngày tạo). */
export const sortNewsPosts = (posts: NewsPost[]) =>
  [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ta = new Date(a.published_at ?? a.created_at).getTime();
    const tb = new Date(b.published_at ?? b.created_at).getTime();
    return tb - ta;
  });

/** BR-5.1: chỉ bài "Đã đăng", đã tới giờ đăng và đánh dấu hiện trang chủ. */
export const isVisibleOnHome = (post: NewsPost, now = new Date()) =>
  post.status === "published" &&
  post.show_on_home &&
  !!post.published_at &&
  new Date(post.published_at).getTime() <= now.getTime();

export const normalizeImageUrl = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (!/^https:\/\//i.test(trimmed)) throw new Error("Link ảnh phải bắt đầu bằng https://");
  return trimmed;
};

export const listNewsCategories = async (companyId: string): Promise<NewsCategory[]> => {
  const { data, error } = await db
    .from("news_categories")
    .select("id, company_id, name, sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được danh mục tin.");
  return (data ?? []) as NewsCategory[];
};

export const createNewsCategory = async (companyId: string, name: string, sortOrder: number) => {
  const { error } = await db
    .from("news_categories")
    .insert({ company_id: companyId, name: name.trim(), sort_order: sortOrder });
  if (error) {
    if (error.code === "23505") throw new Error("Danh mục này đã có.");
    throw new Error(error.message ?? "Không tạo được danh mục.");
  }
};

export const updateNewsCategory = async (id: string, name: string, sortOrder: number) => {
  const { error } = await db
    .from("news_categories")
    .update({ name: name.trim(), sort_order: sortOrder })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Danh mục này đã có.");
    throw new Error(error.message ?? "Không cập nhật được danh mục.");
  }
};

export const deleteNewsCategory = async (id: string) => {
  const { error } = await db.from("news_categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503")
      throw new Error("Danh mục còn bài viết. Hãy chuyển các bài sang danh mục khác trước khi xoá.");
    throw new Error(error.message ?? "Không xoá được danh mục.");
  }
};

export const listNewsPosts = async (companyId: string): Promise<NewsPost[]> => {
  const { data, error } = await db
    .from("news_posts")
    .select(POST_COLUMNS)
    .eq("company_id", companyId)
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(500);
  if (error) throw new Error(error.message ?? "Không tải được tin tức.");
  return sortNewsPosts((data ?? []) as NewsPost[]);
};

export const listHomeNews = async (companyId: string, limit = 5): Promise<NewsPost[]> => {
  const { data, error } = await db
    .from("news_posts")
    .select(POST_COLUMNS)
    .eq("company_id", companyId)
    .eq("status", "published")
    .eq("show_on_home", true)
    .lte("published_at", new Date().toISOString())
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message ?? "Không tải được tin nội bộ.");
  return (data ?? []) as NewsPost[];
};

export const createNewsPost = async (companyId: string, values: NewsPostInput) => {
  const { error } = await db.from("news_posts").insert({ ...values, company_id: companyId });
  if (error) throw new Error(error.message ?? "Không tạo được bài viết.");
};

export const updateNewsPost = async (id: string, values: NewsPostInput) => {
  const { error } = await db.from("news_posts").update(values).eq("id", id);
  if (error) throw new Error(error.message ?? "Không cập nhật được bài viết.");
};

export const deleteNewsPost = async (id: string) => {
  const { error } = await db.from("news_posts").delete().eq("id", id);
  if (error) throw new Error(error.message ?? "Không xoá được bài viết.");
};
