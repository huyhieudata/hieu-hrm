import { useEffect, useState } from "react";

interface ShiftCardProps {
  name: string;
  range: string;
  dateLabel: string;
  /** Fixed clock for previews. Live clock when omitted. */
  time?: string;
}

export const ShiftCard = ({ name, range, dateLabel, time }: ShiftCardProps) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (time) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [time]);

  const hours = time ?? now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const seconds = time ? "" : now.toLocaleTimeString("vi-VN", { second: "2-digit" });

  return (
    <section className="bg-gradient-primary shadow-glow-navy rounded-3xl px-4 py-3.5 text-white">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold">{name}</p>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">Hôm nay</span>
      </div>
      <p className="mt-1 font-display text-[34px] font-extrabold leading-none tracking-tight tabular">
        {hours}
        {seconds ? <span className="text-[16px] font-semibold opacity-70">:{seconds}</span> : null}
      </p>
      <p className="mt-1 text-[12px] opacity-85">
        {range} · {dateLabel}
      </p>
    </section>
  );
};
