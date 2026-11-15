# Kết quả kiểm tra bản đầu — 16/11/2026

Nhánh `feat/document-knowledge-etl`, base `1c56ac2b0261e261f058394b00d87b48035be622`. Mã được bàn giao qua nhánh GitHub; chưa deploy hoặc chạy migration trên database thật theo yêu cầu để đồng nghiệp phụ trách Supabase triển khai sau.

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm test:knowledge` | Đạt 220 kiểm tra: core/worker 62, PostgreSQL/pgvector 59, API/chat 42, Codex gateway 20, OCR routing 24 và 13 Python OCR contract tests |
| Production build với Node heap 4 GB | Đạt compile, TypeScript, 77 trang static và trace cleanup |
| ESLint các file thay đổi | Đạt; hai dòng đo thời gian trong callback submit được ghi rõ ngoại lệ cho rule purity |
| Chat API, upload, client | Đạt, gồm Standard tier, tách người dùng/kho, gửi tệp và nguồn dẫn |
| Model list, PDF parser, contract context | Đạt các script regression tương ứng |
| Build trace | Đạt loại dữ liệu runtime riêng và kiểm tra idempotency |
| Component UI với API fixture | Đạt 13 luồng trên Edge headless: 1440 px/390 px, không tràn ngang, ô nhập folder dùng được, dẫn trang, hiển thị engine/fallback/cảnh báo OCR, lỗi dữ kiện trùng, duyệt dữ kiện/tài liệu và viewer chỉ đọc |
| Codex đăng nhập thật | Đạt 3 planner synthetic: tổng nghiệm thu HD-05 đến ngày cụ thể, tra điều khoản, hỏi lại tổng tiền chưa rõ loại |
| Gemini API thật | Lần mới nhất đạt 7 lời gọi: embedding tài liệu/câu hỏi 768 chiều, trích xuất 3 dữ kiện tiếng Việt, OCR ảnh synthetic tiếng Anh và 3 ảnh/trang scan tiếng Việt; không tạo bản ghi trên DB thật |
| Gemini OCR tiếng Việt qua pipeline mới | Đạt ảnh và PDF 4 trang gồm native, scan, scan có header chọn được và trang trắng. Giữ các trường tên, mã, ngày và tiền được đánh dấu trong fixture |
| Paddle model thật | Khởi tạo được detector v6 small và Latin recognizer v5/v3 trên CPU; các recognizer làm mất dấu tiếng Việt nên **không đạt** tiêu chí tên/điều khoản |
| PaddleOCR-VL 1.6 | Có adapter tùy chọn và contract tests, **chưa nghiệm thu model/inference thật**, không dùng làm mặc định |

Các ca SQL dùng engine PostgreSQL và pgvector thực qua PGlite, không chỉ so chuỗi câu SQL. Bao gồm không cộng trùng lũy kế, mâu thuẫn kỳ/ngày, phụ lục thiếu hợp đồng gốc, hơn 1.000 khoản, bộ lọc hợp đồng/ngày, quyền viewer/ngoài kho, lease cũ, revision mới, rollback và bucket private.

PDF test tạo 3 trang (1 có chữ, 2 scan); giả lập lỗi OCR giữa chừng và publish DB thất bại, rồi xác minh thử lại dùng cache thay vì gọi lại các trang/nhóm vector đã hoàn thành. Không dùng tài liệu thật để chạy các phép thử này.

Planner thật ghi nhận 8.700–8.711 input token/lượt; lượt hỏi lại có 6.528 cached input token. Đây là phép thử adapter/schema, không đo hiệu quả end-to-end trên 83 hồ sơ. Câu tài chính rõ nghĩa được nhận diện ở lượt đầu và nút Xem tổng chạy SQL với 0 lần gọi model.

Một kiểm tra mở rộng có lỗi **có sẵn ngoài phạm vi thay đổi**: `scripts/test-document-library.mjs` dừng tại mock thiếu `@/components/Pager` khi load `DocumentLibrary.tsx`. Cả script và component đó khớp HEAD, không có diff. Các phần folder/storage/upload/client đầu script đã chạy đạt trước điểm dừng. Không gọi đây là toàn bộ bộ kiểm thử ứng dụng đã đạt.

Gemini 3.5 Flash-Lite đã trả HTTP 400 với `maxItems` lồng trong schema dữ kiện ở lần thử thật. Đã chuyển giới hạn 100 dữ kiện/nhóm sang kiểm tra phía ứng dụng; trích xuất JSON sau đó đạt, cùng OCR và embedding. Bổ sung ca kiểm thử để giữ giới hạn này. Trích xuất trang synthetic dùng 719 token tổng; OCR ảnh synthetic dùng 1.252 token tổng trong lần chạy đạt, không suy ra chi phí của hồ sơ thực từ các số này.

Supabase Data API đã xác thực được, chưa có schema mới; theo yêu cầu anh Huy, để đồng nghiệp quản lý Supabase cài migration sau và giữ feature flag false. Chưa nghiệm thu cloud RLS trên project thật, độ đúng OCR theo hồ sơ, tải đồng thời hay giảm token trước/sau trên 83 tệp. Đây là các bước nghiệm thu vận hành tiếp theo, không thay bằng dữ liệu demo.

## Quyết định OCR sau phép thử ngày 16/11/2026

Anh Huy cho phép ưu tiên Gemini nếu Paddle không ổn. Giữ `KNOWLEDGE_OCR=gemini` mặc định; không đưa cấu hình classic mất dấu vào vận hành chỉ vì đọc đúng số tiền. Ví dụ mẫu, `Nguyễn` bị đọc thành `Nguyn`, `Hợp đồng` thành `Hp đng` trong Latin v5 mặc dù điểm trung bình ~0,985. Không coi confidence là độ đúng thực tế. V3 Latin cũng không đạt. Không suy kết quả đó thành kết luận mọi model Paddle đều kém.

Ba lượt Gemini OCR tiếng Việt mới dùng khoảng 2.002/2.261/2.214 ms, số token tổng 1.344/1.344/1.361 trên các ảnh synthetic đã dựng. Kết quả kiểm tra là các trường cụ thể của fixture, không phải đánh giá CER/WER toàn trang hoặc benchmark tài liệu công ty. Có thể tái lập bằng `pnpm knowledge:smoke -- --live`.

Phiên bản OCR mới lưu provenance/metadata ở `dk_pages.ocr_meta`, chặn API trả chữ rỗng trên ảnh có nội dung, giới hạn ảnh/pixel/thời gian, bỏ qua cả inference của trang đã checkpoint. Engine/model/DPI/ngưỡng/fallback nằm trong fingerprint; giữ duyệt lại khi tạo revision mới. Cần chạy migration mới nhất trước khi bật tính năng.
