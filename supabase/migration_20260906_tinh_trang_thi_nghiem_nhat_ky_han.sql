-- Bổ sung vòng đời thí nghiệm cho từng mối hàn.
-- Trạng thái mới mặc định chờ thí nghiệm; mối thuộc dự án Đào tạo nội bộ
-- tự động được đánh dấu Không thí nghiệm ở cả client và database.

alter table public.lich_su_moi_han
  add column if not exists ma_khuyet_tat text[],
  add column if not exists tinh_trang_thi_nghiem text;

update public.lich_su_moi_han ls
set tinh_trang_thi_nghiem = case
  when ls.loai_moi_han = 'Đào tạo'
    or exists (
      select 1
      from public.du_an da
      where da.id = ls.du_an_id
        and lower(btrim(da.du_an)) = 'đào tạo nội bộ'
    ) then 'Không thí nghiệm'
  when coalesce(ls.so_luong_loi, 0) > 0 then 'Không đạt'
  else 'Đạt'
end
where ls.tinh_trang_thi_nghiem is null;

alter table public.lich_su_moi_han
  alter column tinh_trang_thi_nghiem set default 'Chờ thí nghiệm',
  alter column tinh_trang_thi_nghiem set not null;

alter table public.lich_su_moi_han
  drop constraint if exists lich_su_moi_han_tinh_trang_thi_nghiem_check;
alter table public.lich_su_moi_han
  add constraint lich_su_moi_han_tinh_trang_thi_nghiem_check
  check (tinh_trang_thi_nghiem in ('Chờ thí nghiệm', 'Đạt', 'Không đạt', 'Không thí nghiệm'));

create or replace function public.them_nhat_ky_han_co_toa_do_status(
  p_ma_lich_su text,
  p_du_an_id uuid,
  p_tho_han_id uuid,
  p_nam_thuc_hien smallint,
  p_ngay_thuc_hien date,
  p_loai_ray text,
  p_loai_moi_han text,
  p_cong_nghe_han text,
  p_so_luong_loi integer,
  p_nguyen_nhan_loi text,
  p_ghi_chu text,
  p_moi_han_lien_ket text,
  p_may_id uuid,
  p_chung_chi_su_dung text,
  p_hach_toan text,
  p_toa_do_id uuid default null,
  p_kinh_do double precision default null,
  p_vi_do double precision default null,
  p_ly_trinh text default null,
  p_ma_khuyet_tat text[] default null,
  p_tinh_trang_thi_nghiem text default 'Chờ thí nghiệm'
)
returns uuid
language plpgsql
as $$
declare
  weld_id uuid;
  resolved_status text := p_tinh_trang_thi_nghiem;
begin
  if exists (
    select 1 from public.du_an da
    where da.id = p_du_an_id and lower(btrim(da.du_an)) = 'đào tạo nội bộ'
  ) then
    resolved_status := 'Không thí nghiệm';
  end if;

  if resolved_status not in ('Chờ thí nghiệm', 'Đạt', 'Không đạt', 'Không thí nghiệm') then
    raise exception 'Tình trạng thí nghiệm không hợp lệ: %', resolved_status;
  end if;

  weld_id := public.them_nhat_ky_han_co_toa_do(
    p_ma_lich_su, p_du_an_id, p_tho_han_id, p_nam_thuc_hien,
    p_ngay_thuc_hien, p_loai_ray, p_loai_moi_han, p_cong_nghe_han,
    p_so_luong_loi, p_nguyen_nhan_loi, p_ghi_chu, p_moi_han_lien_ket,
    p_may_id, p_chung_chi_su_dung, p_hach_toan, p_toa_do_id,
    p_kinh_do, p_vi_do, p_ly_trinh
  );

  update public.lich_su_moi_han
  set ma_khuyet_tat = case
        when coalesce(cardinality(p_ma_khuyet_tat), 0) = 0 then null
        else p_ma_khuyet_tat
      end,
      tinh_trang_thi_nghiem = resolved_status
  where id = weld_id;

  if not found then
    raise exception 'Không tìm thấy nhật ký vừa tạo %', weld_id;
  end if;
  return weld_id;
end;
$$;

revoke execute on function public.them_nhat_ky_han_co_toa_do_status(
  text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text,
  uuid, text, text, uuid, double precision, double precision, text, text[], text
) from public;
grant execute on function public.them_nhat_ky_han_co_toa_do_status(
  text, uuid, uuid, smallint, date, text, text, text, integer, text, text, text,
  uuid, text, text, uuid, double precision, double precision, text, text[], text
) to anon, authenticated;

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
  ls.tinh_trang_thi_nghiem
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;
