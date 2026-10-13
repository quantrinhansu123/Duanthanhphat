-- ============================================================
-- Bổ sung loại mối hàn: Chấp thuận, Tần suất
-- Thứ tự chuẩn: Đào tạo, Thử nghiệm, Chấp thuận, Sản xuất, Tần suất
-- Chạy trong: Supabase Dashboard → SQL Editor (có thể chạy lại an toàn).
-- ============================================================

-- 1. Nới ràng buộc loại mối hàn
alter table public.lich_su_moi_han
  drop constraint if exists lich_su_moi_han_loai_check;
alter table public.lich_su_moi_han
  add constraint lich_su_moi_han_loai_check
  check (loai_moi_han in ('Đào tạo', 'Thử nghiệm', 'Chấp thuận', 'Sản xuất', 'Tần suất'));

comment on column public.lich_su_moi_han.loai_moi_han is
  'Mục đích/nhóm mối hàn: Đào tạo, Thử nghiệm, Chấp thuận, Sản xuất hoặc Tần suất';

alter table public.tong_moi_han_nam_loai_moi
  drop constraint if exists tong_moi_han_nam_loai_check;
alter table public.tong_moi_han_nam_loai_moi
  add constraint tong_moi_han_nam_loai_check
  check (loai_moi_han in ('Đào tạo', 'Thử nghiệm', 'Chấp thuận', 'Sản xuất', 'Tần suất'));

-- 2. Cột tổng hợp cho 2 loại mới
alter table public.tong_moi_han_nam add column if not exists chap_thuan integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists tan_suat integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists loi_chap_thuan integer not null default 0;
alter table public.tong_moi_han_nam add column if not exists loi_tan_suat integer not null default 0;

alter table public.tong_moi_han_nam_du_an add column if not exists chap_thuan integer not null default 0;
alter table public.tong_moi_han_nam_du_an add column if not exists tan_suat integer not null default 0;

alter table public.tong_moi_han_nam_nhan_su add column if not exists chap_thuan integer not null default 0;
alter table public.tong_moi_han_nam_nhan_su add column if not exists tan_suat integer not null default 0;

alter table public.tong_moi_han_nam_phuong_phap add column if not exists chap_thuan integer not null default 0;
alter table public.tong_moi_han_nam_phuong_phap add column if not exists tan_suat integer not null default 0;

-- 3. Hàm đồng bộ tổng hợp năm (thêm Chấp thuận / Tần suất)
create or replace function public.dong_bo_tong_moi_han_nam()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  truncate public.tong_moi_han_nam;
  truncate public.tong_moi_han_nam_du_an;
  truncate public.tong_moi_han_nam_nhan_su;
  truncate public.tong_moi_han_nam_phuong_phap;
  truncate public.tong_moi_han_nam_loai_moi;

  -- Tổng năm
  insert into public.tong_moi_han_nam (
    nam, tong_moi_han, tong_loi, tong_dat,
    fbw, atw, loi_fbw, loi_atw,
    san_xuat, thu_nghiem, dao_tao, chap_thuan, tan_suat,
    loi_san_xuat, loi_thu_nghiem, loi_dao_tao, loi_chap_thuan, loi_tan_suat,
    updated_at
  )
  select
    nam_thuc_hien,
    coalesce(sum(so_luong_thuc_hien), 0)::integer,
    coalesce(sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) - sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Đào tạo'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Chấp thuận'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Tần suất'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Đào tạo'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Chấp thuận'), 0)::integer,
    coalesce(sum(so_luong_loi) filter (where loai_moi_han = 'Tần suất'), 0)::integer,
    now()
  from public.lich_su_moi_han
  group by nam_thuc_hien;

  -- Năm × dự án
  insert into public.tong_moi_han_nam_du_an (
    nam, du_an_id, ma_du_an, du_an,
    tong_moi_han, tong_loi, tong_dat, fbw, atw, loi_fbw, loi_atw,
    san_xuat, thu_nghiem, dao_tao, chap_thuan, tan_suat, updated_at
  )
  select
    ls.nam_thuc_hien,
    da.id,
    da.ma_du_an,
    da.du_an,
    coalesce(sum(ls.so_luong_thuc_hien), 0)::integer,
    coalesce(sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) - sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Đào tạo'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Chấp thuận'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Tần suất'), 0)::integer,
    now()
  from public.lich_su_moi_han ls
  join public.du_an da on da.id = ls.du_an_id
  group by ls.nam_thuc_hien, da.id, da.ma_du_an, da.du_an;

  -- Năm × nhân sự
  insert into public.tong_moi_han_nam_nhan_su (
    nam, tho_han_id, ma_nhan_su, ten_tho_han,
    tong_moi_han, tong_loi, tong_dat, fbw, atw, loi_fbw, loi_atw,
    san_xuat, thu_nghiem, dao_tao, chap_thuan, tan_suat, updated_at
  )
  select
    ls.nam_thuc_hien,
    ns.employee_id,
    ns.ma_nhan_su,
    ns.ho_ten,
    coalesce(sum(ls.so_luong_thuc_hien), 0)::integer,
    coalesce(sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) - sum(ls.so_luong_loi), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(ls.so_luong_loi) filter (where ls.cong_nghe_han = 'ATW'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Đào tạo'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Chấp thuận'), 0)::integer,
    coalesce(sum(ls.so_luong_thuc_hien) filter (where ls.loai_moi_han = 'Tần suất'), 0)::integer,
    now()
  from public.lich_su_moi_han ls
  join public.nhan_su ns on ns.employee_id = ls.tho_han_id
  group by ls.nam_thuc_hien, ns.employee_id, ns.ma_nhan_su, ns.ho_ten;

  -- Năm × phương pháp hàn
  insert into public.tong_moi_han_nam_phuong_phap (
    nam, cong_nghe_han, tong_moi_han, tong_loi, tong_dat,
    san_xuat, thu_nghiem, dao_tao, chap_thuan, tan_suat, updated_at
  )
  select
    nam_thuc_hien,
    cong_nghe_han,
    coalesce(sum(so_luong_thuc_hien), 0)::integer,
    coalesce(sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) - sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Sản xuất'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Thử nghiệm'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Đào tạo'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Chấp thuận'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where loai_moi_han = 'Tần suất'), 0)::integer,
    now()
  from public.lich_su_moi_han
  group by nam_thuc_hien, cong_nghe_han;

  -- Năm × loại mối hàn
  insert into public.tong_moi_han_nam_loai_moi (
    nam, loai_moi_han, tong_moi_han, tong_loi, tong_dat, fbw, atw, updated_at
  )
  select
    nam_thuc_hien,
    loai_moi_han,
    coalesce(sum(so_luong_thuc_hien), 0)::integer,
    coalesce(sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) - sum(so_luong_loi), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'FBW'), 0)::integer,
    coalesce(sum(so_luong_thuc_hien) filter (where cong_nghe_han = 'ATW'), 0)::integer,
    now()
  from public.lich_su_moi_han
  group by nam_thuc_hien, loai_moi_han;
end;
$$;

grant execute on function public.dong_bo_tong_moi_han_nam() to authenticated, anon;

select public.dong_bo_tong_moi_han_nam();

notify pgrst, 'reload schema';
