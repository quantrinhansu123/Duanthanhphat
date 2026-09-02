-- ============================================================
-- Tiến độ lý thuyết theo ngày — lưu dạng JSONB trên bảng du_an
-- Chạy sau schema.sql và lich_su_moi_han.sql
-- Cấu trúc mỗi phần tử:
--   { "ngay": "2024-05-01", "so_moi_han": 120 }
-- ============================================================

alter table public.du_an
  add column if not exists tien_do_ly_thuyet jsonb not null default '[]'::jsonb;

comment on column public.du_an.tien_do_ly_thuyet is
  'Bảng con tiến độ lý thuyết theo ngày: [{ ngay, so_moi_han }]';

-- Ràng buộc: phải là mảng JSON
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'du_an_tien_do_ly_thuyet_array_check'
      and conrelid = 'public.du_an'::regclass
  ) then
    alter table public.du_an
      add constraint du_an_tien_do_ly_thuyet_array_check
      check (jsonb_typeof(tien_do_ly_thuyet) = 'array');
  end if;
end;
$$;

create index if not exists idx_du_an_tien_do_ly_thuyet
  on public.du_an using gin (tien_do_ly_thuyet);
