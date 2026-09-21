-- ============================================================
-- Fix: sửa/thêm nhật ký hàn bị lỗi RLS trên bảng tổng hợp
--   thong_ke_moi_han_theo_ngay
--
-- Nguyên nhân: trigger sync_thong_ke_moi_han_theo_ngay chạy với
-- quyền caller (anon). Bảng tổng hợp chỉ có policy ghi cho
-- authenticated → INSERT/UPDATE nhật ký fail với:
--   "new row violates row-level security policy for table
--    thong_ke_moi_han_theo_ngay"
--
-- Cách xử lý:
-- 1) Hàm trigger SECURITY DEFINER (chuẩn cho bảng tổng hợp)
-- 2) Mở policy ghi cho anon (đồng bộ kiểu rls_anon_dev của project)
-- Có thể chạy lại an toàn.
-- ============================================================

create or replace function public.sync_thong_ke_moi_han_theo_ngay()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_status text;
  d_rework int;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    if old.ngay_thuc_hien is not null then
      d_status := old.tinh_trang_thi_nghiem;
      d_rework := case when nullif(btrim(old.moi_han_lien_ket), '') is not null then 1 else 0 end;

      update public.thong_ke_moi_han_theo_ngay
      set so_moi = so_moi - 1,
          so_dat = so_dat - (case when d_status = 'Đạt' then 1 else 0 end),
          so_khong_dat = so_khong_dat - (case when d_status = 'Không đạt' then 1 else 0 end),
          so_cho_tn = so_cho_tn - (case when d_status = 'Chờ thí nghiệm' then 1 else 0 end),
          so_khong_tn = so_khong_tn - (case when d_status = 'Không thí nghiệm' then 1 else 0 end),
          so_han_lai = so_han_lai - d_rework,
          updated_at = now()
      where ngay_thuc_hien = old.ngay_thuc_hien
        and du_an_id = old.du_an_id
        and cong_nghe_han = old.cong_nghe_han
        and loai_moi_han = old.loai_moi_han;

      delete from public.thong_ke_moi_han_theo_ngay
      where ngay_thuc_hien = old.ngay_thuc_hien
        and du_an_id = old.du_an_id
        and cong_nghe_han = old.cong_nghe_han
        and loai_moi_han = old.loai_moi_han
        and so_moi <= 0;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.ngay_thuc_hien is not null then
      d_status := new.tinh_trang_thi_nghiem;
      d_rework := case when nullif(btrim(new.moi_han_lien_ket), '') is not null then 1 else 0 end;

      insert into public.thong_ke_moi_han_theo_ngay
        (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han, so_moi, so_dat, so_khong_dat, so_cho_tn, so_khong_tn, so_han_lai)
      values
        (new.ngay_thuc_hien, new.du_an_id, new.cong_nghe_han, new.loai_moi_han, 1,
         case when d_status = 'Đạt' then 1 else 0 end,
         case when d_status = 'Không đạt' then 1 else 0 end,
         case when d_status = 'Chờ thí nghiệm' then 1 else 0 end,
         case when d_status = 'Không thí nghiệm' then 1 else 0 end,
         d_rework)
      on conflict (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han)
      do update set
        so_moi = thong_ke_moi_han_theo_ngay.so_moi + excluded.so_moi,
        so_dat = thong_ke_moi_han_theo_ngay.so_dat + excluded.so_dat,
        so_khong_dat = thong_ke_moi_han_theo_ngay.so_khong_dat + excluded.so_khong_dat,
        so_cho_tn = thong_ke_moi_han_theo_ngay.so_cho_tn + excluded.so_cho_tn,
        so_khong_tn = thong_ke_moi_han_theo_ngay.so_khong_tn + excluded.so_khong_tn,
        so_han_lai = thong_ke_moi_han_theo_ngay.so_han_lai + excluded.so_han_lai,
        updated_at = now();
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_thong_ke_moi_han_theo_ngay() from public;
grant execute on function public.sync_thong_ke_moi_han_theo_ngay() to anon, authenticated, service_role;

drop policy if exists "anon_write_thong_ke_moi_han_theo_ngay" on public.thong_ke_moi_han_theo_ngay;
create policy "anon_write_thong_ke_moi_han_theo_ngay"
  on public.thong_ke_moi_han_theo_ngay for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.thong_ke_moi_han_theo_ngay to anon;
