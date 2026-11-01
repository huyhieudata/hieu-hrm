import { cn } from "@/lib/utils";

interface Segment {
  value: string;
  label: string;
  count?: number;
}

interface SegmentedProps {
  options: Segment[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export const Segmented = ({ options, value, onChange, label }: SegmentedProps) => (
  <div className="flex gap-1 overflow-x-auto rounded-[14px] bg-secondary p-1" role="tablist" aria-label={label}>
    {options.map((option) => {
      const on = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-11 min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[13px]",
            on ? "bg-card font-bold text-brand-navy shadow-sm" : "font-medium text-muted-foreground",
          )}
        >
          {option.label}
          {option.count ? (
            <b className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-bold text-white">
              {option.count}
            </b>
          ) : null}
        </button>
      );
    })}
  </div>
);
