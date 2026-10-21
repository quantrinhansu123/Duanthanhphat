-- Checklist kiểm tra máy hàn MFBW trước ca — một phiếu / máy / ngày / ca.

create table if not exists public.kiem_tra_may_truoc_ca (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ngay date not null,
  ca text not null default 'Ca 1'
    check (ca in ('Ca 1', 'Ca 2')),
  may_id uuid not null references public.thiet_bi (id) on delete restrict,
  may_ma text,
  may_ten text,
  du_an_id uuid references public.du_an (id) on delete set null,
  du_an_ten text,
  dia_diem text,
  ly_trinh text,
  nguoi_kiem_tra_id uuid references public.nhan_su (employee_id) on delete set null,
  nguoi_kiem_tra_ten text,
  truong_ca_id uuid references public.nhan_su (employee_id) on delete set null,
  truong_ca_ten text,
  ket_qua jsonb not null default '{}'::jsonb,
  ly_do_na text,
  xu_ly_ma_muc text,
  xu_ly_mo_ta text,
  bien_phap_khac_phuc text,
  kiem_tra_lai_luc text,
  ket_luan text
    check (ket_luan is null or ket_luan in ('du_dieu_kien', 'dung_van_hanh', 'cho_khac_phuc')),
  ghi_chu text,
  constraint kiem_tra_may_truoc_ca_unique_may_ngay_ca unique (may_id, ngay, ca)
);

create index if not exists idx_kiem_tra_may_truoc_ca_ngay_desc
  on public.kiem_tra_may_truoc_ca (ngay desc, ca, id desc);

create index if not exists idx_kiem_tra_may_truoc_ca_may_ngay
  on public.kiem_tra_may_truoc_ca (may_id, ngay desc);

drop trigger if exists trg_kiem_tra_may_truoc_ca_updated_at on public.kiem_tra_may_truoc_ca;
create trigger trg_kiem_tra_may_truoc_ca_updated_at
  before update on public.kiem_tra_may_truoc_ca
  for each row
  execute function public.set_updated_at();

comment on table public.kiem_tra_may_truoc_ca is
  'Checklist kiểm tra máy hàn MFBW trước ca (Đ / K / NA theo hạng mục)';
comment on column public.kiem_tra_may_truoc_ca.ket_qua is
  'JSON theo mã hạng mục: { "A01": { "result": "D"|"K"|"NA", "note": "", "nhietDo": "" } }';
comment on column public.kiem_tra_may_truoc_ca.ket_luan is
  'du_dieu_kien | dung_van_hanh | cho_khac_phuc';

alter table public.kiem_tra_may_truoc_ca enable row level security;

drop policy if exists "authenticated_all_kiem_tra_may_truoc_ca" on public.kiem_tra_may_truoc_ca;
create policy "authenticated_all_kiem_tra_may_truoc_ca"
  on public.kiem_tra_may_truoc_ca for all to authenticated
  using (true) with check (true);

drop policy if exists "anon_all_kiem_tra_may_truoc_ca" on public.kiem_tra_may_truoc_ca;
create policy "anon_all_kiem_tra_may_truoc_ca"
  on public.kiem_tra_may_truoc_ca for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.kiem_tra_may_truoc_ca to anon, authenticated;

notify pgrst, 'reload schema';
