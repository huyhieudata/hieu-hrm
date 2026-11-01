import { useEffect, useState } from "react";
import { ChevronRight, Lock, MapPin } from "lucide-react";

import { elapsedLabel } from "@/components/mobile/use-my-day";

export interface MonthProgress {
  worked: number;
  planned: number;
  onOpen?: () => void;
}

interface ShiftStatusCardProps {
  kind: "out" | "in" | "blocked" | "off";
  shiftName: string;
  range?: string;
  chip?: string;
  meta?: string | null;
  sinceIso?: string | null;
  sinceLabel?: string;
  elapsed?: string;
  expectedOut?: string;
  detail?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  month?: MonthProgress | null;
}

const Elapsed = ({ sinceIso, frozen }: { sinceIso?: string | null; frozen?: string }) => {
  const [label, setLabel] = useState(() => frozen || (sinceIso ? elapsedLabel(sinceIso) : "00:00:00"));
  useEffect(() => {
    if (frozen || !sinceIso) return;
    const id = window.setInterval(() => setLabel(elapsedLabel(sinceIso)), 1000);
    return () => window.clearInterval(id);
  }, [frozen, sinceIso]);
  return <p className="mt-0.5 font-display text-[24px] font-bold tabular tracking-tight text-success">{label}</p>;
};

export const ShiftStatusCard = ({
  kind,
  shiftName,
  range,
  chip,
  meta,
  sinceIso,
  sinceLabel,
  elapsed,
  expectedOut,
  detail,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  month,
}: ShiftStatusCardProps) => {
  const ratio = month && month.planned > 0 ? Math.min(1, month.worked / month.planned) : 0;
  return (
    <section className="shadow-card-soft rounded-[20px] bg-card p-4">
      <div
        className={
          kind === "in"
            ? "rounded-[14px] bg-success-subtle p-3.5"
            : kind === "blocked"
              ? "rounded-[14px] bg-destructive-subtle p-3.5"
              : "rounded-[14px] bg-secondary p-3.5"
        }
      >
        {kind === "blocked" ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-destructive">Không thể chấm công</p>
              <p className="mt-1 text-[13px] leading-5 text-foreground/80">{detail}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-destructive">
              <Lock className="h-5 w-5" />
            </span>
          </div>
        ) : kind === "off" ? (
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">Hôm nay</p>
            <p className="mt-0.5 text-[18px] font-bold">Không có ca</p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{detail}</p>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-muted-foreground">{kind === "in" ? "Đang trong ca" : shiftName}</p>
              {kind === "in" ? (
                <Elapsed sinceIso={sinceIso} frozen={elapsed} />
              ) : (
                <p className="mt-0.5 text-[20px] font-bold tracking-tight">{range}</p>
              )}
              {kind === "in" && sinceLabel ? <p className="mt-1 text-[13px] text-muted-foreground">Vào {sinceLabel}</p> : null}
              {kind === "in" && expectedOut ? <p className="text-[13px] text-muted-foreground">Ra ca dự kiến {expectedOut}</p> : null}
            </div>
            {chip ? (
              <span
                className={
                  kind === "in"
                    ? "inline-flex h-6 items-center rounded-full bg-success-subtle px-2.5 text-[12px] font-semibold text-success ring-1 ring-success/20"
                    : "inline-flex h-6 shrink-0 items-center rounded-full bg-accent px-2.5 text-[12px] font-semibold text-accent-foreground"
                }
              >
                {chip}
              </span>
            ) : null}
          </div>
        )}
        {kind === "out" && meta ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{meta}</span>
          </p>
        ) : null}
        {kind === "blocked" && (primaryLabel || secondaryLabel) ? (
          <div className="mt-3 flex gap-2">
            {primaryLabel ? (
              <button type="button" onClick={onPrimary} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand-navy px-2 text-[13px] font-semibold text-white">
                {primaryLabel}
              </button>
            ) : null}
            {secondaryLabel ? (
              <button
                type="button"
                onClick={onSecondary}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-card px-2 text-[13px] font-semibold text-brand-navy ring-1 ring-border"
              >
                {secondaryLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {month ? (
        <>
          <div className="my-4 h-px bg-border" />
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Công tháng</p>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                {month.planned > 0 ? (
                  <>
                    <b className="text-[20px] font-bold text-foreground">{month.worked}</b> / {month.planned} ngày
                  </>
                ) : (
                  <>
                    <b className="text-[20px] font-bold text-foreground">{month.worked}</b> ngày đã chấm
                  </>
                )}
              </p>
            </div>
            {month.onOpen ? (
              <button type="button" onClick={month.onOpen} className="flex h-11 items-center gap-0.5 text-[13px] font-semibold text-brand-navy">
                Bảng công <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <i className="block h-full rounded-full bg-brand-navy" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        </>
      ) : null}
    </section>
  );
};
