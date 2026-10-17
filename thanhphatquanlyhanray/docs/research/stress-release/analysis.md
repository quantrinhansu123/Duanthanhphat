# Phân tích “Tính toán giải toả ứng suất R2.xlsx”

## Kết quả đối chiếu lại ngày 17/10/2026

**Kết luận: các công thức chính đã triển khai của sheet “Bảng tính mẫu 60R2” khớp biểu thức và kết quả Excel trong toàn bộ ca kiểm thử. Không phát hiện sai công thức cần sửa trong khối tính này. Không xác nhận phần mềm tái hiện toàn bộ 11 sheet.**

Đã trích lại từ XLSX gốc. SHA-256 của file được kiểm tra: `655833D8E379EB2000FE19C0DCEA4FA10D0E980F05351D66751E1E6598E19FB4`.

| Nội dung kiểm tra | Phạm vi | Kết quả |
| --- | --- | --- |
| Kết quả chính 60R2 với giá trị Excel lưu trong file | 22 ô | Khớp |
| Bảng khe kéo | D7:AA37, 744 ô, gồm các chiều dài 1.025–1.100 m | Khớp |
| Bảng lực kéo | D/F/H/J/L, hàng 7–37, 155 ô | Khớp |
| Tính lại công thức gốc của 6 sheet tính toán | 152 biểu thức với giá trị cache Excel | Khớp |
| So sánh phần mềm với biểu thức gốc 60R2 khi đổi đầu vào | 240 bộ × 22 kết quả = 5.280 phép so sánh | Khớp |
| Nhánh khe cắt FBW | K49/K50 của hai mẫu FBW, 4 phép so sánh | Khớp |

Tổng đối chiếu trực tiếp đầu ra phần mềm với cache: **921 ô** (mở rộng từ 797 ô trước đây). Các tình huống biến thiên thay đổi A, E, α, r, Pj, Lt/Lp, nhiệt độ khóa, nhiệt độ hai neo, nhiệt độ cực trị, Ga, Ag và chuyển vị Mt/Mp; có cả chênh nhiệt âm và làm tròn nhiệt độ trung bình.

`scripts/audit-stress-formulas.ts` đọc biểu thức trực tiếp từ bản trích XLSX và dùng bộ diễn giải số học riêng, không gọi hàm làm tròn của phần mềm. Phạm vi bộ diễn giải gồm tham chiếu ô, cộng/trừ/nhân/chia/lũy thừa và ROUND của các biểu thức được kiểm tra. Đây là đối chiếu biểu thức và cache, **không phải chạy tính lại bằng ứng dụng Microsoft Excel**. Sai số phép so sánh biểu thức cho phép 10⁻⁹ × max(1, |kết quả|); kiểm tra bảng tra số nguyên so sánh bằng tuyệt đối.

Hai lượt rà soát độc lập không phát hiện sai ánh xạ công thức/đơn vị trong giao diện 60R2 hiện hành. TypeScript và lint của các file thay đổi đã qua.

Các giới hạn cần giữ khi sử dụng kết quả:

- **FBW là nhánh khe cắt trên nền thông số 60R2:** −35,5 mm lấy từ V37 của “Bảng tính 2/3 FBW”; V36 của mẫu 60R2 là 0, còn K60 mẫu 60R2 chỉ cộng Ga của ATW. Phần mềm không tự chuyển lực/chiều dài neo sang bộ tham số và đơn vị của các sheet FBW cũ. Đã ghi rõ ngay trong giao diện.
- Bảng khe kéo độc lập giữ hệ số 0,0115 của Excel dù người dùng chỉnh α trong bảng chính. Đã bổ sung giải thích trên giao diện.
- Các công thức đối chứng phụ R75:T78, A59, V64, AF82 được rà soát trong nguồn nhưng không phải các dòng kết quả riêng trên web.
- Các kết luận nhập tay “OK”, “8–11 mm”, “6–13 mm” không được xác nhận bằng phép đối chiếu này. Các bất nhất nguồn và phép kiểm tra do phần mềm bổ sung được nêu bên dưới.
- Chưa có xác nhận tính đúng kỹ thuật/tiêu chuẩn của bản Excel nguồn; kết quả này xác nhận việc chuyển công thức sang phần mềm.

## Phạm vi đã triển khai

Trang `/giai-toa-ung-suat` tái hiện logic sheet **Bảng tính mẫu 60R2** với tham số nhập được; bổ sung lựa chọn ATW, FBW (số bù có dấu từ mẫu FBW), ray đơn; kiểm tra chiều dài theo bảng tra; tra nhanh lực kéo/khe kéo; xuất dữ liệu và kết quả CSV. Module tính thuần ở `src/lib/stress-release.ts`.

11 sheet gồm: Khe hở giải toả; Lực kéo; Bảng tính 1; Bảng tính 2 FBW; Bảng tính 3 FBW; Bảng tính 4 ATW; Bảng tính 5 (52kg); Bảng tính mẫu 60R2; Nhiệt độ; Thông số ray; Chiều dài giải toả.

`workbook.json` chứa giá trị lưu trong Excel, công thức và XML công thức (bao gồm shared formulas). Tái trích bằng `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-stress-workbook.ps1`. Không thực thi macro hoặc công thức từ file trong trình duyệt.

## Đơn vị và thứ tự tính

Mẫu 60R2: A = 0,007611 m²; E = 210.840.000 kN/m²; α = 0,0000115/°C; r = 24 kN/m; Pj = 400 kN. Trọng lượng 0,586 kN/m không tham gia công thức chính. Các mẫu cũ dùng cm², kg/cm² và tấn, không thể trộn trực tiếp với mẫu này.

| Ô mẫu 60R2 | Công thức | Kết quả mặc định |
| --- | --- | --- |
| K26 | Lt + Lp | 500 m |
| V30, K31 | Tđiểm kéo = (Tp+Tt)/2; Ttb = ROUND((Tp+Tt+Tđiểm kéo)/3,0) | 20°C |
| V31 | T − Ttb | 15°C |
| K40, V40 | ROUND(EAαΔT,2); ROUND(P/r,2) | 276,81 kN; 11,53 m |
| K41, K42 | ROUND(EAα(Traymax−(T−5)),2); ROUND(EAα((T+5)−Traymin),2) | 498,26; 442,90 kN |
| K43 | ROUND(ΔTαL×1000,2) | 86,25 mm |
| K44, K45 | (Pmax−Pj)/r | 4,0941667; 1,7875 m |
| V41, V42 | (Pmax−Pj)²/(2EAr)×1000 | 0,125348; 0,023893 mm |
| V43, V44 | ((Pmax−Pj)×25−r×25²/4)/(2EA)×1000 | −0,403034; −0,834266 mm |
| K46 | EA(αΔTkéo)²/r×1000 | 5,093328 mm |
| K49, V49 | Ag−(V42+V44); V41+V43 | 18,810373; −0,277686 mm |
| K50, V50 | Ag−2V44; 2V43 | 19,668533; −0,806068 mm |
| K59, K60 | ΔL+Mt+Mp; Ld+Ga | 86,25; 112,25 mm |

Giữ các bước ROUND trung gian để khớp workbook. ROUND nửa đơn vị ra xa 0, khác Math.round cho số âm. Giá trị được giữ đầy đủ cho tính tiếp và CSV, giao diện hiển thị tối đa 4 chữ số thập phân.

FBW: sheet 2/3 dùng `K50=K49+V37`, V37 = −35,5 mm. Với nhiệt độ 25°C: Ld=57,5 → 22 mm; với 32°C: Ld=17,25 → −18,25 mm. Không đổi thành trị tuyệt đối hoặc mặc định cho phép cắt khi kết quả âm. Ray đơn không trả kết quả khe hở hàn.

## Bất nhất và giới hạn của nguồn

- Mẫu 60R2 ghi các lựa chọn ATW/FBW/ray đơn cùng lúc, nhưng K60 thực tế dùng Ga của ATW. Web dùng lựa chọn phương pháp rõ ràng.
- Gr hiện tại có ô nhập nhưng không xuất hiện trong K60. Web giữ công thức và chỉ cảnh báo nếu khe mục tiêu nhỏ hơn Gr; không gọi K60 là lượng vật liệu cần cắt bỏ.
- R=1.000 m, L=500 m, không có con lăn cạnh: bảng chiều dài giới hạn 330 m, trong khi mẫu ghi tay “N” và “OK”. Web tính lại; có con lăn cạnh giới hạn 600 m.
- Bảng ghi R<400 và R=401–600, không định nghĩa R=400. Web trả chưa xác định tại R=400; các khoảng khác được nối liên tục theo cận trên (ví dụ 800<R≤1200).
- Tên “độ giảm”/“độ tăng” tại K33/V33 dễ gây nhầm; triển khai theo biểu thức và gắn nhãn nén/kéo.
- Các chuyển vị ray đệm âm và khoảng khe hở mẫu không trùng kết luận văn bản cố định “8–11 mm”/“6–13 mm”. Web giữ giá trị Excel để đối chiếu, cảnh báo và không tái sử dụng kết luận đó như kết quả tính.
- Khi Pmax<Pj, công thức chiều dài thở âm còn công thức bình phương chuyển vị vẫn dương. Web cảnh báo phạm vi áp dụng, không tự thay công thức vật lý.
- K46 không có công thức trạng thái OK trong workbook. Web bổ sung phép so sánh K46≤Ag và ghi rõ tiêu chí, không coi đây là nghiệm thu toàn bộ phương án.
- Sheet “Lực kéo” dùng `ROUND(kg/m×(T−Tray)×0,03232,0)` (tấn); không đồng nhất với lực EAαΔT. Cột MPa để trống, nên không suy đoán chỉ số đồng hồ kích.
- “Bảng tính 5 (52kg)” vẫn có nhiều tham số giống mẫu 60R2; K45 dùng nhiệt độ ray nhỏ nhất thay vì chênh nhiệt. Không tạo preset 52kg từ sheet này khi chưa xác nhận.
- Các ô thao tác/đo mốc/kiểm tra nhiệt độ ghi Y/N/OK là dữ liệu hiện trường, không phải công thức tự động. Không tự đánh dấu hoàn thành.
- Sheet Nhiệt độ chứa diễn giải các tiêu chuẩn khác nhau. Việc chuyển công thức này không phải xác minh phiên bản tiêu chuẩn hoặc xác nhận phương án thi công.

## Kiểm thử

`scripts/test-stress-release.ts` đối chiếu 22 ô kết quả chính với giá trị cache trong file; 744 ô khe kéo và 155 ô lực kéo; FBW dương/âm, bù chuyển vị, ray đơn, dấu nhiệt độ, làm tròn, giới hạn bán kính và đầu vào sai. `scripts/audit-stress-formulas.ts` kiểm tra biểu thức gốc và các bộ đầu vào biến thiên.

Chạy trên Node/TypeScript đã có trong dự án:

```powershell
node node_modules/typescript/bin/tsc scripts/test-stress-release.ts scripts/audit-stress-formulas.ts --outDir .next/stress-tests --module commonjs --target es2021 --esModuleInterop --skipLibCheck
node --test .next/stress-tests/scripts/test-stress-release.js .next/stress-tests/scripts/audit-stress-formulas.js
npm.cmd run check
```

Trang tổng quan hiển thị bảng chi tiết bên phải và bảng tính R2 khi bấm từng ô ray. Bảng nằm cùng bố cục với sơ đồ, không dùng hộp thoại hoặc lớp phủ; trên màn hình nhỏ bảng nằm dưới sơ đồ. Chiều dài được lấy từ hiệu lý trình cuối–đầu; nhiệt độ trên ô là nhiệt độ khóa đường và được truyền vào T khóa, không phải nhiệt độ thi công tại neo. Các thông số khác dùng mẫu 60R2 và có thể chỉnh sửa qua phần Thông số đầu vào. Chuyển đoạn/đóng bảng sẽ đặt lại dữ liệu nhập; chưa lưu kết quả vào hồ sơ hoặc cơ sở dữ liệu. CSV có mã đoạn ray trong nội dung và tên file.

### Biểu đồ trong bảng chi tiết

`StressChart.tsx` và `src/lib/stress-chart.ts` hiển thị hai kết quả từ bộ tính hiện hành: P(x)=K40 (kN) và ΔL(x)=K43×x/L (mm), trên x=0…L. 41 điểm được dựng từ giá trị P và ΔL đã làm tròn đúng bước Excel; điểm cuối khớp K43. Trục được điều chỉnh theo dữ liệu, bao gồm trường hợp âm hoặc bằng 0. Đầu vào lỗi sẽ ẩn biểu đồ.

Đường này minh họa lực kéo mục tiêu và giãn dài tự do tích lũy theo nhiệt độ trung bình; workbook không cung cấp phân bố nội lực/chuyển vị theo vị trí trong vùng neo để tái hiện. Biểu đồ không dùng đường cong mô phỏng cũ với các hằng số 500 m, 110,8 kN và 0,26 mm. Mt/Mp chỉ tham gia Ld và không được cộng vào đường giãn dài tự do.

`scripts/test-stress-chart.ts` kiểm tra điểm đầu/giữa/cuối, L=500/1.000 m, chênh nhiệt âm/0 và dữ liệu không hợp lệ. Biểu đồ dùng chung cho trang R2 và bảng bên phải.

Script `scripts/check-rail-details.mjs` kiểm tra toàn bộ 28 ô: mã đoạn, chiều dài, nhiệt độ khóa và lực tính tương ứng; cập nhật bảng khi bấm ô khác, chuyển đoạn đặt lại đầu vào, đóng bằng nút X và bố cục trên điện thoại (tham số package Playwright và URL tương tự script bên dưới; mặc định cổng 3000).

### Kiểm tra trình duyệt ngày 17/10/2026

Đã chạy Chromium headless trên bản production tại localhost. Trang trả HTTP 200; không có lỗi JavaScript trong các thao tác kiểm thử:

- Mẫu ATW: P=276,81 kN, khe cắt=112,25 mm.
- Bật con lăn cạnh: kiểm tra chiều dài chuyển sang đạt.
- FBW tại 25°C: 22 mm; tại 32°C: −18,25 mm; ray đơn: khe hàn không áp dụng.
- Nhập r=0: hiển thị lỗi và vô hiệu hóa xuất CSV.
- Nhập Mt bằng dấu phẩy `2,5`: Ld=88,75 mm; file CSV tải xuống chứa kết quả này.
- Khôi phục mẫu, menu điện thoại, không tràn ngang ở viewport 390×844; desktop 1440×1000.

Script tái chạy: `node scripts/check-stress-browser.mjs <đường-dẫn-package-playwright> <URL-web>`. Nếu đã cài Playwright trong dự án và web chạy cổng 3100, có thể bỏ hai tham số. Script sử dụng trình duyệt đã cài, không tự tải dependency. Ảnh đối chiếu nằm trong `browser/desktop.png`, `browser/mobile.png` và `browser/mobile-results.png`.
