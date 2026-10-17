# Hướng dẫn sử dụng phần mềm quản lý hàn ray

Cập nhật: 17/10/2026. Áp dụng cho phiên bản local hiện tại của Thanh Phát.

Tài liệu hướng dẫn thao tác trên web, nhập thông số và đọc kết quả của bảng tính giải toả ứng suất R2.

## 1. Mở phần mềm

Khi web local đang chạy, mở một trong các địa chỉ sau:

| Trang | Địa chỉ | Chức năng |
| --- | --- | --- |
| Tổng quan | <http://127.0.0.1:3000> | Xem sơ đồ và bấm từng ô ray để tính |
| Giải toả ứng suất R2 | <http://127.0.0.1:3000/giai-toa-ung-suat> | Tính độc lập theo mẫu Excel 60R2 |
| Ký hiệu công trình | <http://127.0.0.1:3000/cong-trinh> | Xem, thêm, sửa và xóa ký hiệu |

Trên điện thoại hoặc cửa sổ hẹp, bấm nút menu ở góc trên bên trái để chọn chức năng.

### Khởi động lại web local

Máy cần có Node.js 24 trở lên và các thư viện của dự án đã được cài. Mở PowerShell trong thư mục dự án và chạy:

```powershell
cd D:\thanhphatquanlyhanray
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Giữ cửa sổ terminal này mở. Khi xuất hiện `Ready`, mở địa chỉ trang tổng quan. Dùng `Ctrl+C` trong terminal để dừng web. Địa chỉ `127.0.0.1` dùng trên chính máy đang chạy dự án.

## 2. Xem chi tiết từng ô ray

1. Mở trang **Tổng quan (Track Map)**.
2. Tìm bảng **Sơ đồ 4 dải ray**. Trên cửa sổ hẹp, cuộn ngang để xem các đoạn.
3. Bấm vào ô nhiệt độ, ví dụ **UT-02 — 36°C**.
4. Bảng chi tiết hiện ở bên phải sơ đồ, gồm mã đoạn, tuyến, bên ray, lý trình, chiều dài và bảng tính R2. Trên màn hình nhỏ, bảng nằm dưới sơ đồ và được đưa vào tầm nhìn.
5. Mở **Thông số đầu vào** để chỉnh các giá trị cần tính; kết quả cập nhật ngay khi nhập.
6. Bấm **Xuất CSV** để giữ lại dữ liệu trước khi đóng hoặc chuyển đoạn.

Quy ước mã đoạn hiện tại:

| Tiền tố | Tuyến / bên ray |
| --- | --- |
| UT | Tuyến thượng — Ray trái |
| UP | Tuyến thượng — Ray phải |
| DT | Tuyến hạ — Ray trái |
| DP | Tuyến hạ — Ray phải |

**Nhiệt độ trên ô ray là nhiệt độ khóa đường T.** Ví dụ ô 36°C sẽ đưa T = 36°C vào bảng tính. Đây không phải số đo nhiệt độ thi công tại hai neo.

Chiều dài được lấy từ hiệu lý trình cuối và đầu. Đoạn `0+500 → 1+000` có chiều dài 500 m; khi mở bảng, Lt = 500 m và Lp = 0 m.

Các thông số khác dùng mẫu 60R2, trong đó nhiệt độ hai neo mặc định đều là 20°C. Hãy thay bằng dữ liệu phù hợp với lần tính của bạn.

Trong lúc bảng bên phải đang mở, bạn vẫn có thể cuộn sơ đồ và bấm trực tiếp ô ray khác để cập nhật nội dung. Nút mũi tên chuyển sang đoạn trước hoặc tiếp theo. Nút **X** ẩn bảng chi tiết. Các giá trị đã chỉnh sẽ đặt lại khi chuyển đoạn hoặc đóng bảng; hiện chưa có chức năng lưu bảng tính vào hồ sơ đoạn ray.

### Bố trí công trình và ghép dài tuyến

Trên trang Tổng quan, phần **Bố trí công trình trên tuyến** cho phép:

1. Chọn **Dải ray** cần bố trí.
2. Chọn **Bắt đầu thanh** và **Kết thúc thanh**. Phạm vi tính từ đầu thanh bắt đầu đến cuối thanh kết thúc, trên cùng một dải ray. Ví dụ UT-02 đến UT-04 tương ứng Km 0+500 đến Km 2+000.
3. Chọn **Ký hiệu công trình** trong danh mục của trang Công trình. Có thể nhập tên hiển thị riêng, ví dụ “Cầu C1”.
4. Bấm **Thêm lên sơ đồ**. Ảnh ký hiệu đè trực tiếp lên đường tuyến tại giữa phạm vi được chọn, tên và lý trình nằm phía trên. Hai vạch xanh đánh dấu thanh bắt đầu–kết thúc, dải vàng đánh dấu phạm vi. Công trình cùng dải dùng chung đường tuyến; những ký hiệu quá gần nhau được tách thêm một đường để tránh chồng tên.
5. Bấm trực tiếp ký hiệu để sửa phạm vi/ký hiệu/tên. Khi rê chuột hoặc dùng bàn phím chọn ký hiệu, nút bút chì và thùng rác hiện bên dưới; trên màn hình cảm ứng các nút này hiện sẵn. Xóa khỏi sơ đồ không xóa ký hiệu trong danh mục.

Nếu vừa thêm hoặc sửa ký hiệu tại trang Công trình, bấm **Cập nhật ký hiệu** để nạp lại danh mục vào ô chọn.

Nhập **Số thanh ghép thêm / dải** rồi bấm **Ghép thêm thanh** để kéo dài đồng thời các dải ray. Mỗi thanh mới dài 500 m, có mã nối tiếp và nhiệt độ khóa mẫu 35°C; mỗi lần có thể ghép 1–100 thanh. Các ô mới vẫn mở được bảng chi tiết và tính R2 như ô ban đầu.

Sơ đồ công trình, lý trình và bốn dải ray cùng nằm trong một vùng cuộn ngang. Dùng thanh cuộn phía dưới hoặc cuộn ngang trên bàn di chuột/màn hình cảm ứng để xem đến cuối tuyến. Các công trình giữ đúng phạm vi thanh đã chọn khi tuyến dài thêm.

Sơ đồ tự lưu trên trình duyệt sau khi thêm/sửa/xóa công trình hoặc ghép thanh. Dữ liệu này dùng cùng quy tắc lưu local như mục 6. Nếu ký hiệu đã được dùng trên sơ đồ bị xóa khỏi danh mục, vị trí vẫn còn và hiển thị thông báo để chọn lại ký hiệu.

## 3. Tính giải toả ứng suất R2

Có thể tính trong bảng chi tiết đoạn ray bên phải hoặc mở trang **Giải toả ứng suất R2** từ menu. Trang tính độc lập khởi tạo từ mẫu Excel; bảng chi tiết đoạn ray khởi tạo thêm chiều dài và nhiệt độ khóa của ô được chọn. Trong bảng bên phải, phần nhập liệu được thu gọn sẵn để xem ngay kết quả; bấm **Thông số đầu vào** để mở.

### Chọn phương pháp

| Phương pháp | Cách tính khe hở mục tiêu |
| --- | --- |
| Hàn nhiệt nhôm — ATW | Ld + Ga |
| Hàn chảy giáp mép — FBW | Ld + Gf, giữ dấu của số bù |
| Giải toả ray đơn | Hiển thị “Không áp dụng” cho khe hở hàn |

Ở đây `Ld = ΔL + Mt + Mp`.

Trong chế độ FBW, phần mềm đổi công thức khe cắt; lực và chiều dài neo vẫn sử dụng bộ thông số 60R2 đang nhập. Số bù mặc định −35,5 mm lấy từ mẫu FBW trong workbook. Chọn FBW không tự chuyển sang toàn bộ tham số hoặc đơn vị của các sheet FBW cũ.

### Nhập thông số

Nhập số thuần, không kèm đơn vị và không dùng dấu phân cách hàng nghìn. Chấp nhận dấu chấm hoặc dấu phẩy thập phân, ví dụ `0.007611` hoặc `0,007611`.

| Nhóm | Ô nhập | Đơn vị / cách hiểu |
| --- | --- | --- |
| Chiều dài | Lt, Lp | m; tổng chiều dài L = Lt + Lp |
| Bình diện | Bán kính đường cong R | m; dùng để tra giới hạn chiều dài |
| Nhiệt độ khóa | T | °C; dải khóa được tính là T ± 5°C |
| Nhiệt độ đo | Tt, Tp | °C; nhiệt độ ray tại neo trái và neo phải |
| Nhiệt độ cực trị | Nhiệt độ ray lớn nhất, nhỏ nhất | °C |
| Tiết diện | A | m² |
| Đàn hồi | E | kN/m² |
| Giãn nở | α | /°C |
| Lực cản | r | kN/m |
| Mối nối | Pj | kN |
| Khe hở | Ag, Ga, Gr | mm; lần lượt là khe cấu tạo, khe hàn ATW, khe hiện tại |
| Bù FBW | Gf | mm; nhập cả dấu âm nếu có |
| Chuyển vị đo | Mt, Mp | mm; nhập có dấu theo quy ước dữ liệu của bạn |

Bật **Sử dụng con lăn cạnh** nếu trường hợp tính có con lăn cạnh. Lựa chọn này thay đổi giới hạn chiều dài tra theo bán kính.

Không có nút “Tính”: kết quả tự cập nhật. Nếu ô nhập trống hoặc dữ liệu không hợp lệ, phần mềm hiện lỗi và tạm khóa nút xuất CSV. Ví dụ r phải lớn hơn 0, tổng chiều dài phải lớn hơn 0 và nhiệt độ ray nhỏ nhất phải thấp hơn nhiệt độ lớn nhất.

### Đọc kết quả

Ba ô tóm tắt hiển thị **Lực kéo**, **Giãn dài tự do ΔL** và **Khoảng kéo Ld**. Bảng phía dưới cho biết thêm:

- Nhiệt độ trung bình, chênh nhiệt và chiều dài neo.
- Lực nén/kéo lớn nhất và chiều dài thở.
- Chuyển vị đầu ray, ray đệm 25 m và các cận khe hở.
- Khe hở cắt mục tiêu theo phương pháp đã chọn.
- Công thức và địa chỉ ô Excel để đối chiếu từng kết quả.

Biểu đồ nằm ngay dưới ba ô tóm tắt, trong bảng bên phải và trang tính R2 độc lập:

- Trục ngang: chiều dài từ 0 đến tổng chiều dài L đang nhập.
- Đường đỏ và trục trái: lực kéo P, đơn vị kN.
- Đường xanh và trục phải: giãn dài tự do tích lũy, đơn vị mm.
- Rê chuột hoặc chạm vào biểu đồ để xem giá trị tại một vị trí.

Biểu đồ tự cập nhật khi chọn thanh khác hoặc sửa thông số. Lực P lấy từ kết quả K40 và được biểu diễn bằng đường ngang; giãn dài tích lũy tăng/giảm tuyến tính từ 0 đến ΔL của K43 theo nhiệt độ trung bình. Đây là minh họa hai kết quả tổng của Excel, chưa mô phỏng chuyển vị cục bộ tại vùng neo hay lực cản. Số đo Mt/Mp làm thay đổi Ld, không đổi đường giãn dài tự do. Khi đầu vào có lỗi, biểu đồ tạm ẩn cùng kết quả.

`Khe hở cắt mục tiêu` là giá trị Ld + Ga hoặc Ld + Gf. Công thức này không tự trừ khe hở hiện tại Gr để suy ra lượng vật liệu cần cắt bỏ.

Phần **Kiểm tra theo dữ liệu nhập** hiển thị hai tiêu chí: chiều dài giải toả so với giới hạn tra và K46 so với khe cấu tạo Ag. Chữ “Đạt” ở đây chỉ áp dụng cho tiêu chí đang hiển thị.

### Xử lý thông báo cần kiểm tra

| Thông báo | Việc cần xem lại |
| --- | --- |
| Chiều dài vượt giới hạn | Kiểm tra L, bán kính và lựa chọn con lăn cạnh |
| Chưa xác định tại R = 400 m | Bảng nguồn chưa quy định rõ trường hợp này |
| Nhiệt độ ray cao hơn nhiệt độ khóa | Kiểm tra T, Tt, Tp và ý nghĩa của kết quả kéo âm |
| Pmax nhỏ hơn Pj | Kiểm tra các thông số lực cản và phạm vi áp dụng của công thức |
| Chuyển vị ray đệm âm | Đối chiếu dữ liệu và công thức Excel; phần mềm giữ nguyên dấu để kiểm tra |
| Khe mục tiêu nhỏ hơn khe hiện tại | Kiểm tra Gr, phương pháp hàn, số bù và chuyển vị |

Các thông báo này được tính từ dữ liệu hiện tại. Phần mềm không lấy các ô “OK” nhập tay trong Excel làm kết luận tự động.

Cảnh báo màu vàng vẫn cho phép xem và xuất kết quả để đối chiếu. Lỗi đầu vào màu đỏ sẽ tạm ẩn kết quả và vô hiệu hóa xuất CSV cho đến khi sửa dữ liệu.

### Tra nhanh, khôi phục và xuất kết quả

- Mở **Bảng tra nhanh khe kéo và lực kéo** để xem bảng tra theo nhiệt độ đang tính. Bảng khe kéo giữ hệ số 0,0115 của Excel dù chỉnh α trong bảng chính; bảng lực tra có đơn vị tấn và độc lập với lực P theo EAαΔT.
- **Khôi phục mẫu** đặt lại toàn bộ thông số của lần mở bảng. Trong bảng chi tiết đoạn ray, chiều dài và T khóa được khôi phục theo đoạn đó.
- **Xuất CSV** tải file chứa đầu vào, phương pháp, kết quả, công thức và thông báo cần kiểm tra. File xuất từ đoạn ray có thêm mã đoạn và tên như `giai-toa-UT-02.csv`.

CSV có thể mở bằng Excel. Nếu Excel hiển thị cả dòng trong một cột, dùng chức năng nhập **From Text/CSV**, chọn mã hóa UTF-8 và dấu phân cách dấu phẩy.

## 4. Ví dụ đối chiếu với Excel

Mở trang tính R2 độc lập, chọn **Khôi phục mẫu**. Các giá trị chính của mẫu ATW:

| Thông số | Giá trị |
| --- | --- |
| Lt / Lp | 500 / 0 m |
| T khóa / Tt / Tp | 35 / 20 / 20°C |
| A | 0,007611 m² |
| E | 210.840.000 kN/m² |
| α | 0,0000115 /°C |
| r / Pj | 24 kN/m / 400 kN |
| Ga | 26 mm |

Kết quả cần thấy:

| Kết quả | Giá trị |
| --- | --- |
| Chênh nhiệt ΔT | 15°C |
| Lực kéo P | 276,81 kN |
| Chiều dài neo | 11,53 m |
| Giãn dài tự do ΔL | 86,25 mm |
| Khoảng kéo Ld, khi Mt = Mp = 0 | 86,25 mm |
| Khe hở cắt mục tiêu ATW | 112,25 mm |

Mẫu này có R = 1.000 m, L = 500 m và chưa bật con lăn cạnh nên sẽ báo vượt giới hạn 330 m. Khi bật con lăn cạnh, giới hạn tra thành 600 m. Thông báo chuyển vị ray đệm âm vẫn có thể xuất hiện vì công thức mẫu cho kết quả âm.

## 5. Quản lý ký hiệu công trình

Mở trang **Ký hiệu công trình**. Ở chế độ local, lần khởi tạo bộ ký hiệu sẽ bổ sung 9 loại: ghi rẽ trái, ghi rẽ phải, ghi bắt chéo, ghi hình thoi, cầu, hầm, đầu công trình, cuối công trình và vùng hạn chế hàn ray. Ảnh SVG có sẵn theo sơ đồ quản lý của ứng dụng.

### Thêm hoặc sửa

1. Bấm **Thêm mới**, hoặc biểu tượng bút chì tại dòng muốn sửa.
2. Nhập **Tên ký hiệu**.
3. Bấm **Chọn file** để lấy ảnh, hoặc sao chép ảnh rồi nhấn `Ctrl+V` khi cửa sổ đang mở.
4. Chọn **Lưu**. Nếu không muốn giữ thay đổi, chọn **Hủy**.

Ảnh tải lên chấp nhận PNG, JPG, WEBP hoặc GIF, tối đa 5 MB. Các SVG cài sẵn được quản lý cùng mã nguồn; ô tải ảnh hiện không nhận SVG mới.

Biểu mẫu hiện cho sửa tên và ảnh. Mã của ký hiệu mới được tạo tự động; tên tiếng Anh và các cột khác trong danh sách chưa có ô nhập tương ứng trên biểu mẫu này.

### Tìm hoặc xóa

Gõ mã, tên hoặc tên tiếng Anh vào ô tìm kiếm để lọc danh sách. Bấm biểu tượng thùng rác và xác nhận để xóa. Tải lại trang không tự thêm lại ký hiệu đã xóa sau lần khởi tạo bộ mặc định.

## 6. Dữ liệu được lưu ở đâu?

| Dữ liệu | Cách lưu hiện tại |
| --- | --- |
| Thông số R2 đang nhập | Chỉ trong lần mở bảng; đóng, chuyển đoạn hoặc tải lại trang sẽ đặt lại |
| Kết quả đã xuất | Trong file CSV ở thư mục tải xuống của trình duyệt |
| Ký hiệu công trình khi có thông báo “Chế độ local” | Lưu trên trình duyệt đang sử dụng; chưa đồng bộ lên máy chủ |
| Phạm vi công trình và các thanh ray đã ghép thêm | Tự lưu trên trình duyệt đang sử dụng |

Trong chế độ local, hãy dùng cùng trình duyệt, hồ sơ người dùng và địa chỉ truy cập. `localhost` và `127.0.0.1`, hoặc hai cổng khác nhau, có vùng dữ liệu trình duyệt riêng. Xóa dữ liệu trang web sẽ xóa các ký hiệu bạn đã lưu local; hiện chưa có nút xuất/nhập sao lưu danh mục này.

Trang tổng quan khởi tạo từ bộ đoạn ray mẫu. Thêm một ký hiệu vào danh mục chưa tự tạo vị trí công trình; chọn ký hiệu và phạm vi thanh trong phần Bố trí công trình để đưa lên sơ đồ.

## 7. Tài liệu đối chiếu công thức

Các công thức chính của mẫu 60R2 đã được đối chiếu với Excel: 921 ô kết quả/bảng tra, 240 bộ đầu vào và 152 biểu thức nguồn. Phạm vi này xác nhận việc chuyển công thức đã triển khai; các kết luận ghi tay trong workbook và tính đúng kỹ thuật của nguồn chưa được xác nhận bởi việc đối chiếu.

Xem [báo cáo công thức và giới hạn triển khai](research/stress-release/analysis.md) để tra địa chỉ ô, cách làm tròn và các điểm bất nhất trong Excel.

Ảnh giao diện tham khảo: [bảng tính trên máy tính](research/stress-release/browser/desktop.png), [chi tiết đoạn ray trên điện thoại](research/stress-release/browser/rail-detail-mobile.png), [danh mục ký hiệu](design-references/structure/symbols.png).
