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

Chạy duy nhất migration sau trong Supabase SQL Editor:

```text
supabase/migration_dong_bo_dao_tao_chung_chi_gps.sql
```

Migration đồng bộ đào tạo–học viên–chứng chỉ, liên kết GPS với nhật ký hàn, tạo các RPC transaction và view báo cáo. File có transaction, có thể chạy lại và không xóa bảng dữ liệu.

Không chạy `supabase/drop_all.sql`.

## Biến môi trường Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
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

Hai biến Basic Auth phải được cấu hình cùng nhau. Khi chưa cấu hình, API Google Drive và Cloudinary bị khóa an toàn; các màn hình khác vẫn hoạt động.

Service Account Google phải có quyền truy cập thư mục Drive đã cấu hình. Thư viện tài liệu chỉ nhận PDF tối đa 250 MB và thao tác xóa chỉ chuyển file vào Thùng rác.

## Kiểm tra trước khi đẩy Git

```bash
pnpm lint
pnpm build
git diff --check
```
