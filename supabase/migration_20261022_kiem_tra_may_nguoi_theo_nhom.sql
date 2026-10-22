-- Checklist MFBW: người kiểm tra phân công theo từng nhóm A–E, lưu trong ket_qua._inspectors.

comment on column public.kiem_tra_may_truoc_ca.ket_qua is
  'JSON hạng mục + người kiểm tra nhóm: { "A01": { "result": "D"|"K"|"NA", "note": "", "nhietDo": "" }, "_inspectors": { "A": { "id": "", "name": "" } } }';

comment on column public.kiem_tra_may_truoc_ca.nguoi_kiem_tra_ten is
  'Tóm tắt tên người kiểm tra các nhóm A–E (cột riêng trên phiếu in).';
