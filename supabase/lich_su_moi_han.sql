-- ============================================================
-- Lịch sử / khối lượng mối hàn ray
-- Chạy sau schema.sql trong Supabase Dashboard -> SQL Editor.
-- File này chỉ tạo cấu trúc, không chèn dữ liệu Excel.
-- Có thể chạy lại an toàn.
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

-- Mã ổn định phục vụ import và liên kết; tên người có thể trùng nhau.
alter table public.nhan_su
  add column if not exists ma_nhan_su text;

alter table public.du_an
  add column if not exists ma_du_an text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nhan_su_ma_nhan_su_unique'
      and conrelid = 'public.nhan_su'::regclass
  ) then
    alter table public.nhan_su
      add constraint nhan_su_ma_nhan_su_unique unique (ma_nhan_su);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'du_an_ma_du_an_unique'
      and conrelid = 'public.du_an'::regclass
  ) then
    alter table public.du_an
      add constraint du_an_ma_du_an_unique unique (ma_du_an);
  end if;
end;
$$;

create table if not exists public.lich_su_moi_han (
  id                    uuid primary key default gen_random_uuid(),
  ma_lich_su            text not null,
  du_an_id              uuid not null references public.du_an (id) on delete restrict,
  nam_thuc_hien         smallint not null,
  loai_ray              text not null,
  loai_moi_han          text not null,
  cong_nghe_han         text not null,
  so_luong_thuc_hien    integer not null,
  so_luong_loi          integer not null default 0,
  tho_han_id            uuid not null references public.nhan_su (employee_id) on delete restrict,
  chung_chi_su_dung     text,
  nguyen_nhan_loi       text,
  nguon_du_lieu         text,
  dong_nguon            integer,
  ghi_chu               text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint lich_su_moi_han_ma_unique unique (ma_lich_su),
  constraint lich_su_moi_han_nam_check
    check (nam_thuc_hien between 1900 and 2100),
  constraint lich_su_moi_han_loai_check
    check (loai_moi_han in ('Thử nghiệm', 'Đào tạo', 'Sản xuất')),
  constraint lich_su_moi_han_cong_nghe_check
    check (cong_nghe_han in ('FBW', 'ATW')),
  constraint lich_su_moi_han_so_luong_check
    check (so_luong_thuc_hien >= 0),
  constraint lich_su_moi_han_so_luong_loi_check
    check (so_luong_loi >= 0 and so_luong_loi <= so_luong_thuc_hien)
);

comment on table public.lich_su_moi_han is
  'Khối lượng mối hàn lịch sử theo dự án, năm, công nghệ và thợ hàn';
comment on column public.lich_su_moi_han.loai_moi_han is
  'Mục đích/nhóm mối hàn: Thử nghiệm, Đào tạo hoặc Sản xuất';
comment on column public.lich_su_moi_han.cong_nghe_han is
  'Công nghệ hàn: FBW hoặc ATW';
comment on column public.lich_su_moi_han.so_luong_loi is
  'Số mối lỗi nằm trong tổng số lượng thực hiện';
comment on column public.lich_su_moi_han.chung_chi_su_dung is
  'Chứng chỉ của nhân sự được dùng để đáp ứng chuẩn mối hàn';

create index if not exists idx_lich_su_moi_han_nam
  on public.lich_su_moi_han (nam_thuc_hien);
create index if not exists idx_lich_su_moi_han_du_an_nam
  on public.lich_su_moi_han (du_an_id, nam_thuc_hien);
create index if not exists idx_lich_su_moi_han_tho_han_nam
  on public.lich_su_moi_han (tho_han_id, nam_thuc_hien);
create index if not exists idx_lich_su_moi_han_cong_nghe
  on public.lich_su_moi_han (cong_nghe_han);

drop trigger if exists trg_lich_su_moi_han_updated_at on public.lich_su_moi_han;
create trigger trg_lich_su_moi_han_updated_at
  before update on public.lich_su_moi_han
  for each row execute function public.set_updated_at();

alter table public.lich_su_moi_han enable row level security;

drop policy if exists "authenticated_all_lich_su_moi_han" on public.lich_su_moi_han;
create policy "authenticated_all_lich_su_moi_han"
  on public.lich_su_moi_han for all to authenticated
  using (true) with check (true);

-- Giao diện hiện chưa có đăng nhập: anon chỉ được đọc báo cáo.
drop policy if exists "anon_read_lich_su_moi_han" on public.lich_su_moi_han;
create policy "anon_read_lich_su_moi_han"
  on public.lich_su_moi_han for select to anon
  using (true);

grant select on public.lich_su_moi_han to anon;
grant select, insert, update, delete on public.lich_su_moi_han to authenticated;

-- ------------------------------------------------------------
-- Tổng hợp theo năm, tương ứng bảng "Tổng hợp" trong Excel.
-- Thử nghiệm và Đào tạo được cộng vào cùng nhóm thử nghiệm/đào tạo.
-- ------------------------------------------------------------
create or replace view public.bao_cao_moi_han_theo_nam
with (security_invoker = true)
as
select
  nam_thuc_hien,
  coalesce(sum(so_luong_thuc_hien) filter (
    where loai_moi_han in ('Thử nghiệm', 'Đào tạo') and cong_nghe_han = 'FBW'
  ), 0)::bigint as thu_nghiem_dao_tao_fbw,
  coalesce(sum(so_luong_thuc_hien) filter (
    where loai_moi_han in ('Thử nghiệm', 'Đào tạo') and cong_nghe_han = 'ATW'
  ), 0)::bigint as thu_nghiem_dao_tao_atw,
  coalesce(sum(so_luong_thuc_hien) filter (
    where loai_moi_han = 'Sản xuất' and cong_nghe_han = 'FBW'
  ), 0)::bigint as san_xuat_fbw,
  coalesce(sum(so_luong_thuc_hien) filter (
    where loai_moi_han = 'Sản xuất' and cong_nghe_han = 'ATW'
  ), 0)::bigint as san_xuat_atw,
  coalesce(sum(so_luong_loi) filter (where cong_nghe_han = 'FBW'), 0)::bigint as loi_fbw,
  coalesce(sum(so_luong_loi) filter (where cong_nghe_han = 'ATW'), 0)::bigint as loi_atw,
  coalesce(sum(so_luong_thuc_hien), 0)::bigint as tong_thuc_hien,
  coalesce(sum(so_luong_loi), 0)::bigint as tong_loi
from public.lich_su_moi_han
group by nam_thuc_hien;

-- Tổng hợp sản lượng và lỗi theo từng thợ hàn.
create or replace view public.bao_cao_moi_han_theo_tho
with (security_invoker = true)
as
select
  ns.employee_id as tho_han_id,
  ns.ma_nhan_su,
  ns.ho_ten,
  coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'FBW'), 0)::bigint as thuc_hien_fbw,
  coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'ATW'), 0)::bigint as thuc_hien_atw,
  coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'FBW'), 0)::bigint as loi_fbw,
  coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'ATW'), 0)::bigint as loi_atw,
  coalesce(sum(ls.so_luong_thuc_hien), 0)::bigint as tong_thuc_hien,
  coalesce(sum(ls.so_luong_loi), 0)::bigint as tong_loi
from public.nhan_su ns
join public.lich_su_moi_han ls on ls.tho_han_id = ns.employee_id
group by ns.employee_id, ns.ma_nhan_su, ns.ho_ten;

-- Dữ liệu chi tiết đã ghép tên dự án và thợ hàn cho giao diện báo cáo.
create or replace view public.bao_cao_moi_han_theo_du_an
with (security_invoker = true)
as
select
  ls.id,
  ls.ma_lich_su,
  da.id as du_an_id,
  da.ma_du_an,
  da.du_an,
  ls.nam_thuc_hien,
  ls.loai_ray,
  ls.loai_moi_han,
  ls.cong_nghe_han,
  ls.so_luong_thuc_hien,
  ls.so_luong_loi,
  ns.employee_id as tho_han_id,
  ns.ma_nhan_su,
  ns.ho_ten as ten_tho_han,
  ls.nguyen_nhan_loi,
  ls.nguon_du_lieu,
  ls.dong_nguon,
  ls.ghi_chu,
  ns.chung_chi as chung_chi_nhan_su,
  ls.chung_chi_su_dung
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id;

-- Các dòng cần bổ sung nguyên nhân lỗi từ nguồn bên ngoài (Joy).
create or replace view public.canh_bao_du_lieu_moi_han
with (security_invoker = true)
as
select *
from public.bao_cao_moi_han_theo_du_an
where so_luong_loi > 0
  and nullif(btrim(nguyen_nhan_loi), '') is null;

grant select on public.bao_cao_moi_han_theo_nam to anon, authenticated;
grant select on public.bao_cao_moi_han_theo_tho to anon, authenticated;
grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;
grant select on public.canh_bao_du_lieu_moi_han to anon, authenticated;
