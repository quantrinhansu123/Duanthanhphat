# Bàn giao triển khai kho hồ sơ

## Tình trạng

- Mặc định mới tự đọc, kiểm tra và tính trên dữ liệu đủ căn cứ; không bắt duyệt mọi tệp. Số tự động và số được người duyệt có nhãn/chế độ riêng. Đọc [luồng tự động](DOCUMENT_KNOWLEDGE_AUTOMATIC.md), cài migration mới nhất có `automatic_check` và RPC `dk_automatic_summary`.

- Mã ở nhánh `feat/document-knowledge-etl`, đã đồng bộ vào repo `E:\duanthanhphat` anh Huy đang mở. Nhánh `main` local được giữ nguyên.
- Supabase Data API đã xác thực được; chưa có bảng `dk_*`. **Chưa chạy SQL trên database thật**, theo yêu cầu để đồng nghiệp quản lý Supabase triển khai sau.
- Gemini đã chạy đạt embedding tài liệu/câu hỏi 768 chiều, trích xuất 3 dữ kiện và OCR ảnh mẫu. Tất cả là dữ liệu synthetic; chưa đưa hồ sơ công ty lên pipeline này.
- Đã thử 3 planner Codex thật và các luồng UI với API giả lập. Xem [kết quả QA](DOCUMENT_KNOWLEDGE_QA.md).
- OCR giữ Gemini làm mặc định theo kết quả thử và yêu cầu mới nhất; PaddleOCR-VL là tùy chọn cần nghiệm thu trên server, classic không đạt giữ dấu tiếng Việt. Xem [hướng dẫn OCR](DOCUMENT_KNOWLEDGE_OCR.md), dùng schema mới nhất có `dk_pages.ocr_meta`.
- `.env.local` của máy anh Huy đã có cấu hình riêng, tính năng giữ **false**. File môi trường và khóa bí mật không nằm trong commit/gói mã. Khóa đã chia sẻ qua chat cần được thay trước khi đưa vào vận hành.

## Nhận mã

Ưu tiên nhận trực tiếp từ [nhánh GitHub feat/document-knowledge-etl](https://github.com/quantrinhansu123/Duanthanhphat/tree/feat/document-knowledge-etl):

```powershell
git fetch origin feat/document-knowledge-etl
git switch -c deploy/document-knowledge FETCH_HEAD
```

Cũng có thể dùng file `document-knowledge-etl.bundle` do anh Huy chuyển. Gói bundle chứa phần thay đổi kể từ main `1c56ac2b0261e261f058394b00d87b48035be622`; lấy base đó trước khi nhập bundle.

```powershell
git fetch origin main
git bundle verify <duong-dan>\document-knowledge-etl.bundle
git fetch <duong-dan>\document-knowledge-etl.bundle feat/document-knowledge-etl
git switch -c deploy/document-knowledge FETCH_HEAD
```

Nếu repo triển khai đã có thay đổi riêng, dùng nhánh tích hợp và xử lý xung đột như một thay đổi mã thông thường. Không reset hoặc ghi đè thay đổi đang làm.

## Các bước người triển khai thực hiện

1. **Database owner** mở Supabase SQL Editor của đúng project, kiểm tra schema extension và chạy `supabase/migration_20261116_document_knowledge.sql` ở root repo. Migration đã thử trên PostgreSQL/pgvector qua PGlite, có transaction và chạy lại được. Đọc phần schema extension trong [hướng dẫn đầy đủ](DOCUMENT_KNOWLEDGE.md).
2. Kiểm tra bảng `dk_projects`, `dk_documents`, `dk_jobs`, `dk_facts`, các RPC `dk_*`, RLS và bucket **private** `document-knowledge`. Tài khoản ứng dụng chỉ đọc kho có membership; worker dùng service role ở server. Không cấp service role cho browser hoặc agent.
3. Cài Node >=22.18, Python và dependencies. Cấu hình môi trường **trong ứng dụng `quan-ly-nhan-su`** hoặc secret store của nền tảng triển khai. Lệnh root chạy app con nên file `.env.local` chỉ ở root không thay thế cấu hình của app con.
4. Đăng nhập Codex bằng tài khoản vận hành trên máy server. Kiểm tra đường dẫn executable Windows nếu cần. Khóa Google Drive/Cloudinary không thay thế `GEMINI_API_KEY` cho OCR/embedding.
5. Sau khi schema và cấu hình sẵn sàng, đặt `DOCUMENT_KNOWLEDGE_ENABLED=true`, build và khởi động lại web server; chạy worker riêng với chế độ watch. Bật giám sát/khởi động lại worker theo hạ tầng của nhóm.
6. Người có quyền vào **Hồ sơ AI_QS → Kho hồ sơ hỏi đáp**, tạo kho, nhập 2–3 hồ sơ đại diện; đối soát số tiền, ngày, mã hợp đồng và lũy kế. Đạt rồi mới nhập đủ 83 tệp. Không tạo một hợp đồng/giá trị tiền cho mỗi tệp.
7. Thử tổng tự động và câu hỏi “83 file này bao tiền” có dẫn trang; không cần duyệt thủ công để ra số tự động. Kiểm tra các cảnh báo thiếu/mâu thuẫn, thử chế độ chỉ số đã xác minh khi cần. Đo usage trước/sau; chưa đủ độ phủ thì giữ nhãn chưa đầy đủ và chưa xác minh nghiệp vụ.

```powershell
cd quan-ly-nhan-su
pnpm.cmd install --frozen-lockfile
python -m pip install -r scripts/requirements-knowledge.txt
pnpm.cmd knowledge:ocr:check
# Chỉ nghiệm thu Paddle nếu đã cài dependency/model riêng theo hướng dẫn OCR.
pnpm.cmd test:knowledge
# Tùy chọn, gọi Google bằng fixtures synthetic; có sử dụng hạn mức API.
pnpm.cmd knowledge:smoke -- --live
# Chỉ thử trích xuất/kiểm tra tự động trên 3 trang chữ synthetic (có dùng API).
pnpm.cmd knowledge:automatic:smoke -- --live
$env:NODE_OPTIONS='--max-old-space-size=4096'
pnpm.cmd build
pnpm.cmd start
```

Ở terminal/process khác, cùng thư mục ứng dụng:

```powershell
pnpm.cmd knowledge:worker -- --watch
```

Các biến tối thiểu: Supabase URL/anon/service role theo cấu hình hiện tại, `GEMINI_API_KEY`, `DOCUMENT_KNOWLEDGE_ENABLED`, model/worker trong `.env.example`, Codex đã đăng nhập. Nhập từ thư mục local cần thêm `CHAT_CONTRACT_DIR` và tài khoản cho phép trong `KNOWLEDGE_LOCAL_SCAN_USERS`; upload qua UI không cần quyền quét thư mục. `CHAT_LEGACY_ADMIN_IDS` mặc định trống, chỉ cấu hình cho quản trị thật sự cần luồng CLI cũ toàn quyền.

Để không yêu cầu người dùng nạp từng tệp, quản trị tạo kho một lần, đặt `CHAT_CONTRACT_DIR` tới thư mục hồ sơ trên máy worker rồi cấu hình tiến trình lâu dài:

```powershell
pnpm.cmd knowledge:worker -- --watch --project <UUID-kho> --folder "Tong hop HD voi ben A"
```

Worker quét đệ quy toàn bộ thư mục, tự xử lý tệp mới/thay đổi; không nhập lại bản không đổi. Đây là thư mục trên **server**, không phải đường dẫn trên máy khách. Hồ sơ ở Google Drive/nguồn khác cần người triển khai nối hoặc đồng bộ đúng thư mục nguồn; bản này chưa tự liên thông mọi kho Drive cũ.

## Nghiệm thu tối thiểu

- Tệp không đổi không tạo job/chi phí OCR mới; lỗi giữa chừng thử lại dùng checkpoint.
- Cùng một hợp đồng có nhiều chứng từ không bị cộng thành nhiều hợp đồng.
- Nghiệm thu riêng đợt không bị cộng lại vào số lũy kế đã bao gồm nó.
- Đề nghị thanh toán không tự trở thành tiền thực chuyển; phụ lục chỉ ghi phần chênh lệch.
- Thay tệp/quét lại làm phiên bản cũ ngừng được tính, yêu cầu duyệt phiên bản mới.
- Người ngoài kho không đọc được nội dung, số tiền hoặc bản gốc qua URL cũ/mới.
- Câu tổng hợp không gửi 83 tệp vào Codex; số tiền do SQL tính. Câu thông dụng ở lượt đầu/nút Xem tổng không gọi model.
- Mỗi kết quả có phạm vi, ngày chốt, trạng thái độ phủ và nguồn. Không dùng RAG top-k để tính tổng cả kho.

Điểm chưa nghiệm thu: migration/cloud RLS trên project thật, xử lý đầy đủ 83 hồ sơ, chất lượng OCR/điều khoản theo hồ sơ thực, tải đồng thời và khả năng phục hồi hạ tầng. Zalo/NotebookLM/WrenAI không phải phụ thuộc bắt buộc của bản này.
