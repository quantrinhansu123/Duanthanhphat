-- ============================================================
-- Báo cáo ngày: nhân lực chọn từ nhan_su theo chức vụ
-- (thay cột số lượng numeric bằng id + tên)
-- Chạy sau: bao_cao_ngay.sql
-- Lưu ý PG: RENAME COLUMN phải đứng riêng, không gộp với ALTER TYPE.
-- ============================================================

-- 1) Đổi kiểu numeric → text (nếu còn cột so_*)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec'
      and column_name = 'so_cht' and data_type <> 'text'
  ) then
    alter table public.bao_cao_ngay_cong_viec
      alter column so_cht type text using nullif(btrim(so_cht::text), '');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec'
      and column_name = 'so_ky_su' and data_type <> 'text'
  ) then
    alter table public.bao_cao_ngay_cong_viec
      alter column so_ky_su type text using nullif(btrim(so_ky_su::text), '');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec'
      and column_name = 'so_lai_may' and data_type <> 'text'
  ) then
    alter table public.bao_cao_ngay_cong_viec
      alter column so_lai_may type text using nullif(btrim(so_lai_may::text), '');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec'
      and column_name = 'so_tho_van_hanh' and data_type <> 'text'
  ) then
    alter table public.bao_cao_ngay_cong_viec
      alter column so_tho_van_hanh type text using nullif(btrim(so_tho_van_hanh::text), '');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec'
      and column_name = 'so_cong_nhan' and data_type <> 'text'
  ) then
    alter table public.bao_cao_ngay_cong_viec
      alter column so_cong_nhan type text using nullif(btrim(so_cong_nhan::text), '');
  end if;
end $$;

-- 2) Đổi tên so_* → *_ten (câu RENAME riêng)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_cht'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'cht_ten'
  ) then
    alter table public.bao_cao_ngay_cong_viec rename column so_cht to cht_ten;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_ky_su'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'ky_su_ten'
  ) then
    alter table public.bao_cao_ngay_cong_viec rename column so_ky_su to ky_su_ten;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_lai_may'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'lai_may_ten'
  ) then
    alter table public.bao_cao_ngay_cong_viec rename column so_lai_may to lai_may_ten;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_tho_van_hanh'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'tho_van_hanh_ten'
  ) then
    alter table public.bao_cao_ngay_cong_viec rename column so_tho_van_hanh to tho_van_hanh_ten;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_cong_nhan'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'cong_nhan_ten'
  ) then
    alter table public.bao_cao_ngay_cong_viec rename column so_cong_nhan to cong_nhan_ten;
  end if;
end $$;

-- 3) Thêm cột id + tên (nếu bảng mới chưa có / chưa rename)
alter table public.bao_cao_ngay_cong_viec
  add column if not exists cht_id uuid references public.nhan_su (employee_id) on delete set null,
  add column if not exists cht_ten text,
  add column if not exists ky_su_id uuid references public.nhan_su (employee_id) on delete set null,
  add column if not exists ky_su_ten text,
  add column if not exists lai_may_id uuid references public.nhan_su (employee_id) on delete set null,
  add column if not exists lai_may_ten text,
  add column if not exists tho_van_hanh_id uuid references public.nhan_su (employee_id) on delete set null,
  add column if not exists tho_van_hanh_ten text,
  add column if not exists cong_nhan_id uuid references public.nhan_su (employee_id) on delete set null,
  add column if not exists cong_nhan_ten text;

-- 4) Nếu vẫn còn so_* song song với *_ten: copy rồi drop so_*
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_cht'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'cht_ten'
  ) then
    update public.bao_cao_ngay_cong_viec
    set cht_ten = coalesce(nullif(btrim(cht_ten), ''), nullif(btrim(so_cht::text), ''))
    where cht_ten is null or btrim(cht_ten) = '';
    alter table public.bao_cao_ngay_cong_viec drop column so_cht;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_ky_su'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'ky_su_ten'
  ) then
    update public.bao_cao_ngay_cong_viec
    set ky_su_ten = coalesce(nullif(btrim(ky_su_ten), ''), nullif(btrim(so_ky_su::text), ''))
    where ky_su_ten is null or btrim(ky_su_ten) = '';
    alter table public.bao_cao_ngay_cong_viec drop column so_ky_su;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_lai_may'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'lai_may_ten'
  ) then
    update public.bao_cao_ngay_cong_viec
    set lai_may_ten = coalesce(nullif(btrim(lai_may_ten), ''), nullif(btrim(so_lai_may::text), ''))
    where lai_may_ten is null or btrim(lai_may_ten) = '';
    alter table public.bao_cao_ngay_cong_viec drop column so_lai_may;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_tho_van_hanh'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'tho_van_hanh_ten'
  ) then
    update public.bao_cao_ngay_cong_viec
    set tho_van_hanh_ten = coalesce(nullif(btrim(tho_van_hanh_ten), ''), nullif(btrim(so_tho_van_hanh::text), ''))
    where tho_van_hanh_ten is null or btrim(tho_van_hanh_ten) = '';
    alter table public.bao_cao_ngay_cong_viec drop column so_tho_van_hanh;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'so_cong_nhan'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bao_cao_ngay_cong_viec' and column_name = 'cong_nhan_ten'
  ) then
    update public.bao_cao_ngay_cong_viec
    set cong_nhan_ten = coalesce(nullif(btrim(cong_nhan_ten), ''), nullif(btrim(so_cong_nhan::text), ''))
    where cong_nhan_ten is null or btrim(cong_nhan_ten) = '';
    alter table public.bao_cao_ngay_cong_viec drop column so_cong_nhan;
  end if;
end $$;

comment on column public.bao_cao_ngay_cong_viec.cht_id is 'Nhân sự chức vụ CHT / Chỉ huy trưởng';
comment on column public.bao_cao_ngay_cong_viec.ky_su_id is 'Nhân sự chức vụ Kỹ sư';
comment on column public.bao_cao_ngay_cong_viec.lai_may_id is 'Nhân sự chức vụ Lái máy';
comment on column public.bao_cao_ngay_cong_viec.tho_van_hanh_id is 'Nhân sự chức vụ Thợ vận hành';
comment on column public.bao_cao_ngay_cong_viec.cong_nhan_id is 'Nhân sự chức vụ Công nhân';
