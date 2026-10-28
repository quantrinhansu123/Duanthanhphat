# Hệ thống Quản lý Nhân sự Thành Phát

Ứng dụng Next.js quản lý nhân sự, đào tạo, chứng chỉ, máy hàn, nhật ký hàn, GPS và báo cáo.

## Chạy cục bộ

```bash
pnpm install
pnpm dev
```

Mở `http://localhost:3010`.

Sao chép `.env.example` thành `.env.local` và điền các biến cần dùng. Không commit `.env.local`.

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
