# HRM — tiến độ

## 2026-11-01 · Đợt 1: Hồ sơ nhân viên & Hợp đồng lao động
Đã làm:
- Hồ sơ: thêm dân tộc, tôn giáo; tách nhãn thường trú / tạm trú; kiểm tra CCCD 12 số, MST 10/13 số (client + DB, cả người phụ thuộc); cảnh báo trùng CCCD/email khi thêm/sửa.
- Chứng chỉ có hạn (`employee_certificates`) trong tab "Đào tạo & chứng chỉ"; tài liệu có số giấy tờ + ngày hết hạn, loại CV/ảnh thẻ, badge sắp hết hạn.
- Người phụ thuộc: chỉ owner/admin/HR hoặc chính nhân viên xem.
- Nhật ký sửa trường nhạy cảm (tab Lịch sử, chỉ HR thấy).
- Nhân viên đề nghị cập nhật liên hệ/khẩn cấp/ngân hàng tại /toi/ho-so; HR duyệt ở trang Nhân viên và tab Cá nhân của hồ sơ.
- Hợp đồng: thêm loại Thời vụ, nơi làm việc, ngày ký, ràng buộc ngày; phụ lục có lịch sử; Xuất Word / In PDF theo mẫu; trang Cài đặt › Mẫu hợp đồng; cảnh báo pháp lý BLLĐ 2019.
- Cảnh báo hết hạn HĐ qua email: dùng lại sự kiện `contract_expiring` sẵn có.

Chưa làm / ghi chú:
- Số sổ BHXH vẫn cho quản lý xem (giữ hành vi cũ).
- Xuất Word là HTML lưu `.doc` (không phải .docx thật); PDF qua hộp thoại in của trình duyệt.
- Không hiện cảnh báo chứng chỉ sắp hết hạn qua email (chỉ badge trên UI).

## Tiếp theo (đợt riêng)
- Tốc độ tải (React Query, RLS/index), validate Tạo kỳ lương / chính sách phép, seed loại đơn có dấu, đánh dấu bản ghi chấm công nhập tay, các mục nhỏ.

## 01/11/2026 — Đợt xếp hàng (tốc độ + validate + việc nhỏ)
- Tốc độ: cache/dedupe truy vấn, 1 truy vấn platform_admins, profile tải 1 lần, preload chunk tuần tự; migration bọc auth.*() trong RLS (initplan) + 89 index FK.
- Validate Tạo kỳ lương (chặn trùng tháng) và Tạo chính sách phép (bắt buộc, trùng tên/năm, trùng loại phép, kiểm phạm vi trước khi ghi) + toast.
- Loại đơn mặc định có dấu cho mọi công ty + trigger công ty mới; "Phep" → "Nghỉ phép".
- Chấm công cũ → nhãn "Nhập tay/cũ".
- Định biên mặc định năm hiện tại; cột Vào làm lấy HĐ đầu tiên nếu thiếu; PDF ngang + ngày/điện thoại; import .xlsx; bỏ nút Đóng trùng ở import; lỗi theo ô ở Thêm nhân viên; sửa menu "..." ; nhãn ô quyền; xác nhận Thu hồi lời mời; dialog lý do từ chối.

## 01/11/2026 — Sửa danh sách lỗi Tester 2 (A1–C6)
- A: Quên mật khẩu + trang /dat-lai-mat-khau; lỗi hiện dưới từng ô, xác nhận mật khẩu khi đăng ký; Action tự thêm redirect URL vào Auth allow-list.
- B: withRetry/noticeIfSlow ("Đang kết nối lại…"), prefetch quyền song song memberships; Chấm công tải song song + lọc theo nhân viên phía DB.
- C1 kiểm tra SĐT/email/CCCD/MST (client + RPC submit_employee_change_request). C2 dịch lỗi DB sang tiếng Việt, chặn ngày hết hạn < ngày cấp. C3 Xuất Word/PDF/Phụ lục cho mọi dòng hợp đồng + tab hồ sơ + link từ Mẫu hợp đồng. C4 tên chính sách nghỉ trống, xác nhận trước khi tạo kỳ lương. C5 nhãn "Nhập tay/không có bằng chứng" chỉ khi không có IP/UA. C6 Định biên mặc định năm hiện tại, "Thêm năm" tạo nháp.
