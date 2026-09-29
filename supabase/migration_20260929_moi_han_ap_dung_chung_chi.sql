-- Mối hàn áp dụng trên loại chứng chỉ / chứng chỉ nhân sự
-- (VD: FBW, ATW, Sản xuất, Thử nghiệm, Đào tạo — lưu dạng text, nhiều giá trị cách nhau bằng dấu phẩy).

alter table public.chung_chi_nhom
  add column if not exists moi_han_ap_dung text;

alter table public.chung_chi
  add column if not exists moi_han_ap_dung text;

comment on column public.chung_chi_nhom.moi_han_ap_dung is
  'Mối hàn / công nghệ áp dụng của loại chứng chỉ (FBW, ATW, Sản xuất, …)';

comment on column public.chung_chi.moi_han_ap_dung is
  'Mối hàn / công nghệ áp dụng của chứng chỉ nhân sự';
