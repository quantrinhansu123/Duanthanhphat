# Mục tiêu và phương án áp dụng TB 10015 cho ray hàn liền

## Mục tiêu

- Dùng thông số đã lưu của từng thanh ray hàn dài để tính các đại lượng theo TB 10015-2012 ngay trong ứng dụng quản lý hàn ray.
- Cho phép kỹ sư đối chiếu đầu vào, đơn vị, kết quả và ô công thức nguồn trong cùng một tab.
- Xác định dữ liệu cần bổ sung để kiểm toán độ bền, ổn định và nhiệt độ khóa ray thiết kế theo từng đoạn tuyến.

## Phương án sử dụng dữ liệu hiện tại

1. Trong **Quản lý hàn ray LWR → Công thức TB 10015**, chọn dự án và mã thanh ray. Ứng dụng đọc thanh đã lưu trong sơ đồ và hồ sơ giải tỏa ứng suất trên Supabase.
2. Chọn **Bản rút gọn** để xem kết quả chính. Chọn **Bản đầy đủ** để đối chiếu toàn bộ đầu vào và công thức của phần tính theo hồ sơ. Ô `Nhập liệu!D13` trong Excel chọn loại 50, 60 hoặc 75 kg/m. Với `60R2` và `PB43`, phép tính nhiệt dùng diện tích của thanh trong hồ sơ.
3. Tính dải khóa từ nhiệt độ khóa đang lưu và biên độ khóa. Từ dải khóa và nhiệt độ ray cực trị, tính biên độ tăng giảm nhiệt, lực kéo nén nhiệt, ứng suất kéo nhiệt, khe đứt và chiều dài vùng co giãn. Khe đứt được so với ngưỡng lưu trong hồ sơ thanh.
4. Bấm địa chỉ ô ở cột **Excel** để xem công thức và giá trị mẫu. Mục **Excel gốc** tra cứu 11 bảng với 1.675 ô công thức. Mục **Hướng dẫn** giải thích mục đích, cách thao tác, quy đổi đơn vị và phương pháp tính.

Với bộ thông số mẫu loại ray 60 kg/m trong Excel, khe đứt tại ô `3_Khe đứt ray!D10` là **54,42 mm** và ngưỡng tại ô `D11` là **70 mm**. Phép tính trong ứng dụng cho cùng kết quả khi dùng cùng đầu vào.

## Phương án hoàn thiện kiểm toán thiết kế

| Hạng mục | Đầu vào cần xác nhận | Kết quả cần có |
| --- | --- | --- |
| Cường độ ray | Mác thép, độ mòn, đặc trưng mặt cắt, sơ đồ tải bánh và cự ly trục, tốc độ, độ cứng gối đỡ và tải dọc bổ sung nếu có | Tổng ứng suất, ứng suất cho phép, độ giảm nhiệt cho phép |
| Ổn định đường ray | Kiểu kết cấu, tà vẹt, sức cản ngang, sai lệch hình học và bán kính theo đoạn | Độ tăng nhiệt cho phép |
| Nhiệt độ khóa ray thiết kế | Nhiệt độ ray cực trị theo đoạn và các giới hạn từ kiểm toán cường độ, ổn định, khe đứt | Khoảng nhiệt độ khóa khả dụng và nhiệt độ khóa thiết kế |
| Cầu và ghi | Thông số kết cấu, liên kết và tải trọng tại vị trí công trình | Các phép kiểm riêng theo điều kiện bố trí. Cầu nhịp lớn cần phân tích tương tác cầu–ray theo điều 4.3.2 khi kiểm tra đứt ray |

Điều 1.0.2 của TB 10015-2012 quy định phạm vi đường khổ tiêu chuẩn 1.435 mm. Khi bổ sung bộ dữ liệu thiết kế, đối chiếu từng nhóm kết quả với Excel bằng cùng đầu vào và lưu nguồn thông số theo đoạn để phục vụ thẩm tra.
