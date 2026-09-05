-- ============================================================
-- Nạp thêm chứng chỉ hàn nhôm nhiệt (Aluminothermic / Thermit) đọc từ
-- thư mục "D:\Duanthanhphat\chứng chỉ" (14 file, trong đó 12 file là
-- chứng chỉ cá nhân, 2 file là brochure máy mài ray — không áp dụng).
-- Đây là dữ liệu BỔ SUNG (không xóa chứng chỉ đã có).
-- Chạy sau: chung_chi_ho_so.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Thêm nhân sự mới xuất hiện trong chứng chỉ nhưng chưa có trong hệ thống.
-- ------------------------------------------------------------
insert into public.nhan_su (ma_nhan_su, ho_ten, chuc_vu)
values
  ('TH-R4-025', 'Phan Hong Loc', 'Thợ hàn'),
  ('TH-R4-026', 'Bui Huy Toan', 'Thợ hàn'),
  ('TH-R4-027', 'Mai Van Toan', 'Thợ hàn')
on conflict (ma_nhan_su) do nothing;

-- ------------------------------------------------------------
-- 2. Nạp chứng chỉ.
--    - 6 bằng Railtech Australia "Verification of Training" (Aluminothermic
--      Rail Welding, PLA One-Shot Crucible), cấp 22/03/2019, hiệu lực 36
--      tháng → hết hạn 22/03/2022.
--    - 5 bằng Thermit Australia Pty Ltd "Certificate" (Aluminothermic
--      Welding, 50N/60N SOW-5 SU + Long Life Crucible 3P), thi 23/08/2019,
--      hạn ghi trực tiếp trên từng bằng.
--    - 5 bằng "Certificate of Skill Training for Rail Thermit Welders"
--      (khóa 10–15/07/2026, cấp 20/07/2026) — không ghi hạn.
--    Trạng thái tính theo ngày hiện tại lúc nạp (CURRENT_DATE).
-- ------------------------------------------------------------
insert into public.chung_chi_ho_so (nhan_su_id, ten_chung_chi, may, don_vi_cap, so_chung_chi, ngay_cap, ngay_het_han, trang_thai, ghi_chu)
select
  ns.employee_id,
  v.ten_chung_chi,
  v.may,
  v.don_vi_cap,
  v.so_chung_chi,
  v.ngay_cap,
  v.ngay_het_han,
  case
    when v.ngay_het_han is null then 'Còn hiệu lực'
    when v.ngay_het_han < current_date then 'Hết hạn'
    when v.ngay_het_han <= current_date + interval '60 days' then 'Sắp hết hạn'
    else 'Còn hiệu lực'
  end,
  v.ghi_chu
from (
  values
    -- Railtech Australia — Aluminothermic Rail Welding (PLA One-Shot Crucible)
    ('TH-R4-001', 'Chứng chỉ hàn nhôm nhiệt Railtech (Verified Welder L2) – Aluminothermic Rail Welding', 'PLA One-Shot Crucible', 'Railtech Australia Limited', '19/CO2278', '2019-03-22'::date, '2022-03-22'::date, null::text),
    ('TH-R4-020', 'Chứng chỉ hàn nhôm nhiệt Railtech (Verified Welder L2) – Aluminothermic Rail Welding', 'PLA One-Shot Crucible', 'Railtech Australia Limited', '19/CO2279', '2019-03-22'::date, '2022-03-22'::date, null::text),
    ('TH-R4-025', 'Chứng chỉ hàn nhôm nhiệt Railtech (Verified Welder L2) – Aluminothermic Rail Welding', 'PLA One-Shot Crucible', 'Railtech Australia Limited', '19/CO2280', '2019-03-22'::date, '2022-03-22'::date, null::text),
    ('TH-R4-026', 'Chứng chỉ hàn nhôm nhiệt Railtech (Assistant Welder L1) – Aluminothermic Rail Welding', 'PLA One-Shot Crucible', 'Railtech Australia Limited', '19/CO2281', '2019-03-22'::date, '2022-03-22'::date, null::text),
    ('TH-R4-027', 'Chứng chỉ hàn nhôm nhiệt Railtech (Assistant Welder L1) – Aluminothermic Rail Welding', 'PLA One-Shot Crucible', 'Railtech Australia Limited', '19/CO2282', '2019-03-22'::date, '2022-03-22'::date, null::text),
    ('TH-R4-003', 'Chứng chỉ hàn nhôm nhiệt Railtech (Assistant Welder L1) – Aluminothermic Rail Welding', 'PLA One-Shot Crucible', 'Railtech Australia Limited', '19/CO2284', '2019-03-22'::date, '2022-03-22'::date, null::text),
    -- Thermit Australia Pty Ltd — 50N/60N SOW-5 SU + Long Life Crucible 3P
    ('TH-R4-007', 'Chứng chỉ hàn nhôm nhiệt Thermit (Assistant Thermit Welder Level I)', '50N/60N SOW-5 SU', 'Thermit Australia Pty Ltd', 'TPC OA 08/4638/19-LI', '2019-08-23'::date, '2024-11-23'::date, null::text),
    ('TH-R4-001', 'Chứng chỉ hàn nhôm nhiệt Thermit (Thermit Welder Level II)', '50N/60N SOW-5 SU', 'Thermit Australia Pty Ltd', 'TFC OA 08/4622/19-L2', '2019-08-23'::date, '2025-11-23'::date, null::text),
    ('TH-R4-002', 'Chứng chỉ hàn nhôm nhiệt Thermit (Assistant Thermit Welder Level I)', '50N/60N SOW-5 SU', 'Thermit Australia Pty Ltd', 'TPC OA 08/4630/19-LI', '2019-08-23'::date, '2025-11-23'::date, null::text),
    ('TH-R4-004', 'Chứng chỉ hàn nhôm nhiệt Thermit (Assistant Thermit Welder Level I)', '50N/60N SOW-5 SU', 'Thermit Australia Pty Ltd', 'TPC OA 08/4638/19-LI', '2019-08-23'::date, '2025-05-23'::date, 'Số chứng chỉ trùng với bằng của Cao Manh Huy (in trùng trên bản gốc)'),
    ('TH-R4-003', 'Chứng chỉ hàn nhôm nhiệt Thermit (Thermit Welder Level II)', '50N/60N SOW-5 SU', 'Thermit Australia Pty Ltd', 'TFC OA 08/4625/19-L2', '2019-08-23'::date, '2025-11-23'::date, null::text),
    -- Certificate of Skill Training for Rail Thermit Welders (khóa 10-15/07/2026)
    ('TH-R4-007', 'Chứng chỉ đào tạo kỹ năng hàn nhôm nhiệt đường ray (khóa 10–15/07/2026)', null, null, '04471356328', '2026-07-20'::date, null::date, 'Đơn vị cấp không rõ tên (chỉ có dấu mộc); SĐT liên hệ trên bằng: 0971087169'),
    ('TH-R4-001', 'Chứng chỉ đào tạo kỹ năng hàn nhôm nhiệt đường ray (khóa 10–15/07/2026)', null, null, '04311563130', '2026-07-20'::date, null::date, 'Đơn vị cấp không rõ tên (chỉ có dấu mộc); SĐT liên hệ trên bằng: 0906419889'),
    ('TH-R4-002', 'Chứng chỉ đào tạo kỹ năng hàn nhôm nhiệt đường ray (khóa 10–15/07/2026)', null, null, '04209351267', '2026-07-20'::date, null::date, 'Đơn vị cấp không rõ tên (chỉ có dấu mộc); SĐT liên hệ trên bằng: 0392828637'),
    ('TH-R4-004', 'Chứng chỉ đào tạo kỹ năng hàn nhôm nhiệt đường ray (khóa 10–15/07/2026)', null, null, '04932179554', '2026-07-20'::date, null::date, 'Đơn vị cấp không rõ tên (chỉ có dấu mộc); SĐT liên hệ trên bằng: 0327140095'),
    ('TH-R4-003', 'Chứng chỉ đào tạo kỹ năng hàn nhôm nhiệt đường ray (khóa 10–15/07/2026)', null, null, '04754263189', '2026-07-20'::date, null::date, 'Đơn vị cấp không rõ tên (chỉ có dấu mộc); SĐT liên hệ trên bằng: 0972128783')
) as v(ma_nhan_su, ten_chung_chi, may, don_vi_cap, so_chung_chi, ngay_cap, ngay_het_han, ghi_chu)
join public.nhan_su ns on ns.ma_nhan_su = v.ma_nhan_su;

notify pgrst, 'reload schema';
