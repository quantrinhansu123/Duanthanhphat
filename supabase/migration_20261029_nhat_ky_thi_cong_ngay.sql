-- Nhật ký thi công xây dựng — phần B "Tình hình thi công hàng ngày" (mẫu NKTC trang 6-7).
-- Mỗi dự án 1 bản ghi / ngày; nội dung form lưu trong du_lieu (jsonb). Chạy lại an toàn.
create table if not exists public.nhat_ky_thi_cong_ngay (
  id          uuid primary key default gen_random_uuid(),
  du_an_id    uuid not null references public.du_an (id) on delete cascade,
  ngay        date not null,
  du_lieu     jsonb not null default '{}'::jsonb check (jsonb_typeof(du_lieu) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (du_an_id, ngay)
);

drop trigger if exists trg_nhat_ky_thi_cong_ngay_updated_at on public.nhat_ky_thi_cong_ngay;
create trigger trg_nhat_ky_thi_cong_ngay_updated_at
  before update on public.nhat_ky_thi_cong_ngay
  for each row execute function public.set_updated_at();

alter table public.nhat_ky_thi_cong_ngay enable row level security;
drop policy if exists "authenticated_all_nhat_ky_thi_cong_ngay" on public.nhat_ky_thi_cong_ngay;
create policy "authenticated_all_nhat_ky_thi_cong_ngay" on public.nhat_ky_thi_cong_ngay for all to authenticated using (true) with check (true);
drop policy if exists "anon_all_nhat_ky_thi_cong_ngay" on public.nhat_ky_thi_cong_ngay;
create policy "anon_all_nhat_ky_thi_cong_ngay" on public.nhat_ky_thi_cong_ngay for all to anon using (true) with check (true);
grant select, insert, update, delete on public.nhat_ky_thi_cong_ngay to anon, authenticated;
notify pgrst, 'reload schema';
