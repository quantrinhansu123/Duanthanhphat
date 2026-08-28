-- Cho phép anon đọc/ghi tạm thời (dev, chưa có Auth login)
-- Chạy sau schema.sql nếu app dùng anon key trực tiếp

drop policy if exists "anon_all_nhan_su" on public.nhan_su;
create policy "anon_all_nhan_su"
  on public.nhan_su for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_du_an" on public.du_an;
create policy "anon_all_du_an"
  on public.du_an for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_thiet_bi" on public.thiet_bi;
create policy "anon_all_thiet_bi"
  on public.thiet_bi for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_nhat_ky_chay_may" on public.nhat_ky_chay_may;
create policy "anon_all_nhat_ky_chay_may"
  on public.nhat_ky_chay_may for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_thong_so_moi_han" on public.thong_so_moi_han;
create policy "anon_all_thong_so_moi_han"
  on public.thong_so_moi_han for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_dao_tao" on public.dao_tao;
create policy "anon_all_dao_tao"
  on public.dao_tao for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_chung_chi" on public.chung_chi;
create policy "anon_all_chung_chi"
  on public.chung_chi for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_nhan_su_du_an" on public.nhan_su_du_an;
create policy "anon_all_nhan_su_du_an"
  on public.nhan_su_du_an for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_toa_do" on public.toa_do;
create policy "anon_all_toa_do"
  on public.toa_do for all to anon
  using (true) with check (true);

drop policy if exists "anon_all_tai_lieu" on public.tai_lieu;
create policy "anon_all_tai_lieu"
  on public.tai_lieu for all to anon
  using (true) with check (true);
