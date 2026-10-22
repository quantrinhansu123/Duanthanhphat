# Cập nhật LWR — 22/10/2026

- Ray trái/phải của tuyến được chọn riêng, nhìn theo chiều lý trình tăng. Hai phần ở vị trí kéo đổi thành phía Km giảm (L₁) và Km tăng (L₂).
- Nhập lý trình đầu, cuối, vị trí kéo để tính L₁/L₂. Tổng chiều dài bằng cuối trừ đầu; mỗi bản tính gắn với một ray của tuyến.
- Chiều dài kéo có lực kéo = giãn dài tính toán + Mt + Mp, sau đó làm tròn lên theo công thức hiện có. Mt = Mp = 0 giữ nguyên kết quả; tổng Mt + Mp = 3 mm cộng thêm 3 mm. Giải toả tự nhiên vẫn không ra lệnh kéo.
- Mốc ngoài F (Fix) phải cố định. Nếu kéo thử phát hiện chuyển vị ở bất kỳ mốc F nào, neo chưa đạt: tăng chiều dài neo hoặc áp dụng biện pháp tăng cường khác và kiểm tra lại. Không cộng F vào khoảng cách kéo. Số đo F cũ vẫn được giữ để kiểm tra, không đưa vào bảng số liệu báo cáo cuối.
- Ray đơn hiển thị đầy đủ hai phương pháp. So sánh nhiệt độ chưa làm tròn với ngưỡng T khóa − biên độ (mặc định 30°C), tránh chuyển nhầm 29,99°C thành tự nhiên.
- Báo cáo dùng “ứng suất”, “ray đơn”, chỉ có một mục con lăn cạnh; phần chuyển vị chỉ ghi Mt và Mp trong kết quả cuối, cùng chiều dài kéo tính toán và chiều dài sau bù.
- Sơ đồ rải theo mốc 500 m, chốt đúng điểm cuối lẻ. Công trình và đoạn thi công lưu lý trình thực độc lập; đoạn hoàn thành mới được tô lên tuyến. Có ngày thi công, sửa, xoá và kiểm tra chồng lấn.
- Sơ đồ trên/dưới dùng cùng tọa độ theo mét. Mối hàn tại biên rải và đầu đoạn thực tế có thể chọn để liên kết nhật ký: trắng chưa hàn, xanh FBW, đỏ ATW. Số mối hàn lấy từ nhật ký, có liên kết mở nhật ký theo mã. Lý trình trùng trên nhiều dải không bị tự gán vào dải đầu tiên.
- Bản in sơ đồ: A4 ngang, A3 ngang, A3 kéo dài 841 × 297 mm, chia tuyến thành các tờ tiếp nối. Bao gồm công trình, mối hàn và bảng đoạn thi công.
- Chọn dự án để tách sơ đồ. Khi thông tin vị trí dự án có cặp lý trình Km đầu/cuối, sơ đồ mới được rải sẵn; nếu thiếu, nhập phạm vi ở form rải tuyến.

## Lưu trữ và tương thích

Phạm vi, ngày thi công, hoàn thành và dự án của thanh dài nằm trong `params.placement` JSONB của bảng hiện có, không cần thêm cột. Mã lưu trên máy chủ có tiền tố ID dự án để tránh xung đột mã LWR giữa dự án; giao diện vẫn hiển thị mã nhập.

Sơ đồ rải, công trình và liên kết mối hàn giữ cơ chế lưu trình duyệt, tách khóa theo dự án. Dữ liệu thanh dài cũ vẫn đọc được; lưu lại đoạn để bổ sung phạm vi thực. Không tự xoá dữ liệu phụ thuộc khi xoá/rải lại tuyến.

## Kiểm tra

```powershell
node --import ./scripts/lwr-test-loader.mjs --test scripts/test-lwr-60r2.mjs scripts/test-lwr-feedback.mjs scripts/test-track-editor.mjs scripts/test-buffer-gap.mjs
npm.cmd run build
```

Kiểm tra trình duyệt bằng `scripts/test-lwr-browser.cjs` với máy chủ chạy ở `LWR_TEST_URL` (mặc định localhost:3010). Cần Playwright; có thể chỉ định đường dẫn module qua `PLAYWRIGHT_MODULE`. Script giả lập REST để không ghi dữ liệu kiểm thử vào máy chủ thật. PDF và ảnh kiểm tra nằm trong thư mục tạm `thanhphat-lwr-feedback`.

Đã kiểm tra bản tính, lưu/tải lại lý trình lẻ, hoàn thành, công trình, liên kết nhật ký, phân trang PDF và màn hình 390 px. Với tuyến 17.584 m: A4 9 tờ, A3 5 tờ, A3 kéo dài 2 tờ.

## Công thức khe hở đã đối chiếu ảnh Excel

Mẫu khe hở dự phòng đã đổi theo hình mới: a₁ ≥ A + C, a₁ ≤ ag − (B + D); a₂ ≥ 2C, a₂ ≤ ag − 2D. A/C là lượng giãn ở nhiệt độ cao nhất, B/D là lượng co ở nhiệt độ thấp nhất. Cộng số liệu chưa làm tròn; giới hạn dưới làm tròn lên, giới hạn trên làm tròn xuống đến mm nguyên. Nếu giới hạn dưới vượt giới hạn trên, báo không có khoảng thoả mãn.

Tự tính Pmax = EFαΔT riêng cho nén (57 − 30 = 27°C) và kéo (40 − 16 = 24°C). Δdài = (Pmax − Pj)²/(2EFr); Δđệm = [(Pmax − Pj)L − rL²/4]/(2EF), L = 25 m; nhân 1.000 đổi m sang mm. Giữ Pmax ở độ chính xác 0,01 kN của bộ tính hiện có, không làm tròn các chuyển vị trung gian. Bốn chuyển vị nhập tay cũ không ghi đè kết quả tự tính.

Mặc định bản tính mới r = 14,4 kN/m, Pj = 0 kN, E = 210.840.000 kN/m²; thông số đã lưu của dự án được giữ nguyên. Mẫu cho a₁ = 8,5520–11,0066 mm → chọn nguyên 9–11 mm; a₂ = 6,3604–12,5021 mm → chọn nguyên 7–12 mm. Khoảng 6–13 mm trong ảnh không thỏa bất đẳng thức. Màn hình, CSV và bản in dùng chung kết quả; chặn xuất nếu Pmax < Pj hoặc chuyển vị âm. Chưa triển khai lên môi trường thật; đồng bộ Supabase thực tế chưa được kiểm thử ghi dữ liệu.
