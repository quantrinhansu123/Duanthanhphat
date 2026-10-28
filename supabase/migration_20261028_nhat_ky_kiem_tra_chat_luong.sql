-- Giai đoạn 2. Chạy sau migration_20261028_nghiem_thu_moi_han.sql.
-- Không sửa kết quả lịch sử khi chạy migration, không tự tạo tiêu chí áp dụng.
begin;

create or replace view public.nhat_ky_han_chat_luong with (security_invoker = true) as
select b.*, cl.tinh_trang as tinh_trang_chat_luong, cl.phien_ban as phien_ban_chat_luong,
  to_jsonb(kt) as kiem_tra_chat_luong, to_jsonb(tc) as tieu_chuan_chat_luong
from public.bao_cao_moi_han_theo_du_an b
join public.chat_luong_moi_han cl on cl.moi_han_id = b.id
left join public.kiem_tra_moi_han kt on kt.moi_han_id = b.id
left join public.tieu_chuan_nghiem_thu_moi_han tc on tc.id = kt.tieu_chuan_id;
revoke all on public.nhat_ky_han_chat_luong from public, anon, authenticated;
grant select on public.nhat_ky_han_chat_luong to service_role;

create or replace function public.dong_bo_ndt_tu_kiem_tra_moi_han()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare required_ndt boolean; status text;
begin
  select yeu_cau_ndt into required_ndt from public.tieu_chuan_nghiem_thu_moi_han where id = new.tieu_chuan_id;
  if new.ket_qua_ndt is not null then status := new.ket_qua_ndt;
  elsif required_ndt = false then status := 'Không thí nghiệm';
  elsif required_ndt = true or (tg_op = 'UPDATE' and old.ket_qua_ndt is not null) then status := 'Chờ thí nghiệm';
  else return new;
  end if;
  -- Chỉ đồng bộ kết quả NDT sau khi người dùng ghi kiểm tra, không biến NDT thành nghiệm thu.
  update public.lich_su_moi_han set tinh_trang_thi_nghiem = status,
    so_luong_loi = case when status = 'Không đạt' then 1 else 0 end
  where id = new.moi_han_id and (tinh_trang_thi_nghiem is distinct from status
    or so_luong_loi is distinct from case when status = 'Không đạt' then 1 else 0 end);
  return new;
end $$;
revoke all on function public.dong_bo_ndt_tu_kiem_tra_moi_han() from public,anon,authenticated;
grant execute on function public.dong_bo_ndt_tu_kiem_tra_moi_han() to service_role;
drop trigger if exists trg_dong_bo_ndt_tu_kiem_tra on public.kiem_tra_moi_han;
create trigger trg_dong_bo_ndt_tu_kiem_tra after insert or update on public.kiem_tra_moi_han
  for each row execute function public.dong_bo_ndt_tu_kiem_tra_moi_han();

create or replace function public.bao_ve_ket_qua_ndt_da_ghi()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare ndt text;
begin
  if (new.tinh_trang_thi_nghiem,new.so_luong_loi) is distinct from (old.tinh_trang_thi_nghiem,old.so_luong_loi) then
    select ket_qua_ndt into ndt from public.kiem_tra_moi_han where moi_han_id = new.id;
    if ndt is not null and (new.tinh_trang_thi_nghiem is distinct from ndt
      or new.so_luong_loi is distinct from case when ndt = 'Không đạt' then 1 else 0 end) then
      raise exception 'Kết quả NDT đã được ghi ở Kiểm tra chất lượng; hãy cập nhật tại đó';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.bao_ve_ket_qua_ndt_da_ghi() from public,anon,authenticated;
grant execute on function public.bao_ve_ket_qua_ndt_da_ghi() to service_role;
drop trigger if exists trg_bao_ve_ket_qua_ndt_da_ghi on public.lich_su_moi_han;
create trigger trg_bao_ve_ket_qua_ndt_da_ghi before update on public.lich_su_moi_han
  for each row execute function public.bao_ve_ket_qua_ndt_da_ghi();
notify pgrst, 'reload schema';
commit;
