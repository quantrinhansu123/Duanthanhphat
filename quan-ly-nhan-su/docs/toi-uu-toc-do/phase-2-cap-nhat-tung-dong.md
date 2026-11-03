# Giai đoạn 2 — Lưu/sửa/xóa chỉ cập nhật đúng dòng (≈ 3–5 ngày)

## Mục tiêu
Sau mọi thao tác ghi, **không tải lại toàn bộ danh sách hay trang**; chỉ thay/thêm/xóa đúng dòng bị ảnh hưởng, giao diện phản hồi ngay.

## Quy ước chung cho mọi thao tác ghi
1. **Optimistic**: cập nhật giao diện ngay bằng `mutate`, đánh dấu dòng `pending` (làm mờ nhẹ, vô hiệu hóa nút của dòng đó).
2. Gọi API; dùng **bản ghi server trả về** (`.select("*").single()`) thay đúng dòng (có thể khác bản optimistic: id, `updated_at`, cột tính toán).
3. **Lỗi**: hoàn tác dòng về trạng thái trước, toast lỗi, giữ nguyên form để người dùng sửa lại. Không `reload`.
4. Chống bấm đúp: khóa theo id dòng trong lúc `pending`.
5. Thêm mới: id tạm `tmp-<timestamp>`, thay bằng id thật khi server trả về.

Mẫu tham chiếu đã đúng: `src/components/SparePartsList.tsx` (`handleSave`, `handleDelete`). Gộp logic lặp lại thành helper `src/lib/optimistic.ts`: `applyOptimistic(key, updater, request) → Promise<result>` (tự hoàn tác khi lỗi).

## Danh sách màn cần sửa (theo thứ tự ưu tiên)

| Màn | Điểm tải lại hiện tại | Cách sửa |
|-----|------------------------|----------|
| `MachineAssignmentList` | `reload()` (~dòng 215), `reloadFuel()` (~328, ~364) | Thay dòng lịch/đổ dầu bằng bản ghi trả về; xóa thì loại dòng |
| `DocumentLibrary` | `reload()` sau mỗi thao tác (7 chỗ: ~199, 209, 219, 258, 295, 312, 361) | Cập nhật cây thư mục/tài liệu tại chỗ; chỉ `reload` khi di chuyển thư mục làm đổi nhiều dòng |
| `WelderManagement` | 8 lệnh refresh | Cập nhật hồ sơ thợ đúng id |
| `DailyWorkReport` | 15 lệnh load/refresh | Cập nhật từng dòng báo cáo/nhân lực; tổng hợp tính lại ở client từ dữ liệu đã có |
| `WeldAcceptanceWorkflow` | 14 lệnh load/refresh | Cập nhật bước/biên bản đúng id |
| `MachineList`, `TrainingList`, `CertificateManagement`, `ProjectManagement`, `WarehouseManagement` | rà soát từng chỗ | Theo quy ước chung |

Mỗi màn = 1 PR riêng. Trước khi sửa, liệt kê **mọi chỗ gọi tải lại** (`grep -n "await reload\|await refresh\|await load\|router.refresh\|location.reload"`) và ghi vào mô tả PR để không sót.

## Trường hợp phải tải lại một phần (không tránh được)
- Thao tác làm đổi nhiều dòng (di chuyển thư mục, nhập Excel hàng loạt, tạo mối hàn từ Autolisp): gọi `reload()` **có phạm vi** (đúng key/bộ lọc đang xem), không phải toàn trang.
- Số liệu tổng hợp phía server (thống kê tổng quan): làm mới ngầm sau 1–2 giây, không chặn giao diện.

## Đồng bộ nhiều người dùng (tùy chọn, cần chốt)
Chỉ cho bảng dùng chung nhiều người sửa cùng lúc (nhật ký hàn, phân công máy, báo cáo ngày): đăng ký Supabase Realtime `postgres_changes` theo bảng, mỗi sự kiện → `mutate` đúng dòng. Cần bật Realtime cho bảng đó và kiểm tra RLS cho kênh realtime.

## Kiểm thử
- Với mỗi màn: Network không còn request danh sách đầy đủ sau khi lưu/xóa; chỉ còn đúng 1 request ghi.
- Ngắt mạng giữa chừng → dòng hoàn tác + toast lỗi.
- Bấm Lưu hai lần liên tiếp → chỉ 1 lần ghi.
- Script test hiện có chạy lại sạch (`scripts/test-*.mjs` của màn tương ứng).

## Tiêu chí hoàn thành
Không còn `reload` toàn danh sách sau thao tác ghi đơn lẻ ở các màn trong bảng; thao tác ghi phản hồi giao diện < 100 ms (optimistic).

## Rủi ro và cách xử lý
- Hiển thị khác server (cột tính toán) → luôn ghi đè bằng bản ghi server trả về.
- Thứ tự/sắp xếp lệch sau khi thêm → chèn theo cùng hàm sắp xếp của danh sách, không chèn cuối.
- Phân trang client (`Pager`) → `usePaged` tự về trang hợp lệ khi số dòng đổi.
