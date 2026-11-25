-- Bảng B.0.4-2 — mô men cản phụ kiện. Chạy khi migration 20261123 đã áp dụng trước đó.
-- Cài mới: file 20261123 đã gồm bảng này; lệnh dưới đây an toàn nếu chạy lại.

begin;

create table if not exists public.tb15_mo_men_can (
  id uuid primary key default gen_random_uuid(),
  loai_phu_kien text not null,
  h_ncm_cm numeric(14,4) not null,
  mu numeric(10,4) not null,
  psi numeric(12,6) not null,
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_mo_men_can_unique unique (loai_phu_kien)
);

insert into public.tb15_mo_men_can (loai_phu_kien, h_ncm_cm, mu, psi, ghi_chu)
select * from (values
  ('Loại đàn hồi II'::text, 22000::numeric, 2::numeric, 3.0983::numeric, 'B.0.4-2'::text)
) as v(loai_phu_kien, h_ncm_cm, mu, psi, ghi_chu)
where not exists (select 1 from public.tb15_mo_men_can limit 1);

alter table public.tb15_mo_men_can enable row level security;
drop policy if exists "tb15_all_tb15_mo_men_can" on public.tb15_mo_men_can;
create policy "tb15_all_tb15_mo_men_can" on public.tb15_mo_men_can
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.tb15_mo_men_can to anon, authenticated;

notify pgrst, 'reload schema';
commit;
