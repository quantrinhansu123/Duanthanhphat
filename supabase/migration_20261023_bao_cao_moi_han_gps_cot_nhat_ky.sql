-- View GPS đang thiếu alias cột nhật ký (ly_trinh, du_an, tinh_trang_thi_nghiem)
-- nên PostgREST trả 400 khi app LWR select các tên đó.
-- Giữ nguyên thứ tự cột hiện có; CREATE OR REPLACE VIEW chỉ cho thêm cột ở cuối.

create or replace view public.bao_cao_moi_han_gps with (security_invoker = true) as
select
  td.id as toa_do_id,
  td.ma_diem,
  td.kinh_do,
  td.vi_do,
  td.ly_trinh as ly_trinh_toa_do,
  td.thu_tu,
  td.ghi_chu as ghi_chu_toa_do,
  td.lich_su_moi_han_id,
  ls.id as moi_han_id,
  ls.ma_lich_su,
  ls.ngay_thuc_hien,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_loi,
  case
    when coalesce(ls.tinh_trang_thi_nghiem, '') = 'Không đạt' or coalesce(ls.so_luong_loi, 0) > 0 then 'Lỗi'
    when coalesce(ls.tinh_trang_thi_nghiem, '') in ('Đạt', 'Không thí nghiệm') then 'Đạt'
    else 'Chờ thí nghiệm'
  end as ket_qua_moi_han,
  ls.nguyen_nhan_loi,
  ls.hach_toan,
  ls.chung_chi_su_dung,
  ns.employee_id as tho_han_id,
  ns.ho_ten as ten_tho_han,
  ns.ma_nhan_su,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  da.id as du_an_id,
  da.du_an as ten_du_an,
  td.created_at,
  td.ly_trinh,
  da.du_an,
  ls.tinh_trang_thi_nghiem
from public.toa_do td
left join public.lich_su_moi_han ls on ls.id = td.lich_su_moi_han_id
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id
left join public.du_an da on da.id = coalesce(ls.du_an_id, td.du_an_id);

grant select on public.bao_cao_moi_han_gps to anon, authenticated;

notify pgrst, 'reload schema';
