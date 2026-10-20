-- Thanh dài LWR: thông số giải toả 60R2 + phạm vi trên sơ đồ.
-- Chạy trong Supabase Dashboard > SQL Editor.

create table if not exists public.lwr_long_rails (
  id uuid primary key,
  code text not null,
  label text not null default '',
  row_key text not null,
  start_cell_id text not null,
  end_cell_id text not null,
  params jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lwr_long_rails_code_unique unique (code)
);

create index if not exists lwr_long_rails_row_key_idx on public.lwr_long_rails (row_key);
create index if not exists lwr_long_rails_updated_at_idx on public.lwr_long_rails (updated_at desc);

alter table public.lwr_long_rails enable row level security;

drop policy if exists "anon all lwr_long_rails" on public.lwr_long_rails;
create policy "anon all lwr_long_rails" on public.lwr_long_rails
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.lwr_long_rails to anon, authenticated;

notify pgrst, 'reload schema';
