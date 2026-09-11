-- ============================================================
-- Đổi bảng tổng hợp thong_ke_moi_han_theo_ngay sang đếm SỐ DÒNG
-- (1 dòng nhật ký = 1 mối) thay vì cộng so_luong_thuc_hien, để
-- khớp đúng cách trang Báo cáo tổng quan đang đếm (xem
-- summarizeJournalRows/buildDailyJournalSeries trong
-- weldReportData.ts: "1 bản ghi nhật ký = 1 mối").
-- Thêm cột đếm theo tình trạng thí nghiệm + hàn lại để trang Tổng
-- quan có thể hiển thị nhanh các thẻ KPI/biểu đồ trong lúc dữ
-- liệu chi tiết (máy/nhân sự/lỗi) còn đang tải nền.
-- Có thể chạy lại an toàn.
-- ============================================================

drop trigger if exists trg_sync_thong_ke_moi_han_theo_ngay on public.lich_su_moi_han;
drop function if exists public.sync_thong_ke_moi_han_theo_ngay();
drop table if exists public.thong_ke_moi_han_theo_ngay;

create table public.thong_ke_moi_han_theo_ngay (
  ngay_thuc_hien date not null,
  du_an_id       uuid not null references public.du_an (id) on delete cascade,
  cong_nghe_han  text not null,
  loai_moi_han   text not null,
  so_moi         bigint not null default 0,
  so_dat         bigint not null default 0,
  so_khong_dat   bigint not null default 0,
  so_cho_tn      bigint not null default 0,
  so_khong_tn    bigint not null default 0,
  so_han_lai     bigint not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han)
);

comment on table public.thong_ke_moi_han_theo_ngay is
  'Tổng hợp số mối hàn theo ngày/dự án/công nghệ/loại (đếm dòng, không phải so_luong_thuc_hien), nuôi bằng trigger trên lich_su_moi_han cho trang báo cáo tổng quan tải nhanh.';

create index if not exists idx_thong_ke_moi_han_ngay
  on public.thong_ke_moi_han_theo_ngay (ngay_thuc_hien);
create index if not exists idx_thong_ke_moi_han_du_an
  on public.thong_ke_moi_han_theo_ngay (du_an_id);

alter table public.thong_ke_moi_han_theo_ngay enable row level security;

drop policy if exists "authenticated_all_thong_ke_moi_han_theo_ngay" on public.thong_ke_moi_han_theo_ngay;
create policy "authenticated_all_thong_ke_moi_han_theo_ngay"
  on public.thong_ke_moi_han_theo_ngay for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_read_thong_ke_moi_han_theo_ngay" on public.thong_ke_moi_han_theo_ngay;
create policy "anon_read_thong_ke_moi_han_theo_ngay"
  on public.thong_ke_moi_han_theo_ngay for select to anon
  using (true);

grant select on public.thong_ke_moi_han_theo_ngay to anon;
grant select, insert, update, delete on public.thong_ke_moi_han_theo_ngay to authenticated;

create or replace function public.sync_thong_ke_moi_han_theo_ngay()
returns trigger
language plpgsql
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

drop trigger if exists trg_sync_thong_ke_moi_han_theo_ngay on public.lich_su_moi_han;
create trigger trg_sync_thong_ke_moi_han_theo_ngay
  after insert or update or delete on public.lich_su_moi_han
  for each row execute function public.sync_thong_ke_moi_han_theo_ngay();

-- Backfill 1 lần từ dữ liệu hiện có.
truncate public.thong_ke_moi_han_theo_ngay;

insert into public.thong_ke_moi_han_theo_ngay
  (ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han, so_moi, so_dat, so_khong_dat, so_cho_tn, so_khong_tn, so_han_lai)
select
  ngay_thuc_hien,
  du_an_id,
  cong_nghe_han,
  loai_moi_han,
  count(*),
  count(*) filter (where tinh_trang_thi_nghiem = 'Đạt'),
  count(*) filter (where tinh_trang_thi_nghiem = 'Không đạt'),
  count(*) filter (where tinh_trang_thi_nghiem = 'Chờ thí nghiệm'),
  count(*) filter (where tinh_trang_thi_nghiem = 'Không thí nghiệm'),
  count(*) filter (where nullif(btrim(moi_han_lien_ket), '') is not null)
from public.lich_su_moi_han
where ngay_thuc_hien is not null
group by ngay_thuc_hien, du_an_id, cong_nghe_han, loai_moi_han;

-- Đọc kèm tên dự án cho phía client lọc theo tên (bộ lọc "Theo dự án" dùng tên).
create or replace view public.thong_ke_moi_han_theo_ngay_du_an
with (security_invoker = true)
as
select
  t.*,
  da.du_an,
  da.ma_du_an
from public.thong_ke_moi_han_theo_ngay t
join public.du_an da on da.id = t.du_an_id;

grant select on public.thong_ke_moi_han_theo_ngay_du_an to anon, authenticated;
