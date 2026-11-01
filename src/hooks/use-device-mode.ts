import { useEffect, useState } from "react";

/**
 * Chọn giao diện theo thiết bị, không theo vai trò.
 * Mobile: màn hẹp (< 768px) hoặc màn cảm ứng không có chuột (pointer: coarse) dưới 1024px.
 * Lắng nghe matchMedia nên xoay máy/đổi kích thước cửa sổ là đổi ngay, URL giữ nguyên.
 */
const MOBILE_QUERY = "(max-width: 767px), (max-width: 1023px) and (pointer: coarse)";

const read = () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

export type DeviceMode = "mobile" | "desktop";

export const useDeviceMode = (): DeviceMode => {
  const [mobile, setMobile] = useState<boolean>(read);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return mobile ? "mobile" : "desktop";
};
