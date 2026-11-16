# Kết quả kiểm tra bản đầu — 16/11/2026

Nhánh `feat/document-knowledge-etl`, base `1c56ac2b0261e261f058394b00d87b48035be622`. Mã được bàn giao qua nhánh GitHub; chưa deploy hoặc chạy migration trên database thật theo yêu cầu để đồng nghiệp phụ trách Supabase triển khai sau.

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm test:knowledge` | Bản tự động: core/worker 62, PostgreSQL/pgvector 59, API/chat 54, Codex gateway 20, OCR routing 24, Python OCR 13 và kiểm tra tự động/SQL 64; tổng 296 |
| Production build với Node heap 4 GB | Đạt compile, TypeScript, 77 trang static và trace cleanup |
| ESLint các file thay đổi | Đạt; hai dòng đo thời gian trong callback submit được ghi rõ ngoại lệ cho rule purity |
| Chat API, upload, client | Đạt, gồm Standard tier, tách người dùng/kho, gửi tệp và nguồn dẫn |
| Model list, PDF parser, contract context | Đạt các script regression tương ứng |
| Build trace | Đạt loại dữ liệu runtime riêng và kiểm tra idempotency |
| Component UI với API fixture | Bản tự động đạt 10 luồng trên Edge headless, 1440 px/390 px: 83 tệp trả số khi chưa có bản duyệt, chế độ chỉ số đã xác minh riêng, thu gọn duyệt thủ công, nguồn trang, 3 chỉ tiêu trong chat, dẫn chứng, điều khoản, không tràn ngang, chặn sai số lượng tệp và vẫn sửa tay được |
| Codex đăng nhập thật | Đã đạt 3 planner synthetic ở bản trước. Bản mới kiểm tra routing/schema qua API fixtures; câu tổng thông dụng dùng SQL trực tiếp, không cần planner |
| Gemini API thật | Lần mới nhất đạt 7 lời gọi: embedding tài liệu/câu hỏi 768 chiều, trích xuất 3 dữ kiện tiếng Việt, OCR ảnh synthetic tiếng Anh và 3 ảnh/trang scan tiếng Việt; không tạo bản ghi trên DB thật |
| Gemini OCR tiếng Việt qua pipeline mới | Đạt ảnh và PDF 4 trang gồm native, scan, scan có header chọn được và trang trắng. Giữ các trường tên, mã, ngày và tiền được đánh dấu trong fixture |
| Paddle model thật | Khởi tạo được detector v6 small và Latin recognizer v5/v3 trên CPU; các recognizer làm mất dấu tiếng Việt nên **không đạt** tiêu chí tên/điều khoản |
| PaddleOCR-VL 1.6 | Có adapter tùy chọn và contract tests, **chưa nghiệm thu model/inference thật**, không dùng làm mặc định |
| Gemini trích xuất cho tự động | Đã đạt 3 trang chữ synthetic với hợp đồng, nghiệm thu lũy kế và chuyển khoản có mã giao dịch; cả 3 qua bộ kiểm tra nguồn. Có một lượt live smoke chưa đạt tiêu chí nghiệm thu lũy kế, lượt sau đạt; không coi model là tất định hoặc cam kết không bỏ sót |

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

## Luồng tự động bổ sung

Pipeline `dk-v3:dk-auto-v1` tách `automatic_check` khỏi trạng thái người duyệt. Thử SQL với 83 tài liệu không có dữ kiện `approved`: tính đủ tổng, giới hạn 20 nguồn không cắt phép tính, thay tệp ngừng tính bản cũ. Có ca chống trùng cùng mã, chặn mâu thuẫn số/ngày, thiếu mã giao dịch, thiếu loại dữ kiện trên trang có dữ kiện khác, nguồn chưa được xử lý, sai phạm vi tệp, viewer/outsider và tài khoản không có quyền ghi metadata.

Worker watch thử lại lỗi API tạm thời sau cooldown tăng dần, tối đa 4 lần nhận job; không lặp vô hạn. Bộ thử điều khiển timestamp trong PostgreSQL, không chờ thời gian thật hoặc gọi API để kiểm tra backoff.

Độ phủ tự động là độ phủ kỹ thuật và các kiểm tra có quy tắc. Không phát hiện được mọi trường hợp OCR sai, bỏ sót, thiếu chứng từ hoặc hiểu sai nghiệp vụ. Tổng tự động phải có nhãn chưa xác minh; kiểm tra tay và API chỉ số đã duyệt vẫn tồn tại như lựa chọn riêng.
