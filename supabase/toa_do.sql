-- ============================================================
-- Bảng TOẠ ĐỘ (điểm khảo sát / lý trình trên bản đồ)
-- Chạy trong: Supabase Dashboard → SQL Editor → New query → Run
-- Có thể chạy độc lập nếu schema chính đã có sẵn.
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Bảng toạ độ
-- ------------------------------------------------------------
create table if not exists public.toa_do (
  id          uuid primary key default gen_random_uuid(),
  ma_diem     text not null,                 -- TT0001, TT0002...
  kinh_do     double precision not null,     -- longitude
  vi_do       double precision not null,     -- latitude
  ly_trinh    text,                          -- Km0+000.00
  ghi_chu     text,
  thu_tu      integer not null default 0,    -- thứ tự trên tuyến
  du_an_id    uuid references public.du_an (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint toa_do_ma_diem_unique unique (ma_diem),
  constraint toa_do_kinh_do_check check (kinh_do between -180 and 180),
  constraint toa_do_vi_do_check check (vi_do between -90 and 90)
);

comment on table public.toa_do is 'Điểm toạ độ / lý trình khảo sát trên bản đồ';
comment on column public.toa_do.ma_diem is 'Mã điểm (vd TT0001)';
comment on column public.toa_do.kinh_do is 'Kinh độ (longitude)';
comment on column public.toa_do.vi_do is 'Vĩ độ (latitude)';
comment on column public.toa_do.ly_trinh is 'Lý trình Km (vd Km0+025.00)';

create index if not exists idx_toa_do_thu_tu on public.toa_do (thu_tu);
create index if not exists idx_toa_do_du_an on public.toa_do (du_an_id);
create index if not exists idx_toa_do_coords on public.toa_do (vi_do, kinh_do);

drop trigger if exists trg_toa_do_updated_at on public.toa_do;
create trigger trg_toa_do_updated_at
  before update on public.toa_do
  for each row execute function public.set_updated_at();

alter table public.toa_do enable row level security;

drop policy if exists "authenticated_all_toa_do" on public.toa_do;
create policy "authenticated_all_toa_do"
  on public.toa_do for all to authenticated
  using (true) with check (true);

-- Dev: anon đọc/ghi (chạy cùng rls_anon_dev.sql nếu cần)
drop policy if exists "anon_all_toa_do" on public.toa_do;
create policy "anon_all_toa_do"
  on public.toa_do for all to anon
  using (true) with check (true);

-- ------------------------------------------------------------
-- Seed 14 điểm mẫu quanh Hà Nội (bỏ qua nếu mã đã tồn tại)
-- ------------------------------------------------------------
insert into public.toa_do (ma_diem, kinh_do, vi_do, ly_trinh, thu_tu)
values
  ('TT0001', 105.8412, 21.0245, 'Km0+000.00', 1),
  ('TT0002', 105.8415, 21.0228, 'Km0+025.00', 2),
  ('TT0003', 105.8418, 21.0211, 'Km0+050.00', 3),
  ('TT0004', 105.8421, 21.0194, 'Km0+075.00', 4),
  ('TT0005', 105.8424, 21.0177, 'Km0+100.00', 5),
  ('TT0006', 105.8427, 21.0160, 'Km0+125.00', 6),
  ('TT0007', 105.8430, 21.0143, 'Km0+150.00', 7),
  ('TT0008', 105.8433, 21.0126, 'Km0+175.00', 8),
  ('TT0009', 105.8436, 21.0109, 'Km0+200.00', 9),
  ('TT0010', 105.8439, 21.0092, 'Km0+225.00', 10),
  ('TT0011', 105.8442, 21.0075, 'Km0+250.00', 11),
  ('TT0012', 105.8445, 21.0058, 'Km0+275.00', 12),
  ('TT0013', 105.8448, 21.0041, 'Km0+300.00', 13),
  ('TT0014', 105.8451, 21.0024, 'Km0+325.00', 14)
on conflict (ma_diem) do nothing;
