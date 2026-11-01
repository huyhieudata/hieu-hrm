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
  audience_department_ids: string[];
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
  /** Rỗng = cả công ty. */
  audience_department_ids: string[];
}

const POST_COLUMNS =
  "id, company_id, category_id, title, summary, content, cover_image_url, status, show_on_home, pinned, published_at, author_name, audience_department_ids, created_at, updated_at";

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

export const NEWS_REACTIONS = [
  { key: "like", emoji: "👍", label: "Thích" },
  { key: "love", emoji: "❤️", label: "Yêu thích" },
  { key: "clap", emoji: "👏", label: "Hoan hô" },
  { key: "haha", emoji: "😆", label: "Haha" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "sad", emoji: "😢", label: "Buồn" },
] as const;
export type NewsReactionKey = (typeof NEWS_REACTIONS)[number]["key"];

export interface NewsReactionSummary {
  counts: Partial<Record<NewsReactionKey, number>>;
  mine: NewsReactionKey | null;
}

/** Gom cảm xúc theo bài: số lượng từng loại và cảm xúc của chính mình. */
export const summarizeReactions = (
  rows: { post_id: string; user_id: string; reaction: NewsReactionKey }[],
  me: string | null,
) => {
  const map = new Map<string, NewsReactionSummary>();
  for (const row of rows) {
    const entry = map.get(row.post_id) ?? { counts: {}, mine: null };
    entry.counts[row.reaction] = (entry.counts[row.reaction] ?? 0) + 1;
    if (me && row.user_id === me) entry.mine = row.reaction;
    map.set(row.post_id, entry);
  }
  return map;
};

export const listNewsReactions = async (companyId: string) => {
  const [{ data, error }, { data: auth }] = await Promise.all([
    db.from("news_reactions").select("post_id, user_id, reaction").eq("company_id", companyId).limit(5000),
    supabase.auth.getUser(),
  ]);
  if (error) throw new Error(error.message ?? "Không tải được cảm xúc.");
  return summarizeReactions(data ?? [], auth.user?.id ?? null);
};

/** Thả, đổi hoặc bỏ (bấm lại đúng cảm xúc đang chọn) cảm xúc của mình cho một bài. */
export const setNewsReaction = async (postId: string, reaction: NewsReactionKey | null) => {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Bạn cần đăng nhập.");
  const { error } = reaction
    ? await db.from("news_reactions").upsert({ post_id: postId, user_id: userId, reaction }, { onConflict: "post_id,user_id" })
    : await db.from("news_reactions").delete().eq("post_id", postId).eq("user_id", userId);
  if (error) throw new Error(error.message ?? "Không lưu được cảm xúc.");
};

export const listNewsDepartments = async (companyId: string): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await db
    .from("departments")
    .select("id, name")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message ?? "Không tải được phòng ban.");
  return data ?? [];
};
