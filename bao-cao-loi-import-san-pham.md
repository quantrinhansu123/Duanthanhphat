# Tổng hợp lỗi và rủi ro khi import sản phẩm

**Ngày rà soát:** 18/11/2026  
**Phạm vi:** import danh mục sản phẩm và bảng quy đổi sản phẩm từ Excel/CSV trong code hiện tại.

## Kết luận về việc làm tròn

Không nên kết luận rằng importer luôn giữ nguyên tuyệt đối mọi chữ số. Parser đọc Excel với `raw: true`, vì vậy không lấy số đã định dạng để hiển thị trong Excel. Tuy nhiên, sau đó `cellToText()` chuyển số qua `toPrecision(15)`. Bước này có thể làm mất hoặc đổi chữ số ở giá trị có trên 15 chữ số có nghĩa. Đây là giới hạn thực trong importer.

Với số thập phân thông thường như `1.23456`, code không chủ động làm tròn về 2 chữ số. Nếu màn hình chỉ hiện `1,23`, cần đối chiếu giá trị ô gốc, payload gửi API, giá trị DB và cách UI định dạng trước khi kết luận dữ liệu đã bị làm tròn. Chưa có file Excel của lần import vừa rồi và snapshot trước/sau DB trong phạm vi rà soát này, nên chưa thể xác định chính xác tại công đoạn nào số bị đổi.

## Các lỗi/rủi ro đã xác định

### 1. Có thể mất độ chính xác với số có nhiều chữ số

- `raw: true` đọc giá trị số thực của ô, không đọc chuỗi đã định dạng.
- Cả parser danh mục và parser quy đổi dùng `toPrecision(15)` để chuyển số thành chuỗi. Đây không phải cách giữ chuỗi thập phân nguyên gốc; giá trị có độ chính xác cao hơn có thể bị làm tròn.
- Excel cũng lưu ô kiểu số dưới dạng số dấu phẩy động, nên `raw: true` không thể khôi phục chữ số mà file đã mất trước đó.

**Ảnh hưởng:** trọng lượng, khổ, mét dài hoặc hệ số quy đổi có nhiều chữ số có thể khác file nguồn ở phần cuối.

### 2. Ô trống trong file có thể xóa giá trị đang có

- Import danh mục vẫn gửi các trường trống.
- Khi cập nhật theo mã sản phẩm, API có thể ghi `null` cho các trường được gửi trống.

**Ảnh hưởng:** file thiếu cột/thông tin có thể xóa dữ liệu cũ ngoài ý muốn.

### 3. Có thể ghép nhầm sản phẩm theo mã

- Thiếu `Mã SP` thì importer dùng `Mã AMIS` làm mã sản phẩm.
- Bản ghi đang có được tìm theo mã đó. Các biến thể có chung mã nhưng khác tên sản phẩm/tên sản xuất có thể bị cập nhật nhầm.
- Dòng mới trong cùng file không được đối chiếu lại với danh sách đã cập nhật sau mỗi lần POST; file có mã lặp cần được kiểm tra trước.

### 4. Tên sản xuất được dựng lại từ các cột thông số

Importer lấy `Tên sản xuất mới` để suy ra thông số, rồi ghép lại tên chuẩn từ `Tên gốc`, nhóm hàng, màu, NP/hàng phế, độ li, ZEM, ĐM, khổ và mét dài. Vì vậy tên lưu trong DB có thể khác chuỗi nhập trong Excel; nếu các cột chi tiết mâu thuẫn nhau, tên và thông số lưu có thể không như mong đợi.

### 5. Nhầm các trường độ li, ZEM và định mức kg

- Độ li, ZEM, ĐM theo li và ĐM theo kg là các trường riêng.
- Có xử lý tương thích cho file cũ ghi `(đm n kg)` trong cột ĐM li; nhưng dữ liệu không có đơn vị hoặc nhãn không rõ có thể bị bỏ qua hay suy từ tên sản xuất.
- Nhóm Đặc/Rỗng không nhận ĐM kg theo quy tắc importer hiện tại.

### 6. Có nguy cơ nhầm NP với phân loại hàng phế

Trong `productCatalogRowToPayload()`, nếu thiếu trường Hàng phế, importer có nhánh suy `hàng nguyên phế` khi phát hiện NP. Quy tắc dữ liệu trong manifest lại yêu cầu Hàng phế dựa trên marker tường minh trong tên sản xuất. Hai cách hiểu này có thể không tương đương và cần thống nhất để tránh gán sai loại phế.

### 7. Import có thể lưu một phần rồi mới báo lỗi

- Import danh mục hiện gửi từng dòng riêng lẻ.
- Dòng thành công được lưu ngay; dòng lỗi được tổng hợp sau đó, không hoàn tác các dòng đã lưu.
- Chưa có bước xem trước toàn bộ thao tác cập nhật/thêm mới trước khi ghi DB.

### 8. Danh mục và quy đổi là hai luồng import riêng

File danh mục không thay thế file quy đổi. Bảng quy đổi được đọc riêng và ghép sản phẩm theo mã AMIS/tên; mã trùng nhưng nhiều biến thể có thể cần đủ thông tin nhận diện để tránh ghép vào sai sản phẩm.

## Kiểm tra cần làm cho lần import vừa rồi

Để xác định lỗi làm tròn cụ thể, cần so sánh cùng một trường ở bốn bước:

1. Giá trị thực trong ô Excel (không chỉ giá trị đang hiển thị theo format).
2. Chuỗi sau `cellToText()` và payload trước khi gửi API.
3. Giá trị phản hồi từ API/DB sau import.
4. Giá trị đang hiển thị trên bảng sản phẩm.

Nếu payload đã khác Excel thì lỗi ở bước đọc/chuyển kiểu. Nếu payload đúng nhưng DB khác thì kiểm tra API/schema. Nếu DB đúng nhưng màn hình khác thì lỗi nằm ở định dạng hiển thị.

## Các điểm nên sửa

- Tránh chuyển số Excel qua `toPrecision(15)` khi cần bảo toàn số lẻ; giữ chuỗi giá trị nguồn hoặc dùng cách chuyển đổi thập phân không làm tròn.
- Mặc định ô trống nên giữ nguyên giá trị cũ; chỉ xóa khi người dùng chủ động chọn xóa.
- Thêm bước xem trước: mã khớp, dòng trùng, trường sẽ bị xóa/đổi, thông số được suy ra và số chữ số thay đổi.
- Thống nhất quy tắc NP và Hàng phế giữa parser, form, API và manifest.
- Đối chiếu danh sách các mã trùng trong file trước khi bắt đầu ghi; báo rõ các dòng cùng mã nhưng khác nhận diện.

## Mã nguồn đã rà soát

- `src/utils/productCatalogExcel.ts` — parser danh mục và dựng payload.
- `src/utils/productConversionExcel.ts` — parser bảng quy đổi.
- `src/features/san-pham/index.tsx` — luồng gửi import từng dòng và đối chiếu mã.
- `server.ts` — API cập nhật sản phẩm và import quy đổi.
- `docs/ai-tables/san_pham.md` — quy ước dữ liệu và hướng dẫn import.
