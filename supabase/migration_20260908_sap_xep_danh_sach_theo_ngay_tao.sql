-- Bổ sung thời điểm tạo của bản ghi gốc vào các view dùng cho danh sách.
-- Ứng dụng dùng created_at DESC và id DESC để thứ tự ổn định khi phân trang.

create or replace view public.v_lich_su_moi_han_chi_tiet with (security_invoker = true) as
select
  ls.id,
  ls.ma_lich_su,
  ls.ngay_thuc_hien,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ls.hach_toan,
  ls.moi_han_lien_ket,
  ls.ghi_chu,
  ls.tho_han_id,
  ns.ho_ten as ten_tho_han,
  ns.ma_nhan_su,
  ls.du_an_id,
  da.du_an as ten_du_an,
  da.ma_du_an,
  ls.may_id,
  tb.ma_may as ten_may,
  case
    when ls.ghi_chu ilike '%Kết quả: Sửa chữa%'
      or (coalesce(ls.so_luong_loi, 0) > 0 and (ls.ghi_chu ilike '%sửa chữa%' or ls.moi_han_lien_ket ilike 'SC-%'))
      then 'Sửa chữa'
    when ls.ghi_chu ilike '%Kết quả: Không đạt%' or coalesce(ls.so_luong_loi, 0) > 0
      then 'Không đạt'
    else 'Đạt'
  end as ket_qua,
  case
    when ls.ghi_chu ilike '%Ca 2%' then 'Ca 2'
    when ls.ghi_chu ilike '%Ca 3%' then 'Ca 3'
    else 'Ca 1'
  end as ca_han,
  public.f_unaccent(
    coalesce(ls.ma_lich_su, '') || ' ' ||
    coalesce(ls.moi_han_lien_ket, '') || ' ' ||
    coalesce(ls.ghi_chu, '') || ' ' ||
    coalesce(ns.ho_ten, '') || ' ' ||
    coalesce(ns.ma_nhan_su, '') || ' ' ||
    coalesce(da.du_an, '') || ' ' ||
    coalesce(da.ma_du_an, '') || ' ' ||
    coalesce(tb.ma_may, '') || ' ' ||
    coalesce(tb.ten_may, '') || ' ' ||
    coalesce(ls.hach_toan, '')
  ) as tim_kiem_khong_dau,
  ls.created_at
from public.lich_su_moi_han ls
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.du_an da on da.id = ls.du_an_id
left join public.thiet_bi tb on tb.id = ls.may_id;

create or replace view public.bao_cao_moi_han_theo_du_an with (security_invoker = true) as
select
  ls.id,
  ls.ma_lich_su,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ns.employee_id as tho_han_id,
  ns.ma_nhan_su,
  ns.ho_ten as ten_tho_han,
  ls.nguyen_nhan_loi,
  ls.nguon_du_lieu,
  ls.dong_nguon,
  ls.ghi_chu,
  ls.moi_han_lien_ket,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  ns.to_han,
  ns.chung_chi as chung_chi_nhan_su,
  ls.chung_chi_su_dung,
  ls.ngay_thuc_hien,
  ls.chung_chi_id,
  ls.hach_toan,
  ls.ma_khuyet_tat,
  ls.tinh_trang_thi_nghiem,
  ls.created_at
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

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
  case when coalesce(ls.so_luong_loi, 0) = 0 then 'Đạt' else 'Lỗi' end as ket_qua_moi_han,
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
  td.created_at
from public.toa_do td
left join public.lich_su_moi_han ls on ls.id = td.lich_su_moi_han_id
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id
left join public.du_an da on da.id = coalesce(ls.du_an_id, td.du_an_id);

grant select on public.v_lich_su_moi_han_chi_tiet to anon, authenticated;
grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;
grant select on public.bao_cao_moi_han_gps to anon, authenticated;

create index if not exists idx_lich_su_moi_han_created_at_desc
  on public.lich_su_moi_han (created_at desc, id desc);
create index if not exists idx_du_an_created_at_desc
  on public.du_an (created_at desc, id desc);
create index if not exists idx_nhan_su_created_at_desc
  on public.nhan_su (created_at desc, employee_id desc);
create index if not exists idx_thiet_bi_created_at_desc
  on public.thiet_bi (created_at desc, id desc);
create index if not exists idx_dao_tao_created_at_desc
  on public.dao_tao (created_at desc, id desc);
create index if not exists idx_dao_tao_hoc_vien_created_at_desc
  on public.dao_tao_hoc_vien (created_at desc, id desc);
create index if not exists idx_nhat_ky_chay_may_created_at_desc
  on public.nhat_ky_chay_may (created_at desc, id desc);
create index if not exists idx_lich_su_bao_tri_created_at_desc
  on public.lich_su_bao_tri_may (created_at desc, id desc);
create index if not exists idx_toa_do_created_at_desc
  on public.toa_do (created_at desc, id desc);
