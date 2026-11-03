# Giai đoạn 4 — Giảm bundle và render (≈ 3–5 ngày)

## Mục tiêu
Ít JS phải tải/parse ở lần mở đầu; gõ tìm kiếm và lưu một dòng không làm render lại cả trang.

## 4.1 Tách file lớn
Thứ tự theo kích thước: `WeldingJournalList` (3.642 dòng), `ProjectManagement` (2.694), `WelderManagement` (2.546), `MachineList` (2.359), `DailyWorkReport` (2.132), `CertificateManagement` (2.002).
- Tách theo ranh giới sẵn có: modal, form, bảng, panel; mỗi cái một file trong thư mục cùng tên (`src/components/machine-list/…`).
- Chỉ di chuyển code, **không đổi logic** trong cùng PR; đảm bảo `tsc` sạch và hành vi y hệt.
- Giữ nguyên đường dẫn import công khai của component gốc (re-export) để không vỡ `tabModules.ts`.

## 4.2 Nạp theo nhu cầu
- Modal lớn (chi tiết, form, in, nhập Excel) dùng `next/dynamic` / `import()` khi mở lần đầu.
- Thư viện nặng (xlsx, exceljs, chart, jsQR, thư viện in) chỉ import trong hàm dùng đến, không ở đầu file.
- Kiểm tra bằng `next build` (xem kích thước từng route); chạy `@next/bundle-analyzer` một lần để tìm gói lớn bất ngờ (không cài thường trú).
- Đã có prefetch chunk khi hover menu (`tabModules.ts`): bổ sung prefetch dữ liệu (preload `useResource`) cho tab sắp mở.

## 4.3 Giảm render
- Hàng bảng: tách thành component `memo` với props ổn định (id + dữ liệu dòng), để sửa một dòng chỉ render lại dòng đó.
- Ô tìm kiếm: `useDeferredValue` cho chuỗi lọc, danh sách lọc bằng `useMemo` (nhiều nơi đã có).
- Tránh tạo object/hàm mới mỗi lần render truyền xuống hàng (`useCallback` cho handler theo id).
- Danh sách rất dài không phân trang: cân nhắc ảo hóa (chỉ khi đo thấy cần).

## Kiểm thử
- Profiler: sửa 1 dòng → chỉ 1 hàng render; gõ tìm kiếm không giật (INP < 200 ms).
- `next build`: kích thước route trước/sau ghi vào `do-luong-sau.md`.
- Hành vi giữ nguyên: chạy lại script test của từng màn.

## Tiêu chí hoàn thành
JS của 6 file lớn giảm đáng kể ở lần mở đầu; không đổi hành vi.

## Rủi ro và cách xử lý
- Tách file làm vỡ state dùng chung → tách từng phần nhỏ, mỗi bước chạy `tsc` + thử tay.
- Lazy modal có độ trễ lần đầu mở → prefetch khi rê chuột lên nút mở.
