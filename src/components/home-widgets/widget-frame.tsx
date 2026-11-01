import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WidgetSurface } from "@/lib/home-widgets";

interface WidgetFrameProps {
  surface: WidgetSurface;
  title: string;
  emoji?: string;
  subtitle?: string;
  to?: string;
  linkLabel?: string;
  className?: string;
  children: ReactNode;
}

/** Khung chung cho widget: desktop dạng thẻ quản trị, mobile dạng thẻ bo tròn ONHRM. */
export const WidgetFrame = ({
  surface,
  title,
  emoji,
  subtitle,
  to,
  linkLabel = "Xem",
  className,
  children,
}: WidgetFrameProps) => (
  <section
    className={cn(
      "flex h-full flex-col bg-card",
      surface === "mobile"
        ? "shadow-mobile rounded-3xl p-4"
        : "rounded-xl border border-border/80 p-5 shadow-sm",
      className,
    )}
  >
    <header className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3
          className={cn(
            "font-semibold leading-6 text-foreground",
            surface === "mobile" ? "text-[15px] font-bold" : "text-[14.5px]",
          )}
        >
          {emoji ? (
            <span className="mr-1.5" aria-hidden>
              {emoji}
            </span>
          ) : null}
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {to ? (
        <Link
          to={to}
          className="flex shrink-0 items-center text-[12px] font-semibold text-primary hover:underline"
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </header>
    <div className="flex-1">{children}</div>
  </section>
);

export const WidgetSkeleton = ({ surface }: { surface: WidgetSurface }) => (
  <div
    className={cn(
      "animate-pulse bg-card p-5",
      surface === "mobile"
        ? "shadow-mobile rounded-3xl"
        : "rounded-xl border border-border/80",
    )}
  >
    <div className="h-4 w-1/3 rounded bg-muted" />
    <div className="mt-4 space-y-2">
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-4/5 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
    </div>
  </div>
);

export const WidgetEmpty = ({
  emoji = "🌤️",
  text,
}: {
  emoji?: string;
  text: string;
}) => (
  <div className="flex flex-col items-center justify-center gap-1 py-5 text-center">
    <span className="text-[26px]" aria-hidden>
      {emoji}
    </span>
    <p className="text-[12.5px] text-muted-foreground">{text}</p>
  </div>
);

export const WidgetError = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-col items-center gap-2 rounded-lg bg-destructive-subtle px-3 py-4 text-center text-[12.5px] text-destructive">
    <AlertTriangle className="h-5 w-5" />
    <p>{message}</p>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="text-[12px] font-bold underline"
      >
        Thử lại
      </button>
    ) : null}
  </div>
);

export const Metric = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) => (
  <div className="rounded-xl bg-muted/40 px-3 py-2">
    <p
      className={cn(
        "font-display text-[22px] font-extrabold leading-7",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "danger" && "text-destructive",
        tone === "info" && "text-info",
      )}
    >
      {value}
    </p>
    <p className="text-[11.5px] text-muted-foreground">{label}</p>
  </div>
);
