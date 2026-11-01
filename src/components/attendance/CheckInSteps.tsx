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
}

export const CheckInSteps = ({ steps }: CheckInStepsProps) => (
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
