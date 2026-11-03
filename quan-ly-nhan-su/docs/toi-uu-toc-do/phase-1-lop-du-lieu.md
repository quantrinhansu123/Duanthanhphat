# Giai đoạn 1 — Lớp dữ liệu dùng chung (≈ 1–2 ngày)

## Mục tiêu
Một chỗ duy nhất quản lý tải dữ liệu: cache theo key, trả dữ liệu cũ ngay rồi làm mới ngầm, gộp request trùng, cung cấp `mutate` để sửa cache tại chỗ. Nền tảng cho giai đoạn 2.

## Thiết kế
File mới `src/lib/useResource.ts` (client):

```ts
useResource<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>, opts?: { staleMs?: number })
// → { data, error, loading, refreshing, reload(), mutate(updater: (cur: T) => T) }
```

- Cache `Map<key, {data, at, promise}>` ở mức module (sống qua các lần chuyển tab).
- Mở tab: có cache → hiển thị ngay; quá `staleMs` (mặc định 60 giây) → làm mới ngầm, không hiện spinner toàn trang.
- Request trùng key đang chạy → dùng chung một promise (dedupe).
- `AbortController`: đổi key/unmount thì hủy request cũ, bỏ kết quả muộn.
- `mutate(updater)`: sửa cache và thông báo mọi component đang dùng key đó (dùng `useSyncExternalStore`).
- Lỗi: giữ dữ liệu cũ, trả `error`; không xóa danh sách đang hiển thị.

## Các bước
1. Viết `useResource.ts` + test đơn vị nhỏ (script `.mjs` trong `scripts/`, theo mẫu `test-*.mjs`): dedupe, stale, abort, mutate, lỗi giữ dữ liệu cũ.
2. Thí điểm trên `SparePartsList`: thay `useEffect + loadSpareParts` bằng `useResource("spare-parts", loadSpareParts)`.
3. Đối chiếu Network: mở tab → rời đi → quay lại trong 60 giây không phát request mới.
4. Chỉ khi thí điểm ổn mới chuyển các màn khác (làm dần ở giai đoạn 2–3, mỗi PR một màn).

## Quy ước đặt key
`<bảng>[:<bộ lọc>]`, ví dụ `spare-parts`, `machines`, `weld-history:<project>:<page>`. Danh sách key ghi trong `src/lib/resourceKeys.ts` để tránh trùng/gõ nhầm.

## Tiêu chí hoàn thành
- Quay lại tab đã mở: dữ liệu hiện tức thì, không spinner.
- Hai component cùng key → 1 request.
- Test đơn vị đạt; `tsc` sạch.

## Rủi ro và cách xử lý
- Dữ liệu cũ hiển thị sai sau khi người khác sửa → làm mới ngầm + (giai đoạn 2) realtime cho bảng dùng chung.
- Cache phình bộ nhớ → giới hạn số key (LRU 50) và xóa cache khi đăng xuất.
- Dữ liệu theo quyền người dùng → xóa toàn bộ cache khi đổi tài khoản.
