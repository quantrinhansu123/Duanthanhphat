-- ============================================================
-- Seed dữ liệu từ: TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx
-- Chạy sau lich_su_moi_han.sql.
-- 30 dòng chi tiết, tổng 13.387 mối (FBW 9.873, ATW 3.514), 8 lỗi.
-- Có thể chạy lại: ma_lich_su được upsert, không tạo bản ghi trùng.
-- ============================================================

begin;

insert into public.nhan_su (ma_nhan_su, ho_ten, chuc_vu, don_vi)
values
  ('TH-R4-001', 'Nguyễn Huy Thanh', 'Thợ hàn', 'Phòng Sản xuất'),
  ('TH-R4-002', 'Trần Công Tiến', 'Thợ hàn', 'Phòng Sản xuất'),
  ('TH-R4-003', 'Vũ Văn Khanh', 'Thợ hàn', 'Phòng Sản xuất'),
  ('TH-R4-004', 'Trịnh Thông Phúc', 'Thợ hàn', 'Phòng Sản xuất'),
  ('TH-R4-005', 'Đỗ Lê Phương', 'Thợ hàn', 'Phòng Sản xuất'),
  ('TH-R4-006', 'Nguyễn Thanh Tùng', 'Thợ hàn', 'Phòng Sản xuất')
on conflict (ma_nhan_su) do update
set ho_ten = excluded.ho_ten,
    chuc_vu = excluded.chuc_vu,
    don_vi = excluded.don_vi,
    updated_at = now();

insert into public.du_an (ma_du_an, du_an)
values
  ('DA-R4-001', 'Dự án Đường sắt đô thị Nhổn - Ga Hà Nội (Đoạn trên cao), đường đôi khổ 1435mm (Việt Nam)'),
  ('DA-R4-002', 'Dự án Nâng cấp, cải tạo tuyến đường sắt Yangon - Mandalay giai đoạn 1, gói thầu CP102'),
  ('DA-R4-003', 'Hàn thí điểm trên tuyến đang khai thác Hà Nội - TP. Hồ Chí Minh, đường đơn khổ 1000mm'),
  ('DA-R4-004', 'Đào tạo nội bộ'),
  ('DA-R4-005', 'Hàn ray tại xưởng Vinalift')
on conflict (ma_du_an) do update
set du_an = excluded.du_an,
    updated_at = now();

with source (
  ma_lich_su,
  ma_du_an,
  nam_thuc_hien,
  loai_ray,
  loai_moi_han,
  cong_nghe_han,
  so_luong_thuc_hien,
  so_luong_loi,
  ma_nhan_su,
  dong_nguon
) as (
  values
    ('R4-001', 'DA-R4-001', 2019, '60E1',  'Thử nghiệm', 'ATW',   30, 0, 'TH-R4-002', 14),
    ('R4-002', 'DA-R4-001', 2019, '60E1',  'Thử nghiệm', 'FBW',  100, 0, 'TH-R4-002', 15),
    ('R4-003', 'DA-R4-001', 2019, '60E1',  'Sản xuất',   'ATW', 1000, 0, 'TH-R4-002', 16),
    ('R4-004', 'DA-R4-001', 2019, '60E1',  'Sản xuất',   'FBW', 1123, 0, 'TH-R4-002', 17),
    ('R4-005', 'DA-R4-001', 2020, '60E1',  'Sản xuất',   'ATW',  381, 0, 'TH-R4-006', 18),

    ('R4-006', 'DA-R4-002', 2020, '50N',   'Thử nghiệm', 'FBW',   50, 0, 'TH-R4-002', 19),
    ('R4-007', 'DA-R4-002', 2020, '50N',   'Thử nghiệm', 'ATW',   30, 0, 'TH-R4-002', 20),
    ('R4-008', 'DA-R4-002', 2020, '50N',   'Sản xuất',   'FBW', 2000, 1, 'TH-R4-002', 21),
    ('R4-009', 'DA-R4-002', 2020, '50N',   'Sản xuất',   'FBW',  500, 0, 'TH-R4-001', 22),
    ('R4-010', 'DA-R4-002', 2020, '50N',   'Sản xuất',   'ATW',  300, 6, 'TH-R4-002', 23),
    ('R4-011', 'DA-R4-002', 2021, '50N',   'Sản xuất',   'FBW', 2000, 0, 'TH-R4-001', 24),
    ('R4-012', 'DA-R4-002', 2021, '50N',   'Sản xuất',   'FBW', 1000, 0, 'TH-R4-004', 25),
    ('R4-013', 'DA-R4-002', 2021, '50N',   'Sản xuất',   'ATW',  600, 0, 'TH-R4-003', 26),
    ('R4-014', 'DA-R4-002', 2021, '50N',   'Sản xuất',   'ATW',  200, 0, 'TH-R4-004', 27),
    ('R4-015', 'DA-R4-002', 2022, '50N',   'Sản xuất',   'FBW', 2000, 0, 'TH-R4-003', 28),
    ('R4-016', 'DA-R4-002', 2022, '50N',   'Sản xuất',   'FBW',  500, 0, 'TH-R4-005', 29),
    ('R4-017', 'DA-R4-002', 2022, '50N',   'Sản xuất',   'ATW',  400, 0, 'TH-R4-003', 30),
    ('R4-018', 'DA-R4-002', 2023, '50N',   'Sản xuất',   'FBW',  400, 0, 'TH-R4-006', 31),
    ('R4-019', 'DA-R4-002', 2023, '50N',   'Sản xuất',   'ATW',  200, 1, 'TH-R4-004', 32),
    ('R4-020', 'DA-R4-002', 2024, '50N',   'Sản xuất',   'ATW',  217, 0, 'TH-R4-002', 33),

    ('R4-021', 'DA-R4-003', 2019, '50N',   'Thử nghiệm', 'ATW',   16, 0, 'TH-R4-002', 34),
    ('R4-022', 'DA-R4-003', 2019, '50N',   'Sản xuất',   'ATW',   16, 0, 'TH-R4-003', 35),

    ('R4-023', 'DA-R4-004', 2017, 'P60',   'Thử nghiệm', 'ATW',   30, 0, 'TH-R4-004', 36),
    ('R4-024', 'DA-R4-004', 2017, 'P60',   'Thử nghiệm', 'FBW',   50, 0, 'TH-R4-005', 37),
    ('R4-025', 'DA-R4-004', 2018, '50N',   'Thử nghiệm', 'ATW',   40, 0, 'TH-R4-003', 38),
    ('R4-026', 'DA-R4-004', 2018, '60N',   'Thử nghiệm', 'ATW',   40, 0, 'TH-R4-004', 39),
    ('R4-027', 'DA-R4-004', 2025, 'P50',   'Thử nghiệm', 'ATW',   10, 0, 'TH-R4-006', 40),
    ('R4-028', 'DA-R4-004', 2025, '60E1',  'Thử nghiệm', 'FBW',  100, 0, 'TH-R4-005', 41),
    ('R4-029', 'DA-R4-004', 2025, 'P50',   'Thử nghiệm', 'FBW',   50, 0, 'TH-R4-006', 42),

    ('R4-030', 'DA-R4-005', 2026, 'CR100', 'Thử nghiệm', 'ATW',    4, 0, 'TH-R4-002', 43)
)
insert into public.lich_su_moi_han (
  ma_lich_su,
  du_an_id,
  nam_thuc_hien,
  loai_ray,
  loai_moi_han,
  cong_nghe_han,
  so_luong_thuc_hien,
  so_luong_loi,
  tho_han_id,
  nguyen_nhan_loi,
  nguon_du_lieu,
  dong_nguon
)
select
  source.ma_lich_su,
  du_an.id,
  source.nam_thuc_hien,
  source.loai_ray,
  source.loai_moi_han,
  source.cong_nghe_han,
  source.so_luong_thuc_hien,
  source.so_luong_loi,
  nhan_su.employee_id,
  null,
  'TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx',
  source.dong_nguon
from source
join public.du_an on du_an.ma_du_an = source.ma_du_an
join public.nhan_su on nhan_su.ma_nhan_su = source.ma_nhan_su
on conflict (ma_lich_su) do update
set du_an_id = excluded.du_an_id,
    nam_thuc_hien = excluded.nam_thuc_hien,
    loai_ray = excluded.loai_ray,
    loai_moi_han = excluded.loai_moi_han,
    cong_nghe_han = excluded.cong_nghe_han,
    so_luong_thuc_hien = excluded.so_luong_thuc_hien,
    so_luong_loi = excluded.so_luong_loi,
    tho_han_id = excluded.tho_han_id,
    nguon_du_lieu = excluded.nguon_du_lieu,
    dong_nguon = excluded.dong_nguon,
    updated_at = now();

do $$
declare
  v_rows integer;
  v_total integer;
  v_fbw integer;
  v_atw integer;
  v_errors integer;
begin
  select
    count(*),
    coalesce(sum(so_luong_thuc_hien), 0),
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'FBW'), 0),
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'ATW'), 0),
    coalesce(sum(so_luong_loi), 0)
  into v_rows, v_total, v_fbw, v_atw, v_errors
  from public.lich_su_moi_han
  where ma_lich_su like 'R4-%';

  if (v_rows, v_total, v_fbw, v_atw, v_errors) <> (30, 13387, 9873, 3514, 8) then
    raise exception
      'Đối chiếu R4 thất bại: rows=%, total=%, FBW=%, ATW=%, errors=%',
      v_rows, v_total, v_fbw, v_atw, v_errors;
  end if;
end;
$$;

commit;
