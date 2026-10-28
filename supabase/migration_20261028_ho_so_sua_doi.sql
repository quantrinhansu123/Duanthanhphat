-- Bản sửa đổi thông tin in của hồ sơ nghiệm thu. Dữ liệu chốt (số đo, danh sách mối) không bao giờ bị sửa;
-- mỗi lần sửa thêm một phiên bản kèm lý do và người sửa, bản cũ giữ nguyên để truy vết.
create table if not exists public.ho_so_nghiem_thu_sua_doi (
  id uuid primary key default gen_random_uuid(),
  ho_so_id uuid not null references public.ho_so_nghiem_thu(id) on delete restrict,
  phien_ban integer not null check (phien_ban > 0),
  thong_tin jsonb not null check (jsonb_typeof(thong_tin) = 'object'),
  ly_do text not null check (btrim(ly_do) <> ''),
  nguoi_sua text not null check (btrim(nguoi_sua) <> ''),
  created_at timestamptz not null default now(),
  unique (ho_so_id, phien_ban)
);
alter table public.ho_so_nghiem_thu_sua_doi enable row level security;
revoke all on public.ho_so_nghiem_thu_sua_doi from public, anon, authenticated;
grant select, insert on public.ho_so_nghiem_thu_sua_doi to service_role;

-- Chỉ thêm, không sửa/xóa bản đã lưu.
create or replace function public.bao_ve_ho_so_sua_doi() returns trigger language plpgsql as $$
begin raise exception 'Bản sửa đổi hồ sơ chỉ được thêm mới'; end $$;
drop trigger if exists trg_bao_ve_ho_so_sua_doi on public.ho_so_nghiem_thu_sua_doi;
create trigger trg_bao_ve_ho_so_sua_doi before update or delete on public.ho_so_nghiem_thu_sua_doi
  for each row execute function public.bao_ve_ho_so_sua_doi();
