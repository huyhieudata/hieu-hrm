import { Check } from "lucide-react";

import { candidateStageIndex } from "@/lib/recruitment";
import { cn } from "@/lib/utils";

const STAGE_LABELS = [
  "Tiếp nhận",
  "Sàng lọc",
  "Đạt hồ sơ",
  "Hẹn PV",
  "Đã PV",
  "Đạt PV",
  "Gửi offer",
  "Nhận offer",
  "Nhận việc",
];

/** Thanh tiến trình tuyển dụng chính của ứng viên. */
export const CandidatePipeline = ({ status, className }: { status: string; className?: string }) => {
  const current = candidateStageIndex(status);
  const stopped = current < 0;

  return (
    <div className={cn("scrollbar-slim overflow-x-auto", className)}>
      <div className="flex min-w-[640px] items-start gap-1">
        {STAGE_LABELS.map((label, index) => {
          const done = !stopped && index < current;
          const active = !stopped && index === current;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-px flex-1",
                    index === 0 ? "bg-transparent" : done || active ? "bg-primary/40" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary bg-primary-subtle text-primary"
                        : "border-border bg-card text-muted-foreground",
                    stopped && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "h-px flex-1",
                    index === STAGE_LABELS.length - 1
                      ? "bg-transparent"
                      : done
                        ? "bg-primary/40"
                        : "bg-border",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[11px] leading-4",
                  active ? "font-semibold text-primary" : done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
