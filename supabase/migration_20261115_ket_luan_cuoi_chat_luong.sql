-- Chốt Đạt trực tiếp cho 11 mối Chấp thuận 06/10/2026 — KHÔNG tạo phiếu RFI/NT.
begin;

alter table public.kiem_tra_moi_han
  add column if not exists ket_luan_cuoi text
  check (ket_luan_cuoi is null or ket_luan_cuoi in ('Đạt', 'Không đạt'));

comment on column public.kiem_tra_moi_han.ket_luan_cuoi is
  'Kết luận chất lượng cuối (Đạt/Không đạt) không qua phiếu nghiệm thu. NULL = theo luồng bình thường.';

create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and (flags.noi_bo_dat or (kt.ngay_mai is not null and kt.truc_quan is null))
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and kt.ket_luan_cuoi is null
      and not exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Không đạt' and kt.phien_ban is not null and nullif(m.du_lieu_chot->>'phien_ban', '')::int = kt.phien_ban),
    false
  ) as du_dieu_kien_rfi,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
      and flags.ndt_dat
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and kt.ket_luan_cuoi is null
      and (
        tc.dung_sai is null
        or not (tc.dung_sai ? 'chieu_dai_mai')
        or nullif(kt.gia_tri_do->>'chieu_dai_mai', '') is not null
      ),
    false
  ) as du_dieu_kien_nghiem_thu,
  case
    when kt.ket_luan_cuoi = 'Đạt' then 'Đạt'
    when kt.ket_luan_cuoi = 'Không đạt' then 'Không đạt'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt' and (select count(*) from public.ho_so_nghiem_thu h where h.dot_id=dm.dot_id and h.tinh_trang_ky='Đã ký') = 3
    ) then 'Đạt'
    when kt.moi_han_id is null then 'Chờ mài'
    when flags.ndt_loi or flags.ep_khong_dat then 'Không đạt'
    when flags.sua_chua then 'Sửa chữa/khắc phục'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Không đạt' and kt.phien_ban is not null and nullif(m.du_lieu_chot->>'phien_ban', '')::int = kt.phien_ban) then 'Sửa chữa/khắc phục'
    when kt.ngay_mai is null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Chờ mài'
    when kt.ngay_mai is not null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Mài xong'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      join public.dot_nghiem_thu d on d.id = dm.dot_id
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and coalesce(d.thong_tin->>'draft', 'false') <> 'true'
    ) then 'Chờ ký biên bản'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') and exists (select 1 from public.phieu_nt_tach_moi m join public.phieu_nt_tach p on p.id = m.phieu_id where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt' and p.da_ky) then 'Đạt'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') and exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt') then 'Chờ ký biên bản'
    when exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt') then 'Chờ siêu âm'
    when flags.noi_bo_dat and kt.ket_qua_ndt = 'Đạt' then 'Chờ nghiệm thu'
    when flags.noi_bo_dat then 'Chờ siêu âm'
    when kt.ngay_mai is not null and kt.truc_quan is null then 'Mài xong'
    else 'Chờ mài'
  end as tinh_trang
from public.lich_su_moi_han ls
left join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id
cross join lateral (
  select public.qlcl_xet_hinh_hoc(coalesce(kt.gia_tri_do, '{}'::jsonb), tc.dung_sai) as ket_qua
) hh
cross join lateral (
  select
    coalesce(kt.ngay_mai is not null and kt.truc_quan = 'Đạt' and hh.ket_qua = 'Đạt', false) as noi_bo_dat,
    coalesce(not coalesce(tc.yeu_cau_ndt, true) or kt.ket_qua_ndt = 'Đạt', false) as ndt_dat,
    coalesce(kt.ket_qua_ndt = 'Không đạt' or exists (select 1 from public.phieu_nt_tach_moi m where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Không đạt'), false) as ndt_loi,
    coalesce(kt.xu_ly_truc_quan = 'khong_dat', false) as ep_khong_dat,
    coalesce(
      (kt.truc_quan = 'Không đạt' or hh.ket_qua = 'Không đạt' or kt.ly_do_loai_nghiem_thu is not null)
      and coalesce(kt.ket_qua_ndt, '') is distinct from 'Không đạt'
      and coalesce(kt.xu_ly_truc_quan, 'sua_chua') = 'sua_chua',
      false
    ) as sua_chua
) flags;

update public.kiem_tra_moi_han kt
set ket_luan_cuoi = 'Đạt'
from public.lich_su_moi_han ls
where ls.id = kt.moi_han_id
  and ls.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
  and ls.loai_moi_han = 'Chấp thuận'
  and ls.ngay_thuc_hien = date '2026-10-06';

notify pgrst, 'reload schema';
commit;

-- Kiểm tra nhanh:
-- select ma_lich_su, q.tinh_trang
-- from lich_su_moi_han ls
-- join chat_luong_moi_han q on q.moi_han_id = ls.id
-- where ls.du_an_id = '2370b59d-acd5-40a9-9f3f-94445a648a1a'
--   and ls.ngay_thuc_hien = '2026-10-06' and ls.loai_moi_han = 'Chấp thuận'
-- order by ma_lich_su;
