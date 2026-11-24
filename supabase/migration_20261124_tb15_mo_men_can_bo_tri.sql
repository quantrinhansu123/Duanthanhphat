-- TB 10015 — bổ sung bảng B.0.4-2 (mô men cản phụ kiện) + cột bố trí tà vẹt cho B.0.4-1.
-- Chạy sau migration_20261123_tb15_dau_vao.sql

begin;

-- B.0.4-1: bố trí tà vẹt (vd 1 840 / 1 760 thanh/km)
alter table public.tb15_on_dinh_nen
  add column if not exists bo_tri text not null default '';

update public.tb15_on_dinh_nen set bo_tri = '1 840 thanh/km', ghi_chu = 'B.0.4-1'
  where loai_ta_vet = 'II' and (bo_tri is null or bo_tri = '');
update public.tb15_on_dinh_nen set bo_tri = '1 760 thanh/km', ghi_chu = 'B.0.4-1'
  where loai_ta_vet = 'III' and (bo_tri is null or bo_tri = '');

-- B.0.4-2: mô men cản phụ kiện M = H · β^(1/μ)
create table if not exists public.tb15_mo_men_can (
  id uuid primary key default gen_random_uuid(),
  loai_phu_kien text not null,
  h_ncm_cm numeric(14,4) not null,
  mu numeric(10,4) not null,
  psi numeric(12,6),
  ghi_chu text not null default 'B.0.4-2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_mo_men_can_unique unique (loai_phu_kien)
);

insert into public.tb15_mo_men_can (loai_phu_kien, h_ncm_cm, mu, psi, ghi_chu)
select * from (values
  ('Loại đàn hồi II'::text, 22000::numeric, 2::numeric, 3.0983::numeric, 'B.0.4-2'::text)
) as v(loai_phu_kien, h_ncm_cm, mu, psi, ghi_chu)
where not exists (select 1 from public.tb15_mo_men_can limit 1);

-- RLS
do $$
begin
  alter table public.tb15_mo_men_can enable row level security;
  drop policy if exists "tb15_all_tb15_mo_men_can" on public.tb15_mo_men_can;
  create policy "tb15_all_tb15_mo_men_can" on public.tb15_mo_men_can
    for all to anon, authenticated using (true) with check (true);
  grant select, insert, update, delete on public.tb15_mo_men_can to anon, authenticated;
end $$;

notify pgrst, 'reload schema';
commit;
