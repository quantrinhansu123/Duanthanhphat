# Giai đoạn 5 — Ổn định và kiểm thử (≈ 2–3 ngày, làm xen suốt các giai đoạn)

## Mục tiêu
Bất đồng bộ không sinh lỗi: không race, không ghi đôi, không mất dữ liệu khi lỗi mạng.

## 5.1 Race và hủy request
- Mọi fetch theo bộ lọc dùng `AbortController` (đã có trong `useResource`); kết quả của request cũ bị bỏ.
- Chuyển tab/unmount khi đang tải → hủy, không `setState` sau unmount.

## 5.2 Chống ghi trùng và mất dữ liệu
- Khóa theo id khi đang ghi; nút Lưu vô hiệu và hiện "Đang lưu…".
- Cảnh báo khi đóng modal/chuyển tab trong lúc đang `pending`.
- Ghi quan trọng (nhật ký hàn, biên bản): xác nhận bản ghi server trả về khớp trước khi đóng form.
- Lỗi → giữ nguyên dữ liệu người dùng đã nhập, không xóa form.

## 5.3 Thử lại và timeout
- Request đọc: thử lại tối đa 2 lần (backoff 500 ms, 1500 ms) khi lỗi mạng/5xx; không thử lại 4xx.
- Request ghi: **không** tự thử lại (tránh ghi đôi) trừ khi có khóa idempotent (id sinh từ client, `upsert`).
- Timeout 20 giây cho request thường; upload ảnh/Excel dài hơn và có thanh tiến trình.

## 5.4 Hiển thị lỗi và trạng thái
- Thống nhất toast lỗi + nút "Thử lại" cho thao tác thất bại.
- Chỉ báo "đang làm mới" nhỏ khi làm mới ngầm, không che nội dung.

## 5.5 Kiểm thử
- Test đơn vị (script `.mjs` theo mẫu `scripts/test-*.mjs`): `useResource` (dedupe, abort, stale, mutate), `applyOptimistic` (thành công, lỗi hoàn tác, trùng).
- Kịch bản thủ công cho mỗi màn đã đổi (ghi vào `kiem-thu-thu-cong.md`): thêm/sửa/xóa, ngắt mạng, bấm đúp, đổi bộ lọc khi đang tải, hai tab trình duyệt cùng sửa.
- `npx tsc --noEmit` và `next build` sạch trước mỗi merge.
- Sau phát hành: theo dõi lỗi console/Supabase 1 tuần; có sự cố thì revert PR của riêng màn đó (mỗi màn một PR nên revert độc lập).

## Tiêu chí hoàn thành
Toàn bộ kịch bản thủ công đạt; không phát sinh lỗi mới trong 1 tuần theo dõi.
