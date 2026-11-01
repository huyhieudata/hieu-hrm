import { useCallback, useEffect, useState } from "react";

import { useCompany } from "@/lib/company-provider";
import {
  audienceForRole,
  loadHomeSummary,
  loadWidgetConfig,
  visibleWidgets,
  type HomeSummary,
  type WidgetAudience,
  type WidgetConfigItem,
  type WidgetSurface,
} from "@/lib/home-widgets";
import { getErrorMessage } from "@/lib/utils";
import { WIDGET_COMPONENTS } from "./widgets";
import { WidgetError, WidgetSkeleton } from "./widget-frame";

const DESKTOP_SPAN = {
  sm: "md:col-span-1",
  md: "md:col-span-2 xl:col-span-2",
  lg: "md:col-span-2 xl:col-span-4",
} as const;

interface HomeWidgetGridProps {
  surface: WidgetSurface;
  /** Dùng ở trang cài đặt để xem trước cấu hình nháp. */
  previewItems?: WidgetConfigItem[];
  previewAudience?: WidgetAudience;
}

/** Trang chủ theo widget: 1 truy vấn cấu hình + 1 RPC tổng hợp dữ liệu (mỗi widget tự lấy phần của mình). */
export const HomeWidgetGrid = ({
  surface,
  previewItems,
  previewAudience,
}: HomeWidgetGridProps) => {
  const { activeCompany, role } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const audience = previewAudience ?? audienceForRole(role);
  const [items, setItems] = useState<WidgetConfigItem[] | null>(
    previewItems ?? null,
  );
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const [config, data] = await Promise.all([
        previewItems
          ? Promise.resolve(null)
          : loadWidgetConfig(companyId, surface),
        loadHomeSummary(companyId),
      ]);
      if (config) setItems(config.items);
      setSummary(data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
    // previewItems được đồng bộ ở effect riêng
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, surface]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (previewItems) setItems(previewItems);
  }, [previewItems]);

  if (error)
    return (
      <WidgetError
        message={`Không tải được trang chủ: ${error}`}
        onRetry={() => void load()}
      />
    );

  const shown = items ? visibleWidgets(items, audience) : null;

  if (!shown || !summary || !companyId) {
    return (
      <div
        className={
          surface === "mobile"
            ? "space-y-3"
            : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        }
      >
        {Array.from({ length: surface === "mobile" ? 3 : 4 }, (_, i) => (
          <WidgetSkeleton key={i} surface={surface} />
        ))}
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
        Chưa có widget nào được bật cho vai trò này. Quản trị viên có thể bật
        trong Cài đặt › Widget trang chủ.
      </div>
    );
  }

  return (
    <div
      className={
        surface === "mobile"
          ? "space-y-3"
          : "grid auto-rows-auto gap-4 md:grid-cols-2 xl:grid-cols-4"
      }
    >
      {shown.map((item) => {
        const Widget = WIDGET_COMPONENTS[item.widget_key];
        return (
          <div
            key={item.widget_key}
            className={surface === "mobile" ? "" : DESKTOP_SPAN[item.size]}
          >
            <Widget
              surface={surface}
              size={item.size}
              summary={summary}
              companyId={companyId}
              audience={audience}
            />
          </div>
        );
      })}
    </div>
  );
};
