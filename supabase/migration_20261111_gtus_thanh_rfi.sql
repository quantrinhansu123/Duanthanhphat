begin;

-- RFI giải toả ứng suất (GTUS): mỗi RFI gồm các thanh ray (màu xám trên track map).
-- Mỗi thanh có kết quả nghiệm thu và thanh toán riêng, lưu theo RFI (giống mối hàn của RFI nghiệm thu).
create table if not exists public.gtus_thanh_rfi (
  phieu_id uuid not null,                 -- phieu_yeu_cau_nghiem_thu.id (RFI loại GTUS)
  thanh_id text not null,                 -- mã thanh trong sơ đồ track map (vd DT-41)
  ma_thanh text not null,                 -- mã hiển thị (vd HT-41)
  route text not null check (route in ('ha','thuong')),
  ray text not null check (ray in ('trai','phai')),
  ly_trinh_dau text not null,
  ly_trinh_cuoi text not null,
  chieu_dai numeric not null,             -- = lý trình cuối - lý trình đầu + lượng điều chỉnh (m)
  ma_lwr text,
  -- nghiệm thu
  ket_qua text check (ket_qua in ('Đạt','Không đạt')),
  ngay_nghiem_thu date,
  ly_do text,
  nguoi_ghi text,
  -- thanh toán (null = chưa thanh toán)
  ty_le int check (ty_le in (30,50,70,100)),
  ngay_thanh_toan date,
  ghi_chu_thanh_toan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (phieu_id, thanh_id)
);

create index if not exists gtus_thanh_rfi_thanh on public.gtus_thanh_rfi(thanh_id);

-- Chỉ máy chủ (service role) đọc/ghi; người dùng thao tác qua API của ứng dụng.
alter table public.gtus_thanh_rfi enable row level security;
revoke all on public.gtus_thanh_rfi from anon, authenticated;
grant all on public.gtus_thanh_rfi to service_role;

notify pgrst, 'reload schema';
commit;
