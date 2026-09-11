-- ============================================================
-- Bảng tổng hợp mối hàn theo ngày/dự án/công nghệ/loại mối hàn.
-- Nuôi bằng trigger trên lich_su_moi_han để trang Báo cáo & thống
-- kê đọc số liệu tổng hợp trực tiếp thay vì quét/join bảng chi
-- tiết mỗi lần tải. Có thể chạy lại an toàn.
-- ============================================================

create table if not exists public.thong_ke_moi_han_theo_ngay (
  ngay_thuc_hien     date not null,
  du_an_id           uuid not null references public.du_an (id) on delete cascade,
  cong_nghe_han      text not null,
  loai_moi_han       text not null,
  so_luong_thuc_hien bigint not null default 0,
  so_luong_loi       bigint not null default 0,
  updated_at         timestamptz not null default now(),
  primary key (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han)
);

comment on table public.thong_ke_moi_han_theo_ngay is
  'Tổng hợp số lượng mối hàn theo ngày/dự án/công nghệ/loại, nuôi bằng trigger trên lich_su_moi_han cho trang báo cáo tổng quan.';

create index if not exists idx_thong_ke_moi_han_ngay
  on public.thong_ke_moi_han_theo_ngay (ngay_thuc_hien);
create index if not exists idx_thong_ke_moi_han_du_an
  on public.thong_ke_moi_han_theo_ngay (du_an_id);

alter table public.thong_ke_moi_han_theo_ngay enable row level security;

drop policy if exists "authenticated_all_thong_ke_moi_han_theo_ngay" on public.thong_ke_moi_han_theo_ngay;
create policy "authenticated_all_thong_ke_moi_han_theo_ngay"
  on public.thong_ke_moi_han_theo_ngay for all to authenticated
  using (true) with check (true);

-- Giao diện hiện chưa có đăng nhập: anon chỉ được đọc báo cáo.
drop policy if exists "anon_read_thong_ke_moi_han_theo_ngay" on public.thong_ke_moi_han_theo_ngay;
create policy "anon_read_thong_ke_moi_han_theo_ngay"
  on public.thong_ke_moi_han_theo_ngay for select to anon
  using (true);

grant select on public.thong_ke_moi_han_theo_ngay to anon;
grant select, insert, update, delete on public.thong_ke_moi_han_theo_ngay to authenticated;

-- ------------------------------------------------------------
-- Trigger nuôi bảng tổng hợp mỗi khi lich_su_moi_han thay đổi.
-- Áp dụng delta (cộng/trừ) thay vì tính lại toàn bộ, nên chi phí
-- mỗi lần ghi mối hàn không phụ thuộc số dòng lịch sử đã có.
-- Dòng thiếu ngay_thuc_hien (dữ liệu lịch sử cũ) không gộp được
-- theo ngày nên bị bỏ qua.
-- ------------------------------------------------------------

create or replace function public.sync_thong_ke_moi_han_theo_ngay()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    if old.ngay_thuc_hien is not null then
      update public.thong_ke_moi_han_theo_ngay
      set so_luong_thuc_hien = so_luong_thuc_hien - old.so_luong_thuc_hien,
          so_luong_loi = so_luong_loi - old.so_luong_loi,
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
        and so_luong_thuc_hien <= 0
        and so_luong_loi <= 0;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.ngay_thuc_hien is not null then
      insert into public.thong_ke_moi_han_theo_ngay
        (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han, so_luong_thuc_hien, so_luong_loi)
      values
        (new.ngay_thuc_hien, new.du_an_id, new.cong_nghe_han, new.loai_moi_han, new.so_luong_thuc_hien, new.so_luong_loi)
      on conflict (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han)
      do update set
        so_luong_thuc_hien = public.thong_ke_moi_han_theo_ngay.so_luong_thuc_hien + excluded.so_luong_thuc_hien,
        so_luong_loi = public.thong_ke_moi_han_theo_ngay.so_luong_loi + excluded.so_luong_loi,
        updated_at = now();
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_thong_ke_moi_han_theo_ngay on public.lich_su_moi_han;
create trigger trg_sync_thong_ke_moi_han_theo_ngay
  after insert or update or delete on public.lich_su_moi_han
  for each row execute function public.sync_thong_ke_moi_han_theo_ngay();

-- ------------------------------------------------------------
-- Nạp lại toàn bộ dữ liệu hiện có (backfill 1 lần khi tạo bảng).
-- An toàn khi chạy lại: truncate rồi tổng hợp lại từ đầu.
-- ------------------------------------------------------------
truncate public.thong_ke_moi_han_theo_ngay;

insert into public.thong_ke_moi_han_theo_ngay
  (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han, so_luong_thuc_hien, so_luong_loi)
select
  ngay_thuc_hien,
  du_an_id,
  cong_nghe_han,
  loai_moi_han,
  sum(so_luong_thuc_hien),
  sum(so_luong_loi)
from public.lich_su_moi_han
where ngay_thuc_hien is not null
group by ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han;
