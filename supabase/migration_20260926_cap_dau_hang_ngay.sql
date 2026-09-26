-- Cấp dầu hàng ngày theo máy (tách khỏi tổng hợp nhật ký hàn trên Lịch chạy máy).

create table if not exists public.cap_dau_hang_ngay (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ngay date not null,
  may uuid not null references public.thiet_bi (id) on delete restrict,
  so_lit numeric(10, 2) not null default 0
    check (so_lit >= 0),
  bom_mo boolean not null default false,
  nguoi_cap uuid references public.nhan_su (employee_id) on delete set null,
  ghi_chu text,
  constraint cap_dau_hang_ngay_unique_may_ngay unique (may, ngay)
);

create index if not exists idx_cap_dau_hang_ngay_ngay_desc
  on public.cap_dau_hang_ngay (ngay desc, id desc);

create index if not exists idx_cap_dau_hang_ngay_may_ngay
  on public.cap_dau_hang_ngay (may, ngay desc);

drop trigger if exists trg_cap_dau_hang_ngay_updated_at on public.cap_dau_hang_ngay;
create trigger trg_cap_dau_hang_ngay_updated_at
  before update on public.cap_dau_hang_ngay
  for each row
  execute function public.set_updated_at();

comment on table public.cap_dau_hang_ngay is
  'Nhật ký cấp / đổ dầu hàng ngày theo từng máy';
comment on column public.cap_dau_hang_ngay.so_lit is
  'Số lít dầu đã cấp trong ngày';
comment on column public.cap_dau_hang_ngay.bom_mo is
  'Bơm được mở khi cấp dầu';

create or replace view public.bao_cao_cap_dau_hang_ngay
with (security_invoker = true)
as
select
  cd.id,
  cd.ngay,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  cd.so_lit,
  cd.bom_mo,
  ns.employee_id as nguoi_cap_id,
  ns.ma_nhan_su,
  ns.ho_ten as nguoi_cap,
  cd.ghi_chu,
  cd.created_at,
  cd.updated_at
from public.cap_dau_hang_ngay cd
join public.thiet_bi tb on tb.id = cd.may
left join public.nhan_su ns on ns.employee_id = cd.nguoi_cap;

alter table public.cap_dau_hang_ngay enable row level security;

drop policy if exists "authenticated_all_cap_dau_hang_ngay" on public.cap_dau_hang_ngay;
create policy "authenticated_all_cap_dau_hang_ngay"
  on public.cap_dau_hang_ngay for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_cap_dau_hang_ngay" on public.cap_dau_hang_ngay;
create policy "anon_all_cap_dau_hang_ngay"
  on public.cap_dau_hang_ngay for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.cap_dau_hang_ngay to anon, authenticated;
grant select on public.bao_cao_cap_dau_hang_ngay to anon, authenticated;

notify pgrst, 'reload schema';
