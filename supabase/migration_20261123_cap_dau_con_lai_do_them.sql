-- Báo cáo mức dầu tách 2 ô giao diện: Đã đổ (do_them) và Thực tế (so_lit).
-- so_lit = mức dầu thực tế sau khi đổ (báo cáo, định mức). con_lai = thực tế − đã đổ (trước khi đổ).
-- Dòng cũ: con_lai = so_lit, do_them = 0. Chạy lại nhiều lần không sao.
alter table public.cap_dau_hang_ngay
  add column if not exists con_lai numeric(10, 2) check (con_lai is null or con_lai >= 0),
  add column if not exists do_them numeric(10, 2) not null default 0 check (do_them >= 0);

update public.cap_dau_hang_ngay set con_lai = so_lit where con_lai is null;

notify pgrst, 'reload schema';