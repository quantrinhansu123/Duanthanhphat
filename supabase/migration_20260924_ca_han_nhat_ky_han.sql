-- Ca hàn (Ca 1 / Ca 2 / Ca 3) trên nhật ký hàn.
-- Trước đây ca chỉ suy ra từ ghi_chu (Lịch sử hàn). Cột riêng để form Nhật ký hàn chọn/lưu trực tiếp.
--
-- Lưu ý: CREATE OR REPLACE VIEW chỉ được THÊM cột ở CUỐI danh sách SELECT,
-- không được chèn giữa (lỗi 42P16 rename cột). View v_lich_su_moi_han_chi_tiet
-- đã có cột ca_han (tính từ ghi_chu) — chỉ đổi biểu thức, giữ nguyên vị trí.

alter table public.lich_su_moi_han
  add column if not exists ca_han text;

update public.lich_su_moi_han
set ca_han = case
  when ghi_chu ilike '%Ca 3%' then 'Ca 3'
  when ghi_chu ilike '%Ca 2%' then 'Ca 2'
  else 'Ca 1'
end
where ca_han is null;

alter table public.lich_su_moi_han
  alter column ca_han set default 'Ca 1',
  alter column ca_han set not null;

alter table public.lich_su_moi_han
  drop constraint if exists lich_su_moi_han_ca_han_check;
alter table public.lich_su_moi_han
  add constraint lich_su_moi_han_ca_han_check
  check (ca_han in ('Ca 1', 'Ca 2', 'Ca 3'));

comment on column public.lich_su_moi_han.ca_han is
  'Ca hàn thực hiện: Ca 1, Ca 2 hoặc Ca 3.';

-- Báo cáo / Nhật ký hàn: thêm ca_han ở CUỐI view
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
  ls.created_at,
  ls.anh_moi_han_lien_ket,
  ls.ca_han
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

-- Lịch sử hàn: ưu tiên cột ca_han, fallback ghi_chu (giữ nguyên vị trí cột ca_han)
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
    when coalesce(ls.tinh_trang_thi_nghiem, '') = 'Chờ thí nghiệm'
      and coalesce(ls.ghi_chu, '') not ilike '%Kết quả: Đạt%'
      then 'Chờ thí nghiệm'
    else 'Đạt'
  end as ket_qua,
  case
    when ls.ca_han in ('Ca 1', 'Ca 2', 'Ca 3') then ls.ca_han
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
    coalesce(ls.hach_toan, '') || ' ' ||
    coalesce(ls.ca_han, '')
  ) as tim_kiem_khong_dau,
  ls.tinh_trang_thi_nghiem,
  ls.created_at
from public.lich_su_moi_han ls
left join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.du_an da on da.id = ls.du_an_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.v_lich_su_moi_han_chi_tiet to anon, authenticated;
