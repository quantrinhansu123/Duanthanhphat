-- ============================================================
-- Thêm gio_nghi_trua vào view bao_cao_moi_han_theo_du_an
-- (cột đã có trên lich_su_moi_han từ migration_20261027 nhưng view chưa lộ).
-- Chạy trong: Supabase Dashboard → SQL Editor (idempotent).
-- Chỉ THÊM cột ở CUỐI view (tránh lỗi 42P16 đổi thứ tự cột).
-- ============================================================

alter table public.lich_su_moi_han
  add column if not exists gio_nghi_trua numeric(4,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lich_su_moi_han_gio_nghi_trua_check'
      and conrelid = 'public.lich_su_moi_han'::regclass
  ) then
    alter table public.lich_su_moi_han
      add constraint lich_su_moi_han_gio_nghi_trua_check
      check (gio_nghi_trua >= 0 and gio_nghi_trua <= 8);
  end if;
end $$;

create or replace view public.bao_cao_moi_han_theo_du_an with (security_invoker = true) as
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
  ls.moi_han_lien_ket,
  tb.id as may_id,
  tb.ma_may,
  tb.ten_may,
  ns.to_han,
  ns.chung_chi as chung_chi_nhan_su,
  ls.chung_chi_su_dung,
  ls.ngay_thuc_hien,
  ls.chung_chi_id,
  ls.hach_toan,
  ls.ma_khuyet_tat,
  ls.tinh_trang_thi_nghiem,
  ls.created_at,
  ls.anh_moi_han_lien_ket,
  ls.ca_han,
  ls.gio_han,
  ls.ten_moi_han_theo_may,
  ls.ma_hien_truong,
  ls.gio_bat_dau,
  ls.gio_ket_thuc,
  ls.gio_nghi_trua
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;

-- View chất lượng lấy b.* — DROP rồi CREATE vì CREATE OR REPLACE không chèn cột
-- giữa b.* và các cột chất lượng (lỗi 42P16 / RENAME COLUMN).
do $$
begin
  if to_regclass('public.chat_luong_moi_han') is null then
    return;
  end if;
  execute 'drop view if exists public.nhat_ky_han_chat_luong';
  execute $v$
    create view public.nhat_ky_han_chat_luong with (security_invoker = true) as
    select b.*, cl.tinh_trang as tinh_trang_chat_luong, cl.phien_ban as phien_ban_chat_luong,
      to_jsonb(kt) as kiem_tra_chat_luong, to_jsonb(tc) as tieu_chuan_chat_luong
    from public.bao_cao_moi_han_theo_du_an b
    join public.chat_luong_moi_han cl on cl.moi_han_id = b.id
    left join public.kiem_tra_moi_han kt on kt.moi_han_id = b.id
    left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id
  $v$;
  revoke all on public.nhat_ky_han_chat_luong from public, anon, authenticated;
  grant select on public.nhat_ky_han_chat_luong to service_role;
end $$;

notify pgrst, 'reload schema';
