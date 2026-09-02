-- ============================================================
-- Lịch chạy máy + liên kết máy với báo cáo mối hàn
-- Chạy sau: schema.sql, lich_su_moi_han.sql, moi_han_lien_ket.sql
-- Có thể chạy lại an toàn.
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. Danh mục máy
-- ------------------------------------------------------------
alter table public.thiet_bi
  add column if not exists ma_may text;

update public.thiet_bi
set ma_may = 'MAY-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where nullif(btrim(ma_may), '') is null;

alter table public.thiet_bi
  alter column ma_may set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'thiet_bi_ma_may_unique'
      and conrelid = 'public.thiet_bi'::regclass
  ) then
    alter table public.thiet_bi
      add constraint thiet_bi_ma_may_unique unique (ma_may);
  end if;
end;
$$;

comment on column public.thiet_bi.ma_may is 'Mã máy duy nhất dùng để liên kết và báo cáo';

insert into public.thiet_bi (ma_may, ten_may, trang_thai, hinh_anh)
values
  ('K920-01', 'Máy hàn aluminothermic K920', 'Hoạt động', '/may-han/k920.svg'),
  ('AMS60-03', 'Máy hàn đường ray AMS60', 'Hoạt động', '/may-han/ams60.svg'),
  ('K355-02', 'Máy hàn di động K355', 'Bảo trì', '/may-han/k355.svg'),
  ('GEO-01', 'Máy định vị & hàn GEO', 'Hoạt động', '/may-han/geo.svg'),
  ('K920-02', 'Máy hàn aluminothermic K920 (dự phòng)', 'Ngừng', '/may-han/k920.svg'),
  ('AMS60-01', 'Máy hàn đường ray AMS60 – tổ 1', 'Hỏng', '/may-han/ams60.svg')
on conflict (ma_may) do update
set ten_may = excluded.ten_may,
    trang_thai = excluded.trang_thai,
    hinh_anh = excluded.hinh_anh,
    updated_at = now();

-- ------------------------------------------------------------
-- 2. Lịch chạy máy
-- ------------------------------------------------------------
alter table public.nhat_ky_chay_may
  add column if not exists ngay date,
  add column if not exists ly_trinh_tu text,
  add column if not exists ly_trinh_den text,
  add column if not exists so_gio_hoat_dong numeric(6,2);

update public.nhat_ky_chay_may
set ngay = coalesce(ngay, created_at::date),
    ly_trinh_tu = coalesce(nullif(btrim(ly_trinh_tu), ''), 'Chưa cập nhật'),
    ly_trinh_den = coalesce(nullif(btrim(ly_trinh_den), ''), 'Chưa cập nhật'),
    so_gio_hoat_dong = coalesce(so_gio_hoat_dong, 0)
where ngay is null
   or nullif(btrim(ly_trinh_tu), '') is null
   or nullif(btrim(ly_trinh_den), '') is null
   or so_gio_hoat_dong is null;

alter table public.nhat_ky_chay_may
  alter column ngay set not null,
  alter column ly_trinh_tu set not null,
  alter column ly_trinh_den set not null,
  alter column so_gio_hoat_dong set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nhat_ky_chay_may_du_an_required'
      and conrelid = 'public.nhat_ky_chay_may'::regclass
  ) then
    alter table public.nhat_ky_chay_may
      add constraint nhat_ky_chay_may_du_an_required
      check (du_an is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nhat_ky_chay_may_may_required'
      and conrelid = 'public.nhat_ky_chay_may'::regclass
  ) then
    alter table public.nhat_ky_chay_may
      add constraint nhat_ky_chay_may_may_required
      check (may is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nhat_ky_chay_may_nguoi_required'
      and conrelid = 'public.nhat_ky_chay_may'::regclass
  ) then
    alter table public.nhat_ky_chay_may
      add constraint nhat_ky_chay_may_nguoi_required
      check (nguoi_phu_trach is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nhat_ky_chay_may_gio_check'
      and conrelid = 'public.nhat_ky_chay_may'::regclass
  ) then
    alter table public.nhat_ky_chay_may
      add constraint nhat_ky_chay_may_gio_check
      check (so_gio_hoat_dong >= 0 and so_gio_hoat_dong <= 24);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nhat_ky_chay_may_ly_trinh_check'
      and conrelid = 'public.nhat_ky_chay_may'::regclass
  ) then
    alter table public.nhat_ky_chay_may
      add constraint nhat_ky_chay_may_ly_trinh_check
      check (btrim(ly_trinh_tu) <> '' and btrim(ly_trinh_den) <> '');
  end if;
end;
$$;

create index if not exists idx_nhat_ky_chay_may_ngay
  on public.nhat_ky_chay_may (ngay desc);
create index if not exists idx_nhat_ky_chay_may_may_ngay
  on public.nhat_ky_chay_may (may, ngay desc);

drop trigger if exists trg_nhat_ky_updated_at on public.nhat_ky_chay_may;
create trigger trg_nhat_ky_updated_at
  before update on public.nhat_ky_chay_may
  for each row execute function public.set_updated_at();

comment on column public.nhat_ky_chay_may.ngay is 'Ngày máy hoạt động';
comment on column public.nhat_ky_chay_may.ly_trinh_tu is 'Lý trình bắt đầu';
comment on column public.nhat_ky_chay_may.ly_trinh_den is 'Lý trình kết thúc';
comment on column public.nhat_ky_chay_may.so_gio_hoat_dong is 'Số giờ máy hoạt động trong ngày, tối đa 24 giờ';

create or replace view public.bao_cao_lich_chay_may
with (security_invoker = true)
as
select
  nk.id,
  nk.ngay,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  nk.ly_trinh_tu,
  nk.ly_trinh_den,
  nk.so_gio_hoat_dong,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ns.employee_id as nguoi_phu_trach_id,
  ns.ma_nhan_su,
  ns.ho_ten as nguoi_phu_trach,
  nk.created_at,
  nk.updated_at
from public.nhat_ky_chay_may nk
join public.thiet_bi tb on tb.id = nk.may
join public.du_an da on da.id = nk.du_an
join public.nhan_su ns on ns.employee_id = nk.nguoi_phu_trach;

-- ------------------------------------------------------------
-- 3. Gắn máy cho dữ liệu mối hàn
-- ------------------------------------------------------------
alter table public.lich_su_moi_han
  add column if not exists may_id uuid references public.thiet_bi (id) on delete set null;

comment on column public.lich_su_moi_han.may_id is
  'Máy thực hiện mối hàn; dùng để tự động tổng hợp số mối hàn theo máy';

create index if not exists idx_lich_su_moi_han_may
  on public.lich_su_moi_han (may_id);

create or replace view public.bao_cao_moi_han_theo_du_an
with (security_invoker = true)
as
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
  tb.ten_may
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

create or replace view public.bao_cao_may
with (security_invoker = true)
as
with gio_may as (
  select
    may as may_id,
    count(*)::bigint as so_luot_chay,
    coalesce(sum(so_gio_hoat_dong), 0)::numeric(12,2) as tong_gio_hoat_dong
  from public.nhat_ky_chay_may
  group by may
),
moi_han_may as (
  select
    may_id,
    coalesce(sum(so_luong_thuc_hien), 0)::bigint as tong_moi_han,
    coalesce(sum(so_luong_loi), 0)::bigint as tong_moi_han_loi
  from public.lich_su_moi_han
  where may_id is not null
  group by may_id
)
select
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  tb.trang_thai,
  coalesce(gm.so_luot_chay, 0)::bigint as so_luot_chay,
  coalesce(gm.tong_gio_hoat_dong, 0)::numeric(12,2) as tong_gio_hoat_dong,
  coalesce(mh.tong_moi_han, 0)::bigint as tong_moi_han,
  coalesce(mh.tong_moi_han_loi, 0)::bigint as tong_moi_han_loi
from public.thiet_bi tb
left join gio_may gm on gm.may_id = tb.id
left join moi_han_may mh on mh.may_id = tb.id;

-- ------------------------------------------------------------
-- 4. Quyền truy cập. App hiện dùng anon key trong giai đoạn dev.
-- ------------------------------------------------------------
alter table public.thiet_bi enable row level security;
alter table public.nhat_ky_chay_may enable row level security;

drop policy if exists "authenticated_all_thiet_bi" on public.thiet_bi;
create policy "authenticated_all_thiet_bi"
  on public.thiet_bi for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated_all_nhat_ky_chay_may" on public.nhat_ky_chay_may;
create policy "authenticated_all_nhat_ky_chay_may"
  on public.nhat_ky_chay_may for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_thiet_bi" on public.thiet_bi;
create policy "anon_all_thiet_bi"
  on public.thiet_bi for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_nhat_ky_chay_may" on public.nhat_ky_chay_may;
create policy "anon_all_nhat_ky_chay_may"
  on public.nhat_ky_chay_may for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.thiet_bi to anon, authenticated;
grant select, insert, update, delete on public.nhat_ky_chay_may to anon, authenticated;
grant select on public.bao_cao_lich_chay_may to anon, authenticated;
grant select on public.bao_cao_may to anon, authenticated;
grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

notify pgrst, 'reload schema';
