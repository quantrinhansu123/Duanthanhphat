-- Sơ đồ ray LWR (dải, ô lý trình, ký hiệu, đoạn đã lắp, liên kết mối hàn).
-- Một dòng cho sơ đồ chưa gán dự án (project_id = '') và một dòng cho mỗi dự án.
-- Chạy trong Supabase Dashboard > SQL Editor.

create table if not exists public.lwr_track_layouts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null default '',
  layout jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lwr_track_layouts_project_unique unique (project_id)
);

create index if not exists lwr_track_layouts_updated_at_idx
  on public.lwr_track_layouts (updated_at desc);

alter table public.lwr_track_layouts enable row level security;

drop policy if exists "anon all lwr_track_layouts" on public.lwr_track_layouts;
create policy "anon all lwr_track_layouts" on public.lwr_track_layouts
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.lwr_track_layouts to anon, authenticated;

notify pgrst, 'reload schema';
