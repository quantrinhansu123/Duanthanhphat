# Bàn giao cập nhật R2 và dọn dữ liệu Phú Quốc

## Dữ liệu đã đối chiếu (đọc, chưa sửa production)

- Dự án Phú Quốc: `2370b59d-acd5-40a9-9f3f-94445a648a1a`, trên Supabase `ssgwccxdcpejyytmfarc`.
- Có 82 mối: 11 Chấp thuận ngày 06/10/2026 và 71 mối cần xóa theo yêu cầu test lại.
- 11 mối giữ lại mang mã `FBW00009` đến `FBW00019`; hiện gắn với `001-RFI`. Giữ nguyên mối, kiểm tra, tọa độ, RFI, kết quả nghiệm thu, chữ ký và bản sửa đổi của nhóm này.
- Có 11 RFI trong dự án. Dự kiến dọn 10 phiếu còn lại, gồm phiếu theo dõi rỗng; `001-RFI` giữ lại. Phạm vi thực tế được kiểm tra lại trong transaction khi chạy, không dựa duy nhất vào số liệu trong tài liệu.
- 0046 và 0048 đã NDT đạt nhưng 0046 chưa có chiều dài mài; 0048 đã nhập 700 mm. Không tự điền chiều dài cho 0046. Cả hai thuộc 71 mối sẽ được dọn.
- R2 chỉ đang được cài cho FBW/Sản xuất. Mối 0038 là FBW/Đào tạo, nên chưa có tiêu chí của nhóm này. Chức năng mới chuyển thẳng tới đúng nhóm để thiết lập, không tự dùng tiêu chí Sản xuất cho Đào tạo.

## Thứ tự chạy SQL (đồng nghiệp chạy trên SQL Editor)

1. Nếu chưa chạy, áp dụng [`migration_20261101_rfi_doi_soat_trang_thai.sql`](../../supabase/migration_20261101_rfi_doi_soat_trang_thai.sql). File này sửa view trạng thái, không ghi kết quả hay chữ ký.
2. Chạy riêng toàn bộ [`operations/reset_pq_giu_11_moi_chap_thuan_20261101.sql`](../../supabase/operations/reset_pq_giu_11_moi_chap_thuan_20261101.sql). Đây là thao tác xóa dữ liệu theo yêu cầu, không phải migration tự động khi deploy.
3. Áp dụng [`migration_20261101_tieu_chi_dong_bo_moi_mo.sql`](../../supabase/migration_20261101_tieu_chi_dong_bo_moi_mo.sql). File này bổ sung RPC tạo/áp dụng tiêu chí nguyên tử, nhật ký đổi tiêu chí, tự chọn tiêu chí cho mối mới và đồng bộ dữ liệu mở của Phú Quốc. Không thay số đo, NDT hay hồ sơ đã hoàn thành.

Các migration chất lượng/RFI và chiều dài mài trước đó phải có sẵn trên DB hiện tại. Không chạy lại toàn bộ thư mục SQL.

File dọn sẽ:

- Khóa các bảng liên quan trong transaction; dừng nếu không còn đúng 11 mối Chấp thuận 06/10 hoặc RFI chứa lẫn mối giữ/xóa.
- Lưu dữ liệu sẽ xóa và bản đối chiếu cần giữ vào `maintenance_backup.pq_weld_reset_20261101`, không cấp quyền đọc cho `anon`/`authenticated`.
- Xóa bản sửa đổi/hồ sơ/đợt nghiệm thu/liên kết/RFI trong phạm vi trước khi xóa kiểm tra và mối hàn.
- Giữ dữ liệu tọa độ tuyến gốc; chỉ tháo liên kết tới mối đã xóa. Tháo ID mối đã xóa trong `jointWeldLinks` của Track Map; giữ hình học tuyến và liên kết của mối còn lại.
- Giữ các trigger thống kê nguồn hoạt động. Chỉ tạm mở đúng trigger bất biến bản sửa đổi trong transaction rồi bật lại.
- So sánh từng cột của mối/hồ sơ cần giữ trước và sau. Nếu khác, rollback toàn bộ. Kết quả cuối trả `moi_giu_lai`, `moi_da_xoa`, `rfi_da_xoa`, `rfi_con_lai`.
- Chạy lại khi đã sạch không đổi bản backup. Nếu đã có dữ liệu mới sau lần dọn, file dừng để tránh xóa lần nữa mà mất bản sao lưu của đợt mới.

## Kiểm tra sau khi chạy

```sql
select loai_moi_han, ngay_thuc_hien, count(*) as so_moi
from public.lich_su_moi_han
where du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
group by loai_moi_han, ngay_thuc_hien;

select p.so_phieu, count(pm.moi_han_id) as so_moi
from public.phieu_yeu_cau_nghiem_thu p
left join public.phieu_yeu_cau_nghiem_thu_moi pm on pm.phieu_id = p.id
where p.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
group by p.id, p.so_phieu;
```

Kỳ vọng trước khi nhập test mới: đúng 11 mối Chấp thuận ngày 06/10 và 1 phiếu `001-RFI` chứa 11 mối. Các RFI test cũ không còn.

## Luồng test giao diện

1. Tải lại trang, chọn Phú Quốc: nhật ký còn 11 mối; RFI/hồ sơ chỉ còn nhóm đã giữ.
2. Tạo mối FBW/Sản xuất mới, mở **Kiểm tra**: tự nhận R2 của nhóm. Dropdown có tìm kiếm, tên, phiên bản, trạng thái và chọn được bằng bàn phím; không dùng menu native toàn chiều rộng như ảnh cũ.
3. Nếu kiểm tra mối FBW/Đào tạo chưa có tiêu chí, dropdown nêu đúng nhóm chưa thiết lập. Nút **Thiết lập tiêu chí cho nhóm này** mở đúng dự án/công nghệ/loại mối.
4. Tại **Tiêu chí nghiệm thu**, tạo phiên bản mới: các mối chưa chốt trong đúng nhóm chuyển cùng transaction; số đo và NDT còn nguyên. Nhóm khác và 11 mối/hồ sơ đã hoàn thành giữ nguyên. Nút **Áp dụng cho mối chưa chốt** cho phép đồng bộ lại tiêu chí hiện hành và báo số mối được cập nhật.
5. Test nghiệm thu hai mối mới, một thiếu chiều dài mài và một có 700 mm trong dung sai, cả hai NDT đạt: màn hình nêu rõ điều kiện thiếu từng mối. Mối đủ điều kiện được chọn Đạt; mối thiếu phải nhập số đo thật và lưu trước. Không tự biến NDT đạt thành nghiệm thu Đạt.

## Kiểm thử tự động

`test-quality-rule-sync-db.mjs`: SQL thật trong PGlite, kiểm tra tạo/áp dụng nguyên tử, kế thừa cho mối mới, đồng bộ R2 cho dữ liệu mở, bảo toàn số đo/NDT/hồ sơ chốt, cô lập nhóm/dự án, phiên bản, lặp lại, rollback và quyền.

`test-reset-pq-db.mjs`: fixture 82 mối Phú Quốc và mối dự án khác; kiểm tra xóa 71/giữ 11, bảo toàn hồ sơ, xóa RFI rỗng/bản sửa đổi, sao lưu, tháo GPS/LWR, trigger thống kê, rollback và chặn số lượng/phạm vi sai.

`test-quality-rule-browser.cjs`: component thật với API fixture; kiểm tra dropdown trong native dialog, tìm kiếm, bàn phím/Escape, đúng ngữ cảnh nhóm, đồng bộ và tạo phiên bản, nhóm khác không bị tắt, màn hình 375px. Ảnh kiểm thử lưu ngoài repo.
