-- Báo cáo ảnh hàng ngày (mẫu "Mẫu báo cáo ảnh"). Mỗi dự án 1 bản ghi / ngày.
-- du_lieu = { goiThau, hangMuc, items: [{ id, noiDung, anh }] }, anh là ảnh JPEG đã nén (data URL).
create table if not exists public.bao_cao_anh_ngay (
  id          uuid primary key default gen_random_uuid(),
  du_an_id    uuid not null references public.du_an (id) on delete cascade,
  ngay        date not null,
  du_lieu     jsonb not null default '{}'::jsonb check (jsonb_typeof(du_lieu) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (du_an_id, ngay)
);

drop trigger if exists trg_bao_cao_anh_ngay_updated_at on public.bao_cao_anh_ngay;
create trigger trg_bao_cao_anh_ngay_updated_at
  before update on public.bao_cao_anh_ngay
  for each row execute function public.set_updated_at();

alter table public.bao_cao_anh_ngay enable row level security;
drop policy if exists "authenticated_all_bao_cao_anh_ngay" on public.bao_cao_anh_ngay;
create policy "authenticated_all_bao_cao_anh_ngay" on public.bao_cao_anh_ngay for all to authenticated using (true) with check (true);
drop policy if exists "anon_all_bao_cao_anh_ngay" on public.bao_cao_anh_ngay;
create policy "anon_all_bao_cao_anh_ngay" on public.bao_cao_anh_ngay for all to anon using (true) with check (true);
grant select, insert, update, delete on public.bao_cao_anh_ngay to anon, authenticated;
notify pgrst, 'reload schema';
