-- Khớp Bảng A.0.3-1 và A.0.3-2. Bỏ 5 dòng cũ (gộp WJ, nhét số đệm vào tên).
-- A.0.3-2 không có cột D riêng: D khi tính lấy bằng độ cứng đệm.

begin;

alter table public.tb15_do_cung_goi add column if not exists loai_duong text not null default 'co_ba_lat';
alter table public.tb15_do_cung_goi add column if not exists dem_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists dem_sai_so_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists tinh_min_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists tinh_max_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi alter column d_kn_mm drop not null;

alter table public.tb15_do_cung_goi drop constraint if exists tb15_do_cung_goi_unique;
alter table public.tb15_do_cung_goi
  add constraint tb15_do_cung_goi_unique unique (phuong_an, dem_kn_mm);

delete from public.tb15_do_cung_goi
where phuong_an in (
  'Có ba lát – tà vẹt II, đệm dưới ray 110 kN/mm',
  'Có ba lát – tà vẹt II, đệm dưới ray 80 kN/mm',
  'Có ba lát – tà vẹt III, đệm dưới ray 80 kN/mm',
  'Không ba lát – WJ-7A / WJ-8A (đệm 35±5 kN/mm)',
  'Không ba lát – WJ-7B / WJ-8B / WJ-8C (đệm 23±3 kN/mm)',
  'Tà vẹt BT loại II – đệm 110 kN/mm',
  'Tà vẹt BT loại II – đệm 80 kN/mm',
  'Tà vẹt BT loại III – đệm 80 kN/mm'
);

insert into public.tb15_do_cung_goi
  (loai_duong, phuong_an, dem_kn_mm, dem_sai_so_kn_mm, d_kn_mm, tinh_min_kn_mm, tinh_max_kn_mm, ghi_chu)
values
  ('co_ba_lat', 'Tà vẹt bê tông loại II', 110, null, 30, null, null, 'A.0.3-1'),
  ('co_ba_lat', 'Tà vẹt bê tông loại II', 80, null, 27.2, null, null, 'A.0.3-1'),
  ('co_ba_lat', 'Tà vẹt bê tông loại III', 80, null, 33, null, null, 'A.0.3-1'),
  ('khong_ba_lat', 'WJ-7A', 35, 5, null, 35, 50, 'A.0.3-2'),
  ('khong_ba_lat', 'WJ-7B', 23, 3, null, 25, 35, 'A.0.3-2'),
  ('khong_ba_lat', 'WJ-8A', 35, 5, null, 35, 50, 'A.0.3-2'),
  ('khong_ba_lat', 'WJ-8B, WJ-8C', 23, 3, null, 25, 35, 'A.0.3-2')
on conflict (phuong_an, dem_kn_mm) do update set
  loai_duong = excluded.loai_duong,
  dem_sai_so_kn_mm = excluded.dem_sai_so_kn_mm,
  d_kn_mm = excluded.d_kn_mm,
  tinh_min_kn_mm = excluded.tinh_min_kn_mm,
  tinh_max_kn_mm = excluded.tinh_max_kn_mm,
  ghi_chu = excluded.ghi_chu,
  updated_at = now();

notify pgrst, 'reload schema';
commit;
