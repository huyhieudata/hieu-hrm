import { cn } from "@/lib/utils";

/** Biểu tượng ứng dụng đã duyệt: nền navy gradient, vòng trắng, thanh cam. */
export const LogoMark = ({ className }: { className?: string }) => (
  <img
    src="/icons/icon-512.png"
    alt=""
    width={512}
    height={512}
    className={cn("h-10 w-10 shrink-0 rounded-[12px] object-cover", className)}
  />
);

export const BrandWordmark = ({ className }: { className?: string }) => (
  <span className={cn("font-display leading-none tracking-[0.01em] text-brand-navy", className)}>
    <span className="font-extrabold">N</span>
    <span className="font-light">HRM</span>
  </span>
);

interface LogoProps {
  collapsed?: boolean;
  className?: string;
  subtitle?: string;
  size?: "sm" | "md";
}

export const Logo = ({ collapsed = false, className, subtitle = "People Platform", size = "md" }: LogoProps) => {
  if (collapsed) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <LogoMark />
      </div>
    );
  }

  const large = size === "md";

  return (
    <div className={cn("flex items-center gap-2", className)} role="img" aria-label="ONHRM">
      <LogoMark className={large ? "h-8 w-8 rounded-[9px]" : "h-7 w-7 rounded-[8px]"} />
      <div className="flex flex-col">
        <BrandWordmark className={large ? "text-[21px]" : "text-[16px]"} />
        {subtitle && (
          <span className="mt-0.5 text-[11px] font-medium uppercase leading-3 tracking-[0.16em] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
