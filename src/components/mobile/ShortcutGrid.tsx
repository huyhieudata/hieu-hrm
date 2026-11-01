import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface Shortcut {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  dot?: boolean;
}

export const ShortcutGrid = ({ items }: { items: Shortcut[] }) => (
  <div className="grid grid-cols-4 gap-y-4 px-1 py-5">
    {items.map((item) => {
      const Icon = item.icon;
      const inner = (
        <>
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-brand-navy">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
            {item.dot ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-brand-orange" /> : null}
          </span>
          <span className="text-center text-[12px] font-medium leading-4 text-foreground">{item.label}</span>
        </>
      );
      if (item.to) {
        return (
          <Link key={item.label} to={item.to} className="flex min-h-11 flex-col items-center gap-2">
            {inner}
          </Link>
        );
      }
      return (
        <button key={item.label} type="button" onClick={item.onClick} className="flex min-h-11 flex-col items-center gap-2">
          {inner}
        </button>
      );
    })}
  </div>
);
