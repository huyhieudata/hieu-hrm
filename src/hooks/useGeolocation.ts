import { useCallback, useEffect, useState } from "react";

import {
  distanceMeters,
  getGpsFix,
  listLocations,
  type AttendanceLocation,
  type GpsFix,
} from "@/lib/attendance-verify";

export type GeoPhase = "idle" | "loading" | "ready" | "denied" | "error";

export interface GeofenceReading {
  phase: GeoPhase;
  fix: GpsFix | null;
  location: AttendanceLocation | null;
  distanceM: number | null;
  radiusM: number | null;
  outside: boolean;
  weak: boolean;
  /** True when the company has at least one active geofence. */
  hasZones: boolean;
  message: string | null;
  refresh: () => void;
}

const EMPTY: Omit<GeofenceReading, "refresh"> = {
  phase: "idle",
  fix: null,
  location: null,
  distanceM: null,
  radiusM: null,
  outside: false,
  weak: false,
  hasZones: false,
  message: null,
};

/**
 * Read-only browser GPS + the company's saved locations.
 * Does not punch attendance. Callers decide whether a reading blocks the button.
 */
export const useGeofence = (companyId: string | null, maxAccuracyM: number): GeofenceReading => {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<GeofenceReading, "refresh">>(EMPTY);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setState((prev) => ({ ...prev, phase: "loading", message: "Đang xác định vị trí…", outside: false }));

    const run = async () => {
      const locations = (await listLocations(companyId)).filter((item) => item.active);
      if (cancelled) return;
      if (locations.length === 0) {
        setState({
          ...EMPTY,
          phase: "ready",
          hasZones: false,
          message: "Công ty chưa cấu hình vùng chấm công.",
        });
        return;
      }

      try {
        const fix = await getGpsFix();
        if (cancelled) return;
        let nearest = locations[0];
        let distance = distanceMeters(fix.latitude, fix.longitude, Number(nearest.latitude), Number(nearest.longitude));
        locations.slice(1).forEach((location) => {
          const next = distanceMeters(fix.latitude, fix.longitude, Number(location.latitude), Number(location.longitude));
          if (next < distance) {
            nearest = location;
            distance = next;
          }
        });
        const radius = Number(nearest.radius_m);
        const outside = distance > radius;
        const weak = fix.accuracy > maxAccuracyM;
        setState({
          phase: "ready",
          fix,
          location: nearest,
          distanceM: Math.round(distance),
          radiusM: radius,
          outside,
          weak,
          hasZones: true,
          message: outside
            ? "Bạn đang ngoài vùng chấm công."
            : weak
              ? `Sai số ±${Math.round(fix.accuracy)} m (cần ≤ ${maxAccuracyM} m).`
              : `Trong vùng · cách ${Math.round(distance)} m`,
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Không lấy được vị trí GPS.";
        const denied = /cho phép|quyền|denied/i.test(message);
        setState({
          ...EMPTY,
          phase: denied ? "denied" : "error",
          hasZones: true,
          message,
        });
      }
    };

    void run().catch((error: unknown) => {
      if (cancelled) return;
      setState({
        ...EMPTY,
        phase: "error",
        message: error instanceof Error ? error.message : "Không tải được vùng chấm công.",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, maxAccuracyM, tick]);

  return { ...state, refresh };
};
