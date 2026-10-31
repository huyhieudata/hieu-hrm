import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

type StatTone = "primary" | "violet" | "teal" | "amber";

const toneStyles: Record<StatTone, { tile: string; stroke: string; fill: string }> = {
  primary: {
    tile: "bg-primary/10 text-primary",
    stroke: "hsl(var(--chart-1))",
    fill: "url(#spark-primary)",
  },
  violet: {
    tile: "bg-chart-2/12 text-chart-2",
    stroke: "hsl(var(--chart-2))",
    fill: "url(#spark-violet)",
  },
  teal: {
    tile: "bg-chart-3/12 text-chart-3",
    stroke: "hsl(var(--chart-3))",
    fill: "url(#spark-teal)",
  },
  amber: {
    tile: "bg-chart-4/15 text-chart-4",
    stroke: "hsl(var(--chart-4))",
    fill: "url(#spark-amber)",
  },
};

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  positiveIsGood?: boolean;
  icon: LucideIcon;
  tone?: StatTone;
  data: number[];
  className?: string;
  style?: CSSProperties;
}

export const StatCard = ({
  label,
  value,
  unit,
  delta,
  deltaLabel = "so với tháng trước",
  positiveIsGood = true,
  icon: Icon,
  tone = "primary",
  data,
  className,
  style,
}: StatCardProps) => {
  const styles = toneStyles[tone];
  const positive = (delta ?? 0) >= 0;
  const favorable = positiveIsGood ? positive : !positive;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-raised",
        className,
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-5 text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:scale-105",
            styles.tile,
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        <span className="tabular font-display text-[24px] font-semibold leading-8 tracking-[-0.02em] text-foreground sm:text-[28px] sm:leading-9">
          {value}
        </span>
        {unit && <span className="pb-1 text-[11px] font-medium text-muted-foreground sm:text-[13px]">{unit}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {delta !== undefined ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                favorable
                  ? "bg-success-subtle text-success"
                  : "bg-destructive-subtle text-destructive",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
              ) : (
                <ArrowDownRight className="h-3 w-3" strokeWidth={2.4} />
              )}
              {Math.abs(delta)}%
            </span>
            <span className="hidden truncate whitespace-nowrap text-[10.5px] text-muted-foreground xl:inline">
              {deltaLabel}
            </span>
          </div>
        ) : (
          <span className="truncate whitespace-nowrap text-[10.5px] text-muted-foreground">{deltaLabel}</span>
        )}
        <Sparkline data={data} stroke={styles.stroke} fill={styles.fill} className="hidden h-8 w-[56px] shrink-0 sm:block xl:hidden 2xl:block" />
      </div>
    </div>
  );
};
