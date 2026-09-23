-- Ảnh Cloudinary cho khối "Mối hàn liên kết" trên nhật ký hàn.
-- Mảng JSON: [{ publicId, secureUrl, name, bytes? }]
--
-- Lưu ý: CREATE OR REPLACE VIEW chỉ được THÊM cột ở CUỐI danh sách SELECT,
-- không được chèn giữa (sẽ lỗi 42P16 rename cột).

alter table public.lich_su_moi_han
  add column if not exists anh_moi_han_lien_ket jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lich_su_moi_han_anh_moi_han_lien_ket_array_check'
  ) then
    alter table public.lich_su_moi_han
      add constraint lich_su_moi_han_anh_moi_han_lien_ket_array_check
      check (jsonb_typeof(anh_moi_han_lien_ket) = 'array');
  end if;
end $$;

comment on column public.lich_su_moi_han.anh_moi_han_lien_ket is
  'Mảng metadata ảnh Cloudinary gắn với mối hàn liên kết / sửa hàn lại.';

-- Thêm cột mới ở cuối view (không đổi thứ tự cột cũ)
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
  ls.anh_moi_han_lien_ket
from public.lich_su_moi_han ls
join public.du_an da on da.id = ls.du_an_id
join public.nhan_su ns on ns.employee_id = ls.tho_han_id
left join public.thiet_bi tb on tb.id = ls.may_id;

grant select on public.bao_cao_moi_han_theo_du_an to anon, authenticated;
