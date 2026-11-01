import { AlertTriangle, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export type GeofenceTone = "loading" | "inside" | "outside" | "weak" | "denied" | "idle";

interface GeofenceStatusProps {
  tone: GeofenceTone;
  placeName?: string | null;
  distanceM?: number | null;
  radiusM?: number | null;
  accuracyM?: number | null;
  maxAccuracyM?: number | null;
  message?: string | null;
  onRetry?: () => void;
  onCreateRequest?: () => void;
  onOpenMap?: () => void;
}

const SURFACE: Record<GeofenceTone, string> = {
  loading: "bg-info-subtle text-info",
  inside: "bg-success-subtle text-success",
  outside: "bg-destructive-subtle text-destructive",
  weak: "bg-warning-subtle text-warning",
  denied: "bg-accent text-accent-foreground",
  idle: "bg-card text-foreground",
};

export const GeofenceStatus = ({
  tone,
  placeName,
  distanceM,
  radiusM,
  accuracyM,
  maxAccuracyM,
  message,
  onRetry,
  onCreateRequest,
  onOpenMap,
}: GeofenceStatusProps) => {
  if (tone === "inside" || tone === "idle" || tone === "loading") {
    return (
      <div className={cn("shadow-mobile flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12.5px]", SURFACE[tone])}>
        <MapPin className={cn("h-4 w-4 shrink-0", tone === "loading" && "animate-pulse")} />
        <span className="font-semibold">
          {tone === "loading" ? "Đang xác định vị trí…" : message}
          {tone === "inside" && placeName ? ` · ${placeName}` : ""}
        </span>
      </div>
    );
  }

  return (
    <section className={cn("rounded-3xl px-4 py-3", SURFACE[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-bold">
          <AlertTriangle className="h-4 w-4" />
          {tone === "outside" ? "Ngoài vùng chấm công" : tone === "weak" ? "Vị trí chưa đủ chính xác" : "Chưa lấy được vị trí"}
        </p>
        {tone === "outside" ? (
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-destructive">Bị chặn</span>
        ) : null}
      </div>
      {placeName ? <p className="mt-1 text-[13px] font-semibold">{placeName}</p> : null}
      {tone === "outside" && distanceM != null ? (
        <p className="mt-1 font-display text-[28px] font-extrabold leading-none tabular">{distanceM}m</p>
      ) : null}
      <p className="mt-1 text-[12.5px] leading-5">
        {message}
        {tone === "outside" && radiusM != null ? ` Bán kính cho phép ${radiusM} m.` : ""}
        {tone === "weak" && accuracyM != null
          ? ` Sai số ±${Math.round(accuracyM)} m${maxAccuracyM != null ? ` (yêu cầu ≤ ${maxAccuracyM} m)` : ""}.`
          : ""}
      </p>
      {tone === "outside" ? (
        <p className="mt-1 text-[12.5px] leading-5">Không thể chấm công ngoài vùng. Hãy tạo đơn hoặc liên hệ HR.</p>
      ) : null}
      {tone === "weak" ? (
        <p className="mt-1 text-[12.5px] leading-5">Ra gần cửa sổ hoặc ngoài trời, bật Wi-Fi rồi thử lại.</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {onOpenMap ? (
          <button type="button" onClick={onOpenMap} className="touch-target rounded-2xl bg-white/80 text-[13px] font-bold text-destructive">
            Xem bản đồ
          </button>
        ) : null}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="touch-target rounded-2xl bg-white/80 text-[13px] font-bold">
            Thử lại vị trí
          </button>
        ) : null}
        {onCreateRequest ? (
          <button
            type="button"
            onClick={onCreateRequest}
            className="bg-gradient-primary touch-target rounded-2xl text-[13px] font-bold text-white shadow-glow"
          >
            Gửi đơn quên / sai chấm công
          </button>
        ) : null}
      </div>
    </section>
  );
};
