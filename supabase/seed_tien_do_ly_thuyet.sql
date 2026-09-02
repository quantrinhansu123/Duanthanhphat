-- Seed mẫu tiến độ lý thuyết cho các dự án R4 (chạy sau du_an_tien_do_ly_thuyet.sql)

update public.du_an
set tien_do_ly_thuyet = '[
  {"ngay":"2024-05-01","so_moi_han":118},
  {"ngay":"2024-05-02","so_moi_han":125},
  {"ngay":"2024-05-03","so_moi_han":132},
  {"ngay":"2024-05-04","so_moi_han":128},
  {"ngay":"2024-05-05","so_moi_han":140}
]'::jsonb,
updated_at = now()
where ma_du_an = 'DA-R4-001';

update public.du_an
set tien_do_ly_thuyet = '[
  {"ngay":"2024-05-01","so_moi_han":95},
  {"ngay":"2024-05-02","so_moi_han":102},
  {"ngay":"2024-05-03","so_moi_han":110},
  {"ngay":"2024-05-04","so_moi_han":108},
  {"ngay":"2024-05-05","so_moi_han":115}
]'::jsonb,
updated_at = now()
where ma_du_an = 'DA-R4-002';

update public.du_an
set tien_do_ly_thuyet = '[
  {"ngay":"2024-05-01","so_moi_han":42},
  {"ngay":"2024-05-02","so_moi_han":45},
  {"ngay":"2024-05-03","so_moi_han":48}
]'::jsonb,
updated_at = now()
where ma_du_an = 'DA-R4-003';
