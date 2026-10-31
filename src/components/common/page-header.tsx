import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) => (
  <div
    className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0 space-y-1.5">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[30px]">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);
