-- ============================================================
-- MIGRATION TOÀN DIỆN: ĐỒNG BỘ 4 MÁY HÀN THẬT & CỘT HẠCH TOÁN
-- Chạy script này trong Supabase Dashboard -> SQL Editor
-- Script an toàn để chạy nhiều lần (idempotent)
-- ============================================================

-- ------------------------------------------------------------
-- 1. BỔ SUNG CỘT HẠCH TOÁN VÀO LỊCH SỬ MỐI HÀN
-- ------------------------------------------------------------
alter table public.lich_su_moi_han
  add column if not exists hach_toan text;

comment on column public.lich_su_moi_han.hach_toan is
  'Mã hạch toán chi phí/sản xuất (HT-SX01, HT-SX02, HT-TN01, HT-SC01, HT-M01, HT-M02...)';

create index if not exists idx_lich_su_moi_han_hach_toan
  on public.lich_su_moi_han (hach_toan);

-- Gán mã hạch toán mặc định cho các bản ghi cũ chưa có mã hạch toán
update public.lich_su_moi_han
set hach_toan = case
  when loai_moi_han = 'Sản xuất' then 'HT-SX01'
  when loai_moi_han = 'Thử nghiệm' then 'HT-TN01'
  when loai_moi_han = 'Đào tạo' then 'HT-M01'
  else 'HT-SX01'
end
where hach_toan is null or btrim(hach_toan) = '';

-- ------------------------------------------------------------
-- 2. BỔ SUNG CÁC THÔNG SỐ MỞ RỘNG CHO BẢNG THIẾT BỊ
-- ------------------------------------------------------------
alter table public.thiet_bi
  add column if not exists model text,
  add column if not exists loai_may text,
  add column if not exists so_serial text,
  add column if not exists nam_san_xuat integer,
  add column if not exists cong_nghe_han text,
  add column if not exists loai_ray_ho_tro text,
  add column if not exists nang_suat_han text,
  add column if not exists gio_hoat_dong numeric(10,2) default 0,
  add column if not exists tong_moi_han integer default 0,
  add column if not exists du_an_hien_tai text,
  add column if not exists nguoi_phu_trach text,
  add column if not exists to_van_hanh text,
  add column if not exists ngay_bao_tri_gan_nhat text,
  add column if not exists ngay_bao_tri_tiep_theo text,
  add column if not exists ghi_chu text,
  add column if not exists thong_so jsonb default '{}'::jsonb,
  add column if not exists hinh_anh_chi_tiet text[] default '{}';

-- ------------------------------------------------------------
-- 3. UPSERT 4 MÁY HÀN THẬT THEO CATALOGUE VÀ HỒ SƠ CHÍNH THỨC
-- ------------------------------------------------------------
insert into public.thiet_bi (
  ma_may,
  ten_may,
  model,
  loai_may,
  so_serial,
  nam_san_xuat,
  cong_nghe_han,
  loai_ray_ho_tro,
  nang_suat_han,
  gio_hoat_dong,
  tong_moi_han,
  vi_tri_hien_tai,
  du_an_hien_tai,
  nguoi_phu_trach,
  to_van_hanh,
  ngay_bao_tri_gan_nhat,
  ngay_bao_tri_tiep_theo,
  ghi_chu,
  thong_so,
  hinh_anh,
  hinh_anh_chi_tiet,
  trang_thai
)
values
(
  'KCM007-01',
  'Tổ hợp máy hàn ray lưu động KCM-007 (K922-1)',
  'KCM-007 (K922-1)',
  'Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)',
  'Chờ cập nhật theo hồ sơ bàn giao thiết bị',
  2021,
  'Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)',
  '43 – 75 kg/m · Khổ ray 1.000 mm & 1.435 mm',
  '12 mối/giờ',
  3850,
  2450,
  'Km 15+200 · Ga Hà Nội',
  'Dự án ĐSCT Bắc – Nam',
  'Kỹ sư trưởng TCW',
  'Tổ hàn cơ giới 1',
  '15/02/2026',
  '15/05/2026',
  'Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Các thông số vận hành (vị trí, dự án, giờ chạy) là số liệu theo dõi công trường.',
  '{
    "applicationWork": "On rail / road / stationary",
    "emissionStandard": "Euro V",
    "axes": 4,
    "clampingGradient": "3.5%",
    "speedRoad": "80 km/h",
    "speedRail": "25 km/h",
    "gauge": "1.000 mm, 1.435 mm",
    "weight": "35 tấn (ton)",
    "dimensions": "10.000 × 3.200 × 2.500 mm",
    "upsettingForce": "90 ~ 120 kN",
    "clampingForce": "280 kN",
    "weldingStroke": "100 – 120 mm",
    "efficiency": "12 mối/giờ"
  }'::jsonb,
  '/may-han/kcm007.jpg',
  array['/may-han/kcm007.jpg'],
  'Đang làm việc'
),
(
  'UN5-150ZC2-01',
  'Máy hàn tiếp xúc đối đầu ray lưu động UN5-150ZC2-C6',
  'UN5-150ZC2-C6',
  'Máy hàn tiếp xúc đối đầu ray lưu động (On rail / stationary)',
  'Chờ cập nhật theo hồ sơ bàn giao thiết bị',
  2022,
  'Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)',
  '43 – 75 kg/m · Khổ ray 1.435 mm',
  '12 mối/giờ',
  2740,
  1820,
  'Km 0+500 · Depot ga Hà Nội',
  'Tuyến đường sắt đô thị',
  'Kỹ sư TCW - Aigre',
  'Tổ hàn đường sắt 2',
  '20/02/2026',
  '20/05/2026',
  'Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Các thông số vận hành (vị trí, dự án, giờ chạy) là số liệu theo dõi công trường.',
  '{
    "applicationWork": "On rail / stationary",
    "emissionStandard": "Euro V",
    "axes": 4,
    "clampingGradient": "5.0%",
    "speedRoad": "— (Không tự hành đường bộ)",
    "speedRail": "20 km/h",
    "gauge": "1.435 mm",
    "weight": "32 tấn (ton)",
    "dimensions": "8.300 × 2.500 × 950 mm",
    "upsettingForce": "90 ~ 120 kN",
    "clampingForce": "280 kN",
    "weldingStroke": "100 – 120 mm",
    "efficiency": "12 mối/giờ"
  }'::jsonb,
  '/may-han/un5-150zc2-c6-main.jpg',
  array['/may-han/un5-150zc2-c6-main.jpg', '/may-han/un5-150zc2-c6-detail.jpg', '/may-han/un5-150zc2-c6-action.jpg'],
  'Sẵn sàng'
),
(
  'KCM007-02',
  'Tổ hợp máy hàn ray lưu động KCM-007 (K922-1) (Tổ 2)',
  'KCM-007 (K922-1)',
  'Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)',
  'Chờ cập nhật theo hồ sơ bàn giao thiết bị',
  2021,
  'Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)',
  '43 – 75 kg/m · Khổ ray 1.000 mm & 1.435 mm',
  '12 mối/giờ',
  1950,
  1210,
  'Bãi máy ga Đà Nẵng',
  'Dự án đường sắt Bắc – Nam',
  'Đội trưởng kỹ thuật máy',
  'Tổ hàn cơ giới 2',
  '02/03/2026',
  '02/06/2026',
  'Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Các thông số vận hành (vị trí, dự án, giờ chạy) là số liệu theo dõi công trường.',
  '{
    "applicationWork": "On rail / road / stationary",
    "emissionStandard": "Euro V",
    "axes": 4,
    "clampingGradient": "3.5%",
    "speedRoad": "80 km/h",
    "speedRail": "25 km/h",
    "gauge": "1.000 mm, 1.435 mm",
    "weight": "35 tấn (ton)",
    "dimensions": "10.000 × 3.200 × 2.500 mm",
    "upsettingForce": "90 ~ 120 kN",
    "clampingForce": "280 kN",
    "weldingStroke": "100 – 120 mm",
    "efficiency": "12 mối/giờ"
  }'::jsonb,
  '/may-han/kcm007.jpg',
  array['/may-han/kcm007.jpg'],
  'Sẵn sàng'
),
(
  'UN5-150ZC2-02',
  'Máy hàn tiếp xúc đối đầu ray lưu động UN5-150ZC2-C6 (Dự phòng)',
  'UN5-150ZC2-C6',
  'Máy hàn tiếp xúc đối đầu ray lưu động (On rail / stationary)',
  'Chờ cập nhật theo hồ sơ bàn giao thiết bị',
  2022,
  'Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)',
  '43 – 75 kg/m · Khổ ray 1.435 mm',
  '12 mối/giờ',
  1420,
  940,
  'Khu tập kết thiết bị ga Giáp Bát',
  'Dự phòng khẩn cấp & bảo trì',
  'Kỹ sư cơ điện TCW',
  'Tổ bảo trì & đại tu thiết bị',
  '10/01/2026',
  '10/04/2026',
  'Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Đang trong kỳ kiểm định hệ thống kẹp thủy lực và mạch đo điện áp đối đầu.',
  '{
    "applicationWork": "On rail / stationary",
    "emissionStandard": "Euro V",
    "axes": 4,
    "clampingGradient": "5.0%",
    "speedRoad": "— (Không tự hành đường bộ)",
    "speedRail": "20 km/h",
    "gauge": "1.435 mm",
    "weight": "32 tấn (ton)",
    "dimensions": "8.300 × 2.500 × 950 mm",
    "upsettingForce": "90 ~ 120 kN",
    "clampingForce": "280 kN",
    "weldingStroke": "100 – 120 mm",
    "efficiency": "12 mối/giờ"
  }'::jsonb,
  '/may-han/un5-150zc2-c6-main.jpg',
  array['/may-han/un5-150zc2-c6-main.jpg', '/may-han/un5-150zc2-c6-detail.jpg', '/may-han/un5-150zc2-c6-action.jpg'],
  'Bảo trì'
)
on conflict (ma_may) do update set
  ten_may = excluded.ten_may,
  model = excluded.model,
  loai_may = excluded.loai_may,
  so_serial = excluded.so_serial,
  nam_san_xuat = excluded.nam_san_xuat,
  cong_nghe_han = excluded.cong_nghe_han,
  loai_ray_ho_tro = excluded.loai_ray_ho_tro,
  nang_suat_han = excluded.nang_suat_han,
  gio_hoat_dong = excluded.gio_hoat_dong,
  tong_moi_han = excluded.tong_moi_han,
  vi_tri_hien_tai = excluded.vi_tri_hien_tai,
  du_an_hien_tai = excluded.du_an_hien_tai,
  nguoi_phu_trach = excluded.nguoi_phu_trach,
  to_van_hanh = excluded.to_van_hanh,
  ngay_bao_tri_gan_nhat = excluded.ngay_bao_tri_gan_nhat,
  ngay_bao_tri_tiep_theo = excluded.ngay_bao_tri_tiep_theo,
  ghi_chu = excluded.ghi_chu,
  thong_so = excluded.thong_so,
  hinh_anh = excluded.hinh_anh,
  hinh_anh_chi_tiet = excluded.hinh_anh_chi_tiet,
  trang_thai = excluded.trang_thai,
  updated_at = now();

-- ------------------------------------------------------------
-- 4. CHUYỂN KHÓA NGOẠI VÀ XỬ LÝ 6 MÁY MẪU CŨ (K920, AMS60, K355, GEO)
-- Bảng ánh xạ cụ thể từng máy cũ sang đúng máy mới tương ứng
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  -- Tạo bảng tạm ánh xạ máy cũ sang máy mới tương ứng
  create temp table if not exists _machine_mapping (
    old_code text primary key,
    new_code text not null
  ) on commit drop;

  insert into _machine_mapping (old_code, new_code) values
    ('K920-01',  'KCM007-01'),
    ('K920-02',  'KCM007-02'),
    ('AMS60-01', 'UN5-150ZC2-01'),
    ('AMS60-03', 'UN5-150ZC2-01'),
    ('K355-02',  'UN5-150ZC2-02'),
    ('GEO-01',   'UN5-150ZC2-02')
  on conflict (old_code) do update set new_code = excluded.new_code;

  -- Cập nhật nhật ký chạy máy và lịch sử mối hàn theo từng cặp máy cũ -> máy mới
  for r in (
    select m.id as old_id, n.id as new_id, map.old_code, map.new_code
    from _machine_mapping map
    join public.thiet_bi m on m.ma_may = map.old_code
    join public.thiet_bi n on n.ma_may = map.new_code
  ) loop
    update public.nhat_ky_chay_may
    set may = r.new_id
    where may = r.old_id;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lich_su_moi_han' and column_name = 'may_id'
    ) then
      execute 'update public.lich_su_moi_han set may_id = $1 where may_id = $2'
      using r.new_id, r.old_id;
    end if;
  end loop;

  -- Xóa các máy cũ không còn sử dụng khỏi danh mục
  delete from public.thiet_bi
  where ma_may in (select old_code from _machine_mapping);
end;
$$;
