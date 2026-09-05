-- ============================================================
-- Storage bucket ảnh nhân sự (lấy từ ảnh trong chứng chỉ, cắt sẵn).
-- Chạy trong Supabase SQL Editor.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anh-nhan-su', 'anh-nhan-su', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png'];

drop policy if exists "anon_read_anh_nhan_su_storage" on storage.objects;
create policy "anon_read_anh_nhan_su_storage"
  on storage.objects for select to anon
  using (bucket_id = 'anh-nhan-su');

drop policy if exists "anon_insert_anh_nhan_su_storage" on storage.objects;
create policy "anon_insert_anh_nhan_su_storage"
  on storage.objects for insert to anon
  with check (bucket_id = 'anh-nhan-su');

drop policy if exists "anon_update_anh_nhan_su_storage" on storage.objects;
create policy "anon_update_anh_nhan_su_storage"
  on storage.objects for update to anon
  using (bucket_id = 'anh-nhan-su')
  with check (bucket_id = 'anh-nhan-su');

drop policy if exists "anon_delete_anh_nhan_su_storage" on storage.objects;
create policy "anon_delete_anh_nhan_su_storage"
  on storage.objects for delete to anon
  using (bucket_id = 'anh-nhan-su');

drop policy if exists "authenticated_all_anh_nhan_su_storage" on storage.objects;
create policy "authenticated_all_anh_nhan_su_storage"
  on storage.objects for all to authenticated
  using (bucket_id = 'anh-nhan-su')
  with check (bucket_id = 'anh-nhan-su');

notify pgrst, 'reload schema';
