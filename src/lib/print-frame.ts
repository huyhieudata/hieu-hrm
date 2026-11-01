/** In HTML qua iframe ẩn (blob) — không mở popup, không khoá trang gốc. */
export const printViaFrame = (html: string) => {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = url;
  frame.onload = () => {
    // Cho trình duyệt vẽ xong rồi mới in, chạy bất đồng bộ để trang gốc không bị treo.
    window.setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      }
    }, 250);
  };
  document.body.appendChild(frame);
};
