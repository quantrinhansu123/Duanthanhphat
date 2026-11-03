# Giai đoạn 0 — Đo lường (≈ 0,5 ngày)

## Mục tiêu
Có số liệu "trước" để biết tối ưu có hiệu quả; chốt danh sách tab ưu tiên.

## Việc cần làm
1. Với mỗi tab trong `src/lib/tabModules.ts`, ghi vào bảng đo:
   - số request khi mở tab (Chrome DevTools → Network, tắt cache, "Fast 4G");
   - tổng KB tải về, thời gian tới khi có dữ liệu đầu tiên;
   - số lần render dư (React DevTools Profiler) khi gõ ô tìm kiếm và khi lưu một dòng.
2. Đo riêng thao tác ghi: bấm Lưu → giao diện cập nhật bao lâu; có bị tải lại toàn bảng không (nhìn Network).
3. Thêm công cụ đo tối thiểu, chỉ bật ở môi trường dev: `performance.mark("tab:<id>:start")` / `mark("...:data")` trong hook ở giai đoạn 1.
4. Chốt **5 tab chậm nhất** + **5 thao tác ghi chậm nhất** làm mục tiêu.

## Đầu ra
`docs/toi-uu-toc-do/do-luong-truoc.md`: bảng số liệu (tab | request | KB | ms | ghi chú).

## Tiêu chí hoàn thành
Có bảng số liệu và danh sách mục tiêu; ngưỡng đích (ví dụ: tab danh sách < 1 giây có dữ liệu, lưu một dòng < 300 ms trên giao diện).

## Rủi ro
Không có (chỉ đọc).
