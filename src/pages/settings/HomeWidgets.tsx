import { confirmDialog } from "@/components/common/confirm-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { HomeWidgetGrid } from "@/components/home-widgets/home-widget-grid";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCompany } from "@/lib/company-provider";
import {
  SURFACE_LABELS,
  WIDGET_AUDIENCE_LABELS,
  WIDGET_BY_KEY,
  WIDGET_SIZE_LABELS,
  defaultWidgetConfig,
  loadWidgetConfig,
  resetWidgetConfig,
  saveWidgetConfig,
  type WidgetAudience,
  type WidgetConfigItem,
  type WidgetSize,
  type WidgetSurface,
} from "@/lib/home-widgets";
import { cn, getErrorMessage } from "@/lib/utils";

const AUDIENCES: WidgetAudience[] = ["admin", "manager", "employee"];
const SIZES: WidgetSize[] = ["sm", "md", "lg"];

const HomeWidgets = () => {
  const { activeCompany, role } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canEdit = role === "owner" || role === "admin" || role === "hr";
  const [surface, setSurface] = useState<WidgetSurface>("desktop");
  const [items, setItems] = useState<WidgetConfigItem[]>([]);
  const [customized, setCustomized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewAudience, setPreviewAudience] =
    useState<WidgetAudience>("admin");
  const [showPreview, setShowPreview] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await loadWidgetConfig(companyId, surface);
      setItems(result.items);
      setCustomized(result.customized);
      setDirty(false);
    } catch (error) {
      toast.error("Không tải được cấu hình", {
        description: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, surface]);

  useEffect(() => {
    void load();
    setPreviewAudience(surface === "mobile" ? "employee" : "admin");
  }, [load, surface]);

  const update = (next: WidgetConfigItem[]) => {
    setItems(next);
    setDirty(true);
  };
  const patch = (index: number, change: Partial<WidgetConfigItem>) =>
    update(
      items.map((item, i) => (i === index ? { ...item, ...change } : item)),
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
  };
  const toggleAudience = (index: number, audience: WidgetAudience) => {
    const current = items[index].audiences;
    const next = current.includes(audience)
      ? current.filter((a) => a !== audience)
      : [...current, audience];
    patch(index, { audiences: AUDIENCES.filter((a) => next.includes(a)) });
  };

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await saveWidgetConfig(companyId, surface, items);
      toast.success("Đã lưu widget trang chủ");
      setCustomized(true);
      setDirty(false);
    } catch (error) {
      toast.error("Không lưu được", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (
      !companyId ||
      !(await confirmDialog(`Khôi phục mặc định cho ${SURFACE_LABELS[surface]}?`))
    )
      return;
    setSaving(true);
    try {
      await resetWidgetConfig(companyId, surface);
      setItems(defaultWidgetConfig(surface));
      setCustomized(false);
      setDirty(false);
      toast.success("Đã khôi phục mặc định");
    } catch (error) {
      toast.error("Không khôi phục được", {
        description: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = useMemo(
    () => items.filter((item) => item.enabled).length,
    [items],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cài đặt"
        title="Widget trang chủ"
        description="Chọn widget hiển thị ngay khi đăng nhập, thứ tự, kích thước và ai được thấy. Dữ liệu trong widget luôn theo quyền: quản lý chỉ thấy phòng ban mình, nhân viên chỉ thấy của mình."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => setShowPreview((v) => !v)}
            >
              <Eye className="h-4 w-4" />{" "}
              {showPreview ? "Ẩn xem trước" : "Xem trước"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              disabled={!canEdit || saving}
              onClick={() => void reset()}
            >
              <RotateCcw className="h-4 w-4" /> Khôi phục mặc định
            </Button>
            <Button
              size="sm"
              className="h-9 gap-2"
              disabled={!canEdit || saving || !dirty}
              onClick={() => void save()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              Lưu
            </Button>
          </>
        }
      />

      {!canEdit ? (
        <p className="rounded-lg bg-warning-subtle px-3 py-2 text-[12.5px] text-warning">
          Chỉ chủ sở hữu, quản trị viên hoặc HR được thay đổi cấu hình này.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(["desktop", "mobile"] as WidgetSurface[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={async () => {
              if (dirty && !(await confirmDialog("Bỏ các thay đổi chưa lưu?"))) return;
              setSurface(key);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-[12.5px] font-semibold",
              surface === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {SURFACE_LABELS[key]}
          </button>
        ))}
        <span className="text-[12px] text-muted-foreground">
          {enabledCount} widget đang bật ·{" "}
          {customized ? "Đã tuỳ chỉnh" : "Đang dùng mặc định"}
          {dirty ? " · Có thay đổi chưa lưu" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const def = WIDGET_BY_KEY.get(item.widget_key)!;
            return (
              <li
                key={item.widget_key}
                draggable={canEdit}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card p-3",
                  !item.enabled && "opacity-60",
                  dragIndex === index && "ring-2 ring-primary",
                )}
              >
                <GripVertical
                  className="h-4 w-4 cursor-grab text-muted-foreground"
                  aria-hidden
                />
                <span className="text-[20px]" aria-hidden>
                  {def.emoji}
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="text-[13.5px] font-semibold">{def.label}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {def.description}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {AUDIENCES.map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleAudience(index, audience)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        item.audiences.includes(audience)
                          ? "border-primary bg-primary-subtle text-primary"
                          : "border-border text-muted-foreground",
                      )}
                      title={
                        def.managersOnly && audience === "employee"
                          ? "Nhân viên không có dữ liệu cho widget này"
                          : undefined
                      }
                    >
                      {WIDGET_AUDIENCE_LABELS[audience]}
                    </button>
                  ))}
                </div>
                {surface === "desktop" ? (
                  <select
                    value={item.size}
                    disabled={!canEdit}
                    onChange={(event) =>
                      patch(index, { size: event.target.value as WidgetSize })
                    }
                    className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                    aria-label="Kích thước"
                  >
                    {SIZES.map((size) => (
                      <option key={size} value={size}>
                        {WIDGET_SIZE_LABELS[size]}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!canEdit || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label="Lên"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!canEdit || index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label="Xuống"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <Switch
                  checked={item.enabled}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    patch(index, { enabled: checked })
                  }
                  aria-label="Bật/tắt"
                />
              </li>
            );
          })}
        </ul>
      )}

      {showPreview && !loading ? (
        <section className="space-y-3 rounded-2xl border border-dashed border-primary/40 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">
              Xem trước bố cục với vai trò:
            </p>
            {AUDIENCES.map((audience) => (
              <button
                key={audience}
                type="button"
                onClick={() => setPreviewAudience(audience)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold",
                  previewAudience === audience
                    ? "bg-brand-orange text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {WIDGET_AUDIENCE_LABELS[audience]}
              </button>
            ))}
            <span className="text-[11.5px] text-muted-foreground">
              (số liệu là dữ liệu bạn được xem; người dùng thật chỉ thấy phạm vi
              của họ)
            </span>
          </div>
          <div
            className={
              surface === "mobile"
                ? "mx-auto max-w-[400px] rounded-[28px] bg-background p-3"
                : ""
            }
          >
            <HomeWidgetGrid
              surface={surface}
              previewItems={items}
              previewAudience={previewAudience}
            />
          </div>
        </section>
      ) : null}
    </AppShell>
  );
};

export default HomeWidgets;
