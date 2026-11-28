# Kế hoạch triển khai: phần B nhật ký thi công theo ảnh

Worker 2 (Claude) chỉ lập kế hoạch, không sửa code. Căn cứ: `docs/yeu-cau-bao-cao-thi-cong-theo-anh.md` (worker 1) và đọc mã thực tế. Chưa chạy UI hay in. Số dòng là theo mã lúc đọc và có thể lệch khi worker khác sửa.

**Phạm vi:** "báo cáo ngày" trong yêu cầu thực chất là mẫu **B. TÌNH HÌNH THI CÔNG HÀNG NGÀY** của nhật ký thi công (`ConstructionDiary.tsx`). Trang Báo cáo ngày (`DailyWorkReport.tsx`, `DailyWorkReportPrint.tsx`) là mẫu khác. Nó chỉ là nguồn dữ liệu thiết bị và công việc, và không cần sửa cho B-01..B-07.

Phần nghiệm thu `/trien-khai` (`DeploymentHandoverList.tsx`) **thuộc worker 4**. Plan này không đụng tới. Chỗ chung duy nhất là `lib/server/weldAcceptanceServer.ts`, xem mục 6.

## 1. Kết quả kiểm tra mã

Hiện trạng đã khớp phần lớn B-01..B-06:

| Nội dung | Vị trí | Hiện trạng |
|---|---|---|
| Tiêu đề B, ngày | `ConstructionDiary.tsx:702-703` | `Ngày {day} tháng {m} năm {y}`. Năm lấy từ `date` (`YYYY-MM-DD`) nên không tự suy ra. |
| Thời tiết | `:38-47` `weatherMark`, `:706-712` | Ba ô ☑/☐, nhiệt độ ngày là trung bình `averageDayTemperature` (`constructionDiaryDb.ts:33`), sáng/chiều/tối in nguyên văn. |
| Nhân lực | `constructionDiaryAuto.ts:125`, `constructionDiaryDb.ts:30`, `ConstructionDiary.tsx:716` | Mặc định 4/3/12, sửa được. Có hai hằng trùng nhau (`DIARY_DEFAULT_MANPOWER` và `DEFAULT_MANPOWER`). |
| Thiết bị 2.2 | `constructionDiaryAuto.ts:179` `diaryReportEquipmentText`, `weldAcceptanceServer.ts:220` | 3 nhóm "1. Máy hàn" (mỗi máy một dòng), "2. Máy và thiết bị khác" và "3. Vật tư" (mỗi nhóm viết liền một dòng, ngăn bằng `; `). `diaryMachineName` đổi UN5-… thành "Máy hàn chảy giáp mép di động UN5-…". |
| Mã mối 3.1 | `constructionDiaryAuto.ts:76` `diaryWorkText`, `joinDiaryFieldCodes`, `diaryCode` | Mã `FBW-…` lấy từ `ma_hien_truong`, sắp `localeCompare numeric`, ghép bằng `, `, kết thúc bằng `.`. |
| In A4 | `ConstructionDiary.tsx:60` `.diary-sheet` (210×296mm, `overflow:hidden`), `:656` `DiaryPages` | Mục 3 được chia dòng qua `useWrapped`/`Rows` thành trang 1, các trang giữa và trang cuối. |

Lỗi thiết kế tìm thấy, mỗi lỗi ứng với một ID yêu cầu:

1. **D-01 là lỗi thật.** `Ruled text={d.thietBi}` (`:718`) không giới hạn chiều cao và nằm trong trang 1. `fill1` có `flex:1; min-height:0`. Nếu 2.2 dài, `fill1.clientHeight` giảm về 0, `cap[0]` thành 0 và mục 3 dồn sang trang sau. Nếu 2.2 dài hơn cả một trang thì phần dư bị `overflow:hidden` cắt, tức mất chữ khi in. Trường hợp mục 3 đẩy phần 4–7 và chữ ký sang trang sau thì đã được `cap[1]` xử lý.
2. **B-05: đơn vị.** Dòng thiết bị luôn gắn hậu tố `: N bộ` (`constructionDiaryAuto.ts:186`), kể cả vật tư (đá cắt/đá mài). Bảng `bao_cao_ngay_thiet_bi` chỉ có `ten_thiet_bi`, `so_luong`, `bo_phan`, `nguoi_su_dung`, `ghi_chu` (`dailyReportDb.ts:190-198`). Không có cột mã, quy cách hay đơn vị. Mã và quy cách chỉ nằm trong `ten_thiet_bi` (văn bản tự do). Vì vậy không thể tách mã hay quy cách có cấu trúc, và không được bịa đơn vị "bộ" cho vật tư.
3. **D-02 là lỗi thật.** `pageOf = printStart + index*2` (`:144`) giả định 2 trang/ngày, trong khi số trang thực tế là `2 + midCount`. In ghép nhiều ngày khi mục 3 dài sẽ bị trùng số trang.
4. **B-06: tóm tắt tiêu chí.** 12 mối là con số tổng và danh sách mã lấy từ dữ liệu thật. Mã chưa có `ma_hien_truong` hoặc mã cụt `FBW-` bị bỏ lặng lẽ (`diaryCode`). Số mã in ra có thể ít hơn "khối lượng N mối hàn" mà không có cảnh báo.
5. `weatherMark` đổi "nhiều mây" thành ô "Bình thường". Điều này khớp mô tả ảnh ("nhiều mây", chọn Mưa theo ngày). Ô được chọn lấy từ `thoiTiet` tổng, trong khi sáng/chiều/tối là trường riêng.

## 2. Mapping ID yêu cầu → file/hàm

| ID | Việc cần làm | File / hàm | Ghi chú |
|---|---|---|---|
| B-01 | Không đổi mã. Chỉ thêm test hiển thị. | `ConstructionDiary.tsx:702-703` | Năm lấy từ `date` đã chọn. Fixture dùng một năm rõ ràng. Không suy năm từ ảnh. |
| B-02 | Không đổi mã. Thêm test với fixture 26/31/28 và Mưa. | `weatherMark`, `averageDayTemperature` (`constructionDiaryDb.ts:33`), `:706-712` | (26+31+28)/3 = 28.33 → `Math.round(x*10)/10` = **28.3**, đúng. Cần cho phép form chọn ô Mưa trực tiếp (kiểm tra form `:450-500`). |
| B-03 | Không đổi mã. Test sửa tay phản ánh vào bản xem trước. | `:716`, `DIARY_DEFAULT_MANPOWER` | Tùy chọn P2: hợp nhất hai hằng trùng về một. Chỉ làm nếu không đụng file khác. |
| B-04 | Giữ định dạng. Thêm test cho `diaryMachineName`. | `constructionDiaryAuto.ts:20,179` | "Máy hàn chảy giáp mép di động UN5-150ZC2-C6: 1 bộ" là đầu ra hiện tại cho tên chứa UN5-150ZC2-C6. Máy khác giữ nguyên tên gốc. |
| B-05 | Bỏ hậu tố "bộ" cho nhóm 3 (vật tư), vì không có cột đơn vị. | `constructionDiaryAuto.ts:186` | Xem mục 3. Cần xác nhận với người dùng trước khi đổi. |
| B-06 | Không đổi mã mối. Thêm cảnh báo khi số mã in ra khác khối lượng. | `diaryWorkText` (`constructionDiaryAuto.ts:76`), `diaryReportWorkText` | Nếu `fieldCodes.length < quantity`, thêm ghi chú ngắn kiểu ` (còn N mối chưa có mã hiện trường)`. Xem mục 4. |
| B-07 | Chia trang thiết bị an toàn, xem D-01. | `DiaryPages` `:656-757` | |
| D-01 | Cho 2.2 đi qua cơ chế chia dòng như mục 3, hoặc hạn chế chiều cao và báo cảnh báo. | `DiaryPages`, `Ruled`, `Rows`, `useWrapped` | Xem mục 5. |
| D-02 | Truyền số trang thực tế cho từng ngày. | `pageOf` `:144`, `DiaryPages` | Xem mục 5. |
| D-03 | Chỉ ghi chú, không code. | `AppShell.tsx` (`bc-bao-cao-ngay`) | Chờ xác nhận quy trình. |

## 3. Cấu trúc dữ liệu

Giữ `ConstructionDiary` (`constructionDiaryDb.ts:5`) như hiện tại: `thietBi: string`, `noiDungCongViec: string`. Hai trường này đang được lưu local và Supabase, và bản đã lưu phải còn đọc được. **Không thêm cột, không migration.** Không sửa dữ liệu thật hay bản đã lưu.

Cấu trúc nội bộ đề xuất (không lưu, chỉ dùng khi render), đặt trong `constructionDiaryAuto.ts` hoặc ngay trong `ConstructionDiary.tsx`:

```ts
type DiaryEquipmentLine = { group: "welding" | "other" | "material"; text: string }; // text = ten_thiet_bi nguyên văn + ": SL" (đơn vị chỉ khi nguồn có)
```

Quy tắc:
- Không tách `mã`/`quy cách` ra khỏi `ten_thiet_bi` bằng regex. Nếu tách sai sẽ là suy diễn dữ liệu.
- Thiết bị/vật tư không có tên thì bỏ dòng (đã có `.trim()` filter).
- `so_luong` rỗng thì in tên, không in số lượng.
- Không điền mã, quy cách, số lượng nào ngoài dữ liệu thiết bị (bảng `bao_cao_ngay_thiet_bi`) của báo cáo ngày đã chọn.

## 4. Quy tắc hiển thị và in

1. Hiển thị chỉ từ dữ liệu của ngày đã chọn. Trường nào chưa có dữ liệu thì in dòng chấm `……` như hiện tại, tuyệt đối không điền mẫu.
2. Ảnh gốc bị cắt mép phải/dưới, nên **tính đầy đủ nghiệm thu bằng fixture**, không bằng cách bổ sung dòng ngoài vùng thấy. Mọi giá trị trong ảnh chỉ dùng làm fixture khi được ghi rõ là giả lập, đặt trong test hoặc file riêng, không ghi vào code chạy thật.
3. Vật tư: in `Tên (mã, quy cách nếu nằm sẵn trong tên): SL`. Hậu tố đơn vị chỉ in khi có trong dữ liệu. Với máy hàn và thiết bị khác tiếp tục dùng "bộ", vì đây là quy ước hiện có và là câu mẫu của dự án.
4. Mã mối: giữ thứ tự numeric sort. Thêm ghi chú thiếu mã (B-06) để người đọc biết danh sách chưa đủ, và không tự tạo mã.
5. Phân trang: mỗi dòng 2.2 phải xuất hiện đủ một lần.

## 5. Thiết kế tránh suy diễn và tránh cắt (D-01, D-02)

**D-01: thiết bị dài.** Hai phương án, chọn **A**:

- **A (khuyến nghị): thống nhất 2.2 vào dòng chia trang chung.** Ghép "2.2 Thiết bị:" + `thietBi` vào `section3Print` (hoặc mảng dòng riêng đứng trước mục 3 trong cùng bộ `all`). Khi đó `useWrapped` chia dòng, và trang 1 / trang giữa / trang cuối xử lý tràn tự nhiên. Điều kiện cần: phần tiêu đề B, thời tiết và nhân lực luôn cố định ở trang 1 nên `cap[0]` đã tính theo `fill1`. Cần chú ý `Rows count={cap[0]}` đệm dòng chấm: mục 2.2 hiện đệm `min=5` dòng chấm, bản mới phải giữ hành vi này khi thiết bị ít.
- **B (phương án lùi): giữ `Ruled`, giới hạn chiều cao.** Thêm `max` dòng và hiện cảnh báo trên form khi vượt (không in cắt im lặng). Ít thay đổi nhưng không giải quyết gốc rễ.

Bất biến phải kiểm: tổng số dòng in của 2.2 = số dòng sau ngắt của `thietBi`.

**D-02: số trang.** Thay `pageOf(…, index)` bằng cộng dồn số trang thực tế:

- `DiaryPages` báo ngược số trang đã dùng (`2 + midCount`) qua callback `onPages(key, n)`; component cha giữ `Record<key, number>` rồi tính `pageStart` của ngày i = `printStart + Σ pages[j<i]`.
- Vì `midCount` đo sau khi layout, lần render đầu `pageStart` có thể sai. Chấp nhận re-render một lần (như `cap` đang làm). Phương án lùi: dùng `2 +` ước lượng như cũ nếu callback chưa trả về.

## 6. Thứ tự implement

Mỗi bước làm riêng, kiểm tra tsc sau mỗi bước, và không động chỗ không liên quan.

1. **Fixture và test hiện trạng (không đổi mã).** Tạo fixture giả lập ở `.local-tools/` hoặc test riêng, gắn nhãn "GIẢ LẬP", chụp ảnh trước (form + xem trước + PDF).
2. **B-05**: sửa `diaryReportEquipmentText`: bỏ " bộ" cho nhóm 3. *Xác nhận người dùng trước.* File `constructionDiaryAuto.ts:186` chỉ khoảng 1 dòng.
3. **B-06**: thêm ghi chú thiếu mã ở `diaryWorkText`. Thay đổi chỉ phát sinh khi có mối thiếu mã.
4. **D-01** (phương án A) trong `ConstructionDiary.tsx` `DiaryPages`.
5. **D-02** số trang cộng dồn trong `ConstructionDiaryForm`.
6. Chụp ảnh sau, so với ảnh trước, rồi ghi lại.

Điểm giao cắt với worker khác: `lib/server/weldAcceptanceServer.ts` đang có thay đổi chưa commit và là nơi gọi `diaryReportEquipmentText` (`:220`). Các bước trên **không sửa** file này (chỉ sửa `constructionDiaryAuto.ts` và `ConstructionDiary.tsx`). Nếu phải sửa, phối hợp với worker 4 vì file này cũng phục vụ nghiệm thu `/trien-khai`.

## 7. Kiểm thử

**Tĩnh:**
- `npx tsc --noEmit` trong `quan-ly-nhan-su` (ghi sai khác so với baseline; `tsc-out.txt` ở gốc repo là kết quả cũ, không dùng làm bằng chứng).
- `npx eslint src/components/ConstructionDiary.tsx src/lib/constructionDiaryAuto.ts`.

**Đơn vị (nếu dự án có runner; `package.json` hiện chỉ có `build`, `lint`; chưa thấy script test):** thử trực tiếp bằng script `tsx`, không thêm dependency:
- `averageDayTemperature("…26°C","…31°C","…28°C") === "28.3"`.
- `diaryMachineName("… UN5-150ZC2-C6")` → "Máy hàn chảy giáp mép di động UN5-150ZC2-C6".
- `diaryReportEquipmentText` với fixture 3 nhóm: kiểm nhóm 3 không còn "bộ" nếu B-05 được duyệt.
- `diaryWorkText` với 12 mối giả lập: đủ 12 mã, đúng thứ tự, không trùng; có ID `FBW-0511260009` đúng chính tả.

**UI trước/sau (môi trường cô lập, không dữ liệu thật):**
- Cùng trình duyệt, khổ A4, tỉ lệ 100%. Chụp form, bản xem trước và PDF từng trang; trích văn bản PDF để đối chiếu mã/số lượng.
- Các ca: (a) fixture bình thường, (b) thiết bị dài vượt một trang (D-01), (c) in ghép hai ngày với ngày đầu 3 trang (D-02), (d) dữ liệu trống (dòng chấm).
- Phần ảnh gốc bị cắt chỉ nghiệm thu "đủ dữ liệu fixture", không tuyên bố khớp mẫu.
- Không bấm "lưu" hay "tự điền hàng loạt" (`autofillRange`) trên dữ liệu thật. Nếu cần chạy `autofill`, dùng dự án thử.

## 8. Rủi ro và phương án lùi

| Rủi ro | Mức | Phương án lùi |
|---|---|---|
| Thay đổi chia trang làm lệch đường kẻ (`LINE = 27`) hoặc dư/thiếu trang | Cao | Giữ nguyên `Rows`/`useWrapped`. Chỉ thêm dòng vào mảng; nếu sai, bỏ bước 4, dùng phương án B. |
| Bản đã lưu có `thietBi` dạng cũ | Trung bình | Không đổi định dạng lưu. Chỉ đổi cách tạo dòng khi tự điền và cách hiển thị. |
| Bỏ "bộ" của vật tư làm lệch quy ước người dùng đang quen | Trung bình | Hỏi xác nhận; nếu không đồng ý, giữ nguyên. |
| `weldAcceptanceServer.ts` và `AppShell.tsx` đang bị sửa dở bởi worker khác | Trung bình | Không sửa hai file này trong plan; có chỗ chạm thì làm sau khi worker 4 xong. |
| Ảnh gốc không có trong dự án nên không xác nhận được bố cục | Cao | Chỉ nghiệm thu theo dữ liệu fixture; xin ảnh gốc trước khi tuyên bố khớp. |
| `pageStart` sai ở lần render đầu của in ghép | Thấp | Dùng ước lượng cũ cho đến khi nhận số trang đo thực. |

## 9. Điều cần người dùng xác nhận

1. Ảnh gốc (đầy đủ, không cắt) và năm của ngày 05/11.
2. Vật tư không dùng đơn vị "bộ", hay có đơn vị cụ thể? Nếu cần đơn vị thì phải thêm cột `don_vi` vào `bao_cao_ngay_thiet_bi` (cần migration) hoặc nhập vào tên.
3. Chọn phương án A hay B cho D-01.
4. D-03: lối vào mong muốn cho phần B.
