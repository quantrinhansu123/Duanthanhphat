-- Hồ sơ kỹ thuật đính kèm thiết bị: hướng dẫn máy, sơ đồ thuỷ lực / điện / điều khiển

alter table public.thiet_bi
  add column if not exists ho_so_ky_thuat jsonb not null default '{}'::jsonb;

comment on column public.thiet_bi.ho_so_ky_thuat is
  'JSON hồ sơ kỹ thuật máy: { manual, hydraulic, electrical, control } — mỗi key là mảng file Cloudinary';
