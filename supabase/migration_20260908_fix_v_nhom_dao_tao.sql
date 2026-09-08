-- Fix: không đọc v_nhom khi chưa chọn nhóm chứng chỉ
-- Lỗi: record "v_nhom" is not assigned yet
-- Nguyên nhân: PL/pgSQL đánh giá mọi biến trong điều kiện AND trước khi short-circuit

create or replace function public.luu_khoa_dao_tao_va_cap_chung_chi(
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
  p_hoc_vien jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_dao_tao_id uuid := p_dao_tao_id;
  v_hv record;
  v_nhom record;
  v_has_nhom boolean := false;
  v_chung_chi_id uuid;
  v_old_chung_chi_id uuid;
begin
  if nullif(btrim(p_ten_khoa_hoc), '') is null then
    raise exception 'Tên khóa đào tạo không được để trống';
  end if;

  if v_dao_tao_id is null then
    insert into public.dao_tao (
      ten_khoa_hoc,
      ngay,
      thoi_luong,
      dia_diem,
      mo_ta,
      nguoi_dao_tao,
      ket_qua,
      hinh_anh,
      cloudinary_public_id,
      secure_url,
      nhom_chung_chi_id,
      topics
    ) values (
      btrim(p_ten_khoa_hoc),
      p_ngay,
      nullif(btrim(p_thoi_luong), ''),
      nullif(btrim(p_dia_diem), ''),
      nullif(btrim(p_mo_ta), ''),
      p_nguoi_dao_tao,
      p_ket_qua_khoa,
      nullif(btrim(p_hinh_anh), ''),
      nullif(btrim(p_cloudinary_public_id), ''),
      nullif(btrim(p_secure_url), ''),
      p_nhom_chung_chi_id,
      coalesce(p_topics, '{}'::text[])
    ) returning id into v_dao_tao_id;
  else
    update public.dao_tao
    set ten_khoa_hoc = btrim(p_ten_khoa_hoc),
        ngay = p_ngay,
        thoi_luong = nullif(btrim(p_thoi_luong), ''),
        dia_diem = nullif(btrim(p_dia_diem), ''),
        mo_ta = nullif(btrim(p_mo_ta), ''),
        nguoi_dao_tao = p_nguoi_dao_tao,
        ket_qua = p_ket_qua_khoa,
        hinh_anh = nullif(btrim(p_hinh_anh), ''),
        cloudinary_public_id = nullif(btrim(p_cloudinary_public_id), ''),
        secure_url = nullif(btrim(p_secure_url), ''),
        nhom_chung_chi_id = p_nhom_chung_chi_id,
        topics = coalesce(p_topics, topics),
        updated_at = now()
    where id = v_dao_tao_id;
    if not found then
      raise exception 'Không tìm thấy khóa đào tạo %', v_dao_tao_id;
    end if;
  end if;

  if p_nhom_chung_chi_id is not null then
    select * into strict v_nhom from public.chung_chi_nhom where id = p_nhom_chung_chi_id;
    v_has_nhom := true;
  end if;

  update public.chung_chi cc
  set trang_thai = 'Thu hồi', updated_at = now()
  where cc.khoa_dao_tao_nguon = v_dao_tao_id
    and exists (
      select 1
      from public.dao_tao_hoc_vien old_hv
      where old_hv.dao_tao_id = v_dao_tao_id
        and old_hv.employee_id = cc.employee_id
        and not exists (
          select 1
          from jsonb_to_recordset(coalesce(p_hoc_vien, '[]'::jsonb)) as incoming(employee_id uuid)
          where incoming.employee_id = old_hv.employee_id
        )
    );

  delete from public.dao_tao_hoc_vien old_hv
  where old_hv.dao_tao_id = v_dao_tao_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_hoc_vien, '[]'::jsonb)) as incoming(employee_id uuid)
      where incoming.employee_id = old_hv.employee_id
    );

  if p_hoc_vien is not null and jsonb_array_length(p_hoc_vien) > 0 then
    for v_hv in select * from jsonb_to_recordset(p_hoc_vien) as x(
      employee_id uuid,
      ket_qua text,
      trang_thai text
    ) loop
      v_chung_chi_id := null;
      v_old_chung_chi_id := null;

      select chung_chi_id into v_old_chung_chi_id
      from public.dao_tao_hoc_vien
      where dao_tao_id = v_dao_tao_id and employee_id = v_hv.employee_id;

      if v_old_chung_chi_id is not null then
        update public.chung_chi
        set trang_thai = 'Thu hồi', updated_at = now()
        where id = v_old_chung_chi_id
          and khoa_dao_tao_nguon = v_dao_tao_id
          and (
            v_hv.ket_qua is distinct from 'Đạt'
            or nhom_id is distinct from p_nhom_chung_chi_id
          );
      end if;

      -- Chỉ cấp chứng chỉ khi đã load được nhóm; không đọc v_nhom khi chưa gán
      if v_hv.ket_qua = 'Đạt' and v_has_nhom then
        select id into v_chung_chi_id
        from public.chung_chi
        where employee_id = v_hv.employee_id
          and nhom_id = p_nhom_chung_chi_id
          and (
            (trang_thai = 'Còn hiệu lực' and (ngay_het_han is null or ngay_het_han >= current_date))
            or khoa_dao_tao_nguon = v_dao_tao_id
          )
        order by (khoa_dao_tao_nguon = v_dao_tao_id) desc, created_at desc
        limit 1;

        if v_chung_chi_id is null then
          insert into public.chung_chi (
            employee_id,
            ten_chung_chi,
            nhom_id,
            don_vi_cap,
            may_ap_dung,
            ngay_cap,
            ngay_het_han,
            trang_thai,
            khoa_dao_tao_nguon,
            file_chung_chi,
            cloudinary_public_id,
            secure_url,
            ghi_chu
          ) values (
            v_hv.employee_id,
            v_nhom.ten_nhom,
            p_nhom_chung_chi_id,
            v_nhom.don_vi_cap,
            v_nhom.may_ap_dung,
            coalesce(v_nhom.ngay_cap, p_ngay),
            v_nhom.ngay_het_han,
            'Còn hiệu lực',
            v_dao_tao_id,
            v_nhom.file_chung_chi,
            v_nhom.cloudinary_public_id,
            v_nhom.secure_url,
            'Cấp từ khóa đào tạo: ' || p_ten_khoa_hoc
          ) returning id into v_chung_chi_id;
        else
          update public.chung_chi
          set ten_chung_chi = v_nhom.ten_nhom,
              don_vi_cap = v_nhom.don_vi_cap,
              may_ap_dung = v_nhom.may_ap_dung,
              ngay_cap = coalesce(v_nhom.ngay_cap, p_ngay),
              ngay_het_han = v_nhom.ngay_het_han,
              trang_thai = 'Còn hiệu lực',
              file_chung_chi = v_nhom.file_chung_chi,
              cloudinary_public_id = v_nhom.cloudinary_public_id,
              secure_url = v_nhom.secure_url,
              updated_at = now()
          where id = v_chung_chi_id and khoa_dao_tao_nguon = v_dao_tao_id;
        end if;
      end if;

      insert into public.dao_tao_hoc_vien (
        dao_tao_id,
        employee_id,
        ket_qua,
        trang_thai,
        chung_chi_id,
        updated_at
      ) values (
        v_dao_tao_id,
        v_hv.employee_id,
        coalesce(v_hv.ket_qua, 'Đang học'),
        coalesce(v_hv.trang_thai, 'Đang học'),
        v_chung_chi_id,
        now()
      )
      on conflict (dao_tao_id, employee_id) do update set
        ket_qua = excluded.ket_qua,
        trang_thai = excluded.trang_thai,
        chung_chi_id = excluded.chung_chi_id,
        updated_at = now();
    end loop;
  end if;

  update public.dao_tao
  set nguoi_tham_gia = coalesce((
        select array_agg(hv.employee_id order by hv.created_at, hv.employee_id)
        from public.dao_tao_hoc_vien hv
        where hv.dao_tao_id = v_dao_tao_id
      ), '{}'::uuid[]),
      updated_at = now()
  where id = v_dao_tao_id;

  return v_dao_tao_id;
end;
$$;
