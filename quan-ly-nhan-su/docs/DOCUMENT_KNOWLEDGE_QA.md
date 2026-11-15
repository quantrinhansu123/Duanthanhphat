# Kết quả kiểm tra bản đầu — 16/11/2026

Nhánh `feat/document-knowledge-etl`, base `1c56ac2b0261e261f058394b00d87b48035be622`. Không push, deploy hoặc thay database thật trong đợt này.

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm test:knowledge` | Đạt 178 ca: core/worker 59, PostgreSQL/pgvector 57, API/chat 42, Codex gateway 20 |
| Production build với Node heap 4 GB | Đạt compile, TypeScript, 77 trang static và trace cleanup |
| ESLint các file thay đổi | Đạt; hai dòng đo thời gian trong callback submit được ghi rõ ngoại lệ cho rule purity |
| Chat API, upload, client | Đạt, gồm Standard tier, tách người dùng/kho, gửi tệp và nguồn dẫn |
| Model list, PDF parser, contract context | Đạt các script regression tương ứng |
| Build trace | Đạt loại dữ liệu runtime riêng và kiểm tra idempotency |
| Component UI với API fixture | Đạt 10 luồng trên Edge headless: 1440 px/390 px, không tràn ngang, ô nhập folder dùng được, dẫn trang, lỗi dữ kiện trùng, duyệt dữ kiện/tài liệu và viewer chỉ đọc |
| Codex đăng nhập thật | Đạt 3 planner synthetic: tổng nghiệm thu HD-05 đến ngày cụ thể, tra điều khoản, hỏi lại tổng tiền chưa rõ loại |

Các ca SQL dùng engine PostgreSQL và pgvector thực qua PGlite, không chỉ so chuỗi câu SQL. Bao gồm không cộng trùng lũy kế, mâu thuẫn kỳ/ngày, phụ lục thiếu hợp đồng gốc, hơn 1.000 khoản, bộ lọc hợp đồng/ngày, quyền viewer/ngoài kho, lease cũ, revision mới, rollback và bucket private.

PDF test tạo 3 trang (1 có chữ, 2 scan); giả lập lỗi OCR giữa chừng và publish DB thất bại, rồi xác minh thử lại dùng cache thay vì gọi lại các trang/nhóm vector đã hoàn thành. Không dùng tài liệu thật để chạy các phép thử này.

Planner thật ghi nhận 8.700–8.711 input token/lượt; lượt hỏi lại có 6.528 cached input token. Đây là phép thử adapter/schema, không đo hiệu quả end-to-end trên 83 hồ sơ. Câu tài chính rõ nghĩa được nhận diện ở lượt đầu và nút Xem tổng chạy SQL với 0 lần gọi model.

Một kiểm tra mở rộng có lỗi **có sẵn ngoài phạm vi thay đổi**: `scripts/test-document-library.mjs` dừng tại mock thiếu `@/components/Pager` khi load `DocumentLibrary.tsx`. Cả script và component đó khớp HEAD, không có diff. Các phần folder/storage/upload/client đầu script đã chạy đạt trước điểm dừng. Không gọi đây là toàn bộ bộ kiểm thử ứng dụng đã đạt.

Chưa kiểm tra Supabase/Gemini thật, độ đúng OCR theo hồ sơ, tải đồng thời hay giảm token trước/sau trên 83 tệp vì chưa có cấu hình và dữ liệu riêng trong workspace. Đây là các bước nghiệm thu vận hành tiếp theo, không thay bằng dữ liệu demo.
