-- Metadata QLCL được lưu trong Supabase; PDF vẫn lưu trên Google Drive.
-- Hai bảng chỉ được truy cập bằng Route Handler dùng service_role.

create table if not exists public.chung_chi_qlcl_cong_ty (
  id text primary key,
  title text not null,
  standard_code text not null default '',
  organization text not null default '',
  certificate_number text not null default '',
  scope text not null default '',
  issued_at text not null default '',
  expires_at text not null default '',
  status text not null check (status in ('Chưa cập nhật', 'Còn hiệu lực', 'Sắp hết hạn', 'Hết hạn')),
  document_name text,
  document_url text,
  drive_file_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cho phép chạy lại migration nếu bản nháp cũ đã tạo bảng trước khi bổ sung
-- trạng thái trung lập "Chưa cập nhật".
alter table public.chung_chi_qlcl_cong_ty
  drop constraint if exists chung_chi_qlcl_cong_ty_status_check;
alter table public.chung_chi_qlcl_cong_ty
  add constraint chung_chi_qlcl_cong_ty_status_check
  check (status in ('Chưa cập nhật', 'Còn hiệu lực', 'Sắp hết hạn', 'Hết hạn'));

create table if not exists public.danh_gia_tieu_chuan_qlcl (
  item_id text primary key,
  status text not null check (status in ('Chưa đánh giá', 'Thiếu minh chứng', 'Đáp ứng một phần', 'Đạt')),
  scope text not null check (scope in ('Công ty', 'Quy trình hàn', 'Thợ hàn')),
  evidence_doc text,
  evidence_url text,
  verifier text,
  verified_at date,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.chung_chi_qlcl_cong_ty enable row level security;
alter table public.danh_gia_tieu_chuan_qlcl enable row level security;

revoke all on public.chung_chi_qlcl_cong_ty from anon, authenticated;
revoke all on public.danh_gia_tieu_chuan_qlcl from anon, authenticated;

-- Route Handler phía server dùng service_role. BYPASSRLS không thay thế quyền
-- thao tác bảng, vì vậy cần cấp quyền bảng tường minh sau khi đã revoke client.
grant select, insert, update, delete on public.chung_chi_qlcl_cong_ty to service_role;
grant select, insert, update, delete on public.danh_gia_tieu_chuan_qlcl to service_role;

comment on table public.chung_chi_qlcl_cong_ty is
  'Metadata chứng chỉ/hồ sơ QLCL cấp cho doanh nghiệp; không chứa chứng chỉ cá nhân thợ hàn.';
comment on table public.danh_gia_tieu_chuan_qlcl is
  'Kết quả đánh giá và minh chứng cho yêu cầu TCVN; nội dung yêu cầu chuẩn nằm trong mã nguồn.';
