-- ============================================================
-- Chứng chỉ FBW (Flash-Butt Welding) K922-1 / UN5-150ZB.
-- Tạo bảng chứng chỉ chi tiết theo nhân sự, đồng bộ với nhan_su.chung_chi,
-- xóa toàn bộ chứng chỉ cũ và nạp lại dữ liệu thật từ
-- "FBW Certificate rev2 091225.pdf" (25 trang, 24 chứng chỉ / 23 người).
-- Chạy sau: schema.sql, lich_su_moi_han.sql, lich_chay_may.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Bảng chứng chỉ chi tiết theo nhân sự.
-- ------------------------------------------------------------
create table if not exists public.chung_chi_ho_so (
  id uuid primary key default gen_random_uuid(),
  nhan_su_id uuid not null references public.nhan_su (employee_id) on delete cascade,
  ten_chung_chi text not null,
  may text,
  don_vi_cap text,
  so_chung_chi text,
  ngay_cap date,
  ngay_het_han date,
  trang_thai text not null default 'Còn hiệu lực'
    check (trang_thai in ('Còn hiệu lực', 'Sắp hết hạn', 'Hết hạn')),
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chung_chi_ho_so is
  'Chứng chỉ đào tạo/vận hành của từng nhân sự — đơn vị cấp, số hiệu, ngày cấp/hết hạn';
comment on column public.chung_chi_ho_so.may is 'Mã/dòng máy áp dụng (VD: K922-1, UN5-150ZB), nếu chứng chỉ gắn với 1 máy cụ thể';

drop trigger if exists trg_chung_chi_ho_so_updated_at on public.chung_chi_ho_so;
create trigger trg_chung_chi_ho_so_updated_at
  before update on public.chung_chi_ho_so
  for each row execute function public.set_updated_at();

create index if not exists idx_chung_chi_ho_so_nhan_su
  on public.chung_chi_ho_so (nhan_su_id);

-- ------------------------------------------------------------
-- 2. Đồng bộ nhan_su.chung_chi (text[]) mỗi khi bảng chi tiết đổi —
--    trigger kiem_tra_chung_chi_moi_han (nhật ký hàn) đọc cột này.
-- ------------------------------------------------------------
create or replace function public.dong_bo_chung_chi_nhan_su()
returns trigger
language plpgsql
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.nhan_su_id, old.nhan_su_id);
  update public.nhan_su
  set chung_chi = coalesce((
    select array_agg(distinct ten_chung_chi order by ten_chung_chi)
    from public.chung_chi_ho_so
    where nhan_su_id = target_id
  ), '{}'::text[])
  where employee_id = target_id;
  return null;
end;
$$;

drop trigger if exists trg_dong_bo_chung_chi_nhan_su on public.chung_chi_ho_so;
create trigger trg_dong_bo_chung_chi_nhan_su
  after insert or update or delete on public.chung_chi_ho_so
  for each row execute function public.dong_bo_chung_chi_nhan_su();

-- ------------------------------------------------------------
-- 3. View báo cáo (kèm tên, mã, tổ hàn).
-- ------------------------------------------------------------
create or replace view public.bao_cao_chung_chi
with (security_invoker = true)
as
select
  cc.id,
  cc.nhan_su_id,
  ns.ma_nhan_su,
  ns.ho_ten,
  ns.to_han,
  cc.ten_chung_chi,
  cc.may,
  cc.don_vi_cap,
  cc.so_chung_chi,
  cc.ngay_cap,
  cc.ngay_het_han,
  cc.trang_thai,
  cc.ghi_chu,
  cc.created_at,
  cc.updated_at
from public.chung_chi_ho_so cc
join public.nhan_su ns on ns.employee_id = cc.nhan_su_id;

-- ------------------------------------------------------------
-- 4. Quyền truy cập.
-- ------------------------------------------------------------
alter table public.chung_chi_ho_so enable row level security;

drop policy if exists "authenticated_all_chung_chi_ho_so" on public.chung_chi_ho_so;
create policy "authenticated_all_chung_chi_ho_so"
  on public.chung_chi_ho_so for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_chung_chi_ho_so" on public.chung_chi_ho_so;
create policy "anon_all_chung_chi_ho_so"
  on public.chung_chi_ho_so for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.chung_chi_ho_so to anon, authenticated;
grant select on public.bao_cao_chung_chi to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Xóa toàn bộ chứng chỉ hiện tại (theo yêu cầu) trước khi nạp dữ liệu mới.
-- ------------------------------------------------------------
delete from public.chung_chi_ho_so;
update public.nhan_su set chung_chi = '{}'::text[];

-- ------------------------------------------------------------
-- 6. Thêm nhân sự xuất hiện trong chứng chỉ FBW nhưng chưa có trong hệ thống.
--    Chỉ điền tên (đúng như trên bằng, không dấu) + chức vụ (thợ hàn, theo
--    đúng nội dung chứng chỉ). Đơn vị / tổ hàn để trống vì bằng không ghi.
-- ------------------------------------------------------------
insert into public.nhan_su (ma_nhan_su, ho_ten, chuc_vu)
values
  ('TH-R4-007', 'Cao Manh Huy', 'Thợ hàn'),
  ('TH-R4-008', 'Pham Anh Sang', 'Thợ hàn'),
  ('TH-R4-009', 'Nguyen Trong Thoa', 'Thợ hàn'),
  ('TH-R4-010', 'Le Huy Manh', 'Thợ hàn'),
  ('TH-R4-011', 'Vu Minh Tien', 'Thợ hàn'),
  ('TH-R4-012', 'Pham Duc Viet', 'Thợ hàn'),
  ('TH-R4-013', 'Vu Van Luc', 'Thợ hàn'),
  ('TH-R4-014', 'Le Ngoc Tung', 'Thợ hàn'),
  ('TH-R4-015', 'Nguyen Cong Duc', 'Thợ hàn'),
  ('TH-R4-016', 'Nguyen Van Tuan', 'Thợ hàn'),
  ('TH-R4-017', 'Tran Huy Thang', 'Thợ hàn'),
  ('TH-R4-018', 'Nguyen Ngoc Hieu', 'Thợ hàn'),
  ('TH-R4-019', 'Mai Trung Kien', 'Thợ hàn'),
  ('TH-R4-020', 'Pham Xuan Dung', 'Thợ hàn'),
  ('TH-R4-021', 'Nguyen Thanh Ty', 'Thợ hàn'),
  ('TH-R4-022', 'Phan Gia Thanh Trung', 'Thợ hàn'),
  ('TH-R4-023', 'Phan Bui Thang', 'Thợ hàn'),
  ('TH-R4-024', 'Le Van Toan', 'Thợ hàn')
on conflict (ma_nhan_su) do nothing;

-- ------------------------------------------------------------
-- 7. Nạp 24 chứng chỉ FBW đọc từ PDF.
--    - 12 bằng mẫu KZESO "Certificate of Competency" (K922-1): bản gốc
--      không in ngày cấp/hết hạn.
--    - 3 bằng mẫu KZESO có số hiệu (No.33/27, 33/29, 33/30), khóa đào tạo
--      06–22/05/2020 (K922-1) — dùng ngày cuối khóa làm ngày cấp.
--    - 9 bằng Chengdu Aigre Technology "Certificate of Operation"
--      (UN5-150ZB), cấp ngày 26/12/2017.
--    Không bằng nào ghi ngày hết hạn → để trống, trạng thái "Còn hiệu lực".
-- ------------------------------------------------------------
insert into public.chung_chi_ho_so (nhan_su_id, ten_chung_chi, may, don_vi_cap, so_chung_chi, ngay_cap, ghi_chu)
select ns.employee_id, v.ten_chung_chi, v.may, v.don_vi_cap, v.so_chung_chi, v.ngay_cap, v.ghi_chu
from (
  values
    ('TH-R4-005', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-007', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-008', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-009', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-010', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-011', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-004', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-012', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-013', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-014', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-015', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-016', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', null::text, null::date, 'Bản gốc không ghi ngày cấp'),
    ('TH-R4-001', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', '33/27', '2020-05-22'::date, 'Khóa đào tạo 06–22/05/2020'),
    ('TH-R4-002', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', '33/29', '2020-05-22'::date, 'Khóa đào tạo 06–22/05/2020'),
    ('TH-R4-003', 'Chứng chỉ vận hành máy hàn K922-1 (Flash-Butt Welding of Rails)', 'K922-1', 'KZESO', '33/30', '2020-05-22'::date, 'Khóa đào tạo 06–22/05/2020'),
    ('TH-R4-001', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-017', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-018', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-019', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-020', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-021', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-022', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-023', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text),
    ('TH-R4-024', 'Chứng chỉ vận hành máy hàn UN5-150ZB (Flash-Butt Welding of Rails)', 'UN5-150ZB', 'Chengdu Aigre Technology Co., Ltd', null::text, '2017-12-26'::date, null::text)
) as v(ma_nhan_su, ten_chung_chi, may, don_vi_cap, so_chung_chi, ngay_cap, ghi_chu)
join public.nhan_su ns on ns.ma_nhan_su = v.ma_nhan_su;

notify pgrst, 'reload schema';
