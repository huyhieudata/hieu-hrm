import type { ReactNode } from "react";

interface EmptyStateProps {
  emoji: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ emoji, title, description, action }: EmptyStateProps) => (
  <div className="shadow-mobile rounded-3xl bg-card px-5 py-8 text-center">
    <div className="text-[32px] leading-none" aria-hidden>
      {emoji}
    </div>
    <p className="mt-2 font-display text-[15px] font-bold text-foreground">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-xs text-[13px] leading-5 text-muted-foreground">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
