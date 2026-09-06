-- Người đào tạo được nhập tự do; một khóa có thể có nhiều ảnh, video và tài liệu.

alter table public.dao_tao
  add column if not exists nguoi_dao_tao_ten text,
  add column if not exists tai_lieu jsonb not null default '[]'::jsonb;

alter table public.dao_tao
  drop constraint if exists dao_tao_tai_lieu_array_check;
alter table public.dao_tao
  add constraint dao_tao_tai_lieu_array_check
  check (jsonb_typeof(tai_lieu) = 'array');

update public.dao_tao dt
set nguoi_dao_tao_ten = ns.ho_ten
from public.nhan_su ns
where ns.employee_id = dt.nguoi_dao_tao
  and nullif(btrim(dt.nguoi_dao_tao_ten), '') is null;

create or replace function public.luu_khoa_dao_tao_va_cap_chung_chi_v2(
  p_dao_tao_id uuid,
  p_ten_khoa_hoc text,
  p_ngay date,
  p_thoi_luong text,
  p_dia_diem text,
  p_mo_ta text,
  p_nguoi_dao_tao uuid,
  p_ket_qua_khoa text,
  p_hinh_anh text,
  p_cloudinary_public_id text,
  p_secure_url text,
  p_nhom_chung_chi_id uuid,
  p_topics text[],
  p_hoc_vien jsonb,
  p_nguoi_dao_tao_ten text,
  p_tai_lieu jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  course_id uuid;
begin
  if jsonb_typeof(coalesce(p_tai_lieu, '[]'::jsonb)) <> 'array' then
    raise exception 'Danh sách tài liệu phải là mảng JSON';
  end if;

  course_id := public.luu_khoa_dao_tao_va_cap_chung_chi(
    p_dao_tao_id,
    p_ten_khoa_hoc,
    p_ngay,
    p_thoi_luong,
    p_dia_diem,
    p_mo_ta,
    p_nguoi_dao_tao,
    p_ket_qua_khoa,
    p_hinh_anh,
    p_cloudinary_public_id,
    p_secure_url,
    p_nhom_chung_chi_id,
    p_topics,
    p_hoc_vien
  );

  update public.dao_tao
  set nguoi_dao_tao_ten = nullif(btrim(p_nguoi_dao_tao_ten), ''),
      tai_lieu = coalesce(p_tai_lieu, '[]'::jsonb),
      updated_at = now()
  where id = course_id;

  if not found then
    raise exception 'Không tìm thấy khóa đào tạo vừa lưu %', course_id;
  end if;
  return course_id;
end;
$$;

revoke execute on function public.luu_khoa_dao_tao_va_cap_chung_chi_v2(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb, text, jsonb
) from public;
grant execute on function public.luu_khoa_dao_tao_va_cap_chung_chi_v2(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb, text, jsonb
) to anon, authenticated;

comment on column public.dao_tao.nguoi_dao_tao_ten is
  'Tên người đào tạo nhập tự do, không bắt buộc thuộc bảng nhân sự.';
comment on column public.dao_tao.tai_lieu is
  'Mảng metadata Cloudinary của ảnh, video và tài liệu đính kèm khóa học.';
