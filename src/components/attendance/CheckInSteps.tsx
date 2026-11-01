import { Camera, Check, MapPin, Smartphone, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckStepState = "idle" | "active" | "loading" | "ok" | "warn" | "bad";

export interface CheckStepItem {
  id: string;
  icon: "camera" | "pin" | "phone";
  label: string;
  note: string;
  state: CheckStepState;
}

const ICONS: Record<CheckStepItem["icon"], LucideIcon> = {
  camera: Camera,
  pin: MapPin,
  phone: Smartphone,
};

const TONE: Record<CheckStepState, string> = {
  idle: "bg-muted text-muted-foreground",
  active: "bg-accent text-brand-orange",
  loading: "bg-info-subtle text-info",
  ok: "bg-success-subtle text-success",
  warn: "bg-warning-subtle text-warning",
  bad: "bg-destructive-subtle text-destructive",
};

interface CheckInStepsProps {
  steps: CheckStepItem[];
  /** List matches the approved mobile check-in. Cards stay on desktop. */
  variant?: "cards" | "list";
}

const STATUS_LABEL: Record<CheckStepState, string> = {
  idle: "Chờ",
  active: "Đang kiểm tra",
  loading: "Đang kiểm tra",
  ok: "Đạt",
  warn: "Đang kiểm tra",
  bad: "Bị chặn",
};

const STATUS_TONE: Record<CheckStepState, string> = {
  idle: "text-muted-foreground",
  active: "text-warning",
  loading: "text-warning",
  ok: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
};

export const CheckInSteps = ({ steps, variant = "cards" }: CheckInStepsProps) => {
  if (variant === "list") {
    return (
      <ol className="shadow-card-soft rounded-[20px] bg-card px-4">
        {steps.map((step) => {
          const Icon = ICONS[step.icon];
          const tone =
            step.state === "ok" ? "ok" : step.state === "bad" ? "bad" : step.state === "warn" || step.state === "active" || step.state === "loading" ? "run" : "idle";
          return (
            <li key={step.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  tone === "ok" && "bg-success-subtle text-success",
                  tone === "bad" && "bg-destructive-subtle text-destructive",
                  tone === "run" && "bg-accent text-warning",
                  tone === "idle" && "bg-primary-subtle text-brand-navy",
                )}
              >
                <Icon className={cn("h-4 w-4", step.state === "loading" && "animate-pulse")} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[14px] font-semibold">{step.label}</span>
                <span className={cn("mt-0.5 block truncate text-[12px]", step.state === "bad" ? "text-destructive" : "text-muted-foreground")}>{step.note}</span>
              </span>
              <span className={cn("shrink-0 text-[12px] font-semibold", STATUS_TONE[step.state])}>{STATUS_LABEL[step.state]}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
  <ol className="space-y-2">
    {steps.map((step) => {
      const Icon = ICONS[step.icon];
      return (
        <li key={step.id} className="shadow-mobile flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE[step.state])}>
            <Icon className={cn("h-4 w-4", step.state === "loading" && "animate-pulse")} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-foreground">{step.label}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{step.note}</span>
          </span>
          {step.state === "ok" ? <Check className="h-4 w-4 shrink-0 text-success" aria-label="Đạt" /> : null}
        </li>
      );
    })}
  </ol>
  );
};
