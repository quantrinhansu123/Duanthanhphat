-- Phân công máy: báo cáo đã tổng hợp, không tính lại mỗi lần mở trang.
-- Chạy trên Supabase SQL editor. Có thể chạy lại.

create table if not exists public.phan_cong_may (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ngay date not null,
  may_id uuid references public.thiet_bi (id) on delete set null,
  ma_may text not null,
  ten_may text not null default '',
  du_an_id uuid references public.du_an (id) on delete set null,
  ten_du_an text not null default '',
  tho_han_id uuid references public.nhan_su (employee_id) on delete set null,
  ten_tho_han text not null default '',
  cong_nghe_han text not null default '',
  loai_moi_han text not null default '',
  ca text[] not null default '{}',
  so_moi_han integer not null default 0 check (so_moi_han >= 0),
  so_moi_loi integer not null default 0 check (so_moi_loi >= 0),
  so_ban_ghi integer not null default 0 check (so_ban_ghi >= 0),
  nhom text not null,
  constraint phan_cong_may_nhom_unique unique (nhom)
);

create index if not exists idx_phan_cong_may_ngay
  on public.phan_cong_may (ngay desc);

create index if not exists idx_phan_cong_may_may_ngay
  on public.phan_cong_may (may_id, ngay desc);

drop trigger if exists trg_phan_cong_may_updated_at on public.phan_cong_may;
create trigger trg_phan_cong_may_updated_at
  before update on public.phan_cong_may
  for each row
  execute function public.set_updated_at();

comment on table public.phan_cong_may is
  'Báo cáo phân công máy đã tổng hợp từ nhật ký hàn theo khoảng ngày';

alter table public.phan_cong_may enable row level security;

drop policy if exists "authenticated_all_phan_cong_may" on public.phan_cong_may;
create policy "authenticated_all_phan_cong_may"
  on public.phan_cong_may for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_phan_cong_may" on public.phan_cong_may;
create policy "anon_all_phan_cong_may"
  on public.phan_cong_may for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.phan_cong_may to anon, authenticated;

notify pgrst, 'reload schema';
