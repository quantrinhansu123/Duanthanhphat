-- Số biên bản BBNTCV kế tiếp, một dãy cho mỗi dự án. Tăng sau mỗi lần in.
-- Chạy lại nhiều lần cũng không sao.
begin;

create table if not exists public.bbnt_so_in (
  du_an_id uuid primary key references public.du_an(id) on delete cascade,
  so_tiep integer not null default 1 check (so_tiep >= 1),
  updated_at timestamptz not null default now()
);

comment on table public.bbnt_so_in is 'Số biên bản BBNTCV kế tiếp của từng dự án. Tăng sau mỗi lần in.';

alter table public.bbnt_so_in enable row level security;
revoke all on public.bbnt_so_in from public, anon, authenticated;
grant select, insert, update on public.bbnt_so_in to service_role;

-- p_so null: đọc số kế tiếp (chưa có dòng thì 1). Có p_so: lần sau = max(số hiện tại, p_so + 1).
create or replace function public.bbnt_so_in_tiep(p_du_an uuid, p_so integer default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_no integer;
begin
  if p_du_an is null then
    raise exception 'Thiếu dự án';
  end if;
  if p_so is null then
    select so_tiep into next_no from public.bbnt_so_in where du_an_id = p_du_an;
    return coalesce(next_no, 1);
  end if;
  if p_so < 1 then
    raise exception 'Số biên bản không hợp lệ';
  end if;
  insert into public.bbnt_so_in (du_an_id, so_tiep)
  values (p_du_an, p_so + 1)
  on conflict (du_an_id) do update
    set so_tiep = greatest(public.bbnt_so_in.so_tiep, excluded.so_tiep),
        updated_at = now()
  returning so_tiep into next_no;
  return next_no;
end $$;

revoke all on function public.bbnt_so_in_tiep(uuid, integer) from public, anon, authenticated;
grant execute on function public.bbnt_so_in_tiep(uuid, integer) to service_role;

notify pgrst, 'reload schema';
commit;
