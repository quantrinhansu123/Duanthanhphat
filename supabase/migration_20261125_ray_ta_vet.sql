-- Bổ sung hằng số ray (K, E, α, P_j, khe hở) và nhánh sức cản dọc 3.2.2-1.
-- Chạy sau migration_20261123_tb15_dau_vao.sql. Không xóa dòng người dùng đã thêm.

begin;

alter table public.tb15_loai_ray add column if not exists k_an_toan numeric(8,4) not null default 1.3;
alter table public.tb15_loai_ray add column if not exists e_mpa numeric(12,2) not null default 210000;
alter table public.tb15_loai_ray add column if not exists alpha numeric(16,10) not null default 0.0000118;
alter table public.tb15_loai_ray add column if not exists pj_kn numeric(10,3) not null default 400;
alter table public.tb15_loai_ray add column if not exists khe_ho_mm numeric(6,2);

update public.tb15_loai_ray
set khe_ho_mm = case when loai_kg_m = 75 then 20 else 18 end
where khe_ho_mm is null;

alter table public.tb15_ket_cau_duong add column if not exists so_thanh_km numeric(8,0);
alter table public.tb15_ket_cau_duong add column if not exists r_khong_tai_hs numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_dau_may_hs numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_toa_xe_hs numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_toa_xe numeric(10,3);

update public.tb15_ket_cau_duong
set so_thanh_km = 1667,
    r_khong_tai_hs = 7.5,
    r_dau_may_hs = 11.6,
    r_toa_xe_hs = 7.5,
    r_toa_xe = 15,
    ghi_chu = case when ghi_chu = '' then '3.2.2-1' else ghi_chu end
where ten = 'Có ba lát – tà vẹt BT loại III (1 667 thanh/km)';

update public.tb15_ket_cau_duong
set so_thanh_km = 1760,
    r_khong_tai_hs = 4.4,
    r_dau_may_hs = 6.8,
    r_toa_xe_hs = 4.4,
    r_toa_xe = 8.8,
    ghi_chu = case when ghi_chu = '' then '3.2.2-1' else ghi_chu end
where ten = 'Có ba lát – tà vẹt BT loại II mới (1 760 thanh/km)';

update public.tb15_ket_cau_duong
set so_thanh_km = 1840,
    r_khong_tai_hs = 4.4,
    r_dau_may_hs = 6.8,
    r_toa_xe_hs = 4.4,
    r_toa_xe = 8.8,
    ghi_chu = 'r lấy bằng loại II 1 760 thanh/km'
where ten = 'Có ba lát – tà vẹt BT loại II mới (1 840 thanh/km)';

insert into public.tb15_ket_cau_duong
  (ten, loai_duong, so_thanh_km, r_khong_tai, cu_ly_nut_a_m, ghi_chu)
select
  'Phụ kiện sức cản nhỏ trên cầu (lò xo V)',
  'co_ba_lat',
  null,
  8,
  0.6,
  '3.2.2 — r = 8,0 kN/(m·ray), nút 600 mm'
where not exists (
  select 1 from public.tb15_ket_cau_duong
  where ten = 'Phụ kiện sức cản nhỏ trên cầu (lò xo V)'
);

notify pgrst, 'reload schema';
commit;
