-- Khôi phục tự động mối đã đủ 4 chỉ tiêu cũ bị tụt «Chờ mài» sau khi bổ sung chiều dài mài.
-- - qlcl_xet_hinh_hoc: chieu_dai_mai chưa nhập → bỏ qua (RFI / «Chờ siêu âm» không bị hạ).
-- - du_dieu_kien_nghiem_thu: vẫn bắt buộc đã nhập chieu_dai_mai trước khi Đạt.

create or replace function public.qlcl_xet_hinh_hoc(p_do jsonb, p_dung_sai jsonb)
returns text language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; b jsonb; v numeric; lo numeric; hi numeric; missing boolean := false;
begin
  if not public.qlcl_so_do_hop_le(p_do) then raise exception 'Số đo không hợp lệ'; end if;
  if p_dung_sai is null then return null; end if;
  if not public.qlcl_dung_sai_hop_le(p_dung_sai) then raise exception 'Dung sai không hợp lệ'; end if;
  foreach k in array array['doc_mat_lan','ngang_nam_ray','ngang_chan_ray','phang_mat_lan','chieu_dai_mai'] loop
    v := (p_do->>k)::numeric;
    if v is null then
      if k = 'chieu_dai_mai' then continue; end if;
      missing := true; continue;
    end if;
    b := p_dung_sai->k; lo := (b->>'min')::numeric; hi := (b->>'max')::numeric;
    if v < lo or v > hi or (v = lo and not (b->>'minInclusive')::boolean)
      or (v = hi and not (b->>'maxInclusive')::boolean) then return 'Không đạt'; end if;
  end loop;
  return case when missing then null else 'Đạt' end;
end $$;

create or replace view public.chat_luong_moi_han with (security_invoker = true) as
select ls.id as moi_han_id, ls.du_an_id, ls.loai_moi_han, ls.cong_nghe_han, ls.ngay_thuc_hien,
  kt.phien_ban, kt.tieu_chuan_id, hh.ket_qua as ket_qua_hinh_hoc,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and (not tc.ndt_truoc_rfi or flags.ndt_dat),
    false
  ) as du_dieu_kien_rfi,
  coalesce(
    ls.so_luong_thuc_hien = 1
      and flags.noi_bo_dat
      and flags.ndt_dat
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and (
        tc.dung_sai is null
        or not (tc.dung_sai ? 'chieu_dai_mai')
        or nullif(kt.gia_tri_do->>'chieu_dai_mai', '') is not null
      ),
    false
  ) as du_dieu_kien_nghiem_thu,
  case
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt' and (select count(*) from public.ho_so_nghiem_thu h where h.dot_id=dm.dot_id and h.tinh_trang_ky='Đã ký') = 3
    ) then 'Đạt'
    when kt.moi_han_id is null then 'Chờ mài'
    when flags.ndt_loi or flags.ep_khong_dat then 'Không đạt'
    when flags.sua_chua then 'Sửa chữa/khắc phục'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when flags.noi_bo_dat and flags.ndt_dat then 'Chờ ký biên bản'
    when flags.noi_bo_dat then 'Chờ siêu âm và nghiệm thu'
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
    coalesce(not coalesce(tc.yeu_cau_ndt, true) or (kt.ket_qua_ndt = 'Đạt' and kt.ngay_ndt is not null), false) as ndt_dat,
    coalesce(kt.ket_qua_ndt = 'Không đạt', false) as ndt_loi,
    coalesce(
      kt.ly_do_loai_nghiem_thu is not null
      or kt.xu_ly_truc_quan = 'khong_dat',
      false
    ) as ep_khong_dat,
    coalesce(
      (kt.truc_quan = 'Không đạt' or hh.ket_qua = 'Không đạt')
      and coalesce(kt.ket_qua_ndt, '') is distinct from 'Không đạt'
      and kt.ly_do_loai_nghiem_thu is null
      and coalesce(kt.xu_ly_truc_quan, 'sua_chua') = 'sua_chua',
      false
    ) as sua_chua
) flags;

notify pgrst, 'reload schema';
