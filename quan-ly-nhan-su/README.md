# Hệ thống Quản lý Nhân sự Thành Phát

Ứng dụng Next.js quản lý nhân sự, đào tạo, chứng chỉ, máy hàn, nhật ký hàn, GPS và báo cáo.

## Chạy cục bộ

```bash
pnpm install
pnpm dev
```

Mở `http://localhost:3010`.

Sao chép `.env.example` thành `.env.local` và điền các biến cần dùng. Không commit `.env.local`.

## Nhánh thử nghiệm chatbot tạo hợp đồng

Nhánh `feat/chatbot-tao-hop-dong` dùng để chạy và thử nghiệm cục bộ. Cấu hình `vercel.json` ở gốc kho mã và thư mục ứng dụng đều tắt tự động triển khai riêng nhánh này.

Máy mới cần Node.js 22, pnpm theo phiên bản trong `package.json`, kết nối Supabase và tài khoản đăng nhập ứng dụng đã được cấp quyền. Từ thư mục kho mã đã clone:

```powershell
git fetch origin
git switch feat/chatbot-tao-hop-dong
git pull --ff-only origin feat/chatbot-tao-hop-dong
cd quan-ly-nhan-su
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm install -g pnpm@11.5.2
pnpm install --frozen-lockfile
```

Chỉ sao chép `.env.example` khi chưa có `.env.local`, tránh ghi đè cấu hình đang dùng. Điền `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` trong `.env.local`; nhận khóa qua kênh riêng của đội dự án. Các tích hợp Google Drive, Cloudinary, AppSheet, Zalo cần thông tin riêng nếu sử dụng các chức năng tương ứng. Không đưa khóa, phiên đăng nhập hay hồ sơ hợp đồng vào Git.

Chọn một backend chatbot:

- **Codex CLI:** cài CLI bằng `npm install -g @openai/codex`, đăng nhập tài khoản của chính mình bằng `codex -c 'cli_auth_credentials_store="file"' login`. Ứng dụng hiện đọc phiên từ `~/.codex/auth.json`. Đặt `CHAT_PROVIDER=codex`, `CODEX_MODEL=gpt-6-luna`, `CODEX_EFFORT=medium`.
- **Anti CLI:** cài `agy` và làm theo [hướng dẫn Antigravity CLI](https://antigravity.google/docs/cli/headless), mở `agy` để đăng nhập một lần rồi kiểm tra bằng `agy models`. Đặt `CHAT_PROVIDER=anti` hoặc chọn model Anti trong combo box của chatbot.
- **Gemini API:** để trống `CHAT_PROVIDER`, điền `GEMINI_API_KEY`, tùy chọn `GEMINI_MODEL`. Chế độ này giữ công cụ tra cứu dữ liệu hệ thống từ nhánh main; quyền tra cứu theo quyền xem Báo cáo tổng quan. Upload tệp hiện chỉ dành cho hai chế độ CLI.

CLI phải được cài trên máy chạy server và có trong `PATH`; khởi động lại server sau khi cài CLI hoặc đổi `.env.local`. Chạy app bằng `pnpm dev`, mở `http://localhost:3010`, đăng nhập rồi chọn model ngay bên trái **Chat mới**.

Để tạo hợp đồng từ hồ sơ riêng, đặt `CHAT_CONTRACT_DIR` thành đường dẫn thư mục hồ sơ trên máy server. Thư mục cần có workbook `Theo dõi Hợp đồng TCW- Các dự án khác-R3.xlsx` và các thư mục PDF hợp đồng tương ứng. Để trống biến này sẽ dùng đường dẫn tương thích máy cũ `E:\20. Hồ sơ phục vụ AI_QS`; dữ liệu riêng trong ổ E không được tải xuống cùng Git. Bảng tra/bản trích xuất được tạo cục bộ trong `.codex-chat/`, máy mới chưa có bản trích xuất có thể xử lý lần đầu lâu hơn.

Đọc PDF trực tiếp cần Python 3 với PyMuPDF:

```powershell
python -m pip install PyMuPDF
```

Kiểm tra chatbot không ghi dữ liệu vào Supabase thật:

```powershell
node scripts/test-chat-api.mjs
node scripts/test-chatbot.mjs
node scripts/test-anti-chat.mjs
node scripts/test-anti-response.mjs
node scripts/test-chat-models.mjs
node scripts/test-chat-upload.mjs
node scripts/test-chat-contract-context.mjs
node scripts/test-chat-pdf.mjs
node scripts/test-require-access.mjs
node scripts/test-chat-build-traces.mjs
pnpm build
```

## Triển khai database

Migration đồng bộ nền trong Supabase SQL Editor:

```text
supabase/migration_dong_bo_dao_tao_chung_chi_gps.sql
```

Migration đồng bộ đào tạo–học viên–chứng chỉ, liên kết GPS với nhật ký hàn, tạo các RPC transaction và view báo cáo. File có transaction, có thể chạy lại và không xóa bảng dữ liệu.

Không chạy `supabase/drop_all.sql`.

### Nền nghiệm thu mối hàn — giai đoạn 1 (28/10/2026)

Trên DB đã có bảng `du_an`, `lich_su_moi_han` và cột `tinh_trang_thi_nghiem`, chạy thêm file ở thư mục gốc kho mã:

```text
supabase/migration_20261028_nghiem_thu_moi_han.sql
```

**Đã áp dụng** trên dự án Supabase `ssgwccxdcpejyytmfarc` lúc **15:00:59 ngày 28/10/2026 (UTC+7)** qua SQL Editor theo yêu cầu người dùng. Đã chạy thử và hoàn tác trên schema thật trước khi commit bản chính thức. Đối soát sau chạy: 13.515 bản ghi nhật ký và 7 dự án giữ nguyên, dấu kiểm tra nội dung nhật ký không đổi; đủ 7 bảng mới bật RLS, 2 view và 3 RPC; không tự sinh dữ liệu kiểm tra/nghiệm thu hoặc tiêu chí PQ. Chi tiết trong [README tiến độ](../README.md).

Thử trên bản sao DB trước. Migration thêm cấu trúc kiểm tra, dung sai theo dự án/công nghệ/loại mối, RFI, đợt và dữ liệu chốt của bộ hồ sơ; không thay đổi kết quả thí nghiệm cũ hoặc tự coi đã nghiệm thu. Có thể chạy lại. Trigger tại bảng nhật ký bảo đảm tất cả đường thêm mối đều khởi tạo chất lượng trong cùng transaction; mối chưa nhập kiểm tra vẫn xoá được.

Chưa tự áp dụng dung sai PQ. Phải tạo tiêu chí có đủ biên giới hạn, quy tắc NDT/RFI, phiên bản và người xác nhận trước khi ghi kiểm tra theo tiêu chí đó. Giai đoạn 2 đã thêm API và giao diện kiểm tra; RFI/nghiệm thu/bản in thuộc các giai đoạn sau. Dữ liệu chất lượng/RPC chỉ cấp cho `service_role`; lớp gọi DB tại `src/lib/server/weldQualityDb.ts` yêu cầu `SUPABASE_SERVICE_ROLE_KEY` trên server. API kiểm tra xác thực trước khi gọi; không đưa khoá này ra trình duyệt.

Xem quy tắc và tiến độ trong [README kế hoạch](../README.md). Kiểm tra phần nền từ thư mục ứng dụng:

```powershell
node scripts/test-weld-quality.mjs
node scripts/test-journal-pagination.mjs
node scripts/test-overview-report.mjs
node scripts/test-lunch-break.mjs
```

Kiểm thử DB dùng PostgreSQL tạm/PGlite, không chạm DB thật. Cài công cụ vào thư mục tạm ngoài kho mã rồi truyền đường dẫn module; không cần thêm dependency vào ứng dụng:

```powershell
$qualityTestRoot = Join-Path $env:TEMP 'thanhphat-quality-db-test'
npm install --prefix $qualityTestRoot --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.5.12
node scripts/test-weld-quality-db.mjs (Join-Path $qualityTestRoot 'node_modules/@electric-sql/pglite/dist/index.js')
```

Test dùng schema nguồn tối thiểu; chưa thay thế kiểm thử trên bản sao DB thật hoặc thử nhiều kết nối đồng thời.

### Nhật ký kiểm tra chất lượng — giai đoạn 2

Migration bổ sung ở gốc kho mã: `supabase/migration_20261028_nhat_ky_kiem_tra_chat_luong.sql`. **Đã áp dụng** lên `ssgwccxdcpejyytmfarc` lúc **15:34:58 ngày 28/10/2026 (UTC+7)** sau lần chạy thử có hoàn tác. View chỉ server đọc và hai trigger mới đã bật; số dòng và dấu kiểm tra toàn bộ 13.515 nhật ký giữ nguyên. Không tự sinh tiêu chí hoặc kết quả đo.

Để mở kiểm tra chất lượng, cần cả `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASIC_AUTH_USER` và `APP_BASIC_AUTH_PASSWORD` trên server. Hai biến Basic Auth **chưa có ở môi trường cục bộ hiện tại**. Người quản trị tự đặt cả hai trong `.env.local` hoặc môi trường hosting rồi khởi động/triển khai lại ứng dụng. Cơ chế sẵn có sẽ yêu cầu đăng nhập cho **toàn ứng dụng**; trình duyệt dùng phiên đăng nhập này khi gọi API chất lượng. Không ghi thông tin đăng nhập vào Git hoặc README. Thiếu cấu hình, API trả 503; chưa đăng nhập/sai thông tin trả 401. Nhật ký cũ vẫn xem được khi Basic Auth chưa bật.

Thao tác sau khi cấu hình:

1. Vào **Nhật ký hàn → Kiểm tra** hoặc mở chi tiết → **Kiểm tra chất lượng**.
2. Chọn tiêu chí theo dự án/công nghệ/loại mối. Nếu chưa có, dùng **Thiết lập dung sai dự án**, nhập bốn giới hạn có dấu và xác nhận căn cứ, biên và quy tắc NDT. Không sao chép ví dụ PQ nếu chưa được chấp thuận.
3. Nhập ngày mài, trực quan và bốn số đo mm. Để trống là chưa đo; nhập `0` là có đo. Chọn phương pháp/ngày/kết quả NDT rồi **Lưu kiểm tra**. NDT Đạt chưa phải Nghiệm thu đạt.
4. Dùng ô chọn hoặc **Chọn trang này**/**Chọn toàn bộ kết quả lọc** trước **Đạt tất trực quan / NDT**. Kiểm tra số lượng, tiêu chí và ngày; mối lỗi hoặc đã đổi phiên bản được báo riêng, không ghi đè. Có thể dừng sau lượt hiện tại.
5. Để nhập kiểm tra Excel, **Xuất Excel** nhật ký trước, sửa các cột kiểm tra và giữ Mã bản ghi/Phiên bản kiểm tra, rồi chọn **Nhập kiểm tra Excel**. Hỗ trợ file xuất Việt/Anh. Ô trống giữ dữ liệu cũ; xóa một giá trị trên màn hình kiểm tra nếu cần. File mẫu sản xuất vẫn tạo mối như trước, không chứng minh nghiệm thu.

Khi đã ghi NDT, màn hình/import cũ không được sửa trái kết quả kiểm tra. Mối đã nghiệm thu bị khóa sửa kiểm tra cho đến khi có quy trình bản sửa đổi. Phát hành RFI/nghiệm thu/in hồ sơ chưa có trong giao diện giai đoạn này.

Kiểm tra thêm từ thư mục ứng dụng:

```powershell
node scripts/test-weld-quality-journal.mjs
```

Script kiểm tra xác thực/origin, người ghi nhận từ server, lọc trước phân trang, chọn/xuất hơn 1.000 dòng, thao tác hàng loạt có lỗi, phiên bản, bảo toàn số đo và Excel Việt/Anh. Bài `test-weld-quality-db.mjs` phía trên kiểm tra cả hai migration, đồng bộ NDT và chặn sửa qua đường cũ. Chưa hoàn tất thử nhập–lưu trên trình duyệt/DB thật do chưa có cấu hình đăng nhập; không có dữ liệu thử được ghi vào DB thật.

## RFI và bộ 3 biên bản nghiệm thu

Chạy `supabase/migration_20261031_rfi_quy_trinh.sql` sau các migration chất lượng 28–29/10. Migration thay thế RPC phát/hoàn thành RFI, tạo sẵn bộ hồ sơ nháp khi phát phiếu, bổ sung thao tác ký chung và đồng bộ tình trạng Đạt với đủ 3 chữ ký. RFI cũ đang hiệu lực chưa có hồ sơ được bổ sung bộ nháp; hồ sơ đã có được giữ nguyên.

- RFI mới chỉ chọn mối **Chờ siêu âm và nghiệm thu**, chưa thuộc RFI hiệu lực khác.
- Sau phát RFI, xác nhận in để mở đủ bộ **(1) Phụ lục**, **(2) Nghiệm thu công việc**, **(3) Hoàn thành công việc**. Có thể in lại cả bộ từ Hồ sơ nghiệm thu. Biên bản (3) gồm 2 trang; phụ lục chia 20 mối/trang.
- Bản in riêng và cả bộ dùng cùng mẫu. Kết quả chưa kiểm tra để trống; không tự kết luận đạt hoặc tự điền số đo.
- Hoàn thành nghiệm thu cập nhật bộ nháp, không tạo bộ thứ hai. Chỉ xác nhận **Đã ký** sau hoàn thành kiểm tra và có đủ cả 3 biên bản; đặt lại **Chờ ký** đồng bộ cả bộ. Báo cáo ngày chỉ tính mối đã ký đủ hồ sơ.

Kiểm thử: `node scripts/test-rfi-print.mjs`, `node scripts/test-rfi-monitoring.mjs`, `node scripts/test-weld-acceptance.mjs` và `node scripts/test-rfi-lifecycle-db.mjs <đường-dẫn-pglite/dist/index.js>`. Bài cuối kiểm tra giao dịch, phát phiếu tạo đủ 3 hồ sơ, lọc trạng thái, lưu lại đợt nháp, thử lại yêu cầu, thiếu biên bản và ký/bỏ ký đồng bộ trên PostgreSQL tạm.

## Biến môi trường Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` chỉ trên server, cần cho lớp dữ liệu chất lượng và các API quản trị
- `APP_BASIC_AUTH_USER`
- `APP_BASIC_AUTH_PASSWORD`
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_SHARED_DRIVE_ID` nếu dùng Shared Drive
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` nếu dùng Google Maps

Hai biến Basic Auth phải được cấu hình cùng nhau. API kiểm tra chất lượng khóa khi thiếu cấu hình; nhật ký sản xuất hiện có vẫn xem được. Khi cấu hình, Basic Auth bảo vệ toàn ứng dụng. Các API lưu trữ khác giữ cơ chế kiểm soát hiện tại của dự án.

Service Account Google phải có quyền truy cập thư mục Drive đã cấu hình. Thư viện tài liệu chỉ nhận PDF tối đa 250 MB và thao tác xóa chỉ chuyển file vào Thùng rác.

## Kiểm tra trước khi đẩy Git

```bash
pnpm lint
pnpm build
git diff --check
```
