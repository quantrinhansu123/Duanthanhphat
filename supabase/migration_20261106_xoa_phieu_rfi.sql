begin;

-- Serialize with acceptance completion, which also locks the RFI row.
create or replace function public.xoa_phieu_rfi(p_id uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  perform 1 from public.phieu_yeu_cau_nghiem_thu where id = p_id for update;
  if not found then raise exception 'Phiếu không còn tồn tại; hãy tải lại danh sách.'; end if;
  perform 1 from public.dot_nghiem_thu where phieu_id = p_id order by id for update;
  perform 1 from public.ho_so_nghiem_thu h
    join public.dot_nghiem_thu d on d.id = h.dot_id
    where d.phieu_id = p_id order by h.id for update of h;

  if exists (select 1 from public.dot_nghiem_thu
      where phieu_id = p_id and coalesce(thong_tin->>'draft', '') <> 'true')
    or exists (select 1 from public.dot_nghiem_thu_moi m
      join public.dot_nghiem_thu d on d.id = m.dot_id
      where d.phieu_id = p_id and m.ket_qua <> 'Chưa nghiệm thu')
    or exists (select 1 from public.ho_so_nghiem_thu h
      join public.dot_nghiem_thu d on d.id = h.dot_id
      where d.phieu_id = p_id and h.tinh_trang_ky = 'Đã ký')
    or exists (select 1 from public.ho_so_nghiem_thu_sua_doi s
      join public.ho_so_nghiem_thu h on h.id = s.ho_so_id
      join public.dot_nghiem_thu d on d.id = h.dot_id where d.phieu_id = p_id)
  then raise exception 'Không thể xóa phiếu đã có kết quả nghiệm thu, hồ sơ đã ký hoặc lịch sử sửa đổi.';
  end if;

  delete from public.ho_so_nghiem_thu where dot_id in (select id from public.dot_nghiem_thu where phieu_id = p_id);
  delete from public.dot_nghiem_thu_moi where dot_id in (select id from public.dot_nghiem_thu where phieu_id = p_id);
  delete from public.dot_nghiem_thu where phieu_id = p_id;
  delete from public.phieu_yeu_cau_nghiem_thu_moi where phieu_id = p_id;
  delete from public.phieu_yeu_cau_nghiem_thu where id = p_id;
end $$;

revoke all on function public.xoa_phieu_rfi(uuid) from public, anon, authenticated;
grant execute on function public.xoa_phieu_rfi(uuid) to service_role;
commit;
