-- B.0.4-3 (bước sóng không đều): l₀, i₀, ΔP theo loại ray; WJ d_kn_mm theo A.0.3-2.
-- Chạy sau migration_20261125_do_cung_goi.sql. Idempotent.

begin;

alter table public.tb15_loai_ray add column if not exists l0_cm numeric(8,2);
alter table public.tb15_loai_ray add column if not exists i0_permil numeric(8,3);
alter table public.tb15_loai_ray add column if not exists dp_kn numeric(10,2);

update public.tb15_loai_ray set l0_cm = 700, i0_permil = 1.13, dp_kn = 130 where loai_kg_m = 50;
update public.tb15_loai_ray set l0_cm = 720, i0_permil = 1, dp_kn = 154 where loai_kg_m = 60;
update public.tb15_loai_ray set l0_cm = 740, i0_permil = 0.76, dp_kn = 188 where loai_kg_m = 75;

-- A.0.3-2: đệm WJ có D khi tính = giá trị đệm (không còn null).
update public.tb15_do_cung_goi set d_kn_mm = 35 where phuong_an in ('WJ-7A', 'WJ-8A') and d_kn_mm is null;
update public.tb15_do_cung_goi set d_kn_mm = 23 where phuong_an in ('WJ-7B', 'WJ-8B, WJ-8C') and d_kn_mm is null;

notify pgrst, 'reload schema';
commit;
