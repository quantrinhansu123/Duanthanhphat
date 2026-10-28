-- Danh sách email được ghi nhận chất lượng/RFI/nghiệm thu (đăng nhập bằng Supabase Auth).
-- Chỉ service_role (server) đọc được; không mở cho anon/authenticated.
-- Tài khoản đăng nhập phải được tạo trong Authentication → Users; bảng này chỉ cấp quyền ghi.
create table if not exists public.nguoi_dung_nghiem_thu (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  created_at timestamptz not null default now()
);
alter table public.nguoi_dung_nghiem_thu enable row level security;
revoke all on public.nguoi_dung_nghiem_thu from public, anon, authenticated;
grant select, insert, update, delete on public.nguoi_dung_nghiem_thu to service_role;

insert into public.nguoi_dung_nghiem_thu(email) values ('admin@gmail.com') on conflict do nothing;
