import { Suspense, type ReactNode } from "react";

/** Khung chờ theo bố cục trang, không phủ logo toàn màn hình. */
export const BootSkeleton = ({ label = "Đang tải…" }: { label?: string }) => (
  <div className="min-h-[100dvh] bg-background" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="h-1 w-full overflow-hidden bg-muted" aria-hidden>
      <div className="h-full w-1/3 animate-shimmer rounded-full bg-brand-orange" />
    </div>
    <div className="mx-auto w-full max-w-2xl space-y-3 px-3 pb-[calc(var(--tabbar-h)+1.5rem)] pt-4 lg:max-w-5xl lg:px-8 lg:pb-8 lg:pt-6">
      <div className="h-11 w-44 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="hidden h-20 animate-pulse rounded-2xl bg-muted lg:block" />
        <div className="hidden h-20 animate-pulse rounded-2xl bg-muted lg:block" />
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-44 animate-pulse rounded-2xl bg-muted" />
    </div>
  </div>
);

export const PageSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<BootSkeleton />}>{children}</Suspense>
);
