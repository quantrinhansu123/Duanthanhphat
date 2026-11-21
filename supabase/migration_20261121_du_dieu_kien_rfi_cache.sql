-- Cache cờ đủ điều kiện phát RFI lên lich_su_moi_han (cùng trigger với tình trạng chất lượng).
-- API phát RFI đọc cột này thay vì quét view chat_luong_moi_han → hết statement timeout.
begin;

alter table public.lich_su_moi_han
  add column if not exists du_dieu_kien_rfi boolean;

update public.lich_su_moi_han
set du_dieu_kien_rfi = false
where du_dieu_kien_rfi is null;

alter table public.lich_su_moi_han
  alter column du_dieu_kien_rfi set default false;

alter table public.lich_su_moi_han
  alter column du_dieu_kien_rfi set not null;

comment on column public.lich_su_moi_han.du_dieu_kien_rfi is
  'Cache cờ đủ điều kiện phát RFI (khớp chat_luong_moi_han.du_dieu_kien_rfi). Đồng bộ bằng cap_nhat_tinh_trang_chat_luong.';

create index if not exists idx_lich_su_moi_han_du_an_rfi
  on public.lich_su_moi_han (du_an_id, tinh_trang_chat_luong)
  where du_dieu_kien_rfi;

-- Cùng công thức view chat_luong_moi_han (migration_20261115).
create or replace function public.du_dieu_kien_rfi_tinh(p_moi_han_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    ls.so_luong_thuc_hien = 1
      and (flags.noi_bo_dat or (kt.ngay_mai is not null and kt.truc_quan is null))
      and not flags.ndt_loi
      and not flags.ep_khong_dat
      and not flags.sua_chua
      and kt.ket_luan_cuoi is null
      and not exists (
        select 1 from public.phieu_nt_tach_moi m
        where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Không đạt'
          and kt.phien_ban is not null
          and nullif(m.du_lieu_chot->>'phien_ban', '')::int = kt.phien_ban
      ),
    false
  )
  from public.lich_su_moi_han ls
  left join public.kiem_tra_moi_han kt on kt.moi_han_id = ls.id
  left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id
  cross join lateral (
    select public.qlcl_xet_hinh_hoc(coalesce(kt.gia_tri_do, '{}'::jsonb), tc.dung_sai) as ket_qua
  ) hh
  cross join lateral (
    select
      coalesce(kt.ngay_mai is not null and kt.truc_quan = 'Đạt' and hh.ket_qua = 'Đạt', false) as noi_bo_dat,
      coalesce(
        kt.ket_qua_ndt = 'Không đạt'
        or exists (
          select 1 from public.phieu_nt_tach_moi m
          where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Không đạt'
        ),
        false
      ) as ndt_loi,
      coalesce(kt.xu_ly_truc_quan = 'khong_dat', false) as ep_khong_dat,
      coalesce(
        (kt.truc_quan = 'Không đạt' or hh.ket_qua = 'Không đạt' or kt.ly_do_loai_nghiem_thu is not null)
        and coalesce(kt.ket_qua_ndt, '') is distinct from 'Không đạt'
        and coalesce(kt.xu_ly_truc_quan, 'sua_chua') = 'sua_chua',
        false
      ) as sua_chua
  ) flags
  where ls.id = p_moi_han_id
$$;

revoke all on function public.du_dieu_kien_rfi_tinh(uuid) from public, anon, authenticated;
grant execute on function public.du_dieu_kien_rfi_tinh(uuid) to service_role;

-- Cập nhật cả tình trạng + cờ RFI trong một lần.
create or replace function public.cap_nhat_tinh_trang_chat_luong(p_moi_han_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
  rfi boolean;
begin
  if p_moi_han_id is null then
    return null;
  end if;
  v := coalesce(public.tinh_trang_chat_luong_tinh(p_moi_han_id), 'Chờ mài');
  rfi := coalesce(public.du_dieu_kien_rfi_tinh(p_moi_han_id), false);
  update public.lich_su_moi_han
  set tinh_trang_chat_luong = v,
      du_dieu_kien_rfi = rfi
  where id = p_moi_han_id
    and (
      tinh_trang_chat_luong is distinct from v
      or du_dieu_kien_rfi is distinct from rfi
    );
  return v;
end $$;

revoke all on function public.cap_nhat_tinh_trang_chat_luong(uuid) from public, anon, authenticated;
grant execute on function public.cap_nhat_tinh_trang_chat_luong(uuid) to service_role;

-- Backfill theo ngày.
do $$
declare
  batch record;
begin
  perform set_config('statement_timeout', '120s', true);
  for batch in
    select ngay_thuc_hien as d
    from public.lich_su_moi_han
    group by ngay_thuc_hien
    order by ngay_thuc_hien
  loop
    update public.lich_su_moi_han ls
    set du_dieu_kien_rfi = v.rfi
    from (
      select ls2.id, coalesce(public.du_dieu_kien_rfi_tinh(ls2.id), false) as rfi
      from public.lich_su_moi_han ls2
      where ls2.ngay_thuc_hien is not distinct from batch.d
    ) v
    where ls.id = v.id
      and ls.du_dieu_kien_rfi is distinct from v.rfi;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

-- Kiểm tra:
-- select du_dieu_kien_rfi, tinh_trang_chat_luong, count(*) from lich_su_moi_han group by 1,2 order by 3 desc;
-- select count(*) from lich_su_moi_han ls
-- where ls.du_dieu_kien_rfi is distinct from public.du_dieu_kien_rfi_tinh(ls.id);
