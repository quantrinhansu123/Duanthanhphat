-- ============================================================
-- Schema Supabase - Quản lý nhân sự / hàn ray
-- Chạy trong: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. NHÂN SỰ
-- ------------------------------------------------------------
create table if not exists public.nhan_su (
  employee_id     uuid primary key default gen_random_uuid(),
  ho_ten          text not null,
  chuc_vu         text,
  don_vi          text,
  to_han          text,
  chung_chi       text[] not null default '{}', -- nhiều chứng chỉ, giao diện hiển thị cách nhau dấu phẩy
  kinh_nghiem     text,                    -- mô tả / số năm kinh nghiệm
  du_an_tham_gia  text[],                  -- danh sách dự án (text) — hoặc dùng bảng nối bên dưới
  cap_bac         text,
  loai_ray        text,
  loai_may        text,
  hinh_anh        text,                    -- URL Storage hoặc path
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.nhan_su is 'Danh sách nhân sự';
comment on column public.nhan_su.hinh_anh is 'URL ảnh trên Supabase Storage';
comment on column public.nhan_su.chung_chi is 'Danh sách chứng chỉ nhân sự được phép sử dụng khi ghép mối hàn';

-- ------------------------------------------------------------
-- 2. DỰ ÁN
-- ------------------------------------------------------------
create table if not exists public.du_an (
  id                uuid primary key default gen_random_uuid(),
  du_an             text not null,         -- tên dự án
  nguoi_phu_trach   uuid references public.nhan_su (employee_id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.du_an is 'Danh sách dự án';

-- Tiến độ lý thuyết theo ngày (bảng con JSONB): [{ "ngay", "so_moi_han" }]
-- Migration đầy đủ: supabase/du_an_tien_do_ly_thuyet.sql

-- ------------------------------------------------------------
-- 3. THIẾT BỊ
-- ------------------------------------------------------------
create table if not exists public.thiet_bi (
  id          uuid primary key default gen_random_uuid(),
  ma_may      text not null unique,
  ten_may     text not null,
  vi_tri_hien_tai text not null default 'Chưa cập nhật',
  hinh_anh    text,                        -- URL Storage
  trang_thai  text not null default 'Sẵn sàng'
              check (trang_thai in ('Đang làm việc', 'Sẵn sàng', 'Bảo trì', 'Hỏng')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.thiet_bi is 'Danh mục máy / thiết bị';

-- ------------------------------------------------------------
-- 4. NHẬT KÝ CHẠY MÁY
-- ------------------------------------------------------------
create table if not exists public.nhat_ky_chay_may (
  id                uuid primary key default gen_random_uuid(),
  ngay              date not null default current_date,
  du_an             uuid not null references public.du_an (id) on delete restrict,
  cong_viec         text,
  may               uuid not null references public.thiet_bi (id) on delete restrict,
  nguoi_phu_trach   uuid not null references public.nhan_su (employee_id) on delete restrict,
  ly_trinh_tu       text not null,
  ly_trinh_den      text not null,
  so_gio_hoat_dong  numeric(6,2) not null default 0
                    check (so_gio_hoat_dong >= 0 and so_gio_hoat_dong <= 24),
  nhiem_vu          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.nhat_ky_chay_may is 'Nhật ký vận hành máy theo dự án';

-- ------------------------------------------------------------
-- 5. THÔNG SỐ MỐI HÀN
-- ------------------------------------------------------------
create table if not exists public.thong_so_moi_han (
  id            uuid primary key default gen_random_uuid(),
  loai_ray      text not null,
  loai_moi_han  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.thong_so_moi_han is 'Thông số kỹ thuật theo loại ray / loại mối hàn';

-- ------------------------------------------------------------
-- 6. ĐÀO TẠO
-- ------------------------------------------------------------
create table if not exists public.dao_tao (
  id              uuid primary key default gen_random_uuid(),
  ten_khoa_hoc    text not null,
  ngay            date,
  noi_dung        text,
  nguoi_dao_tao   uuid references public.nhan_su (employee_id) on delete set null,
  nguoi_tham_gia  uuid[],                  -- danh sách employee_id tham gia
  ket_qua         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.dao_tao is 'Khóa đào tạo / huấn luyện';
comment on column public.dao_tao.nguoi_tham_gia is 'Mảng UUID nhân sự tham gia (employee_id)';

-- ------------------------------------------------------------
-- 7. CHỨNG CHỈ
-- ------------------------------------------------------------
create table if not exists public.chung_chi (
  id              uuid primary key default gen_random_uuid(),
  ten_chung_chi   text not null,
  ngay_cap        date,
  ngay_het_han    date,
  file_chung_chi  text,                    -- URL file trên Storage
  trang_thai      text not null default 'Còn hiệu lực'
                  check (trang_thai in ('Còn hiệu lực', 'Hết hạn', 'Thu hồi')),
  employee_id     uuid references public.nhan_su (employee_id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.chung_chi is 'Chứng chỉ gắn với nhân sự';

-- ------------------------------------------------------------
-- Bảng nối (khuyến nghị): nhân sự ↔ dự án
-- Dùng thay / bổ sung cho cột du_an_tham_gia dạng mảng
-- ------------------------------------------------------------
create table if not exists public.nhan_su_du_an (
  employee_id  uuid not null references public.nhan_su (employee_id) on delete cascade,
  du_an_id     uuid not null references public.du_an (id) on delete cascade,
  primary key (employee_id, du_an_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_du_an_nguoi_phu_trach
  on public.du_an (nguoi_phu_trach);

create index if not exists idx_nhat_ky_du_an
  on public.nhat_ky_chay_may (du_an);

create index if not exists idx_nhat_ky_may
  on public.nhat_ky_chay_may (may);

create index if not exists idx_nhat_ky_nguoi_phu_trach
  on public.nhat_ky_chay_may (nguoi_phu_trach);

create index if not exists idx_nhat_ky_chay_may_ngay
  on public.nhat_ky_chay_may (ngay desc);

create index if not exists idx_nhat_ky_chay_may_may_ngay
  on public.nhat_ky_chay_may (may, ngay desc);

create index if not exists idx_chung_chi_employee
  on public.chung_chi (employee_id);

create index if not exists idx_chung_chi_trang_thai
  on public.chung_chi (trang_thai);

create index if not exists idx_thiet_bi_trang_thai
  on public.thiet_bi (trang_thai);

create index if not exists idx_dao_tao_ngay
  on public.dao_tao (ngay);

-- ------------------------------------------------------------
-- 8. TOẠ ĐỘ (điểm khảo sát trên bản đồ)
-- ------------------------------------------------------------
create table if not exists public.toa_do (
  id          uuid primary key default gen_random_uuid(),
  ma_diem     text not null,
  kinh_do     double precision not null,
  vi_do       double precision not null,
  ly_trinh    text,
  ghi_chu     text,
  thu_tu      integer not null default 0,
  du_an_id    uuid references public.du_an (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint toa_do_ma_diem_unique unique (ma_diem),
  constraint toa_do_kinh_do_check check (kinh_do between -180 and 180),
  constraint toa_do_vi_do_check check (vi_do between -90 and 90)
);

comment on table public.toa_do is 'Điểm toạ độ / lý trình khảo sát trên bản đồ';

create index if not exists idx_toa_do_thu_tu on public.toa_do (thu_tu);
create index if not exists idx_toa_do_du_an on public.toa_do (du_an_id);
create index if not exists idx_toa_do_coords on public.toa_do (vi_do, kinh_do);

-- ------------------------------------------------------------
-- Trigger cập nhật updated_at
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nhan_su_updated_at on public.nhan_su;
create trigger trg_nhan_su_updated_at
  before update on public.nhan_su
  for each row execute function public.set_updated_at();

drop trigger if exists trg_du_an_updated_at on public.du_an;
create trigger trg_du_an_updated_at
  before update on public.du_an
  for each row execute function public.set_updated_at();

drop trigger if exists trg_thiet_bi_updated_at on public.thiet_bi;
create trigger trg_thiet_bi_updated_at
  before update on public.thiet_bi
  for each row execute function public.set_updated_at();

drop trigger if exists trg_nhat_ky_updated_at on public.nhat_ky_chay_may;
create trigger trg_nhat_ky_updated_at
  before update on public.nhat_ky_chay_may
  for each row execute function public.set_updated_at();

drop trigger if exists trg_thong_so_updated_at on public.thong_so_moi_han;
create trigger trg_thong_so_updated_at
  before update on public.thong_so_moi_han
  for each row execute function public.set_updated_at();

drop trigger if exists trg_dao_tao_updated_at on public.dao_tao;
create trigger trg_dao_tao_updated_at
  before update on public.dao_tao
  for each row execute function public.set_updated_at();

drop trigger if exists trg_chung_chi_updated_at on public.chung_chi;
create trigger trg_chung_chi_updated_at
  before update on public.chung_chi
  for each row execute function public.set_updated_at();

drop trigger if exists trg_toa_do_updated_at on public.toa_do;
create trigger trg_toa_do_updated_at
  before update on public.toa_do
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS (Row Level Security) — bật sẵn, policy mở cho authenticated
-- Chỉnh lại theo nhu cầu bảo mật thực tế
-- ------------------------------------------------------------
alter table public.nhan_su enable row level security;
alter table public.du_an enable row level security;
alter table public.thiet_bi enable row level security;
alter table public.nhat_ky_chay_may enable row level security;
alter table public.thong_so_moi_han enable row level security;
alter table public.dao_tao enable row level security;
alter table public.chung_chi enable row level security;
alter table public.nhan_su_du_an enable row level security;
alter table public.toa_do enable row level security;

create policy "authenticated_all_nhan_su"
  on public.nhan_su for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_du_an"
  on public.du_an for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_thiet_bi"
  on public.thiet_bi for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_nhat_ky_chay_may"
  on public.nhat_ky_chay_may for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_thong_so_moi_han"
  on public.thong_so_moi_han for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_dao_tao"
  on public.dao_tao for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_chung_chi"
  on public.chung_chi for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_nhan_su_du_an"
  on public.nhan_su_du_an for all to authenticated
  using (true) with check (true);

create policy "authenticated_all_toa_do"
  on public.toa_do for all to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- Storage buckets (chạy riêng nếu cần; hoặc tạo trên Dashboard)
-- ------------------------------------------------------------
-- insert into storage.buckets (id, name, public)
-- values
--   ('hinh-anh', 'hinh-anh', true),
--   ('chung-chi', 'chung-chi', false)
-- on conflict (id) do nothing;
