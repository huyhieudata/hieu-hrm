import { useEffect, type RefObject } from "react";

/**
 * Gắn data-label (lấy từ <th>) cho từng <td> trong vùng nội dung, để CSS
 * `.mobile-cards` hiển thị bảng thành thẻ dọc trên điện thoại.
 */
export const useTableCards = (ref: RefObject<HTMLElement>) => {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = 0;
    const label = () => {
      frame = 0;
      root.querySelectorAll("table").forEach((table) => {
        const heads = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
        table.querySelectorAll("tbody tr").forEach((tr) => {
          Array.from(tr.children).forEach((cell, index) => {
            const text = heads[index] ?? "";
            if (cell.getAttribute("data-label") !== text) cell.setAttribute("data-label", text);
          });
        });
      });
    };
    label();
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(label);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
};
