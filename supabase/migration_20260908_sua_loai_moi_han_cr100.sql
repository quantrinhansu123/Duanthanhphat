-- Sửa phân loại nguồn R4: ray CR100 tại dự án hàn xưởng Vinalift là hàn sản xuất.
-- Trigger tổng hợp năm (nếu đã cài) sẽ tự đồng bộ lại các bảng thống kê liên quan.
update public.lich_su_moi_han as ls
set loai_moi_han = 'Sản xuất'
from public.du_an as da
where ls.du_an_id = da.id
  and ls.ma_lich_su = 'R4-030'
  and ls.loai_ray = 'CR100'
  and da.ma_du_an = 'DA-R4-005'
  and ls.loai_moi_han <> 'Sản xuất';

notify pgrst, 'reload schema';
