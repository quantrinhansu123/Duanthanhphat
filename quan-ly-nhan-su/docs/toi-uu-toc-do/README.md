# Kế hoạch tối ưu tốc độ & cập nhật theo từng dòng

Mục tiêu: tải trang nhanh, thao tác bất đồng bộ không chặn giao diện, **lưu/sửa/xóa chỉ cập nhật đúng dòng đó** (không tải lại toàn bộ danh sách/trang), và không phát sinh lỗi mới.

## Các giai đoạn (mỗi giai đoạn merge và kiểm tra độc lập)

| # | File | Nội dung | Rủi ro | Giá trị |
|---|------|----------|--------|---------|
| 0 | [phase-0-do-luong.md](phase-0-do-luong.md) | Đo hiện trạng, chốt mục tiêu | Thấp | Cơ sở để không tối ưu mù |
| 1 | [phase-1-lop-du-lieu.md](phase-1-lop-du-lieu.md) | Hook cache dùng chung `useResource` | Thấp | Mở lại tab tức thì |
| 2 | [phase-2-cap-nhat-tung-dong.md](phase-2-cap-nhat-tung-dong.md) | Optimistic update, bỏ "tải lại toàn bộ" | Trung bình | Đúng yêu cầu chính |
| 3 | [phase-3-giam-du-lieu-tai.md](phase-3-giam-du-lieu-tai.md) | Chọn cột, phân trang server, index | Cao | Giảm payload/thời gian query |
| 4 | [phase-4-bundle-render.md](phase-4-bundle-render.md) | Tách file lớn, lazy modal, memo | Trung bình | Giảm JS và giật |
| 5 | [phase-5-on-dinh-kiem-thu.md](phase-5-on-dinh-kiem-thu.md) | Race, abort, retry, test | Thấp | Không lỗi |

Thứ tự: 0 → 1 → 2 → 3 → 4 → 5. Giai đoạn 2 mang lại cảm nhận nhanh rõ nhất; giai đoạn 3 rủi ro nhất nên làm sau và kiểm tra từng bảng.

## Nguyên tắc chung

- Không thêm dependency khi chưa cần (hook cache tự viết, ~60 dòng).
- Mỗi giai đoạn: nhánh git riêng, `npx tsc --noEmit` sạch, chạy script test liên quan trong `scripts/`, thử tay trên trình duyệt trước khi merge.
- Làm thí điểm trên **một** màn (`SparePartsList`) rồi mới nhân rộng.
- Mọi thay đổi schema đi kèm file `supabase/migration_YYYYMMDD_*.sql`, chạy được nhiều lần (`if not exists`).

## Hiện trạng đã khảo sát (2026-11-03)

- 42 chỗ `select("*")` trong `src/lib`; 261 `useEffect` tự fetch; chưa có cache dùng chung.
- Màn còn gọi lại toàn bộ danh sách sau khi ghi: `DailyWorkReport` (15 lệnh refresh/reload/load), `WeldAcceptanceWorkflow` (14), `WelderManagement` (8), `DocumentLibrary` (7, `reload()` sau mỗi thao tác), `MachineAssignmentList` (5, `reload`/`reloadFuel`).
- Màn đã cập nhật từng dòng đúng cách (mẫu tham chiếu): `SparePartsList` (`setList(current.map(...))` dùng bản ghi server trả về).
- File lớn: `WeldingJournalList` 3.642 dòng, `ProjectManagement` 2.694, `WelderManagement` 2.546, `MachineList` 2.359, `DailyWorkReport` 2.132, `CertificateManagement` 2.002.
- Đã có: prefetch chunk khi hover menu (`src/lib/tabModules.ts`), phân trang server ở Lịch sử hàn, phân trang client (`src/components/Pager.tsx`).

## Tiến độ thực hiện (2026-11-03)

| Giai đoạn | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| 0 Đo lường | Bỏ qua | Cần đo bằng DevTools trên trình duyệt, chưa làm |
| 1 Lớp dữ liệu | Xong | `src/lib/resourceCache.ts`, `useResource.ts`; thí điểm `SparePartsList`; test `scripts/test-resource-cache.mjs` |
| 2 Cập nhật từng dòng | Xong một phần | `MachineAssignmentList` (dầu: lưu/xóa tại chỗ), `DocumentLibrary` (xóa/sửa tại chỗ, làm mới ngầm không nháy trắng), `WelderManagement` (làm mới ngầm), `DailyWorkReport` (xóa phiếu tại chỗ). `WeldAcceptanceWorkflow` giữ nguyên vì dữ liệu do server tính (số phiếu, mối còn lại) |
| 3 Giảm dữ liệu | Xong một phần | Lịch sử hàn tải các trang song song: 13.475 dòng từ 3,06 s xuống 0,61 s (`scripts/test-parallel-pages.mjs`). Chưa làm: bỏ `select("*")`, phân trang server, index (cần số liệu Query Performance và schema) |
| 4 Bundle/render | Xong một phần | `xlsx` và `QrScanDialog` (jsqr) nạp khi dùng ở Nhật ký hàn. Chưa làm: tách 6 file lớn, `memo` hàng bảng |
| 5 Ổn định | Xong một phần | Đọc lỗi mạng thử lại 2 lần (0,5 s, 1,5 s); ghi không thử lại. Chưa làm: kịch bản thủ công trên trình duyệt |

Kiểm tra: `tsc --noEmit` sạch, `next build --webpack` thành công, hai script test đạt.
