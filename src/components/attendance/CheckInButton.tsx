import { useRef, useState } from "react";
import { Loader2, ScanFace } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckInButtonMode = "in" | "out" | "busy" | "locked";

interface CheckInButtonProps {
  mode: CheckInButtonMode;
  label: string;
  hint?: string;
  onPress: () => void;
  /** Milliseconds the pointer must stay down before Ra ca fires. */
  holdMs?: number;
}

export const CheckInButton = ({ mode, label, hint, onPress, holdMs = 1000 }: CheckInButtonProps) => {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const locked = mode === "locked" || mode === "busy";
  const holding = mode === "out";

  const clear = () => {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  const fire = () => {
    if (locked) return;
    navigator.vibrate?.(20);
    onPress();
  };

  const startHold = () => {
    if (!holding || locked) return;
    const started = performance.now();
    clear();
    timer.current = window.setInterval(() => {
      const ratio = Math.min(1, (performance.now() - started) / holdMs);
      setProgress(ratio);
      if (ratio >= 1) {
        clear();
        fire();
      }
    }, 30);
  };

  return (
    <div className="flex flex-col items-center py-2">
      <div
        className={cn(
          "rounded-full p-2.5",
          locked ? "bg-muted" : mode === "out" ? "bg-brand-orange/15" : "animate-pulse-ring bg-brand-orange/15",
        )}
      >
        <button
          type="button"
          disabled={locked}
          aria-disabled={locked}
          onClick={() => {
            if (holding) return;
            fire();
          }}
          onPointerDown={startHold}
          onPointerUp={clear}
          onPointerLeave={clear}
          onPointerCancel={clear}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            "flex h-[120px] w-[120px] flex-col items-center justify-center gap-1 rounded-full text-white transition-transform active:scale-95 disabled:active:scale-100",
            locked ? "bg-slate-300 text-white shadow-none" : mode === "out" ? "bg-gradient-accent shadow-glow" : "bg-gradient-primary shadow-glow-navy",
          )}
        >
          {mode === "busy" ? <Loader2 className="h-7 w-7 animate-spin" /> : <ScanFace className="h-7 w-7" />}
          <span className="text-[15px] font-extrabold tracking-wide">{label}</span>
          {hint ? <span className="px-3 text-center text-[10px] font-semibold opacity-90">{hint}</span> : null}
        </button>
      </div>
      {holding && progress > 0 ? (
        <div className="mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-brand-orange transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
};
