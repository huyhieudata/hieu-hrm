import { cn } from "@/lib/utils";

/** Chữ O cách điệu: vòng hở + thanh cam, lấy cảm hứng từ logo ONHRM. */
export const BrandGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={cn("shrink-0", className)}>
    <path
      d="M27.5 10.3A13 13 0 1 1 17.7 8.2"
      stroke="currentColor"
      strokeWidth="4.4"
      strokeLinecap="round"
    />
    <rect x="19.6" y="3.2" width="4.8" height="12.6" rx="0.5" className="fill-brand-orange" />
  </svg>
);

/** Biểu tượng ứng dụng: nền navy, vòng O trắng và thanh cam. */
export const LogoMark = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-brand-navy shadow-brand",
      className,
    )}
  >
    <BrandGlyph className="h-[58%] w-[58%] text-white" />
  </div>
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
    <div className={cn("flex items-start", className)} role="img" aria-label="ONHRM">
      <BrandGlyph
        className={cn(
          "text-brand-navy",
          large ? "mt-[0.5px] h-[25px] w-[25px]" : "mt-[0.5px] h-[19px] w-[19px]",
        )}
      />
      <div className="-ml-[1px] flex flex-col">
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
