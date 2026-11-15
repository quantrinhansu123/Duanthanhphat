# Kết quả kiểm tra bản đầu — 16/11/2026

Nhánh `feat/document-knowledge-etl`, base `1c56ac2b0261e261f058394b00d87b48035be622`. Mã được bàn giao qua nhánh GitHub; chưa deploy hoặc chạy migration trên database thật theo yêu cầu để đồng nghiệp phụ trách Supabase triển khai sau.

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm test:knowledge` | Đạt 181 ca: core/worker 62, PostgreSQL/pgvector 57, API/chat 42, Codex gateway 20 |
| Production build với Node heap 4 GB | Đạt compile, TypeScript, 77 trang static và trace cleanup |
| ESLint các file thay đổi | Đạt; hai dòng đo thời gian trong callback submit được ghi rõ ngoại lệ cho rule purity |
| Chat API, upload, client | Đạt, gồm Standard tier, tách người dùng/kho, gửi tệp và nguồn dẫn |
| Model list, PDF parser, contract context | Đạt các script regression tương ứng |
| Build trace | Đạt loại dữ liệu runtime riêng và kiểm tra idempotency |
| Component UI với API fixture | Đạt 10 luồng trên Edge headless: 1440 px/390 px, không tràn ngang, ô nhập folder dùng được, dẫn trang, lỗi dữ kiện trùng, duyệt dữ kiện/tài liệu và viewer chỉ đọc |
| Codex đăng nhập thật | Đạt 3 planner synthetic: tổng nghiệm thu HD-05 đến ngày cụ thể, tra điều khoản, hỏi lại tổng tiền chưa rõ loại |
| Gemini API thật | Đạt 4 lời gọi: embedding tài liệu/câu hỏi 768 chiều, trích xuất 3 dữ kiện tiếng Việt và OCR ảnh synthetic; không tạo bản ghi trên DB thật |

Các ca SQL dùng engine PostgreSQL và pgvector thực qua PGlite, không chỉ so chuỗi câu SQL. Bao gồm không cộng trùng lũy kế, mâu thuẫn kỳ/ngày, phụ lục thiếu hợp đồng gốc, hơn 1.000 khoản, bộ lọc hợp đồng/ngày, quyền viewer/ngoài kho, lease cũ, revision mới, rollback và bucket private.

PDF test tạo 3 trang (1 có chữ, 2 scan); giả lập lỗi OCR giữa chừng và publish DB thất bại, rồi xác minh thử lại dùng cache thay vì gọi lại các trang/nhóm vector đã hoàn thành. Không dùng tài liệu thật để chạy các phép thử này.

Planner thật ghi nhận 8.700–8.711 input token/lượt; lượt hỏi lại có 6.528 cached input token. Đây là phép thử adapter/schema, không đo hiệu quả end-to-end trên 83 hồ sơ. Câu tài chính rõ nghĩa được nhận diện ở lượt đầu và nút Xem tổng chạy SQL với 0 lần gọi model.

Một kiểm tra mở rộng có lỗi **có sẵn ngoài phạm vi thay đổi**: `scripts/test-document-library.mjs` dừng tại mock thiếu `@/components/Pager` khi load `DocumentLibrary.tsx`. Cả script và component đó khớp HEAD, không có diff. Các phần folder/storage/upload/client đầu script đã chạy đạt trước điểm dừng. Không gọi đây là toàn bộ bộ kiểm thử ứng dụng đã đạt.

Gemini 3.5 Flash-Lite đã trả HTTP 400 với `maxItems` lồng trong schema dữ kiện ở lần thử thật. Đã chuyển giới hạn 100 dữ kiện/nhóm sang kiểm tra phía ứng dụng; trích xuất JSON sau đó đạt, cùng OCR và embedding. Bổ sung ca kiểm thử để giữ giới hạn này. Trích xuất trang synthetic dùng 719 token tổng; OCR ảnh synthetic dùng 1.252 token tổng trong lần chạy đạt, không suy ra chi phí của hồ sơ thực từ các số này.

Supabase Data API đã xác thực được, chưa có schema mới; theo yêu cầu anh Huy, để đồng nghiệp quản lý Supabase cài migration sau và giữ feature flag false. Chưa nghiệm thu cloud RLS trên project thật, độ đúng OCR theo hồ sơ, tải đồng thời hay giảm token trước/sau trên 83 tệp. Đây là các bước nghiệm thu vận hành tiếp theo, không thay bằng dữ liệu demo.
