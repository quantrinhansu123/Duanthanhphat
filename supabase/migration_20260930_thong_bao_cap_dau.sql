-- Thông báo trên app (chuông) khi mức dầu cuối ngày dưới định mức.

create table if not exists public.thong_bao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tieu_de text not null,
  noi_dung text not null,
  loai text not null default 'cap_dau',
  da_doc boolean not null default false,
  doi_tuong text not null default 'chi_huy_truong,quan_tri'
);

alter table public.thong_bao
  add column if not exists doi_tuong text not null default 'chi_huy_truong,quan_tri';

comment on column public.thong_bao.doi_tuong is
  'Người nhận cảnh báo cấp dầu: chi_huy_truong,quan_tri';

alter table public.thong_bao enable row level security;

drop policy if exists "authenticated_all_thong_bao" on public.thong_bao;
create policy "authenticated_all_thong_bao"
  on public.thong_bao for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_thong_bao" on public.thong_bao;
create policy "anon_all_thong_bao"
  on public.thong_bao for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.thong_bao to anon, authenticated;

notify pgrst, 'reload schema';
