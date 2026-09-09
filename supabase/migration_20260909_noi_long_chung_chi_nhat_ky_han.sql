-- ============================================================
-- Nới lỏng ràng buộc chứng chỉ khi ghi nhật ký hàn.
--
-- Yêu cầu nghiệp vụ mới: chỉ cần thợ hàn CÓ chứng chỉ đó trong hồ sơ là đủ —
-- KHÔNG kiểm tra "Còn hiệu lực" hay ngày hết hạn nữa.
--
-- Ứng dụng đã tự tạo bản ghi chung_chi trước khi lưu (ensureCertificateRecord),
-- nên migration này KHÔNG bắt buộc để lưu nhật ký. Chạy để chuẩn hóa dữ liệu và
-- nới lỏng trigger cho các đường ghi khác (import, RPC cũ).
--
-- Chạy sau: schema.sql, chung_chi_ho_so.sql, lien_ket_chung_chi_nhan_su_moi_han.sql
-- Chạy lại an toàn (idempotent). Không xóa dữ liệu.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Gộp chứng chỉ từ mọi nguồn sang public.chung_chi (chèn nếu thiếu).
-- ------------------------------------------------------------
insert into public.chung_chi (ten_chung_chi, ngay_cap, ngay_het_han, trang_thai, employee_id)
select distinct on (h.nhan_su_id, lower(btrim(h.ten_chung_chi)))
  btrim(h.ten_chung_chi), h.ngay_cap, h.ngay_het_han, 'Còn hiệu lực', h.nhan_su_id
from public.chung_chi_ho_so h
join public.nhan_su ns on ns.employee_id = h.nhan_su_id
where nullif(btrim(h.ten_chung_chi), '') is not null
  and not exists (
    select 1 from public.chung_chi cc
    where cc.employee_id = h.nhan_su_id
      and lower(btrim(cc.ten_chung_chi)) = lower(btrim(h.ten_chung_chi))
  )
order by h.nhan_su_id, lower(btrim(h.ten_chung_chi)), h.ngay_cap desc nulls last;

insert into public.chung_chi (ten_chung_chi, trang_thai, employee_id)
select distinct btrim(c.ten), 'Còn hiệu lực', ns.employee_id
from public.nhan_su ns
cross join lateral unnest(coalesce(ns.chung_chi, '{}'::text[])) as c(ten)
where nullif(btrim(c.ten), '') is not null
  and not exists (
    select 1 from public.chung_chi cc
    where cc.employee_id = ns.employee_id
      and lower(btrim(cc.ten_chung_chi)) = lower(btrim(c.ten))
  );

-- ------------------------------------------------------------
-- 2. Trigger nghiệp vụ: chỉ cần chứng chỉ thuộc đúng thợ hàn.
--    Bỏ kiểm tra trang_thai và ngay_het_han.
-- ------------------------------------------------------------
create or replace function public.kiem_tra_chung_chi_moi_han()
returns trigger
language plpgsql
as $$
begin
  if new.nguon_du_lieu is distinct from 'nhat-ky-han' then
    return new;
  end if;

  if nullif(btrim(new.chung_chi_su_dung), '') is null then
    return new;  -- không có chứng chỉ -> không ràng buộc
  end if;

  if new.chung_chi_id is not null then
    if not exists (
      select 1 from public.chung_chi cc
      where cc.id = new.chung_chi_id and cc.employee_id = new.tho_han_id
    ) then
      raise exception 'Chứng chỉ được chọn không thuộc hồ sơ của thợ hàn';
    end if;
    return new;
  end if;

  -- Chưa gắn id: tìm theo tên trong hồ sơ của thợ hàn (bất kể trạng thái/hạn).
  select cc.id into new.chung_chi_id
  from public.chung_chi cc
  where cc.employee_id = new.tho_han_id
    and lower(btrim(cc.ten_chung_chi)) = lower(btrim(new.chung_chi_su_dung))
  order by cc.created_at
  limit 1;

  if new.chung_chi_id is null then
    raise exception 'Thợ hàn được chọn chưa có chứng chỉ "%" trong hồ sơ', btrim(new.chung_chi_su_dung);
  end if;

  return new;
end;
$$;

commit;
