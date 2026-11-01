import { Suspense, type ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";

const PageFallback = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <LogoMark className="h-11 w-11 animate-pulse rounded-[13px]" />
      <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-shimmer rounded-full bg-brand" />
      </div>
    </div>
  </div>
);

export const PageSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageFallback />}>{children}</Suspense>
);
