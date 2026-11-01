/** Thông báo kiểm tra form của trình duyệt bằng tiếng Việt (thay tooltip tiếng Anh) cho mọi input. */
const messageFor = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
  const v = el.validity;
  if (v.valueMissing) return "Vui lòng nhập/chọn trường này.";
  if (v.typeMismatch && el.type === "email") return "Email chưa đúng định dạng (ví dụ: ten@congty.vn).";
  if (v.typeMismatch && el.type === "url") return "Đường dẫn chưa đúng định dạng.";
  if (v.patternMismatch) return el.getAttribute("title") || "Giá trị chưa đúng định dạng.";
  if (v.tooShort) return `Cần tối thiểu ${(el as HTMLInputElement).minLength} ký tự.`;
  if (v.tooLong) return `Tối đa ${(el as HTMLInputElement).maxLength} ký tự.`;
  if (v.rangeUnderflow) return `Giá trị nhỏ nhất là ${(el as HTMLInputElement).min}.`;
  if (v.rangeOverflow) return `Giá trị lớn nhất là ${(el as HTMLInputElement).max}.`;
  if (v.stepMismatch) return "Giá trị không hợp lệ.";
  if (v.badInput) return "Giá trị không hợp lệ.";
  return "";
};

export const installVietnameseValidation = () => {
  document.addEventListener(
    "invalid",
    (event) => {
      const el = event.target as HTMLInputElement;
      if (!el || !("validity" in el)) return;
      el.setCustomValidity("");
      const msg = messageFor(el);
      if (msg) el.setCustomValidity(msg);
    },
    true,
  );
  const reset = (event: Event) => {
    const el = event.target as HTMLInputElement;
    if (el && "setCustomValidity" in el) el.setCustomValidity("");
  };
  document.addEventListener("input", reset, true);
  document.addEventListener("change", reset, true);
};
