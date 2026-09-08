-- Giữ kế hoạch theo ngày do ứng dụng gửi lên để các ngày nghỉ có sản lượng bằng 0.
-- Nếu caller không gửi kế hoạch tường minh, trigger vẫn tự chia đều như trước.
create or replace function public.tao_ke_hoach_moi_han_theo_ngay()
returns trigger
language plpgsql
as $$
declare
  so_ngay integer;
  moi_han_co_ban integer;
  so_du integer;
begin
  if new.ngay_bat_dau is null
     or new.ngay_ket_thuc is null
     or new.ngay_ket_thuc < new.ngay_bat_dau
     or coalesce(new.tong_moi_han_du_kien, 0) <= 0 then
    new.tien_do_ly_thuyet = '[]'::jsonb;
    return new;
  end if;

  if jsonb_typeof(coalesce(new.tien_do_ly_thuyet, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(new.tien_do_ly_thuyet, '[]'::jsonb)) > 0 then
    if tg_op = 'INSERT' then
      return new;
    end if;
    if tg_op = 'UPDATE' and new.tien_do_ly_thuyet is distinct from old.tien_do_ly_thuyet then
      return new;
    end if;
  end if;

  so_ngay = (new.ngay_ket_thuc - new.ngay_bat_dau) + 1;
  moi_han_co_ban = new.tong_moi_han_du_kien / so_ngay;
  so_du = new.tong_moi_han_du_kien % so_ngay;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ngay', (new.ngay_bat_dau + ngay_thu)::text,
        'so_moi_han', moi_han_co_ban + case when ngay_thu < so_du then 1 else 0 end
      )
      order by ngay_thu
    ),
    '[]'::jsonb
  )
  into new.tien_do_ly_thuyet
  from generate_series(0, so_ngay - 1) as series(ngay_thu);

  return new;
end;
$$;

notify pgrst, 'reload schema';
