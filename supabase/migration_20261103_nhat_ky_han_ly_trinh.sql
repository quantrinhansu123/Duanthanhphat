-- Lý trình ghi ngay trên nhật ký hàn (dự án không có tọa độ GPS vẫn có lý trình cho biên bản thi công).
alter table public.lich_su_moi_han add column if not exists ly_trinh text;

-- Mối đã có điểm GPS kèm lý trình: sao chép sang nhật ký.
update public.lich_su_moi_han ls
set ly_trinh = td.ly_trinh
from public.toa_do td
where td.lich_su_moi_han_id = ls.id and ls.ly_trinh is null and nullif(btrim(td.ly_trinh), '') is not null;

notify pgrst, 'reload schema';
