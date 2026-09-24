-- Video + bộ lọc loại ray / công nghệ hàn cho khóa đào tạo.

alter table public.dao_tao
  add column if not exists link_video text,
  add column if not exists loai_ray text,
  add column if not exists cong_nghe_han text;

comment on column public.dao_tao.link_video is
  'Link 1 video bài giảng (URL Cloudinary hoặc URL ngoài).';
comment on column public.dao_tao.loai_ray is
  'Loại ray áp dụng cho khóa đào tạo (vd. 60E1).';
comment on column public.dao_tao.cong_nghe_han is
  'Công nghệ hàn / phương pháp hàn (FBW, ATW, ...).';
