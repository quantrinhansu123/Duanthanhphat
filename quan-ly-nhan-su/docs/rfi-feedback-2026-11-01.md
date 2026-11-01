# Sửa luồng nghiệm thu và đối soát RFI — 01/11/2026

## Nguyên nhân và xử lý

- RFI-008 có 1 mối, RFI-009 có 2 mối chưa hoàn thành nghiệm thu. Cả 3 thiếu số đo `chieu_dai_mai`, nên DB chặn kết quả Đạt. Màn hình cũ không chỉ rõ điều kiện này. Màn hình mới nêu lý do từng mối và cho nhập/lưu chiều dài mài ngay tại bước nghiệm thu; giữ nguyên các số đo khác và kiểm tra phiên bản dữ liệu trước khi lưu.
- View chất lượng cũ gán “Chờ ký biên bản” ngay khi NDT đạt, kể cả chưa có RFI/kết quả nghiệm thu. Migration mới chỉ gán trạng thái này khi có kết quả Đạt trong một đợt đã hoàn thành. Mối NDT đạt chưa có RFI vẫn thuộc bước “Chờ siêu âm và nghiệm thu” và có thể được chọn phát RFI.
- Hoàn thành nghiệm thu cập nhật bộ 3 biên bản có sẵn. Hồ sơ nháp không được ký; thiếu số đo hoặc số đo ngoài dung sai vẫn bị DB chặn. Không tự điền số đo hay suy đoán kết quả Đạt.
- Danh sách RFI lấy kết quả nghiệm thu thực tế, phân biệt số mối trong phiếu, đạt, chưa nghiệm thu, không đạt, chờ ký và đã ký. Đọc đủ trang dữ liệu thay vì dừng ở 200 phiếu/1.000 dòng. KM đã nghiệm thu ưu tiên dữ liệu chốt tại nghiệm thu; thiếu KM được cảnh báo. Phụ bảng từng mối/KM và danh sách mối sẵn sàng chưa có RFI hỗ trợ đối soát. Khoảng KM không được hiểu là nghiệm thu liên tục cả đoạn.
- Phiếu theo dõi bắt buộc chọn ít nhất một tuyến; UI, phát hành API và sửa phiếu API cùng kiểm tra. Tuyến đã chọn được lưu và dùng khi in.
- Trang chủ có 3 nhóm: Sử dụng hiện trường; Quản lý & tra cứu; Báo cáo & quản trị. Nhóm đầu có đúng 6 mục theo thứ tự: Check List, Nhiên liệu, Nhật ký hàn, Báo cáo ngày, Biên bản hàn, Giải toả ứng suất. Nhiên liệu mở thẳng form cấp dầu, dùng luồng lưu và phân quyền Lịch chạy máy hiện có.

## Áp dụng

1. Cài dependency bằng `npm ci` tại `quan-ly-nhan-su/`. Lockfile được đồng bộ với dependency ExcelJS đã có trong `package.json` của bản pull.
2. Sau các migration chất lượng/RFI đã có và hai migration chiều dài mài ngày 01/11, chạy `supabase/migration_20261101_rfi_doi_soat_trang_thai.sql` trên đúng DB triển khai. Migration chỉ thay định nghĩa view, chạy lại được, không ghi kết quả nghiệm thu hay sửa hồ sơ cũ.
3. Build/deploy ứng dụng. Vào RFI-008/009, nhập chiều dài mài đo thực tế, lưu, kiểm tra kết quả rồi hoàn thành nghiệm thu và xác nhận ký bộ hồ sơ.

## Kiểm tra

Tại `quan-ly-nhan-su/`:

```text
node scripts/test-weld-quality.mjs
node scripts/test-weld-acceptance.mjs
node scripts/test-rfi-monitoring.mjs
node scripts/test-rfi-tracking.mjs
node scripts/test-rfi-tracking-server.mjs
node scripts/test-rfi-lifecycle-db.mjs <external-prefix>/node_modules/@electric-sql/pglite/dist/index.js
node scripts/test-rfi-workflow-browser.cjs
npm run build
```

Hai bài kiểm tra cuối phần RFI dùng công cụ QA cài ngoài repo. Với browser, đặt `QA_TOOLS` tới thư mục `node_modules` chứa `esbuild` và `playwright`; dùng Chrome đã cài hoặc đặt `QA_BROWSER_CHANNEL`. Browser render các component thật với API giả lập, kiểm tra nhập số đo → hoàn thành → ký, khóa ký bản nháp, chọn tuyến, danh sách/PDF, menu 375px và form nhiên liệu. PGlite kiểm tra SQL thực, rollback, idempotency, dung sai, dữ liệu cũ và quyền truy cập. Các bài kiểm tra không ghi dữ liệu production.
