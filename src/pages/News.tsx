import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderCog, Loader2, Newspaper, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-provider";
import {
  NEWS_STATUS_LABELS,
  createNewsCategory,
  createNewsPost,
  deleteNewsCategory,
  deleteNewsPost,
  listNewsCategories,
  listNewsPosts,
  normalizeImageUrl,
  updateNewsCategory,
  updateNewsPost,
  type NewsCategory,
  type NewsPost,
  type NewsPostInput,
  type NewsStatus,
} from "@/lib/news";
import { getErrorMessage } from "@/lib/utils";

const ALL = "all";
const NONE = "none";

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "";

/** datetime-local cần dạng yyyy-MM-ddTHH:mm theo giờ máy. */
const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const statusVariant = (status: NewsStatus) =>
  status === "published" ? "default" : status === "draft" ? "secondary" : "outline";

interface EditorState {
  id: string | null;
  title: string;
  summary: string;
  content: string;
  cover: string;
  categoryId: string;
  status: NewsStatus;
  showOnHome: boolean;
  pinned: boolean;
  publishAt: string;
}

const emptyEditor = (categoryId: string): EditorState => ({
  id: null,
  title: "",
  summary: "",
  content: "",
  cover: "",
  categoryId,
  status: "draft",
  showOnHome: true,
  pinned: false,
  publishAt: "",
});

const NewsPage = () => {
  const { activeCompany, canDo } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canCreate = canDo("news", "create");
  const canEdit = canDo("news", "edit");
  const canDelete = canDo("news", "delete");

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(ALL);
  const [reading, setReading] = useState<NewsPost | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<NewsPost | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listNewsPosts(companyId), listNewsCategories(companyId)]);
      setPosts(p);
      setCategories(c);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không tải được tin tức."));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const visible = useMemo(
    () => (filter === ALL ? posts : posts.filter((p) => (p.category_id ?? NONE) === filter)),
    [filter, posts],
  );

  const openEdit = (post: NewsPost) =>
    setEditor({
      id: post.id,
      title: post.title,
      summary: post.summary ?? "",
      content: post.content,
      cover: post.cover_image_url ?? "",
      categoryId: post.category_id ?? NONE,
      status: post.status,
      showOnHome: post.show_on_home,
      pinned: post.pinned,
      publishAt: toLocalInput(post.published_at),
    });

  const savePost = async () => {
    if (!editor || !companyId) return;
    if (!editor.title.trim()) {
      toast.error("Bài viết cần có tiêu đề.");
      return;
    }
    setSaving(true);
    try {
      const values: NewsPostInput = {
        title: editor.title.trim(),
        summary: editor.summary.trim() || null,
        content: editor.content,
        cover_image_url: normalizeImageUrl(editor.cover),
        category_id: editor.categoryId === NONE ? null : editor.categoryId,
        status: editor.status,
        show_on_home: editor.showOnHome,
        pinned: editor.pinned,
        published_at: editor.publishAt ? new Date(editor.publishAt).toISOString() : null,
      };
      if (editor.id) await updateNewsPost(editor.id, values);
      else await createNewsPost(companyId, values);
      toast.success(editor.id ? "Đã cập nhật bài viết." : "Đã tạo bài viết.");
      setEditor(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteNewsPost(deleting.id);
      toast.success("Đã xoá bài viết.");
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const addCategory = async () => {
    if (!companyId || !newCat.trim()) return;
    try {
      await createNewsCategory(companyId, newCat, categories.length + 1);
      setNewCat("");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const renameCategory = async (category: NewsCategory, name: string) => {
    if (!name.trim() || name.trim() === category.name) return;
    try {
      await updateNewsCategory(category.id, name, category.sort_order);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const removeCategory = async (category: NewsCategory) => {
    try {
      await deleteNewsCategory(category.id);
      if (filter === category.id) setFilter(ALL);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Truyền thông nội bộ"
        title="Tin tức"
        description="Tin tức, thông báo của công ty. Bài đã đăng và đánh dấu hiện trang chủ sẽ xuất hiện ở bảng điều khiển."
        actions={
          <div className="flex flex-wrap gap-2">
            {(canCreate || canEdit || canDelete) && (
              <Button variant="outline" onClick={() => setCatOpen(true)}>
                <FolderCog className="mr-2 h-4 w-4" /> Danh mục
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setEditor(emptyEditor(filter !== ALL ? filter : NONE))}>
                <Plus className="mr-2 h-4 w-4" /> Viết bài
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={filter === ALL ? "default" : "outline"} onClick={() => setFilter(ALL)}>
          Tất cả
        </Button>
        {categories.map((c) => (
          <Button key={c.id} size="sm" variant={filter === c.id ? "default" : "outline"} onClick={() => setFilter(c.id)}>
            {c.name}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <Newspaper className="h-8 w-8" />
          <p>Chưa có bài viết nào.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((post) => (
            <Card key={post.id} className="flex flex-col overflow-hidden">
              {post.cover_image_url && (
                <button type="button" onClick={() => setReading(post)} className="block">
                  <img
                    src={post.cover_image_url}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                </button>
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {post.pinned && (
                    <Badge variant="secondary" className="gap-1">
                      <Pin className="h-3 w-3" /> Ghim
                    </Badge>
                  )}
                  {(canEdit || canCreate) && (
                    <Badge variant={statusVariant(post.status)}>{NEWS_STATUS_LABELS[post.status]}</Badge>
                  )}
                  {post.category_id && (
                    <Badge variant="outline">{categoryName.get(post.category_id) ?? "Danh mục"}</Badge>
                  )}
                </div>
                <button type="button" onClick={() => setReading(post)} className="text-left">
                  <h3 className="line-clamp-2 font-semibold hover:underline">{post.title}</h3>
                </button>
                {post.summary && <p className="line-clamp-3 text-sm text-muted-foreground">{post.summary}</p>}
                <p className="mt-auto text-xs text-muted-foreground">
                  {post.published_at ? `Đăng ${formatDate(post.published_at)}` : `Tạo ${formatDate(post.created_at)}`}
                  {post.author_name ? ` · ${post.author_name}` : ""}
                </p>
                {(canEdit || canDelete) && (
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(post)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Sửa
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(post)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Xoá
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!reading} onOpenChange={(open) => !open && setReading(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {reading && (
            <>
              <DialogHeader>
                <DialogTitle>{reading.title}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                {formatDate(reading.published_at ?? reading.created_at)}
                {reading.author_name ? ` · ${reading.author_name}` : ""}
              </p>
              {reading.cover_image_url && (
                <img src={reading.cover_image_url} alt="" className="w-full rounded-md object-cover" />
              )}
              {reading.summary && <p className="font-medium">{reading.summary}</p>}
              <div className="whitespace-pre-line break-words text-sm leading-relaxed">{reading.content}</div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Sửa bài viết" : "Viết bài mới"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="news-title">Tiêu đề</Label>
                <Input
                  id="news-title"
                  value={editor.title}
                  maxLength={300}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="news-summary">Tóm tắt</Label>
                <Textarea
                  id="news-summary"
                  rows={2}
                  value={editor.summary}
                  onChange={(e) => setEditor({ ...editor, summary: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="news-content">Nội dung</Label>
                <Textarea
                  id="news-content"
                  rows={10}
                  value={editor.content}
                  onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="news-cover">Link ảnh đại diện (https://)</Label>
                <Input
                  id="news-cover"
                  value={editor.cover}
                  placeholder="https://..."
                  onChange={(e) => setEditor({ ...editor, cover: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Danh mục</Label>
                  <Select value={editor.categoryId} onValueChange={(v) => setEditor({ ...editor, categoryId: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Không có</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Trạng thái</Label>
                  <Select
                    value={editor.status}
                    onValueChange={(v) => setEditor({ ...editor, status: v as NewsStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(NEWS_STATUS_LABELS) as NewsStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {NEWS_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="news-publish">Hẹn giờ đăng</Label>
                  <Input
                    id="news-publish"
                    type="datetime-local"
                    value={editor.publishAt}
                    onChange={(e) => setEditor({ ...editor, publishAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editor.showOnHome} onCheckedChange={(v) => setEditor({ ...editor, showOnHome: v })} />
                  Hiện ở trang chủ
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editor.pinned} onCheckedChange={(v) => setEditor({ ...editor, pinned: v })} />
                  Ghim lên đầu
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Để trống giờ đăng thì bài "Đã đăng" sẽ lên ngay khi lưu.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Huỷ
            </Button>
            <Button onClick={savePost} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Danh mục tin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Input
                  defaultValue={c.name}
                  disabled={!canEdit}
                  onBlur={(e) => void renameCategory(c, e.target.value)}
                />
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => void removeCategory(c)} aria-label="Xoá danh mục">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-muted-foreground">Chưa có danh mục.</p>}
            {canCreate && (
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Tên danh mục mới"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void addCategory()}
                />
                <Button onClick={() => void addCategory()}>Thêm</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bài viết?</AlertDialogTitle>
            <AlertDialogDescription>Bài "{deleting?.title}" sẽ bị xoá hẳn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default NewsPage;
