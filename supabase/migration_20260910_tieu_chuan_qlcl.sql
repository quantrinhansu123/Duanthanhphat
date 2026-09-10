create table if not exists public.tieu_chuan_qlcl (
  id text primary key,
  standard_code text not null,
  clause text not null,
  title text not null,
  requirement text not null,
  scope text not null check (scope in ('Công ty', 'Quy trình hàn', 'Thợ hàn')),
  related_standard text not null default '',
  evidence_required text not null default '',
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.tieu_chuan_qlcl enable row level security;
revoke all on public.tieu_chuan_qlcl from anon, authenticated;
grant select, insert, update, delete on public.tieu_chuan_qlcl to service_role;

comment on table public.tieu_chuan_qlcl is
  'Danh mục yêu cầu tiêu chuẩn TCVN/ISO dùng cho quản lý chất lượng.';
