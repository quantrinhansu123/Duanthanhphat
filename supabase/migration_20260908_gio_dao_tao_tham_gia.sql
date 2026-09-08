-- Tổng giờ đào tạo NSX / tự đào tạo + tổng người tham gia trên khóa đào tạo

alter table public.dao_tao
  add column if not exists tong_gio_nha_san_xuat numeric(10, 2) not null default 0
    check (tong_gio_nha_san_xuat >= 0),
  add column if not exists tong_gio_tu_dao_tao numeric(10, 2) not null default 0
    check (tong_gio_tu_dao_tao >= 0),
  add column if not exists tong_nguoi_tham_gia integer not null default 0
    check (tong_nguoi_tham_gia >= 0);

comment on column public.dao_tao.tong_gio_nha_san_xuat is
  'Tổng số giờ đào tạo bởi nhà sản xuất';
comment on column public.dao_tao.tong_gio_tu_dao_tao is
  'Tổng số giờ tự đào tạo';
comment on column public.dao_tao.tong_nguoi_tham_gia is
  'Tổng số người tham gia đào tạo (nhập tay, có thể khác danh sách học viên cấp chứng chỉ)';

-- Mở rộng RPC v2: lưu thêm 3 trường sau khi lưu khóa học
drop function if exists public.luu_khoa_dao_tao_va_cap_chung_chi_v2(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb, text, jsonb
);

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
  p_tai_lieu jsonb default '[]'::jsonb,
  p_tong_gio_nha_san_xuat numeric default 0,
  p_tong_gio_tu_dao_tao numeric default 0,
  p_tong_nguoi_tham_gia integer default 0
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
      tong_gio_nha_san_xuat = greatest(coalesce(p_tong_gio_nha_san_xuat, 0), 0),
      tong_gio_tu_dao_tao = greatest(coalesce(p_tong_gio_tu_dao_tao, 0), 0),
      tong_nguoi_tham_gia = greatest(coalesce(p_tong_nguoi_tham_gia, 0), 0),
      updated_at = now()
  where id = course_id;

  if not found then
    raise exception 'Không tìm thấy khóa đào tạo vừa lưu %', course_id;
  end if;
  return course_id;
end;
$$;

revoke execute on function public.luu_khoa_dao_tao_va_cap_chung_chi_v2(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb, text, jsonb, numeric, numeric, integer
) from public;
grant execute on function public.luu_khoa_dao_tao_va_cap_chung_chi_v2(
  uuid, text, date, text, text, text, uuid, text, text, text, text, uuid, text[], jsonb, text, jsonb, numeric, numeric, integer
) to anon, authenticated;
