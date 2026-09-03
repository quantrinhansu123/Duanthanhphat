-- ============================================================
-- Tổng hợp mối hàn theo năm (materialized — tránh lag UI)
-- Chạy trong: Supabase Dashboard → SQL Editor
-- Có thể chạy lại an toàn.
-- ============================================================
--
-- tong_moi_han_nam                 — tổng theo năm (+ lỗi, FBW/ATW, loại mối)
-- tong_moi_han_nam_du_an           — năm × dự án
-- tong_moi_han_nam_nhan_su         — năm × nhân sự
-- tong_moi_han_nam_phuong_phap     — năm × phương pháp hàn (FBW/ATW)
-- tong_moi_han_nam_loai_moi        — năm × loại mối hàn (Sản xuất/Thử nghiệm/Đào tạo)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Tổng theo năm
-- ------------------------------------------------------------
create table if not exists public.tong_moi_han_nam (
  nam                   smallint primary key,
  tong_moi_han          integer not null default 0,
  tong_loi              integer not null default 0,
  tong_dat              integer not null default 0,
  fbw                   integer not null default 0,
  atw                   integer not null default 0,
  loi_fbw               integer not null default 0,
  loi_atw               integer not null default 0,
  san_xuat              integer not null default 0,
  thu_nghiem            integer not null default 0,
  dao_tao               integer not null default 0,
  loi_san_xuat          integer not null default 0,
  loi_thu_nghiem        integer not null default 0,
  loi_dao_tao           integer not null default 0,
  updated_at            timestamptz not null default now(),

  constraint tong_moi_han_nam_nam_check check (nam between 1900 and 2100),
  constraint tong_moi_han_nam_sl_check check (
    tong_moi_han >= 0 and tong_loi >= 0 and tong_dat >= 0
    and tong_loi <= tong_moi_han
  )
);

-- Cột mới nếu bảng đã tồn tại từ bản cũ
alter table public.tong_moi_han_nam add column if not exists san_xuat integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists thu_nghiem integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists dao_tao integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists loi_san_xuat integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists loi_thu_nghiem integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists loi_dao_tao integer not null default 0;

comment on table public.tong_moi_han_nam is
  'Tổng hợp sẵn mối hàn theo năm (thực tế, lỗi, phương pháp, loại mối)';

-- ------------------------------------------------------------
-- 2. Năm × dự án
-- ------------------------------------------------------------
create table if not exists public.tong_moi_han_nam_du_an (
  nam               smallint not null,
  du_an_id          uuid not null references public.du_an (id) on delete cascade,
  ma_du_an          text,
  du_an             text not null,
  tong_moi_han      integer not null default 0,
  tong_loi          integer not null default 0,
  tong_dat          integer not null default 0,
  fbw               integer not null default 0,
  atw               integer not null default 0,
  loi_fbw           integer not null default 0,
  loi_atw           integer not null default 0,
  san_xuat          integer not null default 0,
  thu_nghiem        integer not null default 0,
  dao_tao           integer not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (nam, du_an_id)
);

alter table public.tong_moi_han_nam_du_an add column if not exists san_xuat integer not null default 0;
alter table public.tong_moi_han_nam_du_an add column if not exists thu_nghiem integer not null default 0;
alter table public.tong_moi_han_nam_du_an add column if not exists dao_tao integer not null default 0;

create index if not exists idx_tong_moi_han_nam_du_an_du_an
  on public.tong_moi_han_nam_du_an (du_an_id, nam);

-- ------------------------------------------------------------
-- 3. Năm × nhân sự
-- ------------------------------------------------------------
create table if not exists public.tong_moi_han_nam_nhan_su (
  nam               smallint not null,
  tho_han_id        uuid not null references public.nhan_su (employee_id) on delete cascade,
  ma_nhan_su        text,
  ten_tho_han       text not null,
  tong_moi_han      integer not null default 0,
  tong_loi          integer not null default 0,
  tong_dat          integer not null default 0,
  fbw               integer not null default 0,
  atw               integer not null default 0,
  loi_fbw           integer not null default 0,
  loi_atw           integer not null default 0,
  san_xuat          integer not null default 0,
  thu_nghiem        integer not null default 0,
  dao_tao           integer not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (nam, tho_han_id)
);

alter table public.tong_moi_han_nam_nhan_su add column if not exists san_xuat integer not null default 0;
alter table public.tong_moi_han_nam_nhan_su add column if not exists thu_nghiem integer not null default 0;
alter table public.tong_moi_han_nam_nhan_su add column if not exists dao_tao integer not null default 0;

create index if not exists idx_tong_moi_han_nam_nhan_su_tho
  on public.tong_moi_han_nam_nhan_su (tho_han_id, nam);

-- ------------------------------------------------------------
-- 4. Năm × phương pháp hàn (FBW / ATW)
-- ------------------------------------------------------------
create table if not exists public.tong_moi_han_nam_phuong_phap (
  nam               smallint not null,
  cong_nghe_han     text not null,
  tong_moi_han      integer not null default 0,
  tong_loi          integer not null default 0,
  tong_dat          integer not null default 0,
  san_xuat          integer not null default 0,
  thu_nghiem        integer not null default 0,
  dao_tao           integer not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (nam, cong_nghe_han),
  constraint tong_moi_han_nam_pp_check check (cong_nghe_han in ('FBW', 'ATW'))
);

comment on table public.tong_moi_han_nam_phuong_phap is
  'Tổng hợp mối hàn theo năm và phương pháp hàn (FBW/ATW)';

-- ------------------------------------------------------------
-- 5. Năm × loại mối hàn
-- ------------------------------------------------------------
create table if not exists public.tong_moi_han_nam_loai_moi (
  nam               smallint not null,
  loai_moi_han      text not null,
  tong_moi_han      integer not null default 0,
  tong_loi          integer not null default 0,
  tong_dat          integer not null default 0,
  fbw               integer not null default 0,
  atw               integer not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (nam, loai_moi_han),
  constraint tong_moi_han_nam_loai_check
    check (loai_moi_han in ('Thử nghiệm', 'Đào tạo', 'Sản xuất'))
);

comment on table public.tong_moi_han_nam_loai_moi is
  'Tổng hợp mối hàn theo năm và loại mối hàn';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.tong_moi_han_nam enable row level security;
alter table public.tong_moi_han_nam_du_an enable row level security;
alter table public.tong_moi_han_nam_nhan_su enable row level security;
alter table public.tong_moi_han_nam_phuong_phap enable row level security;
alter table public.tong_moi_han_nam_loai_moi enable row level security;

drop policy if exists "anon_read_tong_moi_han_nam" on public.tong_moi_han_nam;
create policy "anon_read_tong_moi_han_nam"
  on public.tong_moi_han_nam for select to anon using (true);
drop policy if exists "authenticated_all_tong_moi_han_nam" on public.tong_moi_han_nam;
create policy "authenticated_all_tong_moi_han_nam"
  on public.tong_moi_han_nam for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_tong_moi_han_nam_du_an" on public.tong_moi_han_nam_du_an;
create policy "anon_read_tong_moi_han_nam_du_an"
  on public.tong_moi_han_nam_du_an for select to anon using (true);
drop policy if exists "authenticated_all_tong_moi_han_nam_du_an" on public.tong_moi_han_nam_du_an;
create policy "authenticated_all_tong_moi_han_nam_du_an"
  on public.tong_moi_han_nam_du_an for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_tong_moi_han_nam_nhan_su" on public.tong_moi_han_nam_nhan_su;
create policy "anon_read_tong_moi_han_nam_nhan_su"
  on public.tong_moi_han_nam_nhan_su for select to anon using (true);
drop policy if exists "authenticated_all_tong_moi_han_nam_nhan_su" on public.tong_moi_han_nam_nhan_su;
create policy "authenticated_all_tong_moi_han_nam_nhan_su"
  on public.tong_moi_han_nam_nhan_su for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_tong_moi_han_nam_phuong_phap" on public.tong_moi_han_nam_phuong_phap;
create policy "anon_read_tong_moi_han_nam_phuong_phap"
  on public.tong_moi_han_nam_phuong_phap for select to anon using (true);
drop policy if exists "authenticated_all_tong_moi_han_nam_phuong_phap" on public.tong_moi_han_nam_phuong_phap;
create policy "authenticated_all_tong_moi_han_nam_phuong_phap"
  on public.tong_moi_han_nam_phuong_phap for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_tong_moi_han_nam_loai_moi" on public.tong_moi_han_nam_loai_moi;
create policy "anon_read_tong_moi_han_nam_loai_moi"
  on public.tong_moi_han_nam_loai_moi for select to anon using (true);
drop policy if exists "authenticated_all_tong_moi_han_nam_loai_moi" on public.tong_moi_han_nam_loai_moi;
create policy "authenticated_all_tong_moi_han_nam_loai_moi"
  on public.tong_moi_han_nam_loai_moi for all to authenticated using (true) with check (true);

grant select on public.tong_moi_han_nam to anon, authenticated;
grant select on public.tong_moi_han_nam_du_an to anon, authenticated;
grant select on public.tong_moi_han_nam_nhan_su to anon, authenticated;
grant select on public.tong_moi_han_nam_phuong_phap to anon, authenticated;
grant select on public.tong_moi_han_nam_loai_moi to anon, authenticated;

grant select, insert, update, delete on public.tong_moi_han_nam to authenticated;
grant select, insert, update, delete on public.tong_moi_han_nam_du_an to authenticated;
grant select, insert, update, delete on public.tong_moi_han_nam_nhan_su to authenticated;
grant select, insert, update, delete on public.tong_moi_han_nam_phuong_phap to authenticated;
grant select, insert, update, delete on public.tong_moi_han_nam_loai_moi to authenticated;

-- ------------------------------------------------------------
-- Đồng bộ toàn bộ
-- ------------------------------------------------------------
create or replace function public.dong_bo_tong_moi_han_nam()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  truncate public.tong_moi_han_nam;
  truncate public.tong_moi_han_nam_du_an;
  truncate public.tong_moi_han_nam_nhan_su;
  truncate public.tong_moi_han_nam_phuong_phap;
  truncate public.tong_moi_han_nam_loai_moi;

  -- Tổng năm
  insert into public.tong_moi_han_nam (
    nam, tong_moi_han, tong_loi, tong_dat,
    fbw, atw, loi_fbw, loi_atw,
    san_xuat, thu_nghiem, dao_tao,
    loi_san_xuat, loi_thu_nghiem, loi_dao_tao,
    updated_at
  )
  select
    nam_thuc_hien,
    coalesce(sum(so_luong_thuc_hien), 0)::integer,
    coalesce(sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) - sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Đào tạo'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Đào tạo'), 0)::integer,
    now()
  from public.lich_su_moi_han
  group by nam_thuc_hien;

  -- Năm × dự án
  insert into public.tong_moi_han_nam_du_an (
    nam, du_an_id, ma_du_an, du_an,
    tong_moi_han, tong_loi, tong_dat, fbw, atw, loi_fbw, loi_atw,
    san_xuat, thu_nghiem, dao_tao, updated_at
  )
  select
    ls.nam_thuc_hien,
    da.id,
    da.ma_du_an,
    da.du_an,
    coalesce(sum(ls.so_luong_thuc_hien), 0)::integer,
    coalesce(sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) - sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Đào tạo'), 0)::integer,
    now()
  from public.lich_su_moi_han ls
  join public.du_an da on da.id = ls.du_an_id
  group by ls.nam_thuc_hien, da.id, da.ma_du_an, da.du_an;

  -- Năm × nhân sự
  insert into public.tong_moi_han_nam_nhan_su (
    nam, tho_han_id, ma_nhan_su, ten_tho_han,
    tong_moi_han, tong_loi, tong_dat, fbw, atw, loi_fbw, loi_atw,
    san_xuat, thu_nghiem, dao_tao, updated_at
  )
  select
    ls.nam_thuc_hien,
    ns.employee_id,
    ns.ma_nhan_su,
    ns.ho_ten,
    coalesce(sum(ls.so_luong_thuc_hien), 0)::integer,
    coalesce(sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) - sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Đào tạo'), 0)::integer,
    now()
  from public.lich_su_moi_han ls
  join public.nhan_su ns on ns.employee_id = ls.tho_han_id
  group by ls.nam_thuc_hien, ns.employee_id, ns.ma_nhan_su, ns.ho_ten;

  -- Năm × phương pháp hàn
  insert into public.tong_moi_han_nam_phuong_phap (
    nam, cong_nghe_han, tong_moi_han, tong_loi, tong_dat,
    san_xuat, thu_nghiem, dao_tao, updated_at
  )
  select
    nam_thuc_hien,
    cong_nghe_han,
    coalesce(sum(so_luong_thuc_hien), 0)::integer,
    coalesce(sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) - sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Đào tạo'), 0)::integer,
    now()
  from public.lich_su_moi_han
  group by nam_thuc_hien, cong_nghe_han;

  -- Năm × loại mối hàn
  insert into public.tong_moi_han_nam_loai_moi (
    nam, loai_moi_han, tong_moi_han, tong_loi, tong_dat, fbw, atw, updated_at
  )
  select
    nam_thuc_hien,
    loai_moi_han,
    coalesce(sum(so_luong_thuc_hien), 0)::integer,
    coalesce(sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) - sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'ATW'), 0)::integer,
    now()
  from public.lich_su_moi_han
  group by nam_thuc_hien, loai_moi_han;
end;
$$;

comment on function public.dong_bo_tong_moi_han_nam() is
  'Rebuild toàn bộ bảng tổng hợp năm (tổng / dự án / nhân sự / phương pháp / loại mối)';

grant execute on function public.dong_bo_tong_moi_han_nam() to authenticated, anon;

create or replace function public.trg_dong_bo_tong_moi_han_nam()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.dong_bo_tong_moi_han_nam();
  return null;
end;
$$;

drop trigger if exists trg_tong_moi_han_nam_sau_insert on public.lich_su_moi_han;
create trigger trg_tong_moi_han_nam_sau_insert
  after insert on public.lich_su_moi_han
  for each statement execute function public.trg_dong_bo_tong_moi_han_nam();

drop trigger if exists trg_tong_moi_han_nam_sau_update on public.lich_su_moi_han;
create trigger trg_tong_moi_han_nam_sau_update
  after update on public.lich_su_moi_han
  for each statement execute function public.trg_dong_bo_tong_moi_han_nam();

drop trigger if exists trg_tong_moi_han_nam_sau_delete on public.lich_su_moi_han;
create trigger trg_tong_moi_han_nam_sau_delete
  after delete on public.lich_su_moi_han
  for each statement execute function public.trg_dong_bo_tong_moi_han_nam();

-- Đồng bộ lần đầu
select public.dong_bo_tong_moi_han_nam();

notify pgrst, 'reload schema';
