import { useEffect, useState } from "react";

import { describeDevice, getDeviceHash, type DeviceInfo } from "@/lib/attendance-verify";

/** Reads the browser's device label and the local device hash. No server writes. */
export const useDeviceInfo = () => {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([describeDevice(), getDeviceHash()]).then(([nextInfo, nextHash]) => {
      if (cancelled) return;
      setInfo(nextInfo);
      setHash(nextHash);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    info,
    hash,
    shortHash: hash ? hash.slice(-4).toUpperCase() : "",
  };
};
