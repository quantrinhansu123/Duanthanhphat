-- =============================================================================
-- Sửa ngày giả của dữ liệu tổng hợp nhật ký hàn.
-- Nguồn "TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx" chỉ cung cấp năm thực hiện;
-- script import cũ đã chia giả dữ liệu vào 01-30/12. Giữ nguyên toàn bộ bản ghi,
-- mã mối hàn, năm, sản lượng và liên kết; chỉ xóa phần ngày/tháng không có nguồn.
-- =============================================================================

begin;

update public.lich_su_moi_han
set
  ngay_thuc_hien = null,
  nguon_du_lieu = 'TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx - dữ liệu gốc chỉ có năm; 1 mối/dòng',
  updated_at = now()
where nguon_du_lieu = 'TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx - 1 mối/dòng, chia đều 01-30/12';

commit;

notify pgrst, 'reload schema';
