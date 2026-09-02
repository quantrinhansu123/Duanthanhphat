-- ============================================================
-- Tiến độ lý thuyết theo ngày — lưu dạng JSONB trên bảng du_an
-- Chạy sau schema.sql và lich_su_moi_han.sql
-- Cấu trúc mỗi phần tử:
--   { "ngay": "2024-05-01", "so_moi_han": 120 }
-- ============================================================

alter table public.du_an
  add column if not exists tien_do_ly_thuyet jsonb not null default '[]'::jsonb,
  add column if not exists ly_trinh_tu text,
  add column if not exists ly_trinh_den text,
  add column if not exists ngay_bat_dau date,
  add column if not exists ngay_ket_thuc date,
  add column if not exists tong_moi_han_du_kien integer not null default 0;

update public.du_an
set ly_trinh_tu = coalesce(nullif(btrim(ly_trinh_tu), ''), 'Chưa cập nhật'),
    ly_trinh_den = coalesce(nullif(btrim(ly_trinh_den), ''), 'Chưa cập nhật'),
    ngay_bat_dau = coalesce(
      ngay_bat_dau,
      (
        select min(
          case
            when item ->> 'ngay' ~ '^\d{4}-\d{2}-\d{2}$'
              then (item ->> 'ngay')::date
          end
        )
        from jsonb_array_elements(tien_do_ly_thuyet) as item
      ),
      created_at::date
    ),
    ngay_ket_thuc = coalesce(
      ngay_ket_thuc,
      (
        select max(
          case
            when item ->> 'ngay' ~ '^\d{4}-\d{2}-\d{2}$'
              then (item ->> 'ngay')::date
          end
        )
        from jsonb_array_elements(tien_do_ly_thuyet) as item
      ),
      ngay_bat_dau,
      created_at::date
    ),
    tong_moi_han_du_kien = case
      when tong_moi_han_du_kien > 0 then tong_moi_han_du_kien
      else coalesce((
        select sum((item ->> 'so_moi_han')::integer)
        from jsonb_array_elements(tien_do_ly_thuyet) as item
      ), 0)
    end;

alter table public.du_an
  alter column ly_trinh_tu set default 'Chưa cập nhật',
  alter column ly_trinh_tu set not null,
  alter column ly_trinh_den set default 'Chưa cập nhật',
  alter column ly_trinh_den set not null,
  alter column ngay_bat_dau set default current_date,
  alter column ngay_bat_dau set not null,
  alter column ngay_ket_thuc set default current_date,
  alter column ngay_ket_thuc set not null;

comment on column public.du_an.tien_do_ly_thuyet is
  'Kế hoạch mối hàn tự động theo ngày: [{ ngay, so_moi_han }]';
comment on column public.du_an.ly_trinh_tu is 'Lý trình bắt đầu của dự án';
comment on column public.du_an.ly_trinh_den is 'Lý trình kết thúc của dự án';
comment on column public.du_an.ngay_bat_dau is 'Ngày bắt đầu dự án, tính trong số ngày thực hiện';
comment on column public.du_an.ngay_ket_thuc is 'Ngày kết thúc dự án, tính trong số ngày thực hiện';
comment on column public.du_an.tong_moi_han_du_kien is 'Tổng số mối hàn dự kiến của dự án';

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

alter table public.du_an
  drop constraint if exists du_an_thoi_gian_check,
  drop constraint if exists du_an_tong_moi_han_check;

alter table public.du_an
  add constraint du_an_thoi_gian_check check (ngay_ket_thuc >= ngay_bat_dau),
  add constraint du_an_tong_moi_han_check check (tong_moi_han_du_kien >= 0);

-- Tự chia đều tổng mối hàn cho từng ngày. Phần dư được cộng từ ngày đầu.
create or replace function public.tao_ke_hoach_moi_han_theo_ngay()
returns trigger
language plpgsql
as $$
declare
  so_ngay integer;
  moi_han_co_ban integer;
  so_du integer;
begin
  if new.ngay_bat_dau is null
     or new.ngay_ket_thuc is null
     or new.ngay_ket_thuc < new.ngay_bat_dau
     or coalesce(new.tong_moi_han_du_kien, 0) <= 0 then
    new.tien_do_ly_thuyet = '[]'::jsonb;
    return new;
  end if;

  so_ngay = (new.ngay_ket_thuc - new.ngay_bat_dau) + 1;
  moi_han_co_ban = new.tong_moi_han_du_kien / so_ngay;
  so_du = new.tong_moi_han_du_kien % so_ngay;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ngay', (new.ngay_bat_dau + ngay_thu)::text,
        'so_moi_han', moi_han_co_ban + case when ngay_thu < so_du then 1 else 0 end
      )
      order by ngay_thu
    ),
    '[]'::jsonb
  )
  into new.tien_do_ly_thuyet
  from generate_series(0, so_ngay - 1) as series(ngay_thu);

  return new;
end;
$$;

drop trigger if exists trg_tao_ke_hoach_moi_han_theo_ngay on public.du_an;
create trigger trg_tao_ke_hoach_moi_han_theo_ngay
  before insert or update of ngay_bat_dau, ngay_ket_thuc, tong_moi_han_du_kien
  on public.du_an
  for each row execute function public.tao_ke_hoach_moi_han_theo_ngay();

create index if not exists idx_du_an_tien_do_ly_thuyet
  on public.du_an using gin (tien_do_ly_thuyet);

create index if not exists idx_du_an_thoi_gian
  on public.du_an (ngay_bat_dau, ngay_ket_thuc);

create or replace view public.bao_cao_ke_hoach_moi_han_theo_ngay
with (security_invoker = true)
as
select
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  da.ly_trinh_tu,
  da.ly_trinh_den,
  da.ngay_bat_dau,
  da.ngay_ket_thuc,
  da.tong_moi_han_du_kien,
  (ke_hoach ->> 'ngay')::date as ngay,
  (ke_hoach ->> 'so_moi_han')::integer as so_moi_han_ke_hoach
from public.du_an da
cross join lateral jsonb_array_elements(da.tien_do_ly_thuyet) as ke_hoach;

grant select on public.bao_cao_ke_hoach_moi_han_theo_ngay to anon, authenticated;

notify pgrst, 'reload schema';
