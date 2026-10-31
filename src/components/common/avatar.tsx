import { cn } from "@/lib/utils";
import { avatarTone, initials } from "@/lib/format";

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-11 w-11 text-[13px]",
};

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export const Avatar = ({ name, src, size = "md", className }: AvatarProps) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-card",
      sizes[size],
      avatarTone(name),
      className,
    )}
    title={name}
  >
    {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
  </span>
);

export const AvatarStack = ({ names, extra }: { names: string[]; extra?: number }) => (
  <div className="flex items-center">
    {names.map((name, index) => (
      <span
        key={name}
        className={cn("relative transition-transform duration-200 hover:z-10 hover:-translate-y-0.5", index > 0 && "-ml-2")}
      >
        <Avatar name={name} size="sm" />
      </span>
    ))}
    {!!extra && (
      <span className="-ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
        +{extra}
      </span>
    )}
  </div>
);

const toneStyles = {
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  destructive: "bg-destructive-subtle text-destructive",
  info: "bg-info-subtle text-info",
  primary: "bg-primary-subtle text-primary-subtle-foreground",
  muted: "bg-muted text-muted-foreground",
};

interface StatusPillProps {
  tone: keyof typeof toneStyles;
  label: string;
  dot?: boolean;
  className?: string;
}

export const StatusPill = ({ tone, label, dot = true, className }: StatusPillProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
      toneStyles[tone],
      className,
    )}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {label}
  </span>
);
