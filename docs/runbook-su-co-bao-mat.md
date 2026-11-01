# Runbook sự cố bảo mật & sao lưu – ONHRM

## 1. Sao lưu (SEC-13)
- Workflow `.github/workflows/db-backup.yml` chạy 02:30 hằng ngày (giờ VN), hoặc bấm *Run workflow*.
- Cần secret `SUPABASE_DB_URL` và `BACKUP_PASSPHRASE` (anh Hiệu tự thêm, không dán vào chat/repo). Thiếu secret ⇒ job bỏ qua.
- Bản sao lưu: artifact `db-backup`, lưu 14 ngày, mã hoá AES-256.
- **Diễn tập khôi phục hằng tháng** (vào DB thử, KHÔNG vào DB thật):
  ```bash
  gpg --decrypt hrm-YYYYMMDD.dump.gpg > hrm.dump
  pg_restore --no-owner --no-privileges -d "$DB_TEST_URL" hrm.dump
  ```
  Ghi lại ngày diễn tập, thời gian khôi phục, số bản ghi `employees`/`requests` so với thật.
- Khi có khách trả phí: nâng Supabase Pro + PITR.

## 2. Quy trình sự cố
1. **Phát hiện** (≤ 1 giờ): nguồn có thể là cảnh báo Supabase, log edge function, người dùng báo, hoặc thấy hoạt động lạ trong `activity_logs`. Ghi thời điểm phát hiện.
2. **Khoanh vùng** (≤ 4 giờ):
   - Rotate các khoá: Supabase `service_role`/JWT secret (Settings → API), `SUPABASE_ACCESS_TOKEN`, mật khẩu SMTP, secret GitHub.
   - Đăng xuất toàn bộ: đổi JWT secret, hoặc `delete from auth.sessions;` (chạy có duyệt).
   - Khoá tài khoản nghi bị chiếm: Supabase Auth → Ban user.
   - Nếu do bản deploy lỗi: Vercel → Promote bản trước.
3. **Đánh giá**: dữ liệu nào bị lộ (lương, CCCD, hợp đồng…), của bao nhiêu người, của công ty nào. Truy `activity_logs`, `employee_sensitive_audit`, log Auth.
4. **Thông báo**:
   - Theo Nghị định 13/2023/NĐ-CP (và Luật Bảo vệ dữ liệu cá nhân 2025 khi có hiệu lực), báo **Bộ Công an (A05)** trong **72 giờ** kể từ khi xảy ra vi phạm. Dùng mẫu số 03 của Nghị định.
   - Báo các công ty khách hàng bị ảnh hưởng (họ là bên kiểm soát dữ liệu) và nhân viên liên quan.
5. **Khắc phục & rút kinh nghiệm**: vá lỗi, thêm test, cập nhật báo cáo bảo mật. Họp lại trong 7 ngày.

## 3. Đường lui MFA (SEC-04)
- MFA hiện ở chế độ **khuyến nghị**: Owner/Admin/HR được nhắc nhưng không bị ép.
- Người dùng mất app xác thực: quản trị nền tảng gỡ factor trong Supabase (Auth → Users → user → MFA factors → Delete), hoặc chạy SQL có duyệt:
  `delete from auth.mfa_factors where user_id = '<uuid>';`
  Người dùng sẽ đăng nhập lại chỉ bằng mật khẩu, rồi bật MFA lại.
- Chỉ chuyển sang **bắt buộc** khi tài khoản chủ (anh Hiệu) đã bật MFA và đã thử gỡ factor theo cách trên thành công.

## 4. Mật khẩu tạm (SEC-11)
- Mật khẩu tạm hết hạn sau **24 giờ** (cron `expire-temp-passwords`). Quá hạn thì HR bấm *Cấp lại mật khẩu*, hoặc nhân viên dùng *Quên mật khẩu*.
- File CSV mật khẩu tạm: gửi riêng từng người, xoá sau khi gửi.

## 5. Dữ liệu cá nhân – ghi chú tuân thủ
- Dữ liệu nhạy cảm đang lưu: CCCD, lương, tài khoản ngân hàng, hợp đồng, ảnh chân dung.
- Cần có: thông báo xử lý dữ liệu và ghi nhận sự đồng ý của nhân viên; hợp đồng xử lý dữ liệu (DPA) với công ty khách; hồ sơ đánh giá tác động xử lý dữ liệu cá nhân.
- Xoá hoặc ẩn danh hồ sơ khi hết thời hạn lưu theo quy chế của từng công ty.
