-- Số giờ nhập tay cho từng chứng chỉ của nhân sự
alter table public.chung_chi
  add column if not exists so_gio numeric(8,2);

alter table public.chung_chi
  drop constraint if exists chung_chi_so_gio_khong_am;

alter table public.chung_chi
  add constraint chung_chi_so_gio_khong_am check (so_gio is null or so_gio >= 0);

comment on column public.chung_chi.so_gio is 'Số giờ (nhập tay) gắn với chứng chỉ của nhân sự';

notify pgrst, 'reload schema';
