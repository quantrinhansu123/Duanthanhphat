-- Cache tình trạng chất lượng workflow lên lịch sử mối hàn (cột thật).
-- Trước đây chỉ tính trong view chat_luong_moi_han → nhật ký dễ statement timeout / «Chưa tải».
-- Công thức tinh_trang_chat_luong_tinh() khớp CASE hiện tại của chat_luong_moi_han
-- (migration_20261115_ket_luan_cuoi_chat_luong.sql). View chat_luong_moi_han vẫn giữ
-- để RFI / điều kiện RPC; nhật ký đọc cột cache qua bao_cao / nhat_ky_han_chat_luong.
begin;

alter table public.lich_su_moi_han
  add column if not exists tinh_trang_chat_luong text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lich_su_moi_han_tinh_trang_chat_luong_check'
  ) then
    alter table public.lich_su_moi_han
      add constraint lich_su_moi_han_tinh_trang_chat_luong_check
      check (
        tinh_trang_chat_luong is null
        or tinh_trang_chat_luong in (
          'Chờ mài',
          'Mài xong',
          'Chờ siêu âm và nghiệm thu',
          'Chờ siêu âm',
          'Chờ nghiệm thu',
          'Sửa chữa/khắc phục',
          'Chờ ký biên bản',
          'Đạt',
          'Không đạt',
          'Không thí nghiệm'
        )
      );
  end if;
end $$;

update public.lich_su_moi_han
set tinh_trang_chat_luong = 'Chờ mài'
where tinh_trang_chat_luong is null;

alter table public.lich_su_moi_han
  alter column tinh_trang_chat_luong set default 'Chờ mài';

alter table public.lich_su_moi_han
  alter column tinh_trang_chat_luong set not null;

comment on column public.lich_su_moi_han.tinh_trang_chat_luong is
  'Cache tình trạng chất lượng workflow (Chờ mài / Mài xong / …). Đồng bộ bằng trigger từ kiểm tra / phiếu NT / hồ sơ.';

create index if not exists idx_lich_su_moi_han_tinh_trang_chat_luong
  on public.lich_su_moi_han (tinh_trang_chat_luong);

create index if not exists idx_lich_su_moi_han_ngay_tinh_trang_chat_luong
  on public.lich_su_moi_han (ngay_thuc_hien desc, tinh_trang_chat_luong);

-- Tính đúng 1 mối (cùng quy tắc view chat_luong_moi_han hiện hành).
create or replace function public.tinh_trang_chat_luong_tinh(p_moi_han_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when kt.ket_luan_cuoi = 'Đạt' then 'Đạt'
    when kt.ket_luan_cuoi = 'Không đạt' then 'Không đạt'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and (select count(*) from public.ho_so_nghiem_thu h where h.dot_id = dm.dot_id and h.tinh_trang_ky = 'Đã ký') = 3
    ) then 'Đạt'
    when kt.moi_han_id is null then 'Chờ mài'
    when flags.ndt_loi or flags.ep_khong_dat then 'Không đạt'
    when flags.sua_chua then 'Sửa chữa/khắc phục'
    when exists (
      select 1 from public.phieu_nt_tach_moi m
      where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Không đạt'
        and kt.phien_ban is not null
        and nullif(m.du_lieu_chot->>'phien_ban', '')::int = kt.phien_ban
    ) then 'Sửa chữa/khắc phục'
    when kt.ngay_mai is null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Chờ mài'
    when kt.ngay_mai is not null and kt.truc_quan is null and kt.ket_qua_ndt is null then 'Mài xong'
    when tc.yeu_cau_ndt = false then 'Không thí nghiệm'
    when exists (
      select 1 from public.dot_nghiem_thu_moi dm
      join public.dot_nghiem_thu d on d.id = dm.dot_id
      where dm.moi_han_id = ls.id and dm.ket_qua = 'Đạt'
        and coalesce(d.thong_tin->>'draft', 'false') <> 'true'
    ) then 'Chờ ký biên bản'
    when exists (
      select 1 from public.phieu_nt_tach_moi m
      where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt'
    ) and exists (
      select 1 from public.phieu_nt_tach_moi m
      join public.phieu_nt_tach p on p.id = m.phieu_id
      where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt' and p.da_ky
    ) then 'Đạt'
    when exists (
      select 1 from public.phieu_nt_tach_moi m
      where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt'
    ) and exists (
      select 1 from public.phieu_nt_tach_moi m
      where m.moi_han_id = ls.id and m.loai = 'sieu-am' and m.ket_qua = 'Đạt'
    ) then 'Chờ ký biên bản'
    when exists (
      select 1 from public.phieu_nt_tach_moi m
      where m.moi_han_id = ls.id and m.loai = 'hinh-hoc' and m.ket_qua = 'Đạt'
    ) then 'Chờ siêu âm'
    when flags.noi_bo_dat and kt.ket_qua_ndt = 'Đạt' then 'Chờ nghiệm thu'
    when flags.noi_bo_dat then 'Chờ siêu âm'
    when kt.ngay_mai is not null and kt.truc_quan is null then 'Mài xong'
    else 'Chờ mài'
  end
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

revoke all on function public.tinh_trang_chat_luong_tinh(uuid) from public, anon, authenticated;
grant execute on function public.tinh_trang_chat_luong_tinh(uuid) to service_role;

create or replace function public.cap_nhat_tinh_trang_chat_luong(p_moi_han_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  if p_moi_han_id is null then
    return null;
  end if;
  v := coalesce(public.tinh_trang_chat_luong_tinh(p_moi_han_id), 'Chờ mài');
  update public.lich_su_moi_han
  set tinh_trang_chat_luong = v
  where id = p_moi_han_id
    and tinh_trang_chat_luong is distinct from v;
  return v;
end $$;

revoke all on function public.cap_nhat_tinh_trang_chat_luong(uuid) from public, anon, authenticated;
grant execute on function public.cap_nhat_tinh_trang_chat_luong(uuid) to service_role;

create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_kiem_tra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.cap_nhat_tinh_trang_chat_luong(coalesce(new.moi_han_id, old.moi_han_id));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_cap_nhat_tinh_trang_chat_luong_kiem_tra on public.kiem_tra_moi_han;
create trigger trg_cap_nhat_tinh_trang_chat_luong_kiem_tra
  after insert or update or delete on public.kiem_tra_moi_han
  for each row execute function public.trg_cap_nhat_tinh_trang_chat_luong_kiem_tra();

create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_moi()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.cap_nhat_tinh_trang_chat_luong(coalesce(new.moi_han_id, old.moi_han_id));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach_moi on public.phieu_nt_tach_moi;
create trigger trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach_moi
  after insert or update or delete on public.phieu_nt_tach_moi
  for each row execute function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_moi();

drop trigger if exists trg_cap_nhat_tinh_trang_chat_luong_dot_moi on public.dot_nghiem_thu_moi;
create trigger trg_cap_nhat_tinh_trang_chat_luong_dot_moi
  after insert or update or delete on public.dot_nghiem_thu_moi
  for each row execute function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_moi();

-- Đổi da_ky trên phiếu tách → cập nhật mọi mối trong phiếu.
create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.da_ky is not distinct from old.da_ky then
    return new;
  end if;
  perform public.cap_nhat_tinh_trang_chat_luong(m.moi_han_id)
  from public.phieu_nt_tach_moi m
  where m.phieu_id = coalesce(new.id, old.id);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach on public.phieu_nt_tach;
create trigger trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach
  after update of da_ky on public.phieu_nt_tach
  for each row execute function public.trg_cap_nhat_tinh_trang_chat_luong_phieu_nt_tach();

-- Đổi tình trạng ký hồ sơ → cập nhật mối trong đợt.
create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_ho_so()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.tinh_trang_ky is not distinct from old.tinh_trang_ky then
    return new;
  end if;
  perform public.cap_nhat_tinh_trang_chat_luong(m.moi_han_id)
  from public.dot_nghiem_thu_moi m
  where m.dot_id = coalesce(new.dot_id, old.dot_id);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_cap_nhat_tinh_trang_chat_luong_ho_so on public.ho_so_nghiem_thu;
create trigger trg_cap_nhat_tinh_trang_chat_luong_ho_so
  after insert or update of tinh_trang_ky or delete on public.ho_so_nghiem_thu
  for each row execute function public.trg_cap_nhat_tinh_trang_chat_luong_ho_so();

-- Đổi khối lượng / loại mối có thể đổi điều kiện RFI & nhãn.
create or replace function public.trg_cap_nhat_tinh_trang_chat_luong_lich_su()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.cap_nhat_tinh_trang_chat_luong(new.id);
    return new;
  end if;
  if (new.so_luong_thuc_hien, new.loai_moi_han, new.cong_nghe_han, new.du_an_id)
    is distinct from (old.so_luong_thuc_hien, old.loai_moi_han, old.cong_nghe_han, old.du_an_id) then
    perform public.cap_nhat_tinh_trang_chat_luong(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_cap_nhat_tinh_trang_chat_luong_lich_su on public.lich_su_moi_han;
create trigger trg_cap_nhat_tinh_trang_chat_luong_lich_su
  after insert or update of so_luong_thuc_hien, loai_moi_han, cong_nghe_han, du_an_id
  on public.lich_su_moi_han
  for each row execute function public.trg_cap_nhat_tinh_trang_chat_luong_lich_su();

-- Backfill theo ngày để tránh một câu UPDATE quá nặng.
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
    set tinh_trang_chat_luong = v.tt
    from (
      select ls2.id,
        coalesce(public.tinh_trang_chat_luong_tinh(ls2.id), 'Chờ mài') as tt
      from public.lich_su_moi_han ls2
      where ls2.ngay_thuc_hien is not distinct from batch.d
    ) v
    where ls.id = v.id
      and ls.tinh_trang_chat_luong is distinct from v.tt;
  end loop;
end $$;

-- Đưa cột vào view báo cáo: DROP phụ thuộc trước (CREATE OR REPLACE không chèn cột giữa).
drop view if exists public.nhat_ky_han_chat_luong;
drop view if exists public.canh_bao_du_lieu_moi_han;
drop view if exists public.bao_cao_moi_han_theo_du_an;

create view public.bao_cao_moi_han_theo_du_an with (security_invoker = true) as
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
  ls.tinh_trang_chat_luong,
  ls.created_at,
  ls.anh_moi_han_lien_ket,
  ls.ca_han,
  ls.gio_han,
  ls.ten_moi_han_theo_may,
  ls.ma_hien_truong,
  ls.gio_bat_dau,
  ls.gio_ket_thuc,
  ls.gio_nghi_trua
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

create view public.canh_bao_du_lieu_moi_han with (security_invoker = true) as
select *
from public.bao_cao_moi_han_theo_du_an
where so_luong_loi > 0
  and nullif(btrim(nguyen_nhan_loi), '') is null;
grant select on public.canh_bao_du_lieu_moi_han to anon, authenticated;

-- Nhật ký chất lượng: b.* đã có tinh_trang_chat_luong cache; không join chat_luong_moi_han.
create view public.nhat_ky_han_chat_luong with (security_invoker = true) as
select
  b.*,
  kt.phien_ban as phien_ban_chat_luong,
  to_jsonb(kt) as kiem_tra_chat_luong,
  to_jsonb(tc) as tieu_chuan_chat_luong
from public.bao_cao_moi_han_theo_du_an b
left join public.kiem_tra_moi_han kt on kt.moi_han_id = b.id
left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id;

revoke all on public.nhat_ky_han_chat_luong from public, anon, authenticated;
grant select on public.nhat_ky_han_chat_luong to service_role;

notify pgrst, 'reload schema';
commit;

-- Kiểm tra nhanh sau khi chạy:
-- select tinh_trang_chat_luong, count(*) from lich_su_moi_han group by 1 order by 2 desc;
-- select count(*) from lich_su_moi_han ls
-- where ls.tinh_trang_chat_luong is distinct from public.tinh_trang_chat_luong_tinh(ls.id);
