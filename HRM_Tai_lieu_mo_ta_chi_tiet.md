---
title: "Tài liệu mô tả yêu cầu chi tiết – Phần mềm Quản lý Nhân sự (HRM) toàn diện"
subtitle: "Đặc tả chức năng cho đội kỹ thuật – 18 mô-đun – bản cuối"
---

# Quy ước đọc tài liệu

- **Yêu cầu gốc**: ý của anh Hiệu, là yêu cầu bắt buộc.
- **Đề xuất bổ sung**: chi tiết kỹ thuật/nghiệp vụ do người soạn đề xuất để đội kỹ thuật dễ triển khai. Cần anh Hiệu xác nhận trước khi đưa vào phạm vi.
- **Câu hỏi mở**: điểm chưa có quyết định, cần chốt trước khi làm.
- Tài liệu không đưa ra số liệu cụ thể (ngưỡng, tỷ lệ, mức đóng...). Các giá trị này đều do quản trị viên cấu hình hoặc cần anh Hiệu cung cấp.

# 0. Tổng quan & phạm vi

## 0.1 Bối cảnh
Ban đầu anh Hiệu định hướng 10 nhóm chức năng: chấm công, quản lý đơn từ, tuyển dụng quản lý nhân sự, đánh giá, truyền thông nội bộ, cài đặt phân quyền, tính lương, quy trình, báo cáo nhân sự, tự động hoá. Bản cuối này cụ thể hoá thành **18 mô-đun**. Các mô-đun 1–15 giữ nguyên số thứ tự; Tính lương, Tự động hoá và Giao diện đăng nhập được bổ sung thành mô-đun 16–18 để không làm lệch các tham chiếu chéo:

| # | Mô-đun | Ghi chú |
|---|---|---|
| 1 | Chấm công | |
| 2 | Đơn từ | |
| 3 | Tuyển dụng | |
| 4 | Đánh giá | |
| 5 | Truyền thông nội bộ | |
| 6 | Quản lý nhân viên (hồ sơ 360°) | Mô-đun trung tâm |
| 7 | Đào tạo | |
| 8 | Quy trình | Dùng chung cho Đơn từ và các thủ tục |
| 9 | Báo cáo nhân sự | |
| 10 | Trang chủ nhân viên | |
| 11 | Phân quyền | |
| 12 | Cài đặt | Gán quyền, mẫu email, SMTP, cấu hình chung theo workspace |
| 13 | Bảo hiểm | |
| 14 | Hợp đồng | |
| 15 | Khen thưởng – kỷ luật | |
| 16 | Tính lương | Tách riêng theo yêu cầu |
| 17 | Tự động hoá | Gom mọi luồng email tự động và cảnh báo |
| 18 | Giao diện đăng nhập | Đăng nhập bằng SĐT/email trong hồ sơ |

> Mọi nhóm chức năng trong danh sách 10 ban đầu giờ đều có mô-đun tương ứng: “cài đặt phân quyền” → 11 và 12; “tính lương” → 16; “tự động hoá” → 17.

## 0.2 Nguyên tắc chung (yêu cầu gốc)
- Hệ thống là **web app**, **dùng được trên điện thoại** (giao diện responsive). Nhân viên chấm công qua cổng web trên điện thoại.
- **Không có mô-đun quản lý user riêng**. Mỗi nhân viên (mô-đun 18) đăng nhập bằng SĐT hoặc email có trong hồ sơ nhân viên. Quyền được gán trực tiếp cho nhân viên.

## 0.3 Tổng quan kiến trúc (Đề xuất bổ sung)
- **Frontend**: SPA responsive, ưu tiên thiết kế cho mobile; có thể cài dạng PWA lên màn hình chính. Cần truy cập camera và GPS từ trình duyệt (bắt buộc HTTPS).
- **Backend**: REST/JSON API; chia module theo miền nghiệp vụ; một **Workflow Engine** dùng chung (mô-đun 8) cho Đơn từ, thủ tục nhân sự và yêu cầu tuyển dụng.
- **Dịch vụ dùng chung**: xác thực (OTP/mật khẩu qua SĐT/email), phân quyền RBAC (mô-đun 11), thông báo/email (SMTP, mô-đun 12), lưu trữ file (ảnh chấm công, CV, tài liệu), bộ lập lịch (scheduler) và engine tự động hoá (mô-đun 17) cho cảnh báo hết hạn, kiểm tra SLA, email tự động; engine tính lương (mô-đun 16), xuất Excel/PDF, audit log.
- **CSDL**: quan hệ (ví dụ PostgreSQL); file lưu trên object storage. Bảng `employees` là trung tâm, các mô-đun khác tham chiếu `employee_id`.
- **Workspace (đa công ty)**: mỗi công ty là một workspace, dữ liệu tách biệt hoàn toàn (mọi bảng nghiệp vụ có `workspace_id`, mọi truy vấn đều lọc theo workspace). Các thứ sau được cấu hình riêng cho từng workspace: phân quyền, mẫu email, SMTP, quy tắc tự động hoá, chính sách bảo mật, cấu hình chấm công và lương. *(Đề xuất)* Mỗi workspace có tên miền con/đường dẫn riêng (ví dụ `congty.tenmien`). Một người thuộc nhiều công ty thì có hồ sơ nhân viên riêng ở mỗi workspace và chuyển qua lại bằng bộ chọn workspace. Có vai trò Super Admin của nhà cung cấp để tạo và quản lý workspace.
- **Phi chức năng**: ghi audit log mọi thay đổi dữ liệu nhân sự; mã hoá đường truyền; dữ liệu nhạy cảm (sức khỏe, CCCD, lương) chỉ người có quyền mới được xem; sao lưu định kỳ.

## 0.4 Sơ đồ liên kết giữa các mô-đun

```
 ╔═══════════════ WORKSPACE (mỗi công ty – dữ liệu, quyền, email, SMTP tách biệt) ═══════════════╗
   18 Đăng nhập (SĐT/email trong hồ sơ) ──► chọn workspace ──► 10 Trang chủ
   17 Tự động hoá (khi… thì…) ◄── sự kiện từ 1,2,3,6,7,8,14,16 ──► email (12) / tạo việc (8)
   1 Công + 2 Đơn (OT, nghỉ) + 15 Thưởng phạt + 13 BH + 6 Hồ sơ lương ──► 16 Tính lương ──► 9 Quỹ lương
                 ┌──────────────── 12 Cài đặt (đăng nhập, SMTP, mẫu & luồng email) ─────────────┐
                 │                 11 Phân quyền (áp lên mọi mô-đun)                              │
                 ▼                                                                                │
 3 Tuyển dụng ──(ứng viên đậu)──► 6 HỒ SƠ NHÂN VIÊN 360° ◄── 14 Hợp đồng                          │
   ▲   │                         │  ▲   ▲   ▲   ▲        ◄── 13 Bảo hiểm (lấy dữ liệu từ hồ sơ)  │
   │   └─► 4 Đánh giá (phiếu PV) │  │   │   │   └──────── 15 Khen thưởng – kỷ luật            │
   │        (đề xuất: ĐG định kỳ)┘  │   │   └──────────── 7 Đào tạo (khóa học, chứng chỉ)     │
   │                                │   └──────────────── 8 Quy trình (onboarding/điều chuyển/ │
   │                                │                        bổ nhiệm/miễn nhiệm/nghỉ việc)    │
 2 Đơn từ ──(duyệt qua 8)──► 1 Chấm công (bảng công) ─────┘                                    │
   │                              │                                                            │
   └──────────────┬───────────────┘                                                            │
                  ▼                                                                            │
     10 Trang chủ NV (công, nghỉ, muộn, sớm, đơn, thâm niên) ◄── 5 Truyền thông nội bộ          │
                  ▼                                                                            │
     9 Báo cáo nhân sự (tổng hợp từ 1,3,6,13,14 ... và quỹ lương) ◄──────────────────────────────┘
 ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
```

Tóm tắt các luồng dữ liệu chính:

| Từ | Đến | Nội dung |
|---|---|---|
| 2 Đơn từ | 1 Chấm công | Đơn đã duyệt cập nhật bảng công (nghỉ phép, sửa chấm công, làm thêm, công tác...) |
| 8 Quy trình | 2, 3, 6 | Bước duyệt, SLA, biểu mẫu từng bước |
| 3 Tuyển dụng | 6 Nhân viên | Chuyển ứng viên đậu thành hồ sơ nhân viên |
| 4 Đánh giá | 3 Tuyển dụng | Phiếu đánh giá phỏng vấn gắn với hồ sơ ứng viên |
| 6 Nhân viên | 12, 11 | SĐT/email đăng nhập; gán quyền |
| 6 Nhân viên | 13 Bảo hiểm | Danh sách người đóng, mức đóng |
| 14, 15, 7 | 6 Nhân viên | Hợp đồng, khen thưởng – kỷ luật, đào tạo hiển thị trong hồ sơ 360° |
| 1, 2, 6 | 10 Trang chủ | Số liệu cá nhân |
| Tất cả | 9 Báo cáo | Dữ liệu tổng hợp |
| 12 Cài đặt | 17 Tự động hoá | Mẫu email, SMTP |
| 1, 2, 3, 6, 7, 8, 14, 16 | 17 Tự động hoá | Sự kiện/mốc thời gian kích hoạt quy tắc |
| 1, 2, 6, 13, 15 | 16 Tính lương | Công, OT, nghỉ, hồ sơ lương, BH, thưởng phạt |
| 16 Tính lương | 9 Báo cáo, 6 Cổng tự phục vụ | Quỹ lương, phiếu lương |
| 18 Đăng nhập | 11, 10 | Danh tính → quyền → trang chủ trong workspace |

## 0.5 Ma trận phân quyền mặc định (Đề xuất bổ sung)
Yêu cầu gốc (mô-đun 11): phân quyền theo **loại quyền**, **tích chọn theo từng mô-đun** với các quyền **Xem / Sửa / Xóa**. Ma trận dưới đây là bộ vai trò mẫu để khởi tạo, admin có thể sửa lại. **Quyền áp dụng theo từng workspace**: một người có thể là HR ở công ty A nhưng chỉ là nhân viên ở công ty B. Thêm vai trò **Super Admin** (nhà cung cấp) chỉ dùng để tạo/quản lý workspace và không xem dữ liệu nghiệp vụ *(đề xuất)*. Cột "Quản trị hệ thống" = quản trị của một workspace.
Ký hiệu: X = Xem, S = Sửa (gồm thêm mới), Xo = Xóa, (cn) = chỉ dữ liệu của bản thân, (đv) = chỉ đơn vị/cấp dưới, – = không có quyền.

| Mô-đun | Quản trị hệ thống | HR | Quản lý trực tiếp | Nhân viên |
|---|---|---|---|---|
| 1 Chấm công | X S Xo | X S | X (đv) | X (cn), chấm công |
| 2 Đơn từ | X S Xo | X S | X (đv), duyệt | X S (cn) |
| 3 Tuyển dụng | X S Xo | X S Xo | X S (yêu cầu tuyển dụng, phỏng vấn) | – |
| 4 Đánh giá | X S Xo | X S | X S (phiếu được giao) | X (cn – đề xuất) |
| 5 Truyền thông | X S Xo | X S Xo | X | X |
| 6 Nhân viên | X S Xo | X S | X (đv) | X S (cn, qua tự khai/tự phục vụ) |
| 7 Đào tạo | X S Xo | X S Xo | X (đv) | X (cn) |
| 8 Quy trình | X S Xo | X S | duyệt bước được giao | – |
| 9 Báo cáo | X | X | X (đv) | – |
| 10 Trang chủ | X | X | X | X (cn) |
| 11 Phân quyền | X S Xo | – | – | – |
| 12 Cài đặt | X S Xo | X S (mẫu email) | – | – |
| 13 Bảo hiểm | X S Xo | X S | – | X (cn) |
| 14 Hợp đồng | X S Xo | X S | X (đv) | X (cn) |
| 15 Khen thưởng – kỷ luật | X S Xo | X S | X S (đề xuất phiếu, đv) | X (cn) |
| 16 Tính lương (quyền riêng) | X S Xo | chỉ C&B được gán: X S | – (đề xuất: X tổng đv) | X phiếu lương (cn) |
| 17 Tự động hoá | X S Xo | X S | – | – |
| 18 Đăng nhập (chính sách, nhật ký) | X S | X nhật ký | – | X phiên của mình |

## 0.6 Câu hỏi mở chung
- **Q-0.1** Workspace: dùng tên miền con riêng hay đường dẫn chung? Ai được tạo workspace mới (nhà cung cấp hay tự đăng ký)?
- **Q-0.2** Một người thuộc nhiều công ty có dùng chung một tài khoản đăng nhập cho tất cả workspace không?
- **Q-0.3** Trong một workspace có nhiều chi nhánh/cơ cấu nhiều cấp không?
- **Q-0.4** Có cần ứng dụng native (iOS/Android) hay chỉ web app?
- **Q-0.5** Ngôn ngữ giao diện: chỉ tiếng Việt hay cần thêm tiếng Anh?
- **Q-0.6** Có cần tích hợp với hệ thống bên ngoài (máy chấm công vân tay, kế toán, cổng BHXH, chữ ký số)?

---

# 1. Chấm công

## 1.1 Mục tiêu
Nhân viên chấm công vào/ra qua web app trên điện thoại. Hệ thống tự tổng hợp bảng công, liên kết với đơn từ và xuất báo cáo.

## 1.2 Tác nhân/vai trò
Nhân viên (chấm công, xem công của mình); Quản lý (xem công cấp dưới); HR/Admin (cài đặt hình thức và vị trí chấm công, quản lý bảng công, xuất file).

## 1.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Cổng chấm công trên web app, dùng trên điện thoại.
2. Hình thức chấm công: **GPS**, **hình ảnh**, **Wi-Fi**, hoặc **kết hợp** các hình thức.
3. Admin cài đặt **hình thức chấm công** và **vị trí** chấm công.
4. Bảng công hiển thị: **giờ vào/ra**, **vị trí**, **hình ảnh**, **thiết bị** chấm.
5. Tổng hợp: **ngày công**, **nghỉ phép**, **nghỉ lễ**, **đi muộn**.
6. **Liên kết với đơn từ**.
7. **Xuất Excel và PDF**.

**Đề xuất bổ sung**
- Cấu hình vị trí: tọa độ + bán kính cho phép; danh sách SSID/BSSID Wi-Fi hợp lệ; áp dụng theo chi nhánh, phòng ban hoặc cá nhân.
- Chấm công hình ảnh: chụp ảnh trực tiếp bằng camera (không cho chọn ảnh từ thư viện). Nhận diện khuôn mặt để ở giai đoạn sau.
- Ca làm việc và lịch làm việc (giờ vào/ra chuẩn, nghỉ giữa ca, ngày làm việc trong tuần); danh mục ngày lễ do admin khai báo.
- Hiển thị cho nhân viên biết vì sao chấm công bị từ chối (ngoài bán kính, sai Wi-Fi...).
- Chốt công theo kỳ (khóa bảng công sau khi chốt, chỉ sửa được qua đơn hoặc quyền đặc biệt).
- Bộ lọc bảng công theo kỳ, phòng ban, nhân viên, trạng thái (đi muộn, thiếu chấm công...).

## 1.4 Quy tắc nghiệp vụ
- BR-1.1 Một lượt chấm công hợp lệ khi thỏa **tất cả** các điều kiện của hình thức được cấu hình cho nhân viên đó (ví dụ chế độ kết hợp GPS + ảnh thì phải có cả hai).
- BR-1.2 Mỗi lượt chấm công lưu thời gian máy chủ (không dùng giờ thiết bị), tọa độ, ảnh, thông tin thiết bị/trình duyệt, IP/Wi-Fi.
- BR-1.3 Đi muộn/về sớm tính theo ca được gán. Ngưỡng cho phép (nếu có) do admin cấu hình *(đề xuất)*.
- BR-1.4 Đơn đã duyệt (nghỉ phép, sửa chấm công, công tác, làm từ xa, làm thêm, đổi ca, về sớm, đến muộn) tự cập nhật bảng công ngày tương ứng. Đơn bị từ chối/hủy thì hoàn tác.
- BR-1.5 Nhân viên không được tự sửa dữ liệu chấm công. Muốn sửa phải tạo đơn “Sửa chấm công”.

## 1.5 Dữ liệu chính
- `attendance_config`: phạm vi áp dụng, hình thức (GPS/ảnh/Wi-Fi/kết hợp), danh sách vị trí (tên, lat, lng, bán kính), danh sách Wi-Fi.
- `attendance_log`: employee_id, loại (vào/ra), thời gian, lat/lng, khoảng cách tới vị trí, ảnh, thiết bị, wifi, kết quả hợp lệ, lý do.
- `timesheet_day`: employee_id, ngày, ca, giờ vào, giờ ra, phút đi muộn, phút về sớm, công, loại nghỉ, đơn liên kết.
- `timesheet_period`: tổng ngày công, nghỉ phép, nghỉ lễ, số lần/phút đi muộn, trạng thái chốt.
- `shift`, `holiday` *(đề xuất)*.

## 1.6 Luồng
1. Nhân viên mở web app, chọn Chấm vào/Chấm ra.
2. Hệ thống lấy GPS / chụp ảnh / kiểm tra Wi-Fi theo cấu hình.
3. Kiểm tra hợp lệ, lưu log, báo kết quả.
4. Cuối ngày (hoặc theo thời gian thực), hệ thống tính `timesheet_day`; khi có đơn được duyệt thì tính lại.
5. HR xem, lọc bảng công, chốt kỳ, xuất Excel/PDF.

## 1.7 Liên kết mô-đun
2 Đơn từ (điều chỉnh công); 6 Nhân viên (ca, phòng ban); 10 Trang chủ (công tháng, đi muộn, về sớm); 9 Báo cáo; 11 Phân quyền.

## 1.8 Tiêu chí nghiệm thu
- AC-1.1 Chấm công thành công trên trình duyệt di động phổ biến (Android/iOS) với từng hình thức và chế độ kết hợp.
- AC-1.2 Chấm ngoài vị trí hoặc sai Wi-Fi bị từ chối và hiển thị đúng lý do.
- AC-1.3 Bảng công hiển thị đủ giờ vào/ra, vị trí, ảnh, thiết bị cho từng lượt.
- AC-1.4 Tổng hợp đúng ngày công, nghỉ phép, nghỉ lễ, đi muộn theo dữ liệu mẫu.
- AC-1.5 Duyệt một đơn nghỉ phép thì bảng công ngày đó cập nhật ngay.
- AC-1.6 Xuất Excel và PDF đúng bộ lọc đang chọn.

## 1.9 Câu hỏi mở
- Q-1.1 Quy tắc tính công (nửa công, công theo giờ), ngưỡng đi muộn được phép?
- Q-1.2 Có ca đêm/ca xoay không? Một ngày có chấm nhiều lần không?
- Q-1.3 Cách xử lý khi thiết bị mất GPS/mạng (có cho chấm offline rồi đồng bộ sau không)?
- Q-1.4 Có giới hạn một nhân viên chỉ chấm trên một thiết bị đã đăng ký không?
- Q-1.5 Có cần nhận diện khuôn mặt không?

---

# 2. Quản lý đơn từ

## 2.1 Mục tiêu
Số hoá các loại đơn, duyệt theo quy trình có SLA, tự cập nhật bảng công.

## 2.2 Tác nhân/vai trò
Người tạo đơn (nhân viên); người duyệt các bước (quản lý, HR...); Admin (bật/tắt mẫu đơn, cấu hình quy trình).

## 2.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Mẫu đơn **bật/tắt được**: nghỉ phép, đến muộn, làm từ xa, sửa chấm công, làm thêm giờ, công tác, đổi ca, về sớm, bù phép, chi phí đi lại.
2. **Quy trình duyệt** có **SLA** và **biểu mẫu riêng cho từng bước** (dùng mô-đun 8).
3. **Liên kết với bảng công**.
4. Xem đơn theo 3 góc: **Đơn của tôi / Chờ tôi duyệt / Tất cả**.

**Đề xuất bổ sung**
- Trường dữ liệu theo từng loại đơn, ví dụ: nghỉ phép (loại phép, từ–đến, nửa ngày, lý do, người bàn giao); sửa chấm công (ngày, giờ vào/ra đề nghị, lý do, minh chứng); làm thêm giờ (ngày, giờ bắt đầu–kết thúc); công tác (địa điểm, thời gian); đổi ca (ca cũ, ca mới, người đổi cùng); chi phí đi lại (khoản chi, số tiền, chứng từ đính kèm).
- Hiển thị số dư phép khi tạo đơn nghỉ phép/bù phép.
- Thông báo (email/in-app) khi có đơn chờ duyệt, sắp hoặc đã quá SLA, đơn được duyệt/từ chối.
- Thao tác: rút đơn (khi chưa duyệt xong), duyệt/từ chối kèm ý kiến, duyệt hàng loạt, ủy quyền duyệt.

## 2.4 Quy tắc nghiệp vụ
- BR-2.1 Mẫu đơn bị tắt thì không tạo mới được; đơn cũ vẫn xem được.
- BR-2.2 Mỗi bước duyệt có SLA. Quá SLA thì đánh dấu quá hạn và gửi nhắc; có tự chuyển cấp hay không thì cấu hình được *(đề xuất)*.
- BR-2.3 Chỉ đơn ở trạng thái “Đã duyệt” mới tác động lên bảng công.
- BR-2.4 “Tất cả” chỉ hiển thị trong phạm vi quyền của người xem (mô-đun 11).
- Trạng thái đơn *(đề xuất)*: Nháp → Chờ duyệt (bước n) → Đã duyệt / Từ chối / Đã rút / Đã hủy.

## 2.5 Dữ liệu chính
`request_type` (mã, tên, bật/tắt, quy trình gắn, trường động); `request` (người tạo, loại, dữ liệu form, trạng thái, bước hiện tại); `request_approval` (bước, người duyệt, kết quả, ý kiến, dữ liệu biểu mẫu bước, hạn SLA, thời điểm xử lý); file đính kèm.

## 2.6 Luồng
Nhân viên chọn loại đơn → điền form → gửi → quy trình định tuyến tới người duyệt bước 1 (kèm biểu mẫu bước) → … → duyệt cuối → cập nhật bảng công / số dư phép → thông báo người tạo.

## 2.7 Liên kết mô-đun
1 Chấm công; 8 Quy trình; 6 Nhân viên (quản lý trực tiếp, số dư phép); 10 Trang chủ; 12 Cài đặt (email).

## 2.8 Tiêu chí nghiệm thu
- AC-2.1 Tắt một mẫu đơn thì mẫu đó biến mất khỏi danh sách tạo đơn.
- AC-2.2 Đơn đi đúng các bước duyệt; mỗi bước hiển thị đúng biểu mẫu riêng.
- AC-2.3 Quá SLA thì đơn bị đánh dấu quá hạn và gửi nhắc.
- AC-2.4 Ba tab Đơn của tôi / Chờ tôi duyệt / Tất cả trả đúng dữ liệu theo quyền.
- AC-2.5 Đơn sửa chấm công được duyệt thì giờ vào/ra trên bảng công thay đổi tương ứng.

## 2.9 Câu hỏi mở
- Q-2.1 Quy tắc số dư phép (cộng dồn, chuyển năm, bù phép quy đổi thế nào)?
- Q-2.2 Đơn chi phí đi lại hoàn ứng qua lương (mô-đun 16) hay chi riêng qua kế toán?
- Q-2.3 Quá SLA thì tự duyệt, tự chuyển cấp, hay chỉ nhắc?
- Q-2.4 Có cho tạo đơn hộ nhân viên không?

---

# 3. Tuyển dụng

## 3.1 Mục tiêu
Quản lý toàn bộ vòng đời tuyển dụng, từ yêu cầu tuyển dụng tới khi ứng viên đậu trở thành nhân viên.

## 3.2 Tác nhân/vai trò
HR/Recruiter; Trưởng bộ phận (tạo yêu cầu tuyển dụng, phỏng vấn); Người phỏng vấn; Admin.

## 3.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Quản lý **JD** (mô tả công việc).
2. **Yêu cầu tuyển dụng**.
3. **Cơ sở dữ liệu ứng viên**.
4. **Trạng thái ứng viên**.
5. **Kết quả phỏng vấn**.
6. **Email tự động khi đổi trạng thái** ứng viên.
7. **Upload CV**.
8. **Chấm điểm** ứng viên.
9. **Bình luận** trên hồ sơ ứng viên.
10. Bổ sung: **lọc theo kỹ năng**; **lịch phỏng vấn chung**; **chuyển ứng viên đậu thành hồ sơ nhân viên**.

**Đề xuất bổ sung**
- Yêu cầu tuyển dụng đi qua quy trình duyệt (mô-đun 8): vị trí, số lượng, lý do, thời hạn, JD gắn kèm.
- Pipeline dạng Kanban; các trạng thái mặc định (cấu hình được): Mới → Sàng lọc → Phỏng vấn → Đề nghị (offer) → Đậu / Loại / Rút.
- Gắn thẻ kỹ năng cho ứng viên (nhập tay); có thể trích xuất tự động từ CV ở giai đoạn sau.
- Lịch phỏng vấn chung: xem dạng ngày/tuần, phát hiện trùng lịch người phỏng vấn, gửi lời mời qua email.
- Kiểm tra trùng ứng viên theo email/SĐT.

## 3.4 Quy tắc nghiệp vụ
- BR-3.1 Mỗi lần đổi trạng thái sẽ gửi email theo mẫu gắn với trạng thái đó (mẫu cấu hình ở mô-đun 12); có thể tắt gửi cho từng lần đổi *(đề xuất)*.
- BR-3.2 Chỉ ứng viên ở trạng thái “Đậu” mới chuyển thành nhân viên được. Khi chuyển, các trường trùng (họ tên, SĐT, email, CV, vị trí) được copy sang hồ sơ nhân viên và lưu liên kết ngược.
- BR-3.3 Điểm ứng viên lấy từ phiếu đánh giá (mô-đun 4) hoặc chấm trực tiếp; phải lưu người chấm.
- BR-3.4 Lịch sử trạng thái và bình luận không xóa được (chỉ ẩn) *(đề xuất)*.

## 3.5 Dữ liệu chính
`job_description`; `recruitment_request` (vị trí, số lượng, JD, trạng thái duyệt); `candidate` (họ tên, SĐT, email, kỹ năng, nguồn, CV, trạng thái, điểm); `application` (ứng viên × yêu cầu); `interview` (thời gian, địa điểm/link, người phỏng vấn, kết quả); `candidate_comment`; `candidate_status_history`.

## 3.6 Luồng
Trưởng bộ phận tạo yêu cầu tuyển dụng → duyệt → HR đăng JD, nhập/upload CV → sàng lọc, lọc theo kỹ năng → đặt lịch phỏng vấn → người phỏng vấn điền phiếu đánh giá → cập nhật trạng thái (tự gửi email) → Đậu → bấm “Chuyển thành nhân viên” → tạo hồ sơ nhân viên + checklist onboarding (mô-đun 6).

## 3.7 Liên kết mô-đun
4 Đánh giá; 6 Nhân viên; 8 Quy trình; 12 Cài đặt (mẫu email, SMTP); 9 Báo cáo tuyển dụng.

## 3.8 Tiêu chí nghiệm thu
- AC-3.1 Upload CV (PDF/DOC) và xem trực tiếp được.
- AC-3.2 Đổi trạng thái thì ứng viên nhận đúng email theo mẫu.
- AC-3.3 Lọc theo một hoặc nhiều kỹ năng trả đúng kết quả.
- AC-3.4 Lịch phỏng vấn chung hiển thị mọi buổi phỏng vấn và cảnh báo trùng lịch.
- AC-3.5 Ứng viên “Đậu” chuyển thành hồ sơ nhân viên mà không phải nhập lại thông tin.

## 3.9 Câu hỏi mở
- Q-3.1 Có cần trang tuyển dụng công khai/form ứng tuyển, hoặc kết nối các trang tuyển dụng bên ngoài không?
- Q-3.2 Danh sách trạng thái ứng viên chuẩn của công ty?
- Q-3.3 Có đồng bộ lịch phỏng vấn với Google/Outlook Calendar không?
- Q-3.4 Có cần tự đọc CV để trích kỹ năng không?

---

# 4. Đánh giá

## 4.1 Mục tiêu
Chuẩn hoá việc đánh giá bằng biểu mẫu tiêu chí. Phạm vi gốc là đánh giá phỏng vấn ứng viên.

## 4.2 Tác nhân/vai trò
HR/Admin (tạo biểu mẫu); Người đánh giá (người phỏng vấn); *(đề xuất)* quản lý và nhân viên khi mở rộng sang đánh giá định kỳ.

## 4.3 Chức năng chi tiết
**Yêu cầu gốc**
1. **Biểu mẫu tiêu chí đánh giá** (tạo, sửa, dùng lại).
2. **Phiếu đánh giá** có **liên kết với hồ sơ ứng viên** (đánh giá phỏng vấn).

**Đề xuất bổ sung (mở rộng, cần xác nhận)**
- Tiêu chí có tên, mô tả, thang điểm, trọng số; nhóm tiêu chí; ô nhận xét chung; kết luận (Đạt/Không đạt/Cân nhắc).
- Nhiều người cùng đánh giá một ứng viên; hệ thống tính điểm tổng hợp.
- **Mở rộng đánh giá nhân viên**: đánh giá thử việc (gắn với kết thúc hợp đồng thử việc), đánh giá định kỳ (kỳ đánh giá, tự đánh giá, quản lý đánh giá). Phiếu gắn với hồ sơ nhân viên (mô-đun 6).

## 4.4 Quy tắc nghiệp vụ
- BR-4.1 Biểu mẫu đã được dùng thì không sửa cấu trúc, chỉ tạo phiên bản mới *(đề xuất)*.
- BR-4.2 Phiếu đã nộp thì khóa; muốn sửa phải có quyền Sửa.
- BR-4.3 Điểm tổng = tổng (điểm × trọng số), nếu dùng trọng số *(đề xuất)*.

## 4.5 Dữ liệu chính
`evaluation_template` (tên, loại, phiên bản); `evaluation_criterion` (tên, mô tả, thang điểm, trọng số); `evaluation_form` (template, đối tượng = ứng viên/nhân viên, người đánh giá, trạng thái); `evaluation_answer`.

## 4.6 Luồng
HR tạo biểu mẫu → gắn với vòng phỏng vấn → người phỏng vấn mở phiếu từ lịch phỏng vấn/hồ sơ ứng viên → chấm và nộp → điểm hiển thị trong hồ sơ ứng viên.

## 4.7 Liên kết mô-đun
3 Tuyển dụng; 6 Nhân viên (mở rộng); 9 Báo cáo.

## 4.8 Tiêu chí nghiệm thu
- AC-4.1 Tạo được biểu mẫu nhiều tiêu chí.
- AC-4.2 Phiếu đánh giá hiển thị trong hồ sơ ứng viên đúng vòng phỏng vấn.
- AC-4.3 Phiếu đã nộp không sửa được nếu không có quyền.

## 4.9 Câu hỏi mở
- Q-4.1 Có triển khai đánh giá thử việc/định kỳ (KPI, 360°) trong bản đầu không?
- Q-4.2 Thang điểm chuẩn công ty dùng là gì?

---

# 5. Truyền thông nội bộ

## 5.1 Mục tiêu
Kênh đăng tin tức nội bộ, hiển thị ở trang chủ.

## 5.2 Tác nhân/vai trò
Người đăng bài (HR/Admin); Nhân viên (đọc).

## 5.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Tin tức gồm **tiêu đề, nội dung, hình ảnh**.
2. **Danh mục** tin.
3. **Đăng bài ở trang chủ**.
4. **CRUD đầy đủ** (thêm, xem, sửa, xóa) cho tin tức và danh mục.

**Đề xuất bổ sung**
- Trình soạn thảo rich text; ảnh đại diện; trạng thái Nháp/Đã đăng/Ẩn; hẹn giờ đăng; ghim bài lên đầu trang chủ.
- Giới hạn đối tượng xem theo phòng ban; email thông báo bài mới (tùy chọn).
- Thống kê lượt xem.

## 5.4 Quy tắc nghiệp vụ
- BR-5.1 Chỉ bài “Đã đăng” và được đánh dấu hiện trang chủ mới lên trang chủ.
- BR-5.2 Xóa danh mục đang có bài thì phải chuyển bài sang danh mục khác trước *(đề xuất)*.

## 5.5 Dữ liệu chính
`news_category` (tên, thứ tự); `news` (tiêu đề, nội dung, ảnh, danh mục, trạng thái, hiện trang chủ, ghim, người đăng, thời gian đăng).

## 5.6 Luồng
Soạn bài → chọn danh mục → đăng → hiển thị ở trang chủ và trang danh mục → sửa/xóa khi cần.

## 5.7 Liên kết mô-đun
10 Trang chủ; 11 Phân quyền; 12 Cài đặt (email thông báo – đề xuất).

## 5.8 Tiêu chí nghiệm thu
- AC-5.1 Thêm/sửa/xóa tin và danh mục hoạt động đúng.
- AC-5.2 Bài đăng có ảnh hiển thị tốt trên điện thoại.
- AC-5.3 Bài đánh dấu hiện trang chủ xuất hiện ở trang chủ nhân viên.

## 5.9 Câu hỏi mở
- Q-5.1 Có cho nhân viên bình luận/thả cảm xúc không?
- Q-5.2 Có cần giới hạn người xem theo phòng ban không?

---

# 6. Quản lý nhân viên – Trung tâm hồ sơ 360°

## 6.1 Mục tiêu
Một hồ sơ nhân viên duy nhất làm trung tâm dữ liệu cho toàn hệ thống, kèm các thủ tục vòng đời (onboarding, điều chuyển, bổ nhiệm, miễn nhiệm, nghỉ việc) được kiểm soát bằng checklist.

## 6.2 Tác nhân/vai trò
HR/Admin (quản lý hồ sơ, thủ tục); Quản lý (xem cấp dưới, thực hiện việc trong checklist được giao); Nhân viên (tự khai hồ sơ, cổng tự phục vụ).

## 6.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Hồ sơ 360° gồm: **thông tin cá nhân**, **vị trí** công việc, **BHXH**, **mã số thuế**, **sức khỏe**, **liên hệ khẩn cấp**, **tài sản cấp phát**, **hợp đồng**, **tài liệu upload**, **thưởng phạt**, **lương**, **quá trình công tác**.
2. **Checklist onboarding** kèm **gửi mail**.
3. Thủ tục **điều chuyển / bổ nhiệm / miễn nhiệm / nghỉ việc**: **phải hoàn thành checklist thì mới đổi được trạng thái nhân viên**.
4. Nút **gửi link tự khai** để nhân viên tự điền hồ sơ.
5. **Nhật ký thay đổi (audit log)**.
6. **Cảnh báo hết hạn** (hợp đồng, giấy tờ...).
7. **Cổng tự phục vụ** cho nhân viên.

**Đề xuất bổ sung**
- Bố cục hồ sơ dạng tab: Tổng quan | Cá nhân | Công việc | Hợp đồng | Bảo hiểm & thuế | Lương | Tài sản | Tài liệu | Đào tạo | Khen thưởng – kỷ luật | Đánh giá | Quá trình công tác | Lịch sử thay đổi.
- Thông tin cá nhân: mã NV, họ tên, ngày sinh, giới tính, CCCD (số, ngày cấp, nơi cấp, ngày hết hạn), địa chỉ thường trú/tạm trú, SĐT, email (dùng để đăng nhập), tài khoản ngân hàng, học vấn.
- Vị trí: phòng ban, chức danh, cấp bậc, quản lý trực tiếp, nơi làm việc, ngày vào làm, loại nhân sự, trạng thái.
- Tài sản cấp phát: tên, mã, ngày cấp, tình trạng, ngày thu hồi. Thu hồi tài sản là một mục trong checklist nghỉ việc.
- Mẫu checklist cấu hình được cho từng loại thủ tục: mỗi mục có người phụ trách, hạn, có bắt buộc hay không, gửi email khi giao việc.
- Link tự khai: link có hạn dùng, gửi qua email/SĐT; dữ liệu nhân viên khai xong chuyển cho HR duyệt rồi mới ghi vào hồ sơ.
- Cổng tự phục vụ: xem hồ sơ, hợp đồng, bảo hiểm, công, phép, khen thưởng – kỷ luật của mình; yêu cầu cập nhật thông tin (qua HR duyệt); tải tài liệu cá nhân.
- Cảnh báo (thực thi qua mô-đun 17 Tự động hoá): cấu hình số ngày báo trước cho từng loại; hiển thị trên dashboard HR và gửi email.
- Nhập/xuất danh sách nhân viên bằng Excel.

## 6.4 Quy tắc nghiệp vụ
- BR-6.1 Trạng thái nhân viên *(đề xuất)*: Đang onboarding → Thử việc → Chính thức → (Tạm nghỉ) → Đã nghỉ việc. Đổi trạng thái hoặc đổi vị trí do điều chuyển/bổ nhiệm/miễn nhiệm **chỉ thực hiện được khi mọi mục bắt buộc trong checklist của thủ tục đã hoàn thành** (yêu cầu gốc).
- BR-6.2 Mọi thay đổi trên hồ sơ được ghi audit log: ai, khi nào, trường nào, giá trị cũ, giá trị mới. Không ai được xóa audit log.
- BR-6.3 SĐT và email trong hồ sơ là định danh đăng nhập, phải duy nhất trong hệ thống.
- BR-6.4 Nhân viên đã nghỉ việc không đăng nhập được nữa; hồ sơ vẫn được lưu.
- BR-6.5 Quá trình công tác được tự ghi khi thủ tục điều chuyển/bổ nhiệm/miễn nhiệm hoàn tất.
- BR-6.6 Dữ liệu sức khỏe, lương, CCCD là dữ liệu nhạy cảm, cần quyền riêng mới xem được *(đề xuất)*.

## 6.5 Dữ liệu chính
`employee`; `employee_position_history`; `employee_emergency_contact`; `employee_health`; `employee_tax_insurance` (MST, số sổ BHXH...); `employee_asset`; `employee_document` (loại, file, ngày hết hạn); `employee_salary` (lương, phụ cấp, ngày hiệu lực); `hr_procedure` (loại: onboarding/điều chuyển/bổ nhiệm/miễn nhiệm/nghỉ việc, trạng thái); `checklist_template`, `checklist_item`; `self_declare_link` (token, hạn, trạng thái); `audit_log`; `expiry_alert`.

## 6.6 Luồng
- **Onboarding**: tạo hồ sơ (thủ công / từ ứng viên đậu / import) → sinh checklist onboarding → gửi mail giao việc cho người phụ trách và mail chào mừng → gửi link tự khai → HR duyệt dữ liệu → hoàn thành checklist → chuyển trạng thái.
- **Điều chuyển/bổ nhiệm/miễn nhiệm/nghỉ việc**: HR tạo thủ tục (có thể đi qua duyệt ở mô-đun 8) → checklist → hoàn thành hết mục bắt buộc → hệ thống cho phép xác nhận → cập nhật vị trí/trạng thái, ghi quá trình công tác, audit log.

## 6.7 Liên kết mô-đun
3 (tạo hồ sơ từ ứng viên); 7, 13, 14, 15 (hiển thị trong hồ sơ 360°); 8 (duyệt thủ tục); 11–12 (đăng nhập, quyền, email); 1–2 (ca, quản lý trực tiếp); 9–10.

## 6.8 Tiêu chí nghiệm thu
- AC-6.1 Hồ sơ hiển thị đủ các nhóm thông tin của yêu cầu gốc.
- AC-6.2 Khi checklist còn mục bắt buộc chưa xong thì không đổi được trạng thái (nút bị khóa, có thông báo lý do).
- AC-6.3 Gửi link tự khai: nhân viên điền được trên điện thoại, HR duyệt xong thì dữ liệu vào hồ sơ.
- AC-6.4 Mỗi thay đổi đều có dòng audit log đúng giá trị cũ/mới.
- AC-6.5 Hợp đồng hoặc giấy tờ sắp hết hạn hiện cảnh báo và gửi email theo cấu hình.
- AC-6.6 Nhân viên đăng nhập cổng tự phục vụ chỉ thấy dữ liệu của mình.

## 6.9 Câu hỏi mở
- Q-6.1 Danh sách mục checklist chuẩn cho từng thủ tục?
- Q-6.2 Thủ tục điều chuyển/nghỉ việc có cần duyệt nhiều cấp không?
- Q-6.3 Nhân viên được tự sửa trực tiếp những trường nào, trường nào phải HR duyệt?
- Q-6.4 Cảnh báo hết hạn cho những loại giấy tờ nào, báo trước bao nhiêu ngày?
- Q-6.5 Mục “lương” trong hồ sơ lưu những gì (lương hợp đồng, phụ cấp, lịch sử điều chỉnh)? Đây là dữ liệu đầu vào cho mô-đun 16.

---

# 7. Đào tạo

## 7.1 Mục tiêu
Quản lý khóa học và chứng chỉ của nhân viên.

## 7.2 Tác nhân/vai trò
HR/Phụ trách đào tạo; Quản lý (xem cấp dưới); Nhân viên (xem của mình).

## 7.3 Chức năng chi tiết
**Yêu cầu gốc**: quản lý **khóa học**; quản lý **chứng chỉ**; **bộ lọc**; **tải danh sách** (xuất file).
**Đề xuất bổ sung**: khóa học (tên, hình thức, đơn vị đào tạo, thời gian, chi phí, học viên, kết quả); chứng chỉ (tên, nơi cấp, ngày cấp, ngày hết hạn, file) có cảnh báo hết hạn qua mô-đun 6; lọc theo phòng ban, khóa, thời gian, trạng thái; xuất Excel.

## 7.4 Quy tắc nghiệp vụ
- BR-7.1 Kết quả khóa học và chứng chỉ hiển thị trong hồ sơ 360° của nhân viên.
- BR-7.2 Danh sách tải về theo đúng bộ lọc đang áp dụng.

## 7.5 Dữ liệu chính
`course`, `course_participant` (nhân viên, trạng thái, kết quả), `certificate`.

## 7.6 Luồng
Tạo khóa → thêm học viên → cập nhật kết quả → cấp/ghi nhận chứng chỉ → lọc, tải danh sách.

## 7.7 Liên kết mô-đun
6; 9; 12 (email mời học – đề xuất).

## 7.8 Tiêu chí nghiệm thu
Tạo được khóa học và chứng chỉ; bộ lọc chạy đúng; file tải về khớp với danh sách đang lọc.

## 7.9 Câu hỏi mở
- Q-7.1 Có cần đăng ký học/duyệt tham gia, cam kết đào tạo (bồi hoàn chi phí) không?
- Q-7.2 Có cần học online (bài giảng, bài kiểm tra) không?

---

# 8. Quy trình

## 8.1 Mục tiêu
Bộ máy quy trình dùng chung: định nghĩa bước duyệt, SLA, biểu mẫu, tạo việc và in.

## 8.2 Tác nhân/vai trò
Admin/HR (thiết kế quy trình); người xử lý từng bước; người khởi tạo.

## 8.3 Chức năng chi tiết
**Yêu cầu gốc**: **bước duyệt**; **SLA**; **biểu mẫu**; **tạo việc**; **in**.
**Đề xuất bổ sung**
- Người duyệt mỗi bước xác định theo: người cụ thể, chức danh, quản lý trực tiếp của người tạo, trưởng phòng ban.
- Biểu mẫu kéo thả với các loại trường: văn bản, số, ngày, chọn, file.
- Rẽ nhánh theo điều kiện (ví dụ số ngày nghỉ vượt ngưỡng thì thêm một bước) – giai đoạn sau.
- “Tạo việc”: giao nhiệm vụ trong một bước, có người làm, hạn và trạng thái.
- “In”: xuất phiếu/đơn đã duyệt ra PDF theo mẫu in.

## 8.4 Quy tắc nghiệp vụ
- BR-8.1 SLA tính từ lúc đơn đến bước đó. Có tính theo giờ làm việc hay không thì cần chốt (Q-8.1).
- BR-8.2 Sửa quy trình chỉ áp dụng cho đơn tạo mới; đơn đang chạy giữ phiên bản cũ *(đề xuất)*.

## 8.5 Dữ liệu chính
`workflow` (phiên bản), `workflow_step` (thứ tự, người duyệt, SLA, form), `workflow_instance`, `workflow_task`, `print_template`.

## 8.6 Luồng
Thiết kế quy trình → gắn vào mẫu đơn/thủ tục → chạy từng bước → hoàn tất → in.

## 8.7 Liên kết mô-đun
2, 3, 6, 12.

## 8.8 Tiêu chí nghiệm thu
Tạo được quy trình nhiều bước có SLA và biểu mẫu riêng từng bước; tạo được việc; in được PDF.

## 8.9 Câu hỏi mở
- Q-8.1 SLA tính theo giờ hành chính hay giờ tự nhiên?
- Q-8.2 Có cần duyệt song song hoặc duyệt có điều kiện không?
- Q-8.3 Mẫu in có cần chữ ký/con dấu không?

---

# 9. Báo cáo nhân sự

## 9.1 Mục tiêu
Cung cấp số liệu tổng hợp để ra quyết định.

## 9.2 Tác nhân/vai trò
Ban lãnh đạo, HR, Quản lý (trong phạm vi đơn vị của mình).

## 9.3 Chức năng chi tiết
**Yêu cầu gốc**: báo cáo **theo hợp đồng**, **onboarding**, **offboarding**, **theo thời gian**; báo cáo **tuyển dụng**, **tổng quan**, **hợp đồng**, **quỹ lương**.
**Đề xuất bổ sung**: dashboard có biểu đồ; lọc theo kỳ, phòng ban, chi nhánh; xuất Excel/PDF. Gợi ý chỉ số: tổng nhân sự, số vào/ra trong kỳ, tỷ lệ nghỉ việc, cơ cấu theo loại hợp đồng/phòng ban, hợp đồng sắp hết hạn, số ứng viên theo trạng thái/nguồn, thời gian tuyển, quỹ lương theo phòng ban.

## 9.4 Quy tắc nghiệp vụ
- BR-9.1 Báo cáo chỉ hiển thị dữ liệu trong phạm vi quyền của người xem.
- BR-9.2 Báo cáo quỹ lương lấy từ bảng lương đã khóa ở mô-đun 16 Tính lương và cần quyền lương riêng.

## 9.5 Dữ liệu chính
Đọc từ các mô-đun 1, 3, 6, 13, 14, 16. Có thể dùng bảng snapshot theo kỳ *(đề xuất)*.

## 9.6 Luồng
Chọn báo cáo → chọn bộ lọc → xem → xuất file.

## 9.7 Liên kết mô-đun
Gần như toàn bộ hệ thống.

## 9.8 Tiêu chí nghiệm thu
Số liệu trên mỗi báo cáo khớp với dữ liệu gốc trên bộ dữ liệu kiểm thử; xuất được file.

## 9.9 Câu hỏi mở
- Q-9.1 Danh sách chỉ số và mẫu báo cáo cụ thể anh muốn?
- Q-9.2 Báo cáo quỹ lương cần chia theo những chiều nào (phòng ban, thành phần lương, so sánh giữa các kỳ)?

---

# 10. Trang chủ nhân viên

## 10.1 Mục tiêu
Màn hình đầu tiên sau đăng nhập, cho nhân viên nắm nhanh tình hình của mình.

## 10.2 Tác nhân/vai trò
Mọi nhân viên.

## 10.3 Chức năng chi tiết
**Yêu cầu gốc**: **lời chào**; **công tháng**; **nghỉ**; **đi muộn**; **về sớm**; **đơn từ**; **thâm niên**.
**Đề xuất bổ sung**: nút chấm công nhanh; tin tức trang chủ (mô-đun 5); số đơn chờ tôi duyệt (với quản lý); sinh nhật/kỷ niệm ngày vào làm; phép còn lại.

## 10.4 Quy tắc nghiệp vụ
- BR-10.1 Thâm niên tính từ ngày vào làm trong hồ sơ. Có cộng dồn các lần làm việc trước không thì cần chốt.
- BR-10.2 Số liệu công tháng, nghỉ, đi muộn, về sớm lấy từ bảng công của tháng hiện tại.

## 10.5 Dữ liệu chính
Chỉ đọc từ các mô-đun 1, 2, 5, 6.

## 10.6 Luồng
Đăng nhập → trang chủ → bấm vào từng thẻ để mở chi tiết.

## 10.7 Liên kết mô-đun
1, 2, 5, 6.

## 10.8 Tiêu chí nghiệm thu
Các chỉ số khớp với bảng công và đơn từ; hiển thị tốt trên điện thoại.

## 10.9 Câu hỏi mở
- Q-10.1 Có trang chủ riêng cho quản lý/HR không?

---

# 11. Phân quyền

## 11.1 Mục tiêu
Kiểm soát ai được làm gì trên từng mô-đun.

## 11.2 Tác nhân/vai trò
Quản trị hệ thống.

## 11.3 Chức năng chi tiết
**Yêu cầu gốc**: tạo **loại quyền** (vai trò); **tích chọn theo từng mô-đun** các quyền **xem / sửa / xóa**.
**Đề xuất bổ sung**: thêm quyền **Duyệt** và **Xuất file**; phạm vi dữ liệu (cá nhân / đơn vị / toàn công ty); một nhân viên có thể có nhiều vai trò; quyền riêng cho trường nhạy cảm (lương, sức khỏe). Ma trận mặc định xem mục 0.5.

## 11.4 Quy tắc nghiệp vụ
- BR-11.1 Quyền được gán **trực tiếp cho nhân viên** (không có user riêng – xem mô-đun 12).
- BR-11.2 Nếu một người có nhiều vai trò thì được hợp quyền của các vai trò đó *(đề xuất)*.
- BR-11.3 Mọi thay đổi phân quyền đều ghi audit log.
- BR-11.4 Kiểm tra quyền ở cả backend (API), không chỉ ẩn nút ở giao diện.

## 11.5 Dữ liệu chính
`role`, `role_permission` (role, module, xem, sửa, xóa, [duyệt, xuất], phạm vi), `employee_role`.

## 11.6 Luồng
Tạo loại quyền → tích quyền theo mô-đun → gán cho nhân viên (tại Cài đặt hoặc hồ sơ nhân viên).

## 11.7 Liên kết mô-đun
Tất cả mô-đun; 12.

## 11.8 Tiêu chí nghiệm thu
Bỏ quyền Xem một mô-đun thì người dùng không thấy menu và gọi API cũng bị chặn (403); quyền Sửa/Xóa hoạt động tương tự.

## 11.9 Câu hỏi mở
- Q-11.1 Có cần phân quyền theo phạm vi dữ liệu (phòng ban/chi nhánh) không?
- Q-11.2 Có cần phân quyền đến từng trường dữ liệu không?

---

# 12. Cài đặt

## 12.1 Mục tiêu
Cấu hình hệ thống: đăng nhập, gán quyền, email.

## 12.2 Tác nhân/vai trò
Quản trị hệ thống; HR (mẫu email).

## 12.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Nhân viên **đăng nhập bằng SĐT hoặc email có trong hồ sơ** nhân viên (màn hình và bảo mật đặc tả ở mô-đun 18).
2. **Gán quyền cho nhân viên**.
3. **Mẫu email**.
4. **Luồng email tự động** (cấu hình và thực thi tại mô-đun 17 Tự động hoá).
5. **Cấu hình SMTP**.
6. **Không có mô-đun quản lý user riêng**.

**Đề xuất bổ sung**
- (Chi tiết ở mô-đun 18) Phương thức xác thực: OTP qua email/SMS hoặc mật khẩu (đặt lần đầu qua link). Có quên mật khẩu, khóa tài khoản khi nhập sai nhiều lần.
- Mẫu email có biến động (ví dụ `{{ho_ten}}`, `{{vi_tri}}`, `{{lich_phong_van}}`), xem trước, gửi thử.
- Luồng email tự động (quản lý tại mô-đun 17) = sự kiện → điều kiện → mẫu → người nhận. Gợi ý sự kiện: đổi trạng thái ứng viên, có đơn chờ duyệt, quá SLA, onboarding, giao việc trong checklist, sắp hết hạn hợp đồng/giấy tờ, gửi link tự khai.
- SMTP: host, port, mã hoá, tài khoản, tên/địa chỉ người gửi, nút gửi thử. Mật khẩu SMTP được mã hoá khi lưu.
- Nhật ký gửi email (thành công/thất bại, có gửi lại).
- Cấu hình chung khác: thông tin công ty, phòng ban, chức danh, ca làm, ngày lễ, loại phép.

## 12.4 Quy tắc nghiệp vụ
- BR-12.1 Chỉ nhân viên có hồ sơ và trạng thái còn hiệu lực mới đăng nhập được.
- BR-12.2 Sửa SĐT/email trong hồ sơ thì thông tin đăng nhập đổi theo.
- BR-12.3 Email tự động gửi lỗi thì ghi log và thử lại *(đề xuất)*.

## 12.5 Dữ liệu chính
`smtp_config`, `email_template`, `email_automation` (sự kiện, điều kiện, mẫu, người nhận, bật/tắt), `email_log`, `auth_credential/otp` (gắn employee_id).

## 12.6 Luồng
Cấu hình SMTP → gửi thử → tạo mẫu → tạo luồng tự động → khi sự kiện xảy ra thì hệ thống gửi email và ghi log.

## 12.7 Liên kết mô-đun
3, 6, 8, 11 và các mô-đun phát sinh sự kiện.

## 12.8 Tiêu chí nghiệm thu
Đăng nhập được bằng SĐT và bằng email trong hồ sơ; gửi thử SMTP thành công; đổi trạng thái ứng viên thì email tự động được gửi đúng mẫu; không có màn hình quản lý user riêng.

## 12.9 Câu hỏi mở
- Q-12.1 (Chuyển sang Q-18.1.)
- Q-12.2 Ngoài email, có cần thông báo qua Zalo/app hoặc thông báo trong hệ thống không?

---

# 13. Bảo hiểm

## 13.1 Mục tiêu
Quản lý danh sách nhân viên tham gia bảo hiểm và mức đóng.

## 13.2 Tác nhân/vai trò
HR/C&B; Nhân viên (xem của mình).

## 13.3 Chức năng chi tiết
**Yêu cầu gốc**: **danh sách người đóng**; **mức đóng**; **tỷ lệ**; dữ liệu **lấy từ hồ sơ nhân viên**.
**Đề xuất bổ sung**: tách tỷ lệ phần doanh nghiệp đóng và phần người lao động đóng theo từng loại bảo hiểm (do admin cấu hình, không cài sẵn số liệu); lịch sử thay đổi mức đóng; báo tăng/giảm theo tháng; xuất Excel.

## 13.4 Quy tắc nghiệp vụ
- BR-13.1 Số sổ BHXH và các thông tin định danh lấy từ hồ sơ nhân viên, không nhập lại.
- BR-13.2 Số tiền đóng = mức đóng × tỷ lệ cấu hình. Tỷ lệ có ngày hiệu lực.

## 13.5 Dữ liệu chính
`insurance_rate` (loại, tỷ lệ DN, tỷ lệ NLĐ, ngày hiệu lực); `employee_insurance` (nhân viên, mức đóng, ngày bắt đầu/kết thúc, trạng thái).

## 13.6 Luồng
Cấu hình tỷ lệ → nhân viên đủ điều kiện được thêm vào danh sách (từ hồ sơ) → cập nhật mức đóng → xuất danh sách.

## 13.7 Liên kết mô-đun
6, 14 (loại hợp đồng), 9, 16 (khấu trừ BH khi tính lương).

## 13.8 Tiêu chí nghiệm thu
Danh sách người đóng khớp với hồ sơ; số tiền tính đúng theo tỷ lệ đang cấu hình.

## 13.9 Câu hỏi mở
- Q-13.1 Mức đóng lấy từ trường lương nào?
- Q-13.2 Có cần xuất theo mẫu của cơ quan BHXH không?

---

# 14. Hợp đồng

## 14.1 Mục tiêu
Quản lý hợp đồng lao động của nhân viên.

## 14.2 Tác nhân/vai trò
HR; Quản lý (xem cấp dưới); Nhân viên (xem của mình).

## 14.3 Chức năng chi tiết
**Yêu cầu gốc**: **loại hợp đồng**; **hình thức**; **ngày ký**; **ngày hết hạn**; **xem và sửa**.
**Đề xuất bổ sung**: số hợp đồng, file scan, phụ lục, hợp đồng nối tiếp; cảnh báo sắp hết hạn (mô-đun 6); sinh hợp đồng từ mẫu Word có biến – giai đoạn sau.

## 14.4 Quy tắc nghiệp vụ
- BR-14.1 Mỗi nhân viên có lịch sử nhiều hợp đồng; tại một thời điểm chỉ có một hợp đồng hiệu lực *(đề xuất)*.
- BR-14.2 Loại hợp đồng không xác định thời hạn thì không có ngày hết hạn.
- BR-14.3 Mọi lần sửa đều ghi audit log.

## 14.5 Dữ liệu chính
`contract_type`, `contract` (nhân viên, số, loại, hình thức, ngày ký, ngày hiệu lực, ngày hết hạn, file, trạng thái).

## 14.6 Luồng
Tạo hợp đồng → hiển thị trong hồ sơ → cảnh báo trước khi hết hạn → gia hạn hoặc ký hợp đồng mới.

## 14.7 Liên kết mô-đun
6, 9, 13, 4 (đánh giá thử việc – đề xuất).

## 14.8 Tiêu chí nghiệm thu
Thêm/xem/sửa hợp đồng được; hợp đồng hiển thị trong hồ sơ 360°; báo cáo hợp đồng lấy đúng dữ liệu.

## 14.9 Câu hỏi mở
- Q-14.1 Danh mục loại và hình thức hợp đồng của công ty?
- Q-14.2 Có cần quyền xóa hợp đồng không (yêu cầu gốc chỉ có xem và sửa)?

---

# 15. Khen thưởng – kỷ luật

## 15.1 Mục tiêu
Ghi nhận khen thưởng và kỷ luật, gắn vào hồ sơ nhân viên.

## 15.2 Tác nhân/vai trò
HR; Quản lý (đề xuất phiếu); Nhân viên (xem của mình).

## 15.3 Chức năng chi tiết
**Yêu cầu gốc**: **phiếu khen thưởng/kỷ luật** **liên kết với hồ sơ nhân viên**.
**Đề xuất bổ sung**: phiếu gồm loại, hình thức, lý do, ngày quyết định, số quyết định, giá trị (nếu có), file đính kèm; phiếu đi qua duyệt (mô-đun 8); có thể áp dụng một phiếu cho nhiều nhân viên.

## 15.4 Quy tắc nghiệp vụ
- BR-15.1 Phiếu đã duyệt hiển thị ở tab “Khen thưởng – kỷ luật” (mục “thưởng phạt”) trong hồ sơ.
- BR-15.2 Muốn sửa hoặc hủy phiếu đã duyệt phải có quyền và để lại audit log.

## 15.5 Dữ liệu chính
`reward_discipline` (loại, hình thức, nhân viên, lý do, ngày, số quyết định, giá trị, file, trạng thái).

## 15.6 Luồng
Tạo phiếu → (duyệt) → gắn vào hồ sơ → báo cáo.

## 15.7 Liên kết mô-đun
6, 8, 9, 16.

## 15.8 Tiêu chí nghiệm thu
Tạo phiếu xong thì phiếu xuất hiện đúng trong hồ sơ nhân viên; lọc và xuất được danh sách.

## 15.9 Câu hỏi mở
- Q-15.1 Khoản thưởng/phạt bằng tiền có tự động đưa vào kỳ lương (mô-đun 16) không, hay C&B phải chọn tay?
- Q-15.2 Phiếu có cần quy trình duyệt không?

---

---

# 16. Tính lương

## 16.1 Mục tiêu
Tính lương theo kỳ dựa trên dữ liệu đã có trong hệ thống (công, đơn từ, khen thưởng – kỷ luật, bảo hiểm, hồ sơ lương), rồi phát hành bảng lương và phiếu lương bảo mật.

## 16.2 Tác nhân/vai trò
C&B/Kế toán lương (lập và tính lương); Người duyệt bảng lương (lãnh đạo); Nhân viên (xem phiếu lương của mình); Admin (cấu hình). Quyền mô-đun này là quyền riêng, tách khỏi quyền HR thông thường.

## 16.3 Chức năng chi tiết
**Yêu cầu gốc**: anh Hiệu yêu cầu tách **Tính lương** thành mô-đun riêng (ban đầu thuộc danh sách 10 nhóm chức năng).

**Đề xuất bổ sung**
1. **Kỳ lương**: tạo kỳ (tháng hoặc kỳ tùy chọn), ngày bắt đầu/kết thúc, ngày chi trả.
2. **Cấu trúc lương**: định nghĩa các thành phần (lương cơ bản, lương theo công, các khoản phụ cấp, thưởng, khấu trừ). Mỗi thành phần có loại (cộng/trừ), cách tính (cố định, theo công, theo giờ, công thức), có tính thuế hay không, có tính bảo hiểm hay không.
3. **Phụ cấp/khấu trừ**: gán theo nhân viên, chức danh hoặc phòng ban, có ngày hiệu lực.
4. **Nguồn dữ liệu tự động**:
   - Bảng công (mô-đun 1): ngày công, nghỉ phép, nghỉ lễ, đi muộn.
   - Đơn từ đã duyệt (mô-đun 2): làm thêm giờ (OT), nghỉ có/không lương, chi phí đi lại.
   - Khen thưởng – kỷ luật (mô-đun 15): khoản tiền đã duyệt.
   - Bảo hiểm (mô-đun 13): phần người lao động đóng.
   - Hồ sơ lương (mô-đun 6): lương hợp đồng, phụ cấp, người phụ thuộc, MST.
5. **Thuế TNCN**: tính theo biểu thuế và mức giảm trừ do admin cấu hình (hệ thống không cài sẵn số liệu); khai báo người phụ thuộc.
6. **Bảng lương**: xem, lọc, sửa tay có ghi lý do, tính lại.
7. **Phiếu lương**: mỗi nhân viên một phiếu, xem trên cổng tự phục vụ hoặc nhận qua email (luồng ở mô-đun 17).
8. **Chốt/khóa kỳ**: sau khi duyệt thì khóa, không sửa được nữa; muốn điều chỉnh phải mở khóa có quyền hoặc truy thu/truy lĩnh ở kỳ sau.
9. **Xuất Excel/PDF**: bảng lương, phiếu lương, danh sách chuyển khoản.
10. **Bảo mật**: quyền riêng; nhân viên chỉ xem được phiếu của mình; ghi audit log mọi thao tác.

## 16.4 Quy tắc nghiệp vụ
- BR-16.1 Chỉ tính lương khi bảng công của kỳ đã chốt (mô-đun 1).
- BR-16.2 Chỉ đơn từ và phiếu khen thưởng – kỷ luật **đã duyệt** mới được đưa vào lương.
- BR-16.3 Mọi tỷ lệ, biểu thuế, mức giảm trừ, hệ số OT đều do admin cấu hình, có ngày hiệu lực; hệ thống không cài sẵn giá trị.
- BR-16.4 Trạng thái bảng lương: Nháp → Đã tính → Chờ duyệt → Đã duyệt/Khóa → Đã chi trả.
- BR-16.5 Kỳ đã khóa thì không sửa được. Mở khóa phải có quyền đặc biệt và ghi audit log.
- BR-16.6 Thông tin lương không hiện trong báo cáo hay màn hình của người không có quyền lương.

## 16.5 Dữ liệu chính
`payroll_period`; `salary_component` (mã, tên, loại, cách tính/công thức, chịu thuế, tính BH); `employee_salary_component` (nhân viên, thành phần, giá trị, hiệu lực); `tax_config` (biểu thuế, giảm trừ, hiệu lực); `dependent`; `payroll` (kỳ, trạng thái); `payroll_line` (nhân viên, giá trị từng thành phần, tổng thu nhập, BH, thuế, thực lĩnh); `payslip`.

## 16.6 Luồng xử lý
Tạo kỳ → chốt công → hệ thống kéo dữ liệu (công, OT, nghỉ, thưởng phạt, BH) → tính → C&B rà soát, điều chỉnh → trình duyệt (mô-đun 8) → khóa → phát phiếu lương (email/cổng tự phục vụ) → xuất file chuyển khoản → báo cáo quỹ lương (mô-đun 9).

## 16.7 Liên kết mô-đun
1, 2, 6, 8, 9, 11, 13, 15, 17.

## 16.8 Tiêu chí nghiệm thu
- AC-16.1 Với bộ dữ liệu mẫu, lương tính ra khớp với bảng tính tay của C&B.
- AC-16.2 Duyệt thêm một đơn OT rồi tính lại thì khoản OT thay đổi đúng.
- AC-16.3 Kỳ đã khóa không sửa được.
- AC-16.4 Nhân viên chỉ xem được phiếu lương của mình; người không có quyền lương không thấy dữ liệu lương.
- AC-16.5 Xuất được bảng lương và phiếu lương ra Excel/PDF.

## 16.9 Câu hỏi mở
- Q-16.1 Danh sách thành phần lương, phụ cấp, khấu trừ chuẩn của công ty?
- Q-16.2 Cách tính OT (hệ số theo ngày thường/nghỉ/lễ) – anh cung cấp quy định nội bộ?
- Q-16.3 Có nhiều kỳ lương hoặc nhiều cách trả lương (theo giờ, khoán, doanh số) không?
- Q-16.4 Có cần xuất file chuyển khoản theo mẫu của ngân hàng cụ thể, hoặc kết nối phần mềm kế toán không?
- Q-16.5 Phiếu lương gửi qua email có cần đặt mật khẩu không?

---

# 17. Tự động hoá

## 17.1 Mục tiêu
Một bộ máy quy tắc **“khi… thì…”** dùng chung cho toàn hệ thống, gom tất cả email tự động, cảnh báo và tác vụ định kỳ về một chỗ.

## 17.2 Tác nhân/vai trò
Admin/HR (tạo và quản lý quy tắc); hệ thống (thực thi); người nhận (nhân viên, quản lý, ứng viên).

## 17.3 Chức năng chi tiết
**Yêu cầu gốc**: anh Hiệu yêu cầu tách **Tự động hoá** thành mô-đun riêng. Các yêu cầu tự động đã có ở chỗ khác được gom về đây: email tự động khi đổi trạng thái ứng viên (mô-đun 3), luồng email tự động (mô-đun 12), cảnh báo hết hạn (mô-đun 6), gửi mail checklist onboarding (mô-đun 6).

**Đề xuất bổ sung**
1. **Quy tắc** gồm: tên, mô tả, workspace, trạng thái bật/tắt.
2. **Trigger**:
   - Theo sự kiện: tạo/đổi trạng thái ứng viên, đơn từ được gửi/duyệt/từ chối, quá SLA, tạo nhân viên, hoàn thành checklist, đổi trạng thái nhân viên, khóa kỳ lương, đăng tin mới...
   - Theo lịch: hằng ngày/tuần/tháng hoặc trước/sau một ngày mốc (ngày hết hạn hợp đồng, giấy tờ, chứng chỉ; sinh nhật; ngày kết thúc thử việc).
3. **Điều kiện**: lọc theo trường dữ liệu (phòng ban, loại hợp đồng, trạng thái, số ngày còn lại...), kết hợp AND/OR.
4. **Hành động**: gửi email (theo mẫu ở mô-đun 12), gửi thông báo trong hệ thống, tạo việc (mô-đun 8), đổi trạng thái bản ghi (khi được phép), gắn checklist. Một quy tắc có thể có nhiều hành động.
5. **Nhật ký chạy**: thời điểm, quy tắc, bản ghi liên quan, kết quả, lỗi; có nút chạy lại.
6. **Bộ quy tắc mẫu** cài sẵn (tắt mặc định): email đổi trạng thái ứng viên, nhắc đơn chờ duyệt/quá SLA, cảnh báo hợp đồng/giấy tờ sắp hết hạn, chào mừng nhân viên mới, giao việc checklist, phát phiếu lương.
7. Chạy thử (dry-run) để xem trước quy tắc sẽ áp dụng cho bản ghi nào.

## 17.4 Quy tắc nghiệp vụ
- BR-17.1 Hành động “đổi trạng thái” vẫn phải tuân thủ quy tắc của mô-đun đích (ví dụ BR-6.1: checklist chưa xong thì không đổi trạng thái được).
- BR-17.2 Không gửi trùng: cùng một quy tắc, cùng bản ghi, cùng mốc thời gian thì chỉ chạy một lần.
- BR-17.3 Quy tắc chỉ chạy trong workspace của nó.
- BR-17.4 Hành động lỗi thì ghi nhật ký và thử lại theo cấu hình; không ảnh hưởng tới giao dịch gốc.
- BR-17.5 Số ngày báo trước, tần suất chạy do người dùng cấu hình (hệ thống không cài sẵn giá trị).

## 17.5 Dữ liệu chính
`automation_rule` (workspace, tên, trigger_type, event/lịch, bật/tắt); `automation_condition`; `automation_action` (loại, tham số, mẫu email); `automation_run_log`.

## 17.6 Luồng xử lý
Sự kiện phát sinh, hoặc đến lịch → engine tìm các quy tắc đang bật → kiểm tra điều kiện → thực hiện hành động → ghi nhật ký.

## 17.7 Liên kết mô-đun
Phát sinh sự kiện: 1, 2, 3, 6, 7, 8, 14, 16. Thực thi hành động: 8 (tạo việc), 12 (mẫu email, SMTP). Phân quyền: 11.

## 17.8 Tiêu chí nghiệm thu
- AC-17.1 Tạo quy tắc “khi ứng viên chuyển trạng thái X thì gửi mẫu Y”: email được gửi đúng.
- AC-17.2 Quy tắc theo lịch “trước ngày hết hạn hợp đồng N ngày” gửi đúng người, đúng ngày, không gửi trùng.
- AC-17.3 Tắt quy tắc thì nó ngừng chạy.
- AC-17.4 Nhật ký ghi đủ cả lần chạy thành công và lần lỗi.

## 17.9 Câu hỏi mở
- Q-17.1 Ngoài email và thông báo trong hệ thống, có cần gửi qua Zalo/SMS không?
- Q-17.2 HR có được tự tạo quy tắc mới, hay chỉ bật/tắt và sửa bộ quy tắc mẫu?

---

# 18. Giao diện đăng nhập

## 18.1 Mục tiêu
Cho nhân viên đăng nhập an toàn bằng SĐT hoặc email có trong hồ sơ nhân viên. Hệ thống không có mô-đun quản lý user riêng.

## 18.2 Tác nhân/vai trò
Nhân viên (đăng nhập); Admin (cấu hình chính sách bảo mật, mở khóa tài khoản).

## 18.3 Chức năng chi tiết
**Yêu cầu gốc**
1. Màn hình đăng nhập bằng **SĐT hoặc email có trong hồ sơ nhân viên**.
2. Xác thực.
3. Quên mật khẩu/đặt lại mật khẩu.
4. Bảo mật: khóa tài khoản sau nhiều lần nhập sai, quản lý phiên đăng nhập, mã hoá, nhật ký đăng nhập.
5. **Không có mô-đun quản lý user riêng**.

**Đề xuất bổ sung**
- Màn hình tối ưu cho điện thoại; logo và tên workspace; chọn workspace sau khi đăng nhập nếu người dùng thuộc nhiều công ty.
- Lần đầu: kích hoạt qua link/OTP gửi tới email/SĐT trong hồ sơ để đặt mật khẩu.
- Quên mật khẩu: link hoặc OTP có hạn dùng, chỉ dùng được một lần.
- Mật khẩu lưu dạng băm (bcrypt/argon2); toàn bộ truy cập qua HTTPS.
- Phiên: tự hết hạn khi không hoạt động; xem và đăng xuất các thiết bị khác.
- Số lần sai trước khi khóa và thời gian khóa do admin cấu hình.
- **2FA tùy chọn** (OTP qua email/SMS hoặc ứng dụng xác thực).
- Nhật ký đăng nhập: thời gian, IP, thiết bị, kết quả.

## 18.4 Quy tắc nghiệp vụ
- BR-18.1 Chỉ SĐT/email có trong hồ sơ nhân viên đang còn hiệu lực mới đăng nhập được (BR-6.3, BR-6.4).
- BR-18.2 Thông báo lỗi không tiết lộ tài khoản có tồn tại hay không.
- BR-18.3 Đổi SĐT/email trong hồ sơ hoặc đặt lại mật khẩu thì các phiên khác bị hủy *(đề xuất)*.
- BR-18.4 Nhân viên nghỉ việc thì khóa đăng nhập ngay.

## 18.5 Dữ liệu chính
`auth_credential` (employee_id, mật khẩu đã băm, 2FA), `otp_token`, `session`, `login_log`, `security_policy` (theo workspace).

## 18.6 Luồng xử lý
Nhập SĐT/email → mật khẩu hoặc OTP → (2FA) → chọn workspace (nếu thuộc nhiều công ty) → vào Trang chủ (mô-đun 10).

## 18.7 Liên kết mô-đun
6 (định danh), 11 (quyền sau khi đăng nhập), 12 (SMTP/SMS, chính sách), 10.

## 18.8 Tiêu chí nghiệm thu
- AC-18.1 Đăng nhập được bằng SĐT và bằng email trong hồ sơ; SĐT/email không có trong hồ sơ thì bị từ chối.
- AC-18.2 Nhập sai quá số lần cấu hình thì tài khoản bị khóa.
- AC-18.3 Luồng quên mật khẩu chạy được; link đã dùng hoặc hết hạn thì không dùng lại được.
- AC-18.4 Mỗi lần đăng nhập đều có dòng nhật ký.
- AC-18.5 Không có màn hình quản lý user riêng.

## 18.9 Câu hỏi mở
- Q-18.1 Đăng nhập bằng mật khẩu, OTP, hay cả hai? Dùng nhà cung cấp SMS nào?
- Q-18.2 Có bắt buộc 2FA cho admin/HR không?
- Q-18.3 Có cần đăng nhập bằng Google/Microsoft (SSO) không?


---

# Phụ lục A. Tổng hợp câu hỏi mở cần anh Hiệu chốt (ưu tiên)
1. Thành phần lương, phụ cấp, khấu trừ, cách tính OT, biểu thuế/giảm trừ đang áp dụng (Q-16.1, Q-16.2, Q-6.5)?
2. Workspace: tên miền con hay đường dẫn chung, ai tạo workspace, một tài khoản dùng cho nhiều công ty (Q-0.1, Q-0.2)?
3. Đăng nhập bằng mật khẩu, OTP hay cả hai; nhà cung cấp SMS; có bắt buộc 2FA cho admin/HR (Q-18.1, Q-18.2)?
4. Quy tắc tính công, đi muộn, ca, số dư phép (Q-1.1, Q-1.2, Q-2.1)?
5. Quá SLA thì xử lý thế nào; SLA tính theo giờ hành chính hay giờ tự nhiên (Q-2.3, Q-8.1)?
6. HR có được tự tạo quy tắc tự động hoá không; có cần kênh Zalo/SMS (Q-17.1, Q-17.2)?
7. Checklist chuẩn cho onboarding/điều chuyển/bổ nhiệm/miễn nhiệm/nghỉ việc (Q-6.1)?
8. Đánh giá thử việc/định kỳ có nằm trong bản đầu không (Q-4.1)?
9. Tích hợp bên ngoài: máy chấm công, BHXH, kế toán/ngân hàng, lịch (Q-0.6, Q-3.3, Q-13.2, Q-16.4)?
