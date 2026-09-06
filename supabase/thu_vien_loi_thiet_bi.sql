-- ============================================================
-- Thư viện lỗi thiết bị: Tổng thể / Cẩu / Bơm / Máy hàn
-- Nguồn: Bảng 1–5 (tên bảng ở góc phải tài liệu)
-- Chạy trong Supabase SQL Editor
-- ============================================================

create table if not exists public.thu_vien_loi_thiet_bi (
  id                text primary key,
  nhom              text not null
                    check (nhom in ('Tổng thể', 'Cẩu', 'Bơm', 'Máy hàn')),
  stt               integer not null check (stt > 0),
  trieu_chung       text not null,
  nguyen_nhan_khac_phuc jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(nguyen_nhan_khac_phuc) = 'array'),
  nguon_bang        text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint thu_vien_loi_thiet_bi_unique_nhom_stt unique (nhom, stt)
);

comment on table public.thu_vien_loi_thiet_bi is
  'Thư viện xử lý sự cố thiết bị theo nhóm Tổng thể / Cẩu / Bơm / Máy hàn';
comment on column public.thu_vien_loi_thiet_bi.nguyen_nhan_khac_phuc is
  'Mảng { "nguyen_nhan": "...", "khac_phuc": "..." }';

create index if not exists thu_vien_loi_thiet_bi_nhom_stt_idx
  on public.thu_vien_loi_thiet_bi (nhom, stt);

alter table public.thu_vien_loi_thiet_bi enable row level security;

drop policy if exists "anon_all_thu_vien_loi_thiet_bi" on public.thu_vien_loi_thiet_bi;
create policy "anon_all_thu_vien_loi_thiet_bi"
  on public.thu_vien_loi_thiet_bi for all to anon
  using (true) with check (true);

drop policy if exists "authenticated_all_thu_vien_loi_thiet_bi" on public.thu_vien_loi_thiet_bi;
create policy "authenticated_all_thu_vien_loi_thiet_bi"
  on public.thu_vien_loi_thiet_bi for all to authenticated
  using (true) with check (true);

-- Seed (idempotent)
insert into public.thu_vien_loi_thiet_bi
  (id, nhom, stt, trieu_chung, nguyen_nhan_khac_phuc, nguon_bang, active)
values
-- Bảng 1: Tổng thể
(
  'mf-tt-01', 'Tổng thể', 1,
  'Dầu thủy lực chảy từ máy bơm khẩn cấp',
  '[
    {"nguyen_nhan":"Hỏng phớt tuyến","khac_phuc":"Thay phớt tuyến"},
    {"nguyen_nhan":"Hỏng gioăng","khac_phuc":"Thay gioăng"}
  ]'::jsonb,
  'Bảng 1: Tổng thể', true
),
(
  'mf-tt-02', 'Tổng thể', 2,
  'Máy bơm khẩn cấp không hoạt động',
  '[
    {"nguyen_nhan":"Đứt dây","khac_phuc":"Thay dây"},
    {"nguyen_nhan":"Ắc-quy của DGU hết điện","khac_phuc":"Sạc ắc-quy"}
  ]'::jsonb,
  'Bảng 1: Tổng thể', true
),
(
  'mf-tt-03', 'Tổng thể', 3,
  'Hơi nước đọng trên đường ống làm mát',
  '[{"nguyen_nhan":"Nhiệt độ làm mát quá thấp do ảnh hưởng của môi trường","khac_phuc":"Tăng nhiệt độ trên bộ làm mát chất làm mát"}]'::jsonb,
  'Bảng 1: Tổng thể', true
),
(
  'mf-tt-04', 'Tổng thể', 4,
  'Động cơ làm mát dầu thủy lực rung lắc mạnh và có tiếng ồn lớn',
  '[{"nguyen_nhan":"Kiểm tra chiều quay của động cơ điện","khac_phuc":"Thay đổi chiều quay của động cơ điện"}]'::jsonb,
  'Bảng 1: Tổng thể', true
),
(
  'mf-tt-05', 'Tổng thể', 5,
  'Xuất hiện các giọt dầu thủy lực hoặc chất lỏng được làm mát trong các mối nối ren của đường ống',
  '[{"nguyen_nhan":"Đai ốc bị lỏng","khac_phuc":"Siết lại đai ốc"}]'::jsonb,
  'Bảng 1: Tổng thể', true
),
(
  'mf-tt-06', 'Tổng thể', 6,
  'Đèn chiếu sáng bên trong hoặc bên ngoài của tổ hợp không sáng',
  '[
    {"nguyen_nhan":"Đứt dây","khac_phuc":"Thay dây"},
    {"nguyen_nhan":"Ắc-quy của DGU hết điện","khac_phuc":"Sạc ắc-quy"}
  ]'::jsonb,
  'Bảng 1: Tổng thể', true
),

-- Bảng 2: Cẩu
(
  'mf-cau-01', 'Cẩu', 1,
  'Việc hạ và nâng dầm, mở phần kéo dài, xoay bộ điều khiển cần cẩu diễn ra với tốc độ và cử không đều.',
  '[{"nguyen_nhan":"Có không khí trong hệ thống thủy lực. Một dấu hiệu là sự dao động áp suất trong hệ thống thủy lực khi không tiêu thụ dầu.","khac_phuc":"Xả khí ra khỏi hệ thống thủy lực bằng cách đặt mức áp suất thấp trên áp kế của trạm bơm đến 10 MPa (100 kgf/cm2), thực hiện 5 lần nâng và hạ phần nâng dầm, sau đó lặp lại các thao tác này với phần dầm mở rộng được nối bởi một dầm khác. Thực hiện hoạt động này không cần tải."}]'::jsonb,
  'Bảng 2: Cẩu', true
),
(
  'mf-cau-02', 'Cẩu', 2,
  'Nâng hạ dầm phần nâng dầm và phần kéo dài dầm không đều khi được nối bằng thanh sắt.',
  '[{"nguyen_nhan":"Tốc độ dòng chảy của dầu thủy lực không được điều chỉnh.","khac_phuc":"Điều chỉnh tốc độ dòng chảy bằng các van điều khiển."}]'::jsonb,
  'Bảng 2: Cẩu', true
),
(
  'mf-cau-03', 'Cẩu', 3,
  'Việc hạ thấp dầm hoặc tải trọng của cần cẩu một cách tự phát chậm.',
  '[
    {"nguyen_nhan":"Gioăng hoặc vòng đệm trong xi lanh dầm và xi lanh nâng bị hỏng.","khac_phuc":"Thay thế gioăng, vòng đệm bị hư hỏng."},
    {"nguyen_nhan":"Tắc nghẽn van kiểm soát dòng chảy.","khac_phuc":"Rửa sạch van kiểm soát dòng chảy."}
  ]'::jsonb,
  'Bảng 2: Cẩu', true
),
(
  'mf-cau-04', 'Cẩu', 4,
  'Nam châm điện của van phân phối thủy lực không hoạt động.',
  '[
    {"nguyen_nhan":"Nam châm bị đứt mạch điện.","khac_phuc":"Xử lý gián đoạn."},
    {"nguyen_nhan":"Nam châm điện bị hỏng.","khac_phuc":"Thay thế nam châm điện."}
  ]'::jsonb,
  'Bảng 2: Cẩu', true
),
(
  'mf-cau-05', 'Cẩu', 5,
  'Rò rỉ dầu trong xi lanh thủy lực.',
  '[{"nguyen_nhan":"Gioăng và vòng đệm bị hỏng.","khac_phuc":"Thay thế gioăng và vòng đệm bị hỏng."}]'::jsonb,
  'Bảng 2: Cẩu', true
),

-- Bảng 3: Bơm (stt 1–5)
(
  'mf-bom3-01', 'Bơm', 1,
  'Bọt dầu thoát ra khỏi bề mặt tiếp xúc giữa nắp và động cơ điện',
  '[
    {"nguyen_nhan":"Chất lỏng vận hành đi vào khớp nối qua khớp nối của bơm với nắp","khac_phuc":"Kiểm tra miếng đệm giữa nắp ổ đĩa và máy bơm, thay thế nếu cần thiết"},
    {"nguyen_nhan":"Chất lỏng vận hành đi vào nắp thông qua phốt trục bơm","khac_phuc":"Xử lý sự cố theo hướng dẫn vận hành của máy bơm"}
  ]'::jsonb,
  'Bảng 3: Bơm', true
),
(
  'mf-bom3-02', 'Bơm', 2,
  'Trạm bơm không cung cấp áp suất cao',
  '[{"nguyen_nhan":"Lỗi bơm","khac_phuc":"Xử lý sự cố theo hướng dẫn vận hành của máy bơm"}]'::jsonb,
  'Bảng 3: Bơm', true
),
(
  'mf-bom3-03', 'Bơm', 3,
  'Nam châm điện của nhà phân phối không hoạt động',
  '[
    {"nguyen_nhan":"Sự gián đoạn mạch điện của nam châm điện","khac_phuc":"Loại bỏ sự gián đoạn"},
    {"nguyen_nhan":"Nam châm điện bị lỗi","khac_phuc":"Thay thế nam châm điện"}
  ]'::jsonb,
  'Bảng 3: Bơm', true
),
(
  'mf-bom3-04', 'Bơm', 4,
  'Máy bơm không cung cấp dầu thủy lực',
  '[
    {"nguyen_nhan":"Hướng quay trục bơm bị sai","khac_phuc":"Thay đổi chiều quay của động cơ điện"},
    {"nguyen_nhan":"Mức chất lỏng vận hành trong bể không đủ","khac_phuc":"Rót thêm chất lỏng vận hành"},
    {"nguyen_nhan":"Rò rỉ không khí","khac_phuc":"Xử lý rò rỉ không khí"},
    {"nguyen_nhan":"Chất lỏng có độ nhớt quá mức","khac_phuc":"Thay thế chất lỏng vận hành"}
  ]'::jsonb,
  'Bảng 3: Bơm', true
),
(
  'mf-bom3-05', 'Bơm', 5,
  'Xuất hiện nước trong chất lỏng vận hành',
  '[{"nguyen_nhan":"Rò rỉ trong hệ thống làm mát","khac_phuc":"Siết chặt các đai ốc cuộn dây, kiểm tra cuộn dây với áp suất 0,5MPa (≈ 5 kgf/cm2). Thay dầu thủy lực"}]'::jsonb,
  'Bảng 3: Bơm', true
),

-- Bảng 4: Bơm (tiếp, stt 6–9 trong tab Bơm)
(
  'mf-bom4-01', 'Bơm', 6,
  'Rò rỉ chất lỏng vận hành trong các khớp nối của mạch thủy lực và thiết bị thủy lực',
  '[{"nguyen_nhan":"Các mối nối không kín khít","khac_phuc":"Siết chặt các đai ốc"}]'::jsonb,
  'Bảng 4: Bơm', true
),
(
  'mf-bom4-02', 'Bơm', 7,
  'Tiếng ồn gia tăng trong quá trình vận hành máy bơm',
  '[
    {"nguyen_nhan":"Đường ống hút bị xâm thực (các khoang máy bơm không dầu)","khac_phuc":"Kiểm tra ống hút bị tắc nghẽn (có vật lạ) của ống hút và rửa sạch"},
    {"nguyen_nhan":"Các trục bơm bị lệch (gãy) / động cơ truyền động","khac_phuc":"Giảm tốc độ động cơ truyền động (khi tăng tốc độ quay); kiểm tra và căn chỉnh lệch trục không quá 0,2 mm và góc gãy các trục không quá 30′"}
  ]'::jsonb,
  'Bảng 4: Bơm', true
),
(
  'mf-bom4-03', 'Bơm', 8,
  'Máy bơm hút không khí, có tiếng ồn và rung khi máy bơm đang chạy',
  '[
    {"nguyen_nhan":"Mức chất lỏng vận hành trong đường hút thấp","khac_phuc":"Đổ đầy lượng chất lỏng vận hành cần thiết"},
    {"nguyen_nhan":"Rò rỉ ở các khớp nối trên ống hút","khac_phuc":"Kiểm tra đường hút, siết chặt tất cả các mối nối, khớp nối"},
    {"nguyen_nhan":"Gioăng trục bơm bị hỏng","khac_phuc":"Thay thế gioăng"},
    {"nguyen_nhan":"Tạo bọt khí trong thùng dầu","khac_phuc":"Loại bỏ nguồn tạo bọt hoặc thay thế dầu bằng loại dầu khác có phụ gia chống tạo bọt. Nhúng ống rút hoặc đường ống vào dầu"}
  ]'::jsonb,
  'Bảng 4: Bơm', true
),
(
  'mf-bom4-04', 'Bơm', 9,
  'Máy bơm phát triển không đủ áp suất',
  '[{"nguyen_nhan":"Tắc nghẽn van an toàn khiến van an toàn không thể đóng hoàn toàn","khac_phuc":"Súc rửa van an toàn"}]'::jsonb,
  'Bảng 4: Bơm', true
),

-- Bảng 5: Máy hàn
(
  'mf-mh-01', 'Máy hàn', 1,
  'Phần má hàn di động di chuyển với tốc độ không đều và bị giật cục',
  '[{"nguyen_nhan":"Có bọt khí trong hệ thống thủy lực. Dấu hiệu có thể nhận biết là sự thay đổi áp suất trong hệ thống thủy lực mặc dù không có dầu","khac_phuc":"Đặt áp suất trong hệ thống thủy lực thành 1,5...1,0MPa, nới lỏng đai ốc nắp vặn của các ống nối với các khoang bên trái của xi lanh trong vài lượt. Xả dầu cho đến khi nó ngừng xủi bọt."}]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-02', 'Máy hàn', 2,
  'Khi bật công tắc SA7 phần má hàn di động di chuyển với những cú giật theo chu kỳ theo một trình tự nhất định.',
  '[
    {"nguyen_nhan":"Sự mất căn chỉnh của các thanh ép của máy hàn do việc kẹp các ray có độ dày khác nhau hoặc có các dấu ấn (vết lồi) nổi lên","khac_phuc":"Thay thế ray, loại bỏ các vết lồi hoặc mác nhà sản xuất trên bụng ray"},
    {"nguyen_nhan":"Các đế và bàn hạn vị không thẳng, dẫn đến sự mất căn chỉnh của các phần đoạn trong quá trình kẹp","khac_phuc":"Căn chỉnh bàn đế và hạn vị bằng thước thẳng"}
  ]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-03', 'Máy hàn', 3,
  'Khi nhả kẹp ray phần má hàn của máy không thể di chuyển tự động',
  '[{"nguyen_nhan":"Công tắc giới hạn SQ4 bị lỗi hoặc có sự cố đứt mạch trong các mạch của nó.","khac_phuc":"Kiểm tra các mạch điện của công tắc giới hạn SQ4 và khắc phục sự cố; thay thế công tắc giới hạn nếu cần."}]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-04', 'Máy hàn', 4,
  'Hàn xung không ổn định trong quá trình hàn.',
  '[
    {"nguyen_nhan":"Độ nhạy cao trong mạch điều chỉnh tốc độ","khac_phuc":"Giảm độ nhạy bằng cách điều chỉnh các dòng điện I1, I2, I3"},
    {"nguyen_nhan":"Điện trở ngắn mạch quá mức","khac_phuc":"Làm sạch tất cả các bề mặt tiếp xúc của mạch phụ của máy hàn"},
    {"nguyen_nhan":"Tiếp xúc kém với ray","khac_phuc":"Làm sạch ray"}
  ]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-05', 'Máy hàn', 5,
  'Tắt bơm dầu trong quá trình vận hành',
  '[{"nguyen_nhan":"Khởi động lại động cơ điện của bộ truyền động bơm dầu, điều này dẫn đến việc kích hoạt rơle nhiệt của bộ khởi động từ.","khac_phuc":"Kiểm tra nhiệt độ của động cơ bơm dầu và dòng điện trong mạch của nó. Loại bỏ nguyên nhân quá tải."}]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-06', 'Máy hàn', 6,
  'Thời gian tiếp xúc với ray quá lâu (làm nóng do điện trở).',
  '[
    {"nguyen_nhan":"Độ nhạy thấp trong mạch điều chỉnh","khac_phuc":"Tăng độ nhạy bằng cách điều chỉnh các dòng điện I1, I2, I3"},
    {"nguyen_nhan":"Thời gian tiếp xúc lâu có thể do điện trở ngắn mạch tăng của máy hàn","khac_phuc":"Làm sạch các tiếp điểm đóng-mở trong mạch của máy hàn"}
  ]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-07', 'Máy hàn', 7,
  'Giá trị ép nhỏ hơn giá trị cài đặt.',
  '[
    {"nguyen_nhan":"Áp suất dầu trong hệ thống thủy lực thấp hơn giá trị cài đặt, gây trượt ray trong quá trình ép do lực kẹp không đủ","khac_phuc":"Kiểm tra áp suất dầu trong hệ thống thủy lực"},
    {"nguyen_nhan":"Đơn vị đo không được điều chỉnh","khac_phuc":"Cài đặt đơn vị đo đến giá trị mong muốn"}
  ]'::jsonb,
  'Bảng 5: Máy hàn', true
),
(
  'mf-mh-08', 'Máy hàn', 8,
  'Dòng không tải tăng đột ngột khi các máy biến áp hàn được bật.',
  '[
    {"nguyen_nhan":"Kết nối sai (đảo ngược) các cuộn dây sơ cấp của các máy biến áp","khac_phuc":"Kiểm tra lại kết nối của các cuộn dây sơ cấp. Dấu hiệu của kết nối đúng là không có điện áp giữa các đế của cặp phân đoạn bên trái"},
    {"nguyen_nhan":"Hỏng cách điện giữa mạch phụ và thân máy","khac_phuc":"Tháo dỡ mạch phụ, khắc phục sự cố hỏng cách điện"}
  ]'::jsonb,
  'Bảng 5: Máy hàn', true
)
on conflict (id) do update set
  nhom = excluded.nhom,
  stt = excluded.stt,
  trieu_chung = excluded.trieu_chung,
  nguyen_nhan_khac_phuc = excluded.nguyen_nhan_khac_phuc,
  nguon_bang = excluded.nguon_bang,
  active = excluded.active,
  updated_at = now();
