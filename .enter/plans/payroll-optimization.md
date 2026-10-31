# Tối ưu module Tính lương

Mục tiêu: biến trang Kỳ lương thành màn hình làm lương hoàn chỉnh — nhìn nhanh quỹ lương, kiểm soát dữ liệu trước khi chốt, thao tác thuận tiện trên cả máy tính và điện thoại — mà vẫn giữ nguyên công thức lương và dữ liệu hiện có.

## 1. Tổng quan quỹ lương
- [x] Thay 3 ô số liệu tĩnh bằng 4 thẻ số liệu thật của kỳ gần nhất: Tổng thực nhận, Số nhân sự, Thuế TNCN, Bảo hiểm nhân viên.
- [x] Thẻ hiển thị mức tăng/giảm so với kỳ liền trước và xu hướng 6 kỳ gần nhất; kỳ đầu tiên ghi rõ “Kỳ đầu tiên”.

## 2. Danh sách kỳ lương
- [x] Trên máy tính: bảng gọn hơn, thêm cột quỹ lương và nút “Tính lương” nhanh ngay trên kỳ nháp chưa có dữ liệu.
- [x] Trên điện thoại: chuyển sang danh sách thẻ (tháng, trạng thái, số nhân sự, thực nhận, thao tác), không phải cuộn ngang bảng.
- [x] Trạng thái Nháp / Đã chốt / Đã chi trả hiển thị rõ bằng nhãn màu thống nhất với hệ thống.

## 3. Bảng lương chi tiết
- [x] Tìm theo tên hoặc mã nhân sự, lọc theo phòng ban, sắp xếp theo tên, ngày công hoặc thực nhận.
- [x] Thêm cột chênh lệch thực nhận so với kỳ trước, có dấu và màu tăng/giảm.
- [x] Cố định tiêu đề bảng và dòng tổng khi cuộn; hiển thị dấu điều chỉnh và ghi chú trên phiếu đã sửa tay.
- [x] In tất cả phiếu lương của kỳ trong một lần, mỗi phiếu một trang.

## 4. Điều chỉnh phiếu lương
- [x] Ở kỳ nháp, mở từng phiếu để sửa phụ cấp khác, khấu trừ khác và ghi chú; hệ thống tự tính lại tổng thu nhập, thu nhập chịu thuế, thuế TNCN và thực nhận.
- [x] Lưu lại người và thời điểm điều chỉnh gần nhất để đối soát.
- [x] Kỳ đã chốt hoặc đã chi trả chỉ xem, không sửa được — kể cả khi gọi thẳng vào dữ liệu.

## 5. Kiểm soát trước khi chốt
- [x] Sau khi tính lương, hiện báo cáo kết quả: số phiếu đã tạo, nhân sự bị bỏ qua vì chưa có lương, người chưa có chấm công/phép, người vào làm hoặc nghỉ việc giữa kỳ.
- [x] Trước khi chốt kỳ, hộp xác nhận hiển thị số nhân sự và tổng thực nhận, cảnh báo nếu có phiếu thiếu ngày công.
- [x] Chỉ kỳ nháp mới tính lại được; chốt và chi trả giữ nguyên quy tắc bảo vệ hiện tại.

## 6. Nhất quán giao diện
- [x] Dùng đúng thẻ số liệu, nhãn trạng thái, bảng, hộp thoại sẵn có của hệ thống; số tiền căn phải, dùng font số, giao diện tiếng Việt, không emoji.
- [x] Giữ nguyên công thức hiện tại: lương theo ngày công chấm công + phép hưởng lương, bảo hiểm nhân viên 10,5%, thuế TNCN lũy tiến; điều chỉnh tay chỉ xảy ra khi người dùng chủ động.

## Ngoài phạm vi
- Không thêm chấm công, hợp đồng, chuyển khoản ngân hàng hay gửi phiếu lương qua email.
- Không đổi mô hình phân quyền hiện có; vẫn theo quyền Tính lương (xem / tạo / sửa / xoá) đã thiết lập.
- Không xoá hay tính lại dữ liệu lương đã có; không đụng tới các module khác.

## Kiểm chứng
- [x] Kiểm tra công thức điều chỉnh (thuế, thực nhận, tổng kỳ) và quy tắc chặn sửa kỳ đã chốt.
- [x] Chạy kiểm tra kiểu, lint và build.
- [ ] Kiểm tra hiển thị ở khổ máy tính và điện thoại — bản xem trước đang yêu cầu đăng nhập nên phần này chưa xác minh được.
