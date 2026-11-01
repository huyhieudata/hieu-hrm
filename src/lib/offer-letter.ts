import { printViaFrame } from "@/lib/print-frame";
import { toast } from "sonner";

import { currency } from "@/lib/format";
import { OFFER_STATUS_LABELS, formatDay, type Candidate, type CandidateOffer } from "@/lib/recruitment";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildOfferLetterHtml = (offer: CandidateOffer, candidate: Candidate, companyName: string) => {
  const today = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const code = `OL-${offer.id.slice(0, 8).toUpperCase()}`;
  const salary = offer.base_salary ? `${currency(Number(offer.base_salary))} / tháng` : "Theo thoả thuận";
  const allowance = offer.allowance ? currency(Number(offer.allowance)) : "Theo chính sách công ty";
  const benefitLines = (offer.other_benefits ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const benefits = benefitLines.length
    ? benefitLines
    : [
        "Bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp theo quy định pháp luật",
        "12 ngày phép năm và các ngày nghỉ lễ theo quy định",
        "Xét tăng lương định kỳ theo kết quả công việc",
      ];

  const terms: [string, string][] = [
    ["Vị trí công việc", offer.position ?? candidate.position_applied ?? "—"],
    ["Bộ phận", offer.department ?? "—"],
    ["Mức lương", salary],
    ["Phụ cấp", allowance],
    ["Ngày nhận việc", offer.onboarding_date ? formatDay(offer.onboarding_date) : "—"],
    ["Địa điểm làm việc", offer.work_location ?? "—"],
  ];
  if (offer.response_deadline) {
    terms.push(["Thời hạn nhận phản hồi", formatDay(offer.response_deadline)]);
  }

  const rows = terms
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<title>Thư mời nhận việc - ${escapeHtml(candidate.full_name)}</title>
<style>
  @page{size:A4;margin:20mm}
  body{font-family:"Times New Roman",Georgia,serif;color:#111;line-height:1.65}
  .brand{display:flex;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:26px}
  .brand h1{font-size:17px;margin:0;letter-spacing:.04em;color:#1d4ed8}
  .brand p{margin:2px 0 0;font-size:11.5px;color:#555;font-family:"Segoe UI",sans-serif}
  .doc-no{font-size:11.5px;color:#555;text-align:right;font-family:"Segoe UI",sans-serif}
  h2{text-align:center;font-size:21px;margin:0 0 4px;letter-spacing:.08em}
  .sub{text-align:center;font-size:12px;color:#666;margin-bottom:24px;font-family:"Segoe UI",sans-serif}
  p{font-size:13.5px;margin:8px 0}
  table{border-collapse:collapse;width:100%;margin:14px 0}
  th,td{border:1px solid #d7dce5;padding:8px 10px;font-size:13px;text-align:left}
  th{width:36%;background:#f4f7fc;font-weight:600}
  .block{margin:14px 0}
  .block h3{font-size:13.5px;margin:0 0 4px}
  .benefits{margin:4px 0 0;padding-left:20px}
  .benefits li{font-size:13px;margin:3px 0}
  .sign{display:flex;justify-content:space-between;gap:30px;margin-top:38px;text-align:center}
  .sign div{flex:1}
  .sign .role{font-size:12.5px;font-weight:600}
  .sign .hint{font-size:11px;color:#888;margin-top:2px}
  .line{margin-top:56px;border-top:1px dashed #bbb;padding-top:6px;font-size:11.5px;color:#555}
  footer{margin-top:22px;border-top:1px solid #e6e9ef;padding-top:8px;font-size:10.5px;color:#888;font-family:"Segoe UI",sans-serif}
</style></head><body>
<div class="brand">
  <div>
    <h1>${escapeHtml(companyName).toUpperCase()}</h1>
    <p>Bộ phận Tuyển dụng &amp; Nhân sự</p>
  </div>
  <div class="doc-no">Số: ${code}<br />Ngày: ${today}</div>
</div>

<h2>THƯ MỜI NHẬN VIỆC</h2>
<p class="sub">Trạng thái: ${escapeHtml(OFFER_STATUS_LABELS[offer.status] ?? offer.status)}</p>

<p><strong>Kính gửi:</strong> ${escapeHtml(candidate.full_name)}</p>
${candidate.address ? `<p><strong>Địa chỉ:</strong> ${escapeHtml(candidate.address)}</p>` : ""}
${candidate.email ? `<p><strong>Email:</strong> ${escapeHtml(candidate.email)}</p>` : ""}
${candidate.phone ? `<p><strong>Điện thoại:</strong> ${escapeHtml(candidate.phone)}</p>` : ""}

<p>
  ${escapeHtml(companyName)} trân trọng thông báo Quý ứng viên đã trúng tuyển và hân hạnh mời bạn
  làm việc tại công ty với các điều kiện sau:
</p>

<table>${rows}</table>

<div class="block">
  <h3>Chế độ và quyền lợi khác</h3>
  <ul class="benefits">
    ${benefits.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
  </ul>
</div>

${offer.note ? `<div class="block"><h3>Ghi chú</h3><p>${escapeHtml(offer.note).replace(/\n/g, "<br />")}</p></div>` : ""}

<p>
  Vui lòng phản hồi thư này để xác nhận việc nhận lời mời ${
    offer.response_deadline
      ? `trước ngày <strong>${escapeHtml(formatDay(offer.response_deadline))}</strong>`
      : "trước ngày nhận việc <strong>03 ngày</strong>"
  }. Nếu cần trao đổi thêm, bạn có thể liên hệ trực tiếp bộ phận Nhân sự của công ty.
</p>
<p>Chúng tôi rất mong được chào đón bạn gia nhập ${escapeHtml(companyName)}.</p>

<div class="sign">
  <div>
    <p class="role">Đại diện Công ty</p>
    <p class="hint">(Ký, ghi rõ họ tên)</p>
    <div class="line">&nbsp;</div>
  </div>
  <div>
    <p class="role">Ứng viên xác nhận</p>
    <p class="hint">(Ký, ghi rõ họ tên)</p>
    <div class="line">&nbsp;</div>
  </div>
</div>

<footer>Thư mời nhận việc ${code} · ${escapeHtml(companyName)} · In ngày ${today}</footer>
</body></html>`;
};

export const printOfferLetter = (offer: CandidateOffer, candidate: Candidate, companyName: string) => {
  const html = buildOfferLetterHtml(offer, candidate, companyName);
  printViaFrame(html);
};

export const downloadOfferLetter = (offer: CandidateOffer, candidate: Candidate, companyName: string) => {
  const html = buildOfferLetterHtml(offer, candidate, companyName);
  const blob = new Blob(["\ufeff", html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `thu-moi-nhan-viec-${candidate.full_name.replace(/\s+/g, "-").toLowerCase()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Đã tải thư offer", { description: "Mở tệp bằng trình duyệt và chọn In → Lưu thành PDF." });
};
