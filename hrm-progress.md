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
