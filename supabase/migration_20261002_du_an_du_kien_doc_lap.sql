-- Mối hàn dự kiến của dự án đứng riêng với nhật ký hàn.
-- Sửa, thêm hoặc xóa nhật ký không còn ghi đè lịch và tổng mối hàn dự kiến.

drop trigger if exists trg_dong_bo_dinh_muc_sau_insert on public.lich_su_moi_han;
drop trigger if exists trg_dong_bo_dinh_muc_sau_delete on public.lich_su_moi_han;
drop trigger if exists trg_dong_bo_dinh_muc_sau_update on public.lich_su_moi_han;

create or replace function public.dong_bo_dinh_muc_moi_han(p_du_an_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Không đồng bộ từ nhật ký. Kế hoạch dự án chỉ đổi khi sửa trên bảng dự án.
  return;
end;
$$;

create or replace function public.dong_bo_dinh_muc_moi_han_tat_ca()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return 0;
end;
$$;

comment on function public.dong_bo_dinh_muc_moi_han(uuid) is
  'Đã tắt. Mối hàn dự kiến của dự án không còn lấy từ nhật ký hàn.';

notify pgrst, 'reload schema';
