-- Nhật ký ghi nhận nghiệm thu theo TỪNG MỐI: mối được duyệt lẻ (phiếu chưa đóng vì còn mối chưa có kết quả)
-- vẫn vào nhật ký đúng ngày duyệt. Trước đây nhật ký chỉ lấy mối của phiếu đã đóng (phieu_nt_tach.ngay_nghiem_thu).
-- Chạy lại nhiều lần không sao.
begin;

alter table public.phieu_nt_tach_moi add column if not exists ngay_nghiem_thu date;

create index if not exists phieu_nt_tach_moi_ngay_nghiem_thu_idx
  on public.phieu_nt_tach_moi (ngay_nghiem_thu, phieu_id)
  where ngay_nghiem_thu is not null;

-- Phiếu đã đóng: mọi mối đã có kết quả lấy ngày đóng phiếu.
update public.phieu_nt_tach_moi m
set ngay_nghiem_thu = p.ngay_nghiem_thu
from public.phieu_nt_tach p
where m.phieu_id = p.id
  and p.ngay_nghiem_thu is not null
  and m.ket_qua is not null
  and m.ngay_nghiem_thu is null;

-- Mối duyệt lẻ TRƯỚC khi có cột này (phiếu chưa đóng) không biết ngày duyệt → để trống.
-- Muốn ghi nhận vào nhật ký một ngày cụ thể, chạy tay (ví dụ phiếu RFI-017-SA duyệt ngày 21/11/2026):
--   update public.phieu_nt_tach_moi m set ngay_nghiem_thu = date '2026-11-21'
--   from public.phieu_nt_tach p
--   where m.phieu_id = p.id and p.so_phieu = 'RFI-017-SA' and m.ket_qua is not null and m.ngay_nghiem_thu is null;

-- Bản 20261119 + ghi ngày duyệt cho đúng các mối vừa được ghi kết quả.
create or replace function public.chot_phieu_nt_tach(p_id uuid, p_ngay date, p_ket_qua jsonb, p_actor text)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare
  p phieu_nt_tach;
  n int;
  n_submit int;
  updated_count int;
  n_done int;
begin
  select * into strict p from phieu_nt_tach where id = p_id for update;
  if p.ngay_nghiem_thu is not null then raise exception 'Dữ liệu đã thay đổi: phiếu đã chốt.'; end if;
  if p_ngay is null or p_ngay < p.ngay_moi then raise exception 'Ngày nghiệm thu không hợp lệ.'; end if;
  select count(*) into n from phieu_nt_tach_moi where phieu_id = p_id;
  if jsonb_typeof(p_ket_qua) is distinct from 'array' then raise exception 'Danh sách kết quả không hợp lệ.'; end if;
  n_submit := jsonb_array_length(p_ket_qua);
  if n_submit < 1 or n_submit > n then raise exception 'Danh sách kết quả thiếu hoặc thừa mối.'; end if;

  perform 1 from lich_su_moi_han
    where id in (select moi_han_id from phieu_nt_tach_moi where phieu_id = p_id)
    order by id for update;

  update phieu_nt_tach_moi m
  set ket_qua = r.ket_qua,
      ly_do = nullif(trim(r.ly_do), ''),
      ngay_nghiem_thu = p_ngay,
      du_lieu_chot = m.du_lieu_chot || coalesce(to_jsonb(q), '{}'::jsonb) || to_jsonb(kt)
  from jsonb_to_recordset(p_ket_qua) as r(id uuid, ket_qua text, ly_do text, phien_ban int)
  join kiem_tra_moi_han kt on kt.moi_han_id = r.id and kt.phien_ban = r.phien_ban
  left join ung_vien_nt_tach q on q.moi_han_id = r.id and q.du_an_id = p.du_an_id and q.loai = p.loai
  where m.phieu_id = p_id
    and m.moi_han_id = r.id
    and m.ket_qua is null
    and (
      (r.ket_qua = 'Không đạt' and nullif(trim(r.ly_do), '') is not null)
      or (
        r.ket_qua = 'Đạt' and q.co_the_dat
        and case when p.loai = 'sieu-am' then q.ngay_ndt <= p_ngay else q.ngay_mai <= p_ngay end
      )
    );

  get diagnostics updated_count = row_count;
  if updated_count <> n_submit then
    raise exception 'Danh sách kết quả chưa đủ điều kiện, thiếu lý do, đã chốt trước đó hoặc phiên bản đã thay đổi.';
  end if;

  if p.loai = 'sieu-am' then
    update lich_su_moi_han ls
    set so_luong_loi = ls.so_luong_thuc_hien,
        tinh_trang_thi_nghiem = 'Không đạt',
        nguyen_nhan_loi = coalesce(nullif(trim(ls.nguyen_nhan_loi), ''), 'Siêu âm không đạt: ' || coalesce(m.ly_do, ''))
    from phieu_nt_tach_moi m
    where m.phieu_id = p_id
      and m.moi_han_id = ls.id
      and m.ket_qua = 'Không đạt';
  end if;

  select count(*) into n_done from phieu_nt_tach_moi where phieu_id = p_id and ket_qua is not null;
  if n_done = n then
    update phieu_nt_tach set ngay_nghiem_thu = p_ngay, nguoi_nghiem_thu = p_actor where id = p_id;
  end if;

  return p_id;
end $$;

revoke all on function public.chot_phieu_nt_tach(uuid, date, jsonb, text) from public, anon, authenticated;
grant execute on function public.chot_phieu_nt_tach(uuid, date, jsonb, text) to service_role;

notify pgrst, 'reload schema';
commit;
