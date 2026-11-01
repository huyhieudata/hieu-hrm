import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Ngày/tháng: giữ input gốc (giá trị ISO, picker hệ thống) nhưng hiển thị dd/mm/yyyy · "Tháng 11/2026".
    if ((type === "date" || type === "month" || type === "datetime-local") && props.value !== undefined) {
      const raw = String(props.value ?? "");
      const label = formatViDateValue(type, raw);
      return (
        <div className={cn("relative", (className ?? "").includes("w-auto") ? "inline-block" : "w-full")}>
          <input
            type={type}
            className={cn(
              "flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-base text-transparent sm:text-sm transition-all duration-150 hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-calendar-picker-indicator]:opacity-60",
              className,
              "text-transparent",
            )}
            ref={ref}
            lang="vi-VN"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-3.5 right-9 flex items-center truncate text-base sm:text-sm",
              /text-\[\d/.test(className ?? "") ? (className ?? "").match(/text-\[[^\]]+\]/)?.[0] : "",
              label ? "text-foreground" : "text-muted-foreground",
              props.disabled && "text-muted-foreground",
            )}
          >
            {label || (type === "month" ? "Chọn tháng" : "dd/mm/yyyy")}
          </span>
        </div>
      );
    }
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-base text-foreground sm:text-sm transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

/** "2026-11-05" → "05/11/2026"; "2026-11" → "Tháng 11/2026"; datetime → "05/11/2026 08:30". */
export const formatViDateValue = (type: string, raw: string) => {
  if (!raw) return "";
  if (type === "month") {
    const m = /^(\d{4})-(\d{2})/.exec(raw);
    return m ? `Tháng ${Number(m[2])}/${m[1]}` : raw;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(raw);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}${type === "datetime-local" && m[4] ? ` ${m[4]}` : ""}`;
};

export { Input };
