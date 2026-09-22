-- Kế hoạch bảo trì: thêm kết quả và nhắc nhớ (tuỳ chọn)

alter table public.lich_su_bao_tri_may
  add column if not exists ket_qua text not null default 'Chưa có'
    check (ket_qua in ('Chưa có', 'Đạt', 'Không đạt', 'Cần theo dõi')),
  add column if not exists nhac_nho text;

comment on column public.lich_su_bao_tri_may.ket_qua is
  'Kết quả sau bảo trì: Chưa có / Đạt / Không đạt / Cần theo dõi';
comment on column public.lich_su_bao_tri_may.nhac_nho is
  'Nhắc nhớ kèm lịch bảo trì (tuỳ chọn)';
