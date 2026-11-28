# Yêu cầu đối chiếu phần B nhật ký thi công

## Nguồn và giới hạn

Phiên worker không nhận được ảnh gốc; tài liệu này chỉ dùng **bản mô tả ảnh do coordinator cung cấp**, chưa đối chiếu trực quan ảnh gốc. Đã tìm tên file ảnh/PDF liên quan trong dự án và tìm chuỗi `FBW-0511260009`, tiêu đề phần B trong mã nguồn; chưa tìm được file ảnh tương ứng được xác nhận. Ảnh được mô tả bị cắt mép phải và dưới: không suy đoán các dòng, mã, số lượng, bố cục hoặc nội dung ngoài vùng thấy. Ngày được mô tả là 05 tháng 11, không suy ra năm chỉ từ ngày hiển thị. Mục “3 Vật tư” là nhóm bên trong thiết bị, khác mục “3 Nội dung công việc thực hiện”.

Hiện trạng sau đây là **đọc mã**, chưa chạy giao diện hoặc in thực tế; không kết luận sai lệch hình học so với ảnh. Ưu tiên P1: đối chiếu nội dung nhìn thấy; P2: độ bền và trải nghiệm.

## Yêu cầu có căn cứ từ mô tả ảnh

| ID | Hiện trạng theo mã | Kỳ vọng | Ưu tiên | Tiêu chí nghiệm thu với dữ liệu giả lập |
|---|---|---|---|---|
| B-01 | `DiaryPages` in tiêu đề phần B và ngày; mẫu riêng với báo cáo ngày. | Có tiêu đề B. TÌNH HÌNH THI CÔNG HÀNG NGÀY và ngày tương ứng. | P1 | Bản xem trước/in thể hiện tiêu đề và ngày 05 tháng 11; năm chỉ dùng khi được xác nhận. |
| B-02 | Form có ba lựa chọn, chi tiết sáng/chiều/tối; bản in tính trung bình nếu đọc được nhiệt độ. | Bình thường/Mưa/Nắng, chọn Mưa; 28.3°C; sáng nhiều mây 26°C, chiều mưa 31°C, tối nhiều mây 28°C. | P1 | In đúng lựa chọn và các giá trị mẫu; trung bình 26, 31, 28 ra 28.3°C, không mất chi tiết. |
| B-03 | Ba trường nhân lực, mặc định 4/3/12, sửa được; in mục 2.1. | Ban chỉ huy 4, cán bộ kỹ thuật 3, công nhân 12 người. | P1 | Ba nhãn và số lượng khớp trong form và bản in; sửa mẫu được phản ánh trên bản xem trước. |
| B-04 | Mục 2.2 là textarea; tự điền theo nhóm máy hàn, máy khác, vật tư; nhóm sau được ghép bằng dấu chấm phẩy. | Thể hiện máy hàn chảy giáp mép di động UN5-150ZC2-C6 1 bộ và danh sách thiết bị khác theo tên/mã/số lượng nhìn thấy. | P1 | Với dữ liệu giả lập, tên, mã, số lượng và đơn vị không mất hoặc trộn; đối chiếu các dòng cụ thể chỉ khi có ảnh gốc. |
| B-05 | Vật tư thuộc nhóm 3 trong nội dung 2.2, không phải trường bảng riêng. | Hiển thị đá cắt/đá mài theo mã, quy cách, số lượng nhìn thấy. | P1 | Mỗi giá trị giả lập hiện đầy đủ, không gán mã hay số lượng chưa được cung cấp; xác nhận chi tiết khi có ảnh. |
| B-06 | Mục 3.1 ghép từ nội dung công việc; mã mối được tạo từ nguồn nhật ký hàn, chia trang theo dòng đo. | Hàn chảy giáp mép tuyến hạ, 12 mối, danh sách có `FBW-0511260009` và các ID nhìn thấy. | P1 | Bộ dữ liệu thử có 12 ID giả lập in đủ một lần và đúng thứ tự; riêng ID đã nêu đúng chính tả; không coi các ID giả lập là dữ liệu ảnh. |
| B-07 | Trang in A4 cố định, phần công việc có phân trang; phần thiết bị đặt trước vùng phân trang công việc. | Nội dung phần nhìn thấy đọc được và không bị cắt khi in. | P1 | Kiểm tra xem trước và PDF: đủ các dòng thiết bị, vật tư và mã mối, không chồng lấn hoặc mất chữ; so với ảnh gốc trong phạm vi thấy. |

## Đề xuất cần xác nhận, không phải bằng chứng ảnh

| ID | Hiện trạng theo mã | Kỳ vọng đề xuất | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| D-01 | Thiết bị là văn bản tự do; vùng trang cố định `overflow: hidden`. | Xử lý danh sách dài an toàn, có thể tiếp tục sang trang sau. | P1 | Thử dữ liệu dài vượt một trang: mọi dòng xuất hiện đủ, không đè tiêu đề/chân trang. |
| D-02 | In ghép dùng `pageOf` ước lượng hai trang/ngày trong khi mục 3 có thể thêm trang giữa. | Đánh số liên tục theo số trang thực tế. | P2 | Hai ngày giả lập, ngày đầu trên hai trang: số trang không trùng và tăng liên tục. |
| D-03 | Báo cáo ngày và nhật ký thi công là hai luồng/mẫu riêng. | Làm rõ lối vào và nhãn chức năng, sau khi xác nhận quy trình mong muốn. | P2 | Người dùng tìm được phần B từ luồng được thống nhất; không tự giả định nút in báo cáo ngày đã in mẫu B. |

## Vị trí liên quan

- `src/components/DailyWorkReport.tsx` và `DailyWorkReportPrint.tsx`: giao diện Báo cáo ngày và mẫu in riêng; `AppShell.tsx` ánh xạ `bc-bao-cao-ngay` sang báo cáo ngày.
- `src/components/WeldAcceptanceReport.tsx`: tải `ConstructionDiary` trong tab `nhat-ky-ngay`. `ConstructionDiary.tsx` dòng 450–500 là form; khoảng 54–87 CSS in, 615–618 ghép bản in, 655–760 dựng phần B và phân trang; 812 trở đi là dòng kẻ/đo dòng.
- `src/lib/constructionDiaryDb.ts`: cấu trúc, trung bình nhiệt độ, lưu local/Supabase; `constructionDiaryAuto.ts`: nguồn tự điền, mặc định nhân lực, định dạng thiết bị và mã mối. `dailyReportDb.ts` là nguồn dữ liệu báo cáo ngày. Đường dẫn và số dòng là theo mã tại thời điểm phân tích.

## Kiểm thử trước/sau bằng ảnh

1. Nhận ảnh gốc và xác nhận phạm vi cắt, ngày/năm và các giá trị nhìn thấy; lưu ảnh tham chiếu cùng điều kiện so sánh. Không điền các phần khuất.
2. Trên môi trường cô lập không kết nối dữ liệu thật, tạo fixture giả lập theo B-01–B-06; chụp form và xem trước hiện hành, xuất PDF A4 rồi chụp từng trang làm ảnh trước. Không sử dụng chức năng lưu/tự điền hàng loạt trên dữ liệu thật.
3. Sau thay đổi, lặp cùng fixture, trình duyệt, khổ giấy, tỉ lệ và thiết lập in; chụp ảnh sau và so từng vùng nhìn thấy với ảnh gốc, kiểm tra bằng mắt cùng trích xuất văn bản PDF cho đủ mã/số lượng. Kiểm tra thêm danh sách dài và in ghép theo D-01/D-02.
4. Ghi nhận sai khác, trang bị cắt, phiên bản trình duyệt và ảnh trước/sau; phần ảnh bị khuất chỉ nghiệm thu tính đầy đủ dữ liệu fixture, không tuyên bố khớp mẫu. Hiện chưa có ảnh trước/sau hay kết quả chạy thực tế.
