# Giai đoạn 3 — Giảm dữ liệu tải về (≈ 4–6 ngày, rủi ro cao nhất)

## Mục tiêu
Mỗi lần mở tab chỉ tải đúng cột và đúng số dòng cần hiển thị.

## 3.1 Chọn đúng cột
- Hiện có 42 chỗ `select("*")` trong `src/lib/*Db.ts`.
- Mỗi bảng tách 2 hàm: `listXxx()` chỉ cột hiển thị trong danh sách; `getXxx(id)` đủ cột cho modal chi tiết (tải khi mở).
- Cột nặng (ảnh nhiều, JSON, ghi chú dài, mảng tài liệu) không nằm trong danh sách.
- Ưu tiên bảng lớn trước: lịch sử hàn, nhật ký hàn, báo cáo ngày, đổ dầu, chứng chỉ.

## 3.2 Phân trang phía server
- Mẫu có sẵn: Lịch sử hàn (`WeldingHistoryList` + `weldingHistoryDb.ts`, dùng `range()` và đếm tổng).
- Áp cho bảng có thể vượt vài trăm dòng: nhật ký hàn, đổ dầu, phân công máy, chứng chỉ, tài liệu.
- `Pager` hiện chạy phía client; với chế độ server chỉ cần truyền `rows` đã cắt cùng `total`, `page`, `pageSize` (đã tách `usePaged` nên thay được).
- Lọc và tìm kiếm chuyển xuống truy vấn (`ilike`, `eq`), debounce 300 ms và hủy request cũ.
- Đếm tổng dùng `count: "exact"` chỉ ở trang đầu / khi đổi bộ lọc; đổi trang giữ số cũ.

## 3.3 Index cơ sở dữ liệu
- Rà truy vấn thực tế (Supabase → Query Performance) để chọn cột lọc/sắp xếp: ngày, mã dự án, mã mối hàn, id nhân sự.
- Một migration `supabase/migration_<ngày>_index_toc_do.sql`: `create index concurrently if not exists ...` (chạy lặp được, không khóa bảng).
- Kiểm tra bằng `explain analyze` trước/sau cho 5 truy vấn chậm nhất (ghi vào `do-luong-sau.md`).

## 3.4 Gộp và song song hóa
- Tab nào gọi nhiều request tuần tự (waterfall) → gom bằng `Promise.all` khi độc lập.
- Dữ liệu danh mục ít đổi (loại ray, ca, dự án) → `staleMs` dài (10 phút) trong `useResource`.
- Thống kê tổng quan (`overviewAggregates.ts`): ưu tiên view/RPC tổng hợp phía DB thay vì kéo toàn bảng về cộng ở client.

## 3.5 Ảnh
- Dùng URL Cloudinary đã resize (`w_400,q_auto,f_auto`) cho danh sách; ảnh gốc chỉ khi mở xem.
- `loading="lazy"` và `decoding="async"` cho ảnh ngoài màn hình đầu.

## Kiểm thử
- So sánh KB và ms với `do-luong-truoc.md`.
- Mỗi bảng đổi: số dòng, tổng, lọc, sắp xếp cho kết quả y hệt bản cũ (đối chiếu bằng script trên dữ liệu thật/bản sao).
- Thử bộ lọc rỗng, không có dữ liệu, trang cuối, đổi bộ lọc khi đang ở trang 5.

## Tiêu chí hoàn thành
Payload mở tab giảm rõ rệt (mục tiêu ≥ 50% ở 5 tab chậm nhất); không thay đổi kết quả hiển thị.

## Rủi ro và cách xử lý
- Sai tổng/lệch trang khi lọc phía server → test đối chiếu trước khi bỏ code cũ; làm từng bảng, mỗi bảng 1 PR, quay lại bản cũ được.
- Index làm chậm ghi → chỉ thêm index có truy vấn thật sử dụng.
- RLS ảnh hưởng đếm/lọc → kiểm tra bằng tài khoản vai trò thấp (xem `supabase/migration_20261029_phan_quyen.sql`).
