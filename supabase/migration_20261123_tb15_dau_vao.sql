-- TB 10015 — bảng dữ liệu đầu vào thiết kế / kiểm toán CWR (không gắn thanh LWR).
-- Chạy trong Supabase Dashboard > SQL Editor.

begin;

-- 1. Khí hậu VN (QCVN 02:2022/BXD A.5 / A.6 — cột Năm)
create table if not exists public.tb15_khi_hau (
  id uuid primary key default gen_random_uuid(),
  ma_tram text not null default '',
  ten_tram text not null,
  tinh text not null default '',
  t_kk_max numeric(6,2) not null,
  t_kk_min numeric(6,2) not null,
  nguon text not null default 'QCVN 02:2022/BXD',
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_khi_hau_ten_unique unique (ten_tram),
  constraint tb15_khi_hau_temp_check check (t_kk_max >= t_kk_min)
);

-- 1b. Khí hậu theo tháng (QCVN A.5 cao nhất / A.6 thấp nhất, 12 giá trị tháng 1–12)
alter table public.tb15_khi_hau add column if not exists t_max_thang jsonb;
alter table public.tb15_khi_hau add column if not exists t_min_thang jsonb;

-- 2. Loại ray + mặt cắt (Phụ lục C)
create table if not exists public.tb15_loai_ray (
  id uuid primary key default gen_random_uuid(),
  loai_kg_m numeric(6,2) not null,
  do_mon_mm numeric(6,2) not null default 0,
  f_mm2 numeric(12,2) not null,
  w_dau_mm3 numeric(14,2) not null,
  w_day_mm3 numeric(14,2) not null,
  i_x_mm4 numeric(16,2) not null,
  i_y_mm4 numeric(16,2) not null,
  k_an_toan numeric(8,4) not null default 1.3,
  e_mpa numeric(12,2) not null default 210000,
  alpha numeric(16,10) not null default 0.0000118,
  pj_kn numeric(10,3) not null default 400,
  khe_ho_mm numeric(6,2) not null default 18,
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_loai_ray_unique unique (loai_kg_m, do_mon_mm)
);

-- Bảng tạo từ bản cũ có thể thiếu cột (create if not exists bỏ qua bảng đã có): bổ sung trước khi insert.
alter table public.tb15_loai_ray add column if not exists k_an_toan numeric(8,4) not null default 1.3;
alter table public.tb15_loai_ray add column if not exists e_mpa numeric(12,2) not null default 210000;
alter table public.tb15_loai_ray add column if not exists alpha numeric(16,10) not null default 0.0000118;
alter table public.tb15_loai_ray add column if not exists pj_kn numeric(10,3) not null default 400;
alter table public.tb15_loai_ray add column if not exists khe_ho_mm numeric(6,2) not null default 18;

-- 3. Mác thép → σ_s (bảng 3.2.4)
create table if not exists public.tb15_mac_thep (
  id uuid primary key default gen_random_uuid(),
  mac_thep text not null,
  sigma_s_mpa numeric(10,2) not null,
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_mac_thep_unique unique (mac_thep)
);

-- 4. Kết cấu đường / tà vẹt / phụ kiện
create table if not exists public.tb15_ket_cau_duong (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  loai_duong text not null check (loai_duong in ('co_ba_lat', 'khong_ba_lat')),
  so_thanh_km numeric(8,0),
  r_khong_tai_hs numeric(10,3),
  r_khong_tai numeric(10,3),
  r_dau_may_hs numeric(10,3),
  r_co_tai numeric(10,3),
  r_toa_xe_hs numeric(10,3),
  r_toa_xe numeric(10,3),
  q_kn_m numeric(10,3),
  loai_ta_vet text not null default '',
  cu_ly_nut_a_m numeric(10,4),
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_ket_cau_duong_unique unique (ten)
);

-- 5. Độ cứng gối ray D
create table if not exists public.tb15_do_cung_goi (
  id uuid primary key default gen_random_uuid(),
  loai_duong text not null default 'co_ba_lat',
  phuong_an text not null,
  dem_kn_mm numeric(10,3),
  dem_sai_so_kn_mm numeric(10,3),
  d_kn_mm numeric(10,3),
  tinh_min_kn_mm numeric(10,3),
  tinh_max_kn_mm numeric(10,3),
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_do_cung_goi_unique unique (phuong_an, dem_kn_mm)
);

-- 6. Tham số ổn định nền đá (B.0.4-1)
create table if not exists public.tb15_on_dinh_nen (
  id uuid primary key default gen_random_uuid(),
  loai_ta_vet text not null,
  q0 numeric(10,4) not null,
  b_hs numeric(10,4) not null,
  z_hs numeric(10,4) not null,
  c_hs numeric(10,4) not null,
  n_hs numeric(10,4) not null,
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_on_dinh_nen_unique unique (loai_ta_vet)
);

-- 6b. Mô men cản phụ kiện (Bảng B.0.4-2)
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

-- 7. Hệ số vận tốc / lực ngang (A.0.2-1, A.0.2-2)
create table if not exists public.tb15_he_so_tai (
  id uuid primary key default gen_random_uuid(),
  loai text not null check (loai in ('van_toc', 'luc_ngang')),
  nhan text not null default '',
  v_min_kmh numeric(8,2),
  v_max_kmh numeric(8,2),
  loai_keo text,
  r_tu_m numeric(10,2),
  he_so numeric(10,4) not null,
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tb15_he_so_tai_loai_idx on public.tb15_he_so_tai (loai);

-- 8. Sơ đồ tải bánh xe (header + bánh)
create table if not exists public.tb15_so_do_tai (
  id uuid primary key default gen_random_uuid(),
  ma text not null,
  ten text not null,
  mo_ta text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tb15_so_do_tai_ma_unique unique (ma)
);

create table if not exists public.tb15_so_do_tai_banh (
  id uuid primary key default gen_random_uuid(),
  so_do_id uuid not null references public.tb15_so_do_tai(id) on delete cascade,
  stt integer not null check (stt between 1 and 12),
  x_m numeric(12,4) not null,
  p_j_kn numeric(12,4) not null,
  constraint tb15_so_do_tai_banh_unique unique (so_do_id, stt)
);

create index if not exists tb15_so_do_tai_banh_so_do_idx on public.tb15_so_do_tai_banh (so_do_id);

-- Seed từ Excel TB 10015 (Tra cứu) — bỏ qua nếu đã có dữ liệu
insert into public.tb15_loai_ray (loai_kg_m, do_mon_mm, f_mm2, w_dau_mm3, w_day_mm3, i_x_mm4, i_y_mm4, k_an_toan, e_mpa, alpha, pj_kn, khe_ho_mm)
select * from (values
  (50::numeric, 0::numeric, 6580::numeric, 250000::numeric, 289000::numeric, 20370000::numeric, 3770000::numeric, 1.3::numeric, 210000::numeric, 0.0000118::numeric, 400::numeric, 18::numeric),
  (50, 3, 6580, 242000, 283000, 19460000, 3770000, 1.3, 210000, 0.0000118, 400, 18),
  (50, 6, 6580, 230000, 275000, 18270000, 3770000, 1.3, 210000, 0.0000118, 400, 18),
  (50, 9, 6580, 216000, 264000, 17020000, 3770000, 1.3, 210000, 0.0000118, 400, 18),
  (60, 0, 7745, 339400, 396000, 32170000, 5240000, 1.3, 210000, 0.0000118, 400, 18),
  (60, 3, 7745, 318000, 385000, 30690000, 5240000, 1.3, 210000, 0.0000118, 400, 18),
  (60, 6, 7745, 291000, 375000, 28790000, 5240000, 1.3, 210000, 0.0000118, 400, 18),
  (60, 9, 7745, 264000, 363000, 26900000, 5240000, 1.3, 210000, 0.0000118, 400, 18),
  (75, 0, 9504, 432000, 509000, 44890000, 6610000, 1.3, 210000, 0.0000118, 400, 20),
  (75, 3, 9504, 420000, 496000, 43280000, 6610000, 1.3, 210000, 0.0000118, 400, 20),
  (75, 6, 9504, 405000, 482000, 40890000, 6610000, 1.3, 210000, 0.0000118, 400, 20),
  (75, 9, 9504, 390000, 480000, 38980000, 6610000, 1.3, 210000, 0.0000118, 400, 20)
) as v(loai_kg_m, do_mon_mm, f_mm2, w_dau_mm3, w_day_mm3, i_x_mm4, i_y_mm4, k_an_toan, e_mpa, alpha, pj_kn, khe_ho_mm)
where not exists (select 1 from public.tb15_loai_ray limit 1);

insert into public.tb15_mac_thep (mac_thep, sigma_s_mpa)
select * from (values
  ('U71Mn / U71MnG'::text, 457::numeric),
  ('U75V / U75VG / U76CrRE / U77MnCr / U78CrV', 472)
) as v(mac_thep, sigma_s_mpa)
where not exists (select 1 from public.tb15_mac_thep limit 1);

-- Bổ sung cột của bảng kết cấu đường và độ cứng gối nếu bảng được tạo từ bản cũ.
alter table public.tb15_ket_cau_duong add column if not exists so_thanh_km numeric(8,0);
alter table public.tb15_ket_cau_duong add column if not exists r_khong_tai_hs numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_dau_may_hs numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_co_tai numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_toa_xe_hs numeric(10,3);
alter table public.tb15_ket_cau_duong add column if not exists r_toa_xe numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists loai_duong text not null default 'co_ba_lat';
alter table public.tb15_do_cung_goi add column if not exists dem_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists dem_sai_so_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists tinh_min_kn_mm numeric(10,3);
alter table public.tb15_do_cung_goi add column if not exists tinh_max_kn_mm numeric(10,3);

insert into public.tb15_ket_cau_duong (ten, loai_duong, so_thanh_km, r_khong_tai_hs, r_khong_tai, r_dau_may_hs, r_co_tai, r_toa_xe_hs, r_toa_xe, q_kn_m, loai_ta_vet, cu_ly_nut_a_m, ghi_chu)
select * from (values
  ('Có ba lát – tà vẹt BT loại III (1 667 thanh/km)'::text, 'co_ba_lat'::text, 1667::numeric, 7.5::numeric, 15::numeric, 11.6::numeric, 23.2::numeric, 7.5::numeric, 15::numeric, 11.5::numeric, 'III'::text, 0.6::numeric, '3.2.2-1'::text),
  ('Có ba lát – tà vẹt BT loại II mới (1 760 thanh/km)', 'co_ba_lat', 1760, 4.4, 8.8, 6.8, 13.6, 4.4, 8.8, 8.5, 'II', 0.568, '3.2.2-1'),
  ('Có ba lát – tà vẹt BT loại II mới (1 840 thanh/km)', 'co_ba_lat', 1840, 4.4, 8.8, 6.8, 13.6, 4.4, 8.8, 8.9, 'II', 0.543, 'r lấy bằng loại II 1 760 thanh/km'),
  ('Không ba lát – phụ kiện WJ-7 / WJ-8 (nút cách 625 mm)', 'khong_ba_lat', null, null, 24, null, 37.2, null, null, 0, '', 0.625, ''),
  ('Phụ kiện sức cản nhỏ trên cầu (lò xo V)', 'co_ba_lat', null, null, 8, null, null, null, null, null, '', 0.6, '3.2.2 — r = 8,0 kN/(m·ray), nút 600 mm')
) as v(ten, loai_duong, so_thanh_km, r_khong_tai_hs, r_khong_tai, r_dau_may_hs, r_co_tai, r_toa_xe_hs, r_toa_xe, q_kn_m, loai_ta_vet, cu_ly_nut_a_m, ghi_chu)
where not exists (select 1 from public.tb15_ket_cau_duong limit 1);

insert into public.tb15_do_cung_goi
  (loai_duong, phuong_an, dem_kn_mm, dem_sai_so_kn_mm, d_kn_mm, tinh_min_kn_mm, tinh_max_kn_mm, ghi_chu)
select * from (values
  ('co_ba_lat'::text, 'Tà vẹt bê tông loại II'::text, 110::numeric, null::numeric, 30::numeric, null::numeric, null::numeric, 'A.0.3-1'::text),
  ('co_ba_lat', 'Tà vẹt bê tông loại II', 80, null, 27.2, null, null, 'A.0.3-1'),
  ('co_ba_lat', 'Tà vẹt bê tông loại III', 80, null, 33, null, null, 'A.0.3-1'),
  ('khong_ba_lat', 'WJ-7A', 35, 5, null, 35, 50, 'A.0.3-2'),
  ('khong_ba_lat', 'WJ-7B', 23, 3, null, 25, 35, 'A.0.3-2'),
  ('khong_ba_lat', 'WJ-8A', 35, 5, null, 35, 50, 'A.0.3-2'),
  ('khong_ba_lat', 'WJ-8B, WJ-8C', 23, 3, null, 25, 35, 'A.0.3-2')
) as v(loai_duong, phuong_an, dem_kn_mm, dem_sai_so_kn_mm, d_kn_mm, tinh_min_kn_mm, tinh_max_kn_mm, ghi_chu)
where not exists (select 1 from public.tb15_do_cung_goi limit 1);

insert into public.tb15_on_dinh_nen (loai_ta_vet, q0, b_hs, z_hs, c_hs, n_hs)
select * from (values
  ('II'::text, 23::numeric, 63::numeric, 1.2::numeric, 106::numeric, 2.5::numeric),
  ('III', 27.4, 92, 1.2, 179, 2.5)
) as v(loai_ta_vet, q0, b_hs, z_hs, c_hs, n_hs)
where not exists (select 1 from public.tb15_on_dinh_nen limit 1);

insert into public.tb15_mo_men_can (loai_phu_kien, h_ncm_cm, mu, psi, ghi_chu)
select * from (values
  ('Loại đàn hồi II'::text, 22000::numeric, 2::numeric, 3.0983::numeric, 'B.0.4-2'::text)
) as v(loai_phu_kien, h_ncm_cm, mu, psi, ghi_chu)
where not exists (select 1 from public.tb15_mo_men_can limit 1);

insert into public.tb15_he_so_tai (loai, nhan, v_min_kmh, v_max_kmh, loai_keo, r_tu_m, he_so, ghi_chu)
select * from (values
  ('van_toc'::text, 'v > 160'::text, 160.01::numeric, null::numeric, null::text, null::numeric, 1::numeric, 'A.0.2-1'::text),
  ('van_toc', 'Điện v≤160', 0, 160, 'Dien', null, 0.6, 'he_so = 0.6*v/100'),
  ('van_toc', 'Diesel v≤160', 0, 160, 'Diesel', null, 0.4, 'he_so = 0.4*v/100'),
  ('luc_ngang', 'Đường thẳng', null, null, null, 0, 1.25, 'A.0.2-2'),
  ('luc_ngang', 'R ≥ 300', null, null, null, 300, 2, 'A.0.2-2'),
  ('luc_ngang', 'R ≥ 400', null, null, null, 400, 1.8, 'A.0.2-2'),
  ('luc_ngang', 'R ≥ 500', null, null, null, 500, 1.7, 'A.0.2-2'),
  ('luc_ngang', 'R ≥ 600', null, null, null, 600, 1.6, 'A.0.2-2'),
  ('luc_ngang', 'R ≥ 800', null, null, null, 800, 1.45, 'A.0.2-2'),
  ('luc_ngang', 'R ≥ 2000', null, null, null, 2000, 1.3, 'A.0.2-2')
) as v(loai, nhan, v_min_kmh, v_max_kmh, loai_keo, r_tu_m, he_so, ghi_chu)
where not exists (select 1 from public.tb15_he_so_tai limit 1);

-- Mẫu khí hậu VN (QCVN A.5/A.6 cột Năm) — import đầy đủ sau
insert into public.tb15_khi_hau (ma_tram, ten_tram, tinh, t_kk_max, t_kk_min, nguon)
select * from (values
  ('LC'::text, 'Lai Châu'::text, 'Lai Châu'::text, 42.2::numeric, -1.0::numeric, 'QCVN 02:2022/BXD mẫu'::text),
  ('HB', 'Hoà Bình', 'Hoà Bình', 41.8, -1.5, 'QCVN 02:2022/BXD mẫu'),
  ('DB', 'Điện Biên', 'Điện Biên', 37.9, -0.5, 'QCVN 02:2022/BXD mẫu')
) as v(ma_tram, ten_tram, tinh, t_kk_max, t_kk_min, nguon)
where not exists (select 1 from public.tb15_khi_hau limit 1);

-- Sơ đồ tải ví dụ Excel (EMU 17 t)
insert into public.tb15_so_do_tai (id, ma, ten, mo_ta)
select 'a0000000-0000-4000-8000-000000000001'::uuid, 'EMU-17T', 'EMU tải trục 17 t (ví dụ Excel)', 'P_j ≈ 83,4 kN/bánh'
where not exists (select 1 from public.tb15_so_do_tai limit 1);

insert into public.tb15_so_do_tai_banh (so_do_id, stt, x_m, p_j_kn)
select * from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 1, -17.5::numeric, 83.4::numeric),
  ('a0000000-0000-4000-8000-000000000001', 2, -15, 83.4),
  ('a0000000-0000-4000-8000-000000000001', 3, 0, 83.4),
  ('a0000000-0000-4000-8000-000000000001', 4, 2.5, 83.4),
  ('a0000000-0000-4000-8000-000000000001', 5, 7.5, 83.4),
  ('a0000000-0000-4000-8000-000000000001', 6, 10, 83.4),
  ('a0000000-0000-4000-8000-000000000001', 7, 25, 83.4),
  ('a0000000-0000-4000-8000-000000000001', 8, 27.5, 83.4)
) as v(so_do_id, stt, x_m, p_j_kn)
where not exists (select 1 from public.tb15_so_do_tai_banh limit 1);

-- RLS mở cho authenticated/anon (API dùng service_role; đồng bộ pattern LWR)
do $$
declare t text;
begin
  foreach t in array array[
    'tb15_khi_hau','tb15_loai_ray','tb15_mac_thep','tb15_ket_cau_duong',
    'tb15_do_cung_goi','tb15_on_dinh_nen','tb15_mo_men_can','tb15_he_so_tai','tb15_so_do_tai','tb15_so_do_tai_banh'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tb15_all_%s" on public.%I', t, t);
    execute format(
      'create policy "tb15_all_%s" on public.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
