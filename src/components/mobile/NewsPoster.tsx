import { ChevronRight, Megaphone } from "lucide-react";
import { Link } from "react-router-dom";

interface NewsPosterProps {
  title?: string | null;
  meta?: string | null;
  tag?: string;
  to?: string;
  onAll?: () => void;
  hideAll?: boolean;
  empty?: string;
}

export const NewsPoster = ({ title, meta, tag = "Thông báo", to = "/toi/tin-tuc", onAll, hideAll, empty }: NewsPosterProps) => (
  <section>
    <div className="mb-2.5 mt-1 flex items-center justify-between px-1">
      <h2 className="font-display text-[17px] font-bold">Tin tức</h2>
      {hideAll ? <span /> : onAll ? (
        <button type="button" onClick={onAll} className="flex h-11 items-center text-[13px] font-semibold text-brand-navy">
          Tất cả <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <Link to={to} className="flex h-11 items-center text-[13px] font-semibold text-brand-navy">
          Tất cả <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
    {title ? (
      <article className="shadow-card-soft overflow-hidden rounded-[20px] bg-card">
        <div className="bg-home-header relative flex h-[112px] flex-col justify-between overflow-hidden p-4">
          <span className="pointer-events-none absolute -bottom-12 -right-6 h-40 w-40 rounded-full border-[14px] border-brand-orange/50" />
          <span className="relative z-[1] inline-flex h-6 w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 text-[11px] font-semibold text-white">
            <Megaphone className="h-3.5 w-3.5" /> {tag}
          </span>
          <p className="relative z-[1] max-w-[220px] text-[16px] font-bold leading-snug text-white">{title}</p>
        </div>
        {meta ? <p className="px-4 py-3 text-[12px] text-muted-foreground">{meta}</p> : null}
      </article>
    ) : (
      <p className="shadow-card-soft rounded-[20px] bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">
        {empty ?? "Chưa có tin tức mới."}
      </p>
    )}
  </section>
);
