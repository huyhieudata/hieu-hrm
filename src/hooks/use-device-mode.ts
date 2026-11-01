import { useEffect, useState } from "react";

/**
 * Chọn giao diện theo thiết bị, không theo vai trò.
 * Mobile: thiết bị cảm ứng (pointer: coarse) có màn dưới 1024px. Máy có chuột kéo hẹp
 * cửa sổ vẫn giữ shell desktop, nên không dựng lại trang và không mất dữ liệu đang nhập.
 * Lắng nghe matchMedia nên xoay máy/đổi kích thước cửa sổ là đổi ngay, URL giữ nguyên.
 */
const MOBILE_QUERY = "(max-width: 1023px) and (pointer: coarse)";

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
