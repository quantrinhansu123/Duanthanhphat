-- NDT đạt chỉ là điều kiện nghiệm thu. Chờ ký phải có kết quả nghiệm thu Đạt.
-- Giữ nguyên yêu cầu chiều dài mài và toàn bộ dữ liệu/hồ sơ đã chốt.
begin;

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
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      join public.dot_nghiem_thu d on d.id = dm.dot_id
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and coalesce(d.thong_tin->>'draft', 'false') <> 'true'
    ) then 'Chờ ký biên bản'
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

commit;
