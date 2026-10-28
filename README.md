# Kế hoạch sửa module nghiệm thu chất lượng mối hàn

Nguồn yêu cầu: **Nghiệm thu mối hàn 28-10-26 R1.docx**, tại `C:\Users\acer\Downloads\Nghiệm thu mối hàn 28-10-26 R1.docx`.

Ngày lập: **28/10/2026**. Trạng thái: **đã triển khai mã giai đoạn 1–2; hai migration đã áp dụng lên Supabase thật**. Giao diện kiểm tra chất lượng đã được thêm vào Nhật ký hàn; hiện cần cấu hình Basic Auth trên server để bật đọc/ghi chất lượng. Các giai đoạn 3 trở đi chưa triển khai.

Kế hoạch được lập sau khi đọc toàn bộ nội dung chữ, bảng tiêu chí và xem cả 4 hình trong tài liệu: bảng dung sai PQ, vị trí menu Biên bản mối hàn, danh sách tình trạng thí nghiệm hiện tại và Dashboard. Các mục dẫn nguồn bên dưới dùng tên đề mục/nội dung trong Word; không gán số trang khi chưa kiểm chứng phân trang.

Ứng dụng cần sửa là **`quan-ly-nhan-su`**, nơi hiện chứa nhật ký hàn, biên bản và Dashboard. Thư mục `thanhphatquanlyhanray` là ứng dụng riêng; không triển khai trùng chức năng vào đó. Hướng dẫn cài đặt và vận hành hiện có nằm trong [README của ứng dụng](quan-ly-nhan-su/README.md).

## Tiến độ thực hiện — Giai đoạn 1

Đã thêm các phần sau vào mã nguồn:

- [Migration nền chất lượng](supabase/migration_20261028_nghiem_thu_moi_han.sql): 7 bảng, 2 view, quy tắc dung sai, trigger bảo vệ và 3 RPC lưu kiểm tra/phát RFI/hoàn thành nghiệm thu. Hoàn thành tạo dữ liệu chốt cho ba hồ sơ trong cùng transaction; chưa có mẫu in chính thức/PDF.
- [Quy tắc TypeScript](quan-ly-nhan-su/src/lib/weldQuality.ts): bốn phép đo có dấu, phân biệt trống/0, nhập dấu phẩy thập phân, xét biên theo cấu hình và tách NDT với nghiệm thu. TypeScript và DB dùng cùng bộ ca đối chiếu.
- [Lớp dữ liệu chỉ chạy trên server](quan-ly-nhan-su/src/lib/server/weldQualityDb.ts): đọc chất lượng, tạo tiêu chí có phiên bản và gọi RPC. Các bảng/view/RPC chất lượng không cấp quyền cho `anon`/`authenticated`; chỉ `service_role` dùng được. Giai đoạn 2 đã thêm endpoint HTTP có xác thực trước khi gọi lớp này.
- Trigger khởi tạo ngay tại `lich_su_moi_han` bao phủ cả RPC mới/cũ, Excel, Autolisp và insert trực tiếp. Không cần sửa từng nhánh fallback của `weldReportData.ts`; lỗi khởi tạo sẽ làm insert thất bại trong cùng transaction. Mối mới chưa nhập kiểm tra vẫn xoá được; mối đã ghi nhận chất lượng được bảo vệ khỏi xoá nhầm.
- Không backfill dữ liệu cũ. View `moi_han_can_bo_sung_chat_luong` liệt kê mối chưa đủ căn cứ; NDT Đạt cũ không tự trở thành Nghiệm thu đạt.
- Bản ghi khối lượng tổng hợp (số lượng khác 1) không được ghi kiểm tra/phát RFI/nghiệm thu như một mối đơn; phải tách và xác minh dữ liệu trước. Không đổi khối lượng của mối đã gắn tiêu chí kiểm tra.
- Số phiên bản và khoá dòng bảo vệ việc cập nhật/hoàn thành; ID yêu cầu giữ nguyên khi thử lại. Một mối không tham gia hai RFI hiệu lực hoặc được nghiệm thu đạt hai lần. Mối bị loại tại hiện trường giữ Không đạt dù NDT đã đạt; phải ghi nhận kiểm tra lại để đưa vào phiếu mới.

**Không tự quyết thay nghiệp vụ:** chưa tạo tiêu chí PQ cho dự án thật. Muốn áp dụng phải khai báo đủ bốn giới hạn, biên mở/đóng, yêu cầu NDT, NDT trước/sau RFI và người xác nhận. Miễn NDT bắt buộc có căn cứ. Tiêu chí đã dùng không được sửa nội dung; tạo phiên bản mới. Mối đã nghiệm thu bị chặn sửa phép kiểm tra cho tới khi có quy trình bản sửa đổi ở giai đoạn sau.

**Đã triển khai trên DB thật:** theo yêu cầu của người dùng, migration được chạy qua SQL Editor của dự án [chamdiemnhansu — ssgwccxdcpejyytmfarc](https://supabase.com/dashboard/project/ssgwccxdcpejyytmfarc) lúc **15:00:59 ngày 28/10/2026 (UTC+7)**. Đã kiểm tra cột/kiểu dữ liệu, chạy thử toàn bộ migration trong transaction rồi `ROLLBACK` thành công trên schema thật, sau đó chạy bản chính thức và `COMMIT`. Không chạy lại migration lịch sử hoặc `drop_all.sql`.

Đối soát trước/sau triển khai:

| Kiểm tra | Kết quả |
| --- | --- |
| Số bản ghi `lich_su_moi_han` | 13.515 → 13.515 |
| Dấu kiểm tra toàn bộ nội dung nhật ký, sắp theo ID | `8dcfdbe332f10d57a4cb35c22049f798` trước/sau giống nhau |
| Số dự án | 7 → 7 |
| Bảng chất lượng mới / bảng đã bật RLS | 7 / 7 |
| View chất lượng / RPC nghiệp vụ | 2 / 3 |
| Bảng/RPC mới truy cập trực tiếp được bởi `anon` hoặc `authenticated` | 0 / 0 |
| Số dòng view chất lượng | 13.515 |
| Dữ liệu kiểm tra / mối đã nghiệm thu / cấu hình tiêu chí tự tạo | 0 / 0 / 0 |
| Trigger mới trên nhật ký đang bật | 2 |

Không mất hoặc sửa nội dung nhật ký cũ, không tự gán nghiệm thu đạt và không áp dụng dung sai PQ cho dự án thật. Lần chạy trên schema thật có hoàn tác không phải bản sao DB đầy đủ hoặc kiểm thử nhiều phiên đồng thời. Kết quả kiểm tra cuối được giữ trong [SQL Editor](https://supabase.com/dashboard/project/ssgwccxdcpejyytmfarc/sql/b656f811-eb82-4650-aa24-801a8f50eed5).

**Kiểm thử đã đạt:** `test-weld-quality.mjs`, `test-weld-quality-db.mjs` (PostgreSQL WASM/PGlite cài ở thư mục tạm, không thêm dependency vào ứng dụng), và ba bài hồi quy `test-journal-pagination.mjs`, `test-overview-report.mjs`, `test-lunch-break.mjs`. DB thử nghiệm dùng schema nguồn tối thiểu, kiểm tra chạy lại migration cả trước/sau có hồ sơ, bảo toàn dữ liệu cũ, quyền, giới hạn/phiên bản, RFI trùng, nghiệm thu từng phần, thử lại, lỗi lưu hồ sơ và dữ liệu chốt. Chưa phải thử trên bản sao đầy đủ của DB thật hoặc mô phỏng đồng thời nhiều kết nối.

`pnpm build` **đạt**, bao gồm bước kiểm tra TypeScript và tạo 47 trang. `pnpm exec tsc --noEmit --incremental false` chạy riêng sau build **đạt**. Lint riêng bốn file TypeScript/script mới **đạt**. `pnpm lint` toàn ứng dụng báo **28 lỗi, 30 cảnh báo ở các file cũ**, gồm script CommonJS và các component báo cáo/nhật ký; chưa sửa ngoài phạm vi giai đoạn này. Lần kiểm tra TypeScript ban đầu chạy cùng build gặp file `.next/types` bị tạo lại; đã chạy lại thành công sau build.

## Tiến độ thực hiện — Giai đoạn 2

**Đã triển khai trong mã nguồn:**

- Nhật ký có cột và bộ lọc **Tình trạng chất lượng**, tách khỏi **Kết quả NDT**. Bảng desktop, thẻ mobile và màn hình chi tiết có đường mở Kiểm tra chất lượng.
- Màn hình kiểm tra có ngày hoàn thành mài, trực quan, bốn số đo có dấu/đơn vị mm/kết luận từng chỉ tiêu; NDT mặc định Siêu âm, hỗ trợ Từ tính/Thẩm thấu, ngày và Đạt/Không đạt. Ô trống khác số 0. Không có tiêu chí thì chỉ lưu số đo, không tự kết luận hình học đạt.
- Có thiết lập tiêu chí khi nhóm dự án/công nghệ/loại mối chưa có bản đang áp dụng. Phải nhập đủ giới hạn, chọn biên mở/đóng, xác nhận quy tắc NDT/RFI và bấm xác nhận; không có cấu hình PQ được tạo sẵn. Người ghi nhận/người xác nhận lấy từ đăng nhập server.
- Chọn từng mối, chọn trang hiện tại hoặc toàn bộ kết quả lọc; giữ lựa chọn khi chuyển trang, bỏ lựa chọn khi đổi bộ lọc. Danh sách “chọn toàn bộ” và xuất Excel đọc hết các trang, không dừng ở 1.000 bản ghi.
- “Đạt tất trực quan / NDT” hiển thị số lượng/ngày/tiêu chí trước khi lưu, chia lượt 100 mối, tối đa 5 mối xử lý đồng thời, báo thành công/lỗi theo ID. Không tự ghi số đo, không xóa cờ lỗi nghiệm thu, không đánh dấu nghiệm thu đạt. Mối đã sửa ở nơi khác hoặc đã nghiệm thu bị từ chối.
- Xuất Excel bổ sung phiên bản kiểm tra, tiêu chí, số đo và kết quả sau mài/NDT. **Nhập kiểm tra Excel** dùng file xuất từ nhật ký và giữ cột Mã bản ghi/Phiên bản kiểm tra; hỗ trợ Việt/Anh, giữ nguyên trường có ô trống, nhận số 0, không nhập đè phiên bản mới. File mẫu tạo nhật ký cũ có thêm trang hướng dẫn và vẫn dùng được.
- Cache nhật ký, thống kê tổng quan và rollup được xóa/làm mới sau lưu hoặc nhập kiểm tra. NDT đã ghi được đồng bộ nguyên tử về cột thí nghiệm hiện có để các báo cáo hiện tại không giữ kết quả cũ; điều này không đổi NDT Đạt thành Nghiệm thu đạt.
- API `/api/weld-quality` kiểm tra Basic Auth tại route, chặn yêu cầu ghi từ website khác, kiểm tra JSON/ngày/UUID/phương pháp/số đo/phiên bản. Không dùng `currentViewer` để cấp quyền và không đưa `service_role` ra trình duyệt. Thiếu cấu hình đăng nhập trả 503; nhật ký cũ vẫn mở được nhưng không cho chọn/lưu kiểm tra.

**DB thật:** [migration giai đoạn 2](supabase/migration_20261028_nhat_ky_kiem_tra_chat_luong.sql) đã chạy thử rồi hoàn tác, sau đó commit trên dự án `ssgwccxdcpejyytmfarc` lúc **15:34:58 ngày 28/10/2026 (UTC+7)**. Đã tạo view `nhat_ky_han_chat_luong` chỉ server đọc, trigger đồng bộ NDT và trigger chặn ghi đè kết quả NDT qua màn hình/import cũ. Đối soát sau commit: 13.515 bản ghi gốc và 13.515 dòng view; dấu kiểm tra dữ liệu gốc vẫn `8dcfdbe332f10d57a4cb35c22049f798`; cả hai trigger bật; `anon`/`authenticated` không đọc được view, `service_role` đọc được. Dữ liệu kiểm tra và tiêu chí vẫn bằng 0, không có dữ liệu thử ghi vào DB thật.

**Kiểm thử:** sáu script `test-weld-quality.mjs`, `test-weld-quality-db.mjs`, `test-weld-quality-journal.mjs`, `test-journal-pagination.mjs`, `test-overview-report.mjs`, `test-lunch-break.mjs` đã đạt. Test DB chạy lại cả hai migration và kiểm tra đồng bộ/bảo vệ NDT. Test API kiểm tra auth/origin/người ghi nhận, lọc trước phân trang, lấy hơn 1.000 dòng, lỗi từng mối, phiên bản cũ, giới hạn xử lý đồng thời và Excel Việt/Anh. TypeScript và build production đã đạt; lint riêng các file mới và hook đã sửa đạt. File `WeldingJournalList.tsx` vẫn có hai lỗi React memoization từ trước; chưa sửa logic gợi ý mã ngoài phạm vi.

**Điều kiện còn thiếu để vận hành:** server hiện chưa có `APP_BASIC_AUTH_USER` và `APP_BASIC_AUTH_PASSWORD`, nên chưa bật được thao tác ghi kiểm tra trên ứng dụng thật. Cấu hình cả hai trong `quan-ly-nhan-su/.env.local` hoặc môi trường triển khai, khởi động lại server, rồi đăng nhập qua hộp thoại của trình duyệt. Basic Auth bảo vệ **toàn ứng dụng** theo cơ chế sẵn có. Không ghi mật khẩu vào README/Git và không tự tạo tài khoản thay người dùng. Xem [hướng dẫn giai đoạn 2](quan-ly-nhan-su/README.md#nhật-ký-kiểm-tra-chất-lượng--giai-đoạn-2).

Đã kiểm tra trang Nhật ký thực tế hiển thị danh sách/nút/bộ lọc/cảnh báo khi thiếu đăng nhập. Chưa hoàn tất kiểm thử nhập–lưu bằng trình duyệt và chưa thử ghi kiểm tra trên DB thật; trang thử riêng bị Chrome chặn, máy chủ thử đã dừng. Chưa thay đổi Dashboard sang KPI nghiệm thu (thuộc giai đoạn 7), chưa tạo RFI hoặc bộ bản in mới.

## Tiến độ thực hiện — Giai đoạn 3–7 (mã nguồn, chưa vận hành)

Thực hiện theo "phương án đề xuất" ở mục 3.1 (mài + trực quan + hình học đạt [+ NDT nếu tiêu chí `ndt_truoc_rfi`] → phát RFI → nghiệm thu một phần → hồ sơ). **Các quyết định mục 3 chưa được người phụ trách xác nhận; mẫu in là mẫu tạm.**

- **Giai đoạn 3:** tab *Nhật ký thi công* dùng lại Báo cáo ngày; FBW trên tuyến = "Hàn ray chảy giáp mép trên tuyến" (đã chạy trên DB thật). Mới thêm: ô **VNR** (số người, lưu trong `nhan_luc.vnr`, không cần migration; in kèm cột Công nhân, không tính trùng), dòng **Nghiệm thu trong ngày** (đếm mối Đạt theo *ngày nghiệm thu*, tách khỏi ngày hàn; hiện ở bản in, cần đăng nhập), và **In nhiều ngày** (chọn khoảng ngày trong danh sách, tối đa 31 phiếu, mỗi ngày một trang, đọc từ dữ liệu đã lưu; thời tiết/nhiệt độ để trống cho tay điền). Mô tả ATW giữ như danh mục hiện có vì Word chưa nêu nội dung riêng.
- **Giai đoạn 4 (RFI):** tab *RFI & Nghiệm thu → Phát RFI*: lọc theo mã/khoảng mối (so sánh tự nhiên, mối 2 trước mối 10), ngày hàn, khoảng Km; giữ ID đã chọn; mối thiếu lý trình không lọt khoảng Km và được báo; hiển thị số mối chưa đủ điều kiện theo lý do; mối đang thuộc RFI hiệu lực bị loại. ID yêu cầu giữ nguyên khi thử lại. Quy tắc: `src/lib/weldAcceptance.ts`; server: `src/lib/server/weldAcceptanceServer.ts`; API: các action `rfi-*` của `/api/weld-quality` (cùng Basic Auth).
- **Giai đoạn 5 (Nghiệm thu):** chọn RFI → mặc định "Đạt" cho mối đủ điều kiện, mối chưa đủ là "Chưa nghiệm thu"; đổi từng mối, bắt buộc lý do khi loại; tóm tắt trước khi hoàn thành; gọi RPC transaction có sẵn (kiểm lại phiên bản/điều kiện ở DB, không nhận 0 mối đạt).
- **Giai đoạn 6 (Hồ sơ):** tab *Hồ sơ nghiệm thu* liệt kê đợt, mở/in RFI và 3 hồ sơ từ **dữ liệu chốt**, đổi Chờ ký/Đã ký (độc lập với nghiệm thu). Bản in A4 qua trình duyệt, tiêu đề tự theo công nghệ FBW/ATW, ghi rõ "Mẫu tạm v0 — chờ mẫu chính thức". **Bản sửa đổi:** nút *Sửa thông tin in* chỉ sửa địa điểm/thành phần, bắt buộc lý do, lưu thành phiên bản mới ([migration](supabase/migration_20261028_ho_so_sua_doi.sql), **đã chạy trên DB thật ngày 28/10/2026**, bảng đang trống); số đo và danh sách mối đã chốt không đổi, bản cũ giữ để truy vết. *Chưa có:* mẫu chính thức; không lưu PDF trên server (dùng In/Lưu PDF của trình duyệt).
- **Giai đoạn 7 (Dashboard):** thẻ **Nghiệm thu đạt** (thay "Đạt") và **Chờ mài** lấy từ một nguồn server duy nhất (`dashboard-quality`) nên số thẻ luôn bằng danh sách mở ra, áp dụng đúng bộ lọc hiện tại và tự làm mới khi lưu kiểm tra/nghiệm thu. Chưa đăng nhập hoặc chưa cấu hình Basic Auth → thẻ hiện "—". "Ngày gần nhất" không nhận ngày tương lai. `QualityReportDashboard`/`YearlyWeldReport` đã rà: không có chỉ số "nghiệm thu" nên không nhầm với NDT đạt. `overviewAggregates.ts`/`weldDailyStats.ts` không cần đổi cho hai thẻ mới.

**Đăng nhập (thay Basic Auth cho phần nghiệm thu):** API `/api/weld-quality` nhận token Supabase Auth (header `X-Supabase-Token`) và chỉ cho email có trong bảng `nguoi_dung_nghiem_thu` ([migration](supabase/migration_20261028_nguoi_dung_nghiem_thu.sql), **đã chạy trên DB thật ngày 28/10/2026**, bảng có 1 email). Gặp 401 thì ứng dụng hiện hộp đăng nhập (`QualityLoginDialog`). Trang `/login` (Supabase Auth) khóa giao diện: chưa đăng nhập thì chuyển về `/login` (kiểm tra ở `src/proxy.ts`; API và file tĩnh không bị chặn ở đây). Basic Auth cũ vẫn dùng được nếu có đặt biến. Tài khoản phải tạo ở Authentication → Users.

**Kiểm thử trên DB thật (28/10/2026, hoàn tác toàn bộ):** chạy một khối SQL trên schema thật tạo 4 mối thử, tiêu chí, RFI, nghiệm thu một phần và bản sửa đổi, rồi cố ý báo lỗi cuối khối để giao dịch tự hoàn tác. **24/24 bước đạt** (mối thiếu số đo = Chờ mài; ngoài dung sai = Không đạt; RFI chặn mối lỗi/thiếu số đo/trùng RFI; gửi lại không tạo trùng; chấp nhận 1 + chưa nghiệm thu 1 → chỉ 1 mối Nghiệm thu đạt, đủ 3 hồ sơ, RFI vẫn mở; mối đã nghiệm thu bị khóa sửa; bản sửa đổi chỉ thêm). Đối soát sau đó: số dòng 10 bảng chất lượng/nhật ký giống hệt trước khi chạy (13.515 mối), không còn bản ghi `ZZTEST`/`ZZ-RFI`. Chưa kiểm thử được qua giao diện trình duyệt.

**Kiểm thử bổ sung:** `test-weld-quality-login.mjs` (token Supabase, danh sách email 401/403, origin, Basic Auth cũ) và `test-weld-quality-extras-db.mjs` (PGlite: bản sửa đổi chỉ thêm, danh sách email/bảng chỉ service_role, chạy lại migration). `pnpm build` và `tsc` đạt; lỗi lint còn lại đều có từ trước.

**Kiểm thử:** `test-weld-acceptance.mjs` (lọc tên/ngày/km, mối thiếu lý trình, thứ tự tự nhiên, mặc định nghiệm thu) và các bài `test-weld-quality*.mjs`, `test-journal-pagination`, `test-overview-report`, `test-lunch-break`, `test-daily-report-rails` đạt; `tsc` và ESLint các file mới đạt. RPC phát RFI/hoàn thành đã được test DB ở giai đoạn 1 (không đổi). **Chưa:** thử bằng trình duyệt, đăng nhập thật, giai đoạn 0 (mẫu/quy định), giai đoạn 8 (thí điểm, bản sao DB, quay lui). Chưa tạo tiêu chí PQ cho dự án thật nên chưa mối nào đủ điều kiện RFI cho tới khi xác nhận tiêu chí.

## 1. Mục tiêu và phạm vi

Đưa chức năng “Biên bản mối hàn” thành quy trình quản lý chất lượng liên kết với từng mối hàn thực tế:

**Hàn → Mài và kiểm tra nội bộ → Phát yêu cầu nghiệm thu/thí nghiệm → Thí nghiệm không phá huỷ → Nghiệm thu hiện trường → Hoàn thành, lưu hồ sơ → Ký biên bản và in lại.**

Thứ tự phát yêu cầu và thí nghiệm ở trên là phương án đề xuất theo phần **TÓM TẮT LẠI MODULE NÀY NHƯ SAU**; tài liệu có chỗ diễn đạt khác, cần chốt tại giai đoạn 0.

Các nhóm việc bắt buộc:

1. Nhập và lưu kiểm tra trực quan, bốn chỉ tiêu thẳng/phẳng, phương pháp và kết quả thí nghiệm.
2. Xét đạt/không đạt theo dung sai của dự án và công nghệ hàn; quản lý tình trạng theo tiến trình.
3. Nhật ký thi công theo ngày, tự điền dữ liệu sẵn có, bổ sung thông tin còn thiếu và in một/nhiều ngày.
4. Chọn mối theo dự án, tên/khoảng mối, khoảng ngày hàn và khoảng lý trình để phát RFI.
5. Nghiệm thu theo RFI, mặc định chọn hoàn thành các mối trong phiếu, cho phép loại mối chưa hoàn thành hoặc không đạt.
6. Hoàn thành nghiệm thu sinh, lưu và in ba hồ sơ liên quan theo mẫu phù hợp.
7. Sửa Dashboard: “Nghiệm thu đạt”, bổ sung “Chờ mài”, kiểm tra lại “Ngày gần nhất” và đồng bộ số liệu chi tiết/tổng hợp.
8. Cho phép sửa nội dung nghiệp vụ, lưu được sau tải lại trang và giữ được lịch sử hồ sơ đã phát hành.

Không mở rộng sang thay đổi cách đánh mã mối, thuật toán GPS, tính công, giải toả ứng suất hay xây hệ thống ký số. “Hàn: không thay đổi” được giữ về thao tác và dữ liệu sản xuất; chỉ bổ sung giá trị khởi tạo tình trạng chất lượng theo yêu cầu.

## 2. Hiện trạng đã đối chiếu trong mã nguồn

Các đường dẫn ở bảng này tính từ thư mục `quan-ly-nhan-su/`, trừ khi ghi rõ `supabase/` ở gốc kho mã.

| Thành phần | Hiện trạng quan sát được | Hướng xử lý |
| --- | --- | --- |
| `src/components/WeldAcceptanceReport.tsx` | Biểu mẫu nghiệm thu nhiệt nhôm nhập tay, dữ liệu trong React state, có `window.print()`, chưa lấy danh sách mối từ nhật ký trong component này | Dùng lại phần trình bày/in phù hợp; bổ sung dữ liệu thực, lưu hồ sơ và quy trình RFI/nghiệm thu |
| `src/components/WeldingJournalList.tsx` | Có thêm/sửa, import/export, lọc và xem mối; tình trạng đang có Chờ thí nghiệm/Đạt/Không đạt/Không thí nghiệm | Thêm kiểm tra sau mài, NDT, tình trạng tiến trình; cập nhật cả bảng, mobile, bộ lọc, chi tiết, import/export |
| `src/lib/weldReportData.ts` | Khai báo `WeldTestStatus`, đọc/ghi nhật ký, `resolveWeldTestStatus`, hàm tổng hợp và cache; thêm nhật ký có các nhánh RPC dự phòng | Giữ ý nghĩa trạng thái thí nghiệm cũ; thêm dữ liệu chất lượng, quy tắc tiến trình và đồng bộ cache |
| `src/lib/parseWeldJournalExcel.ts` | Định dạng import và file mẫu có cột `tinh_trang_thi_nghiem` | Không khiến Excel cũ tự thành nghiệm thu đạt; mở rộng mẫu nếu nghiệp vụ cần nhập kiểm tra qua Excel |
| `src/lib/weldingHistoryDb.ts` | Có đường đọc lịch sử và suy luận kết quả riêng; một số fallback trả “Đạt” | Rà soát để kết quả lịch sử không bị dùng làm bằng chứng hoàn thành nghiệm thu |
| `src/components/OverviewDashboard.tsx` | KPI “Đạt” đang theo mối sản xuất đã thí nghiệm; có đường dữ liệu chi tiết, tổng hợp nhanh và rollup; đã có tính ngày dữ liệu gần nhất | Đổi nguồn tính KPI nghiệm thu; kiểm tra lỗi ngày qua cả ba đường dữ liệu, không mặc định viết lại toàn bộ |
| `src/lib/overviewAggregates.ts`, `src/lib/weldDailyStats.ts` | Thống kê nhanh đang dựa vào kết quả thí nghiệm và các cột `so_dat`, `so_cho_tn` | Bổ sung thống kê nghiệm thu/chờ mài; không đổi nghĩa âm thầm của các cột cũ |
| `src/components/DailyWorkReport.tsx`, `DailyWorkReportPrint.tsx`, `src/lib/dailyReportDb.ts` | Đã có báo cáo ngày, nhân lực, thiết bị và bản in | Tái sử dụng dữ liệu/phần in phù hợp; kiểm tra độ phù hợp với mẫu nhật ký thi công trước khi dùng chung |
| `src/lib/mapPointsDb.ts` | Có lý trình và liên kết GPS với ID nhật ký hàn | Dùng làm nguồn lọc km; mối thiếu lý trình phải được hiển thị rõ |
| `src/lib/qualityMetadataClient.ts`, `src/app/api/quality-metadata/route.ts` | Có quản lý tiêu chuẩn/chứng chỉ chất lượng | Tận dụng danh mục tiêu chuẩn phù hợp; chưa thấy cấu hình số cho bốn dung sai trong các phần đã đọc |
| `supabase/migration_20260906_tinh_trang_thi_nghiem_nhat_ky_han.sql` | Ràng buộc DB chỉ cho bốn trạng thái thí nghiệm hiện hành | Không chỉ thêm nhãn trên giao diện rồi ghi trực tiếp vào cột cũ |
| `supabase/migration_20260922_fix_thong_ke_moi_han_so_moi.sql` và các migration tổng hợp | Có trigger/bảng/view tổng hợp theo ngày | Viết migration mới; bảo đảm thống kê thay đổi khi kiểm tra/nghiệm thu thay đổi |
| `src/components/AppShell.tsx`, `src/data/navigation.ts`, `src/lib/tabModules.ts` | Tab `bien-ban-moi-han` đã được gắn vào ứng dụng | Giữ đường vào hiện tại, tổ chức các phần nhật ký thi công/RFI/nghiệm thu/hồ sơ bên trong |

Đây là kết quả đọc mã nguồn cục bộ, chưa xác nhận schema, dữ liệu hay hành vi trên môi trường đang vận hành.

## 3. Những điểm phải chốt trước khi lập trình phần liên quan

### 3.1. RFI, RIF, FRI và thời điểm phát phiếu

Tài liệu dùng cả ba cách viết. Đề xuất thống nhất tên hiển thị **“Phiếu yêu cầu nghiệm thu (RFI)”** và chốt mã biểu mẫu chính thức với người phụ trách.

Phần đầu nói chỉ phát phiếu khi xong mài, xong siêu âm; phần tóm tắt nói chỉ cần trực quan, độ phẳng đạt và phiếu bao gồm thí nghiệm không phá huỷ. Cần xác nhận một trong hai luồng:

- **Phương án đề xuất:** mài + trực quan + hình học đạt → phát RFI mời kiểm tra/NDT → có kết quả NDT → nghiệm thu → hoàn thành.
- **Phương án thay thế theo hợp đồng dự án:** có đủ NDT đạt mới phát RFI nghiệm thu.

Chưa chốt thì chưa cố định điều kiện phát hành RFI. Có thể làm trước phần dữ liệu và nhập kiểm tra. Không mặc định phát RFI hàng ngày chỉ vì có sản xuất.

### 3.2. Dung sai và cách tính đạt

Hình bảng PQ trong Word thể hiện:

| Chỉ tiêu | Giá trị đọc từ tài liệu | Cách biểu diễn đề xuất, chờ xác nhận biên |
| --- | --- | --- |
| Theo chiều dọc trên mặt lăn | +0,40 / -0,10 mm | Khoảng hai phía bất đối xứng: -0,10 đến +0,40 |
| Theo chiều ngang trên nấm ray | ±0,40 mm | Khoảng -0,40 đến +0,40 |
| Theo chiều ngang trên các đầu chân ray | ±2,0 mm | Khoảng -2,0 đến +2,0 |
| Độ phẳng mặt lăn trên chiều dài khu vực mài | 0,20 mm | Giới hạn trên 0,20; cách xử lý dấu và miền đo cần xác nhận |

Đây là **ví dụ PQ trong tài liệu**, không tự áp dụng cho mọi dự án/công nghệ hàn. Không dùng một phép `giá trị < sai số` cho cả bốn chỉ tiêu: sẽ sai với ngưỡng âm và ngưỡng bất đối xứng.

Cần chốt: có nhận giá trị đúng bằng giới hạn không; làm tròn bao nhiêu chữ số; dấu đo theo hướng nào; chiều dài/thước đo áp dụng. Ghi chú trong hình: dung sai ngang dương làm tăng khổ đường, nên phải giữ dấu khi nhập và in.

### 3.3. Loại mối và yêu cầu thí nghiệm

Tài liệu yêu cầu Thử nghiệm/Chấp thuận tự chọn Chờ thí nghiệm, một số loại tự chọn Không thí nghiệm. Mã hiện tại có **Đào tạo, Thử nghiệm, Chấp thuận, Sản xuất, Tần suất**; chưa đủ căn cứ để gán mọi loại còn lại là Không thí nghiệm.

Cần một bảng quy tắc chính thức theo dự án/loại mối: có mài không, có đo hình học không, có NDT không, có tham gia nghiệm thu công việc không. Với mối miễn NDT, phải có căn cứ miễn; không đổi “Không thí nghiệm” thành “NDT đạt”.

### 3.4. Biểu mẫu, người ký và chỉnh sửa

Tài liệu ghi rõ **“Mẫu các loại biên bản và giải thích (Trinh bổ sung)”**. Cần nhận đủ mẫu theo dự án và FBW/ATW, trường bắt buộc, quy tắc số phiếu, các bên tham dự, người ký và căn cứ nghiệm thu.

Cần chốt thêm: nhật ký thi công có phải mẫu báo cáo ngày hiện tại không; số công nhân VNR lấy từ đâu; khối lượng nghiệm thu trong ngày có bắt buộc thể hiện không; một RFI có được nghiệm thu nhiều đợt không; phiếu giai đoạn lập mỗi lần hay theo mốc giai đoạn; cách lưu tình trạng ký. Chưa xác nhận quy định hợp đồng/pháp lý từ câu hỏi “Check quy định” trong Word; không coi nội dung này là kết luận pháp lý.

Đề xuất giữ “tất cả module open để chỉnh sửa” bằng cách cho sửa nháp và tạo bản sửa đổi khi hồ sơ đã phát hành. Việc sửa thông tin in không được tự thay kết quả đo hoặc làm hồ sơ đã ký đổi nội dung mà không có dấu vết. Cơ chế này cần thống nhất cùng người phụ trách hồ sơ.

## 4. Mô hình nghiệp vụ và dữ liệu đề xuất

### 4.1. Tách ba nhóm thông tin

**Kiểm tra nội bộ từng mối:** trực quan; bốn giá trị đo và kết luận hình học; phương pháp NDT mặc định Siêu âm, có Từ tính/Thẩm thấu; kết quả NDT; thời điểm và người ghi nhận. Giá trị chưa nhập là “Chưa kiểm tra”, không phải 0 hoặc Đạt.

**Tình trạng tiến trình:** Chờ mài, Chờ thí nghiệm, Không đạt, Nghiệm thu đạt; thêm cách hiển thị rõ “NDT đạt, chờ nghiệm thu” và “Không thí nghiệm” để người dùng không nhầm đã hoàn tất. Các nhãn bổ sung là đề xuất làm rõ khoảng trống trong tài liệu; chốt ở giai đoạn 0.

**Hồ sơ nghiệm thu:** RFI, danh sách mối trong RFI, đợt nghiệm thu, mối tham gia/loại trừ, bộ hồ sơ được sinh, phiên bản và tình trạng ký. Trạng thái hồ sơ khác với kết quả chất lượng của mối.

Không đổi tên hàng loạt giá trị `Đạt` trong `tinh_trang_thi_nghiem` thành `Nghiệm thu đạt`. Dữ liệu cũ chỉ chứng minh kết quả thí nghiệm, không chứng minh đã có nghiệm thu các bên.

### 4.2. Quy tắc chuyển tình trạng

| Sự kiện/điều kiện | Kết quả mong muốn |
| --- | --- |
| Tạo mối sản xuất mới | Chờ mài, chưa có kết luận trực quan/hình học/NDT |
| Mối Thử nghiệm hoặc Chấp thuận | Tự Chờ thí nghiệm theo yêu cầu; điều kiện mài/hình học trước RFI vẫn phải chốt riêng |
| Loại được miễn NDT theo quy tắc đã chốt | Không thí nghiệm, lưu căn cứ miễn; không tự nghiệm thu đạt |
| Đã mài, trực quan đạt, đủ bốn phép đo và trong dung sai | Chờ thí nghiệm nếu thuộc diện phải NDT |
| Trực quan hoặc hình học hoặc NDT không đạt | Không đạt, nêu tiêu chí lỗi và hướng xử lý |
| NDT đạt, chưa hoàn thành nghiệm thu | Giữ kết quả NDT đạt, hiển thị đang chờ nghiệm thu |
| Bỏ chọn vì chưa nghiệm thu trong đợt | Không xuất hiện trong khối lượng hoàn thành; không tự coi là lỗi chất lượng |
| Bỏ chọn vì không đạt | Loại khỏi danh sách được chấp nhận, ghi lý do và liên kết xử lý sửa chữa/hàn lại |
| Đủ tiêu chí, được chọn và bấm Hoàn thành nghiệm thu thành công | Nghiệm thu đạt, có liên kết đợt/hồ sơ đã lưu |
| Sửa phép đo/kết quả của mối đã nghiệm thu | Không giữ kết luận cũ âm thầm; yêu cầu xử lý bản sửa đổi và đánh giá lại phần bị ảnh hưởng |

### 4.3. Cấu trúc lưu tối thiểu

Tên bên dưới là tên **đề xuất**, chưa phải bảng/cột hiện hữu. Chốt tên theo quy ước dự án khi viết migration.

- `kiem_tra_moi_han`: liên kết ID `lich_su_moi_han`, trực quan, bốn số đo mm, phương pháp/kết quả NDT, thời gian mài/kiểm tra, người ghi nhận, ghi chú và phiên bản tiêu chí dùng để xét.
- Cấu hình dung sai theo dự án + công nghệ/loại áp dụng: bốn cặp giới hạn hoặc giới hạn trên, đơn vị mm, quy tắc biên và phiên bản. Tái sử dụng danh mục tiêu chuẩn hiện có khi phù hợp; không tạo hệ thống cấu hình tổng quát.
- `phieu_yeu_cau_nghiem_thu` + bảng chi tiết: dự án, số phiếu, ngày phát hành, ngày mời, phạm vi, các bên, trạng thái và các ID mối cụ thể.
- `dot_nghiem_thu` + bảng chi tiết: tham chiếu RFI, ngày/địa điểm/thành phần, mối hoàn thành, mối loại trừ và lý do. Nếu cho nghiệm thu nhiều đợt, chỉ lấy phần RFI còn lại.
- `ho_so_nghiem_thu`: loại biểu mẫu, phiên bản mẫu, tham chiếu đợt, dữ liệu đã chốt tại thời điểm phát hành, tình trạng ký và nơi lưu bản hồ sơ. Có thể lưu ba tài liệu trong một bộ hồ sơ nếu cách này đủ cho mẫu thực tế.
- Nhật ký thi công theo dự án/ngày: tận dụng báo cáo ngày hiện có nếu phù hợp; chỉ bổ sung bản chốt và thông tin VNR còn thiếu, không sao chép toàn bộ dữ liệu sản xuất sang một nguồn độc lập.

Liên kết bằng **ID ổn định**; không chỉ bằng tên/mã mối có thể được đồng bộ lại. Hồ sơ đã phát hành phải lưu tên/mã, số đo, dung sai, người tham gia và khối lượng tại thời điểm phát hành để in lại không bị thay theo dữ liệu nguồn mới.

## 5. Các giai đoạn thực hiện

Các ô dưới đây theo dõi công việc triển khai. Dấu hoàn thành của giai đoạn 1 phản ánh mã và kiểm thử cục bộ; điều kiện chạy trên bản sao DB thật vẫn cần được kiểm chứng trước triển khai. Mỗi giai đoạn chỉ kết thúc vận hành khi đạt tiêu chí đầu ra.

### Giai đoạn 0 — Chốt nghiệp vụ, mẫu và dữ liệu đối chiếu

**Mục tiêu:** giải quyết những chỗ chưa rõ của Word trước khi cố định quy tắc hệ thống.

- [ ] Người phụ trách chất lượng xác nhận các mục 3.1–3.4: luồng RFI/NDT, biên dung sai, bảng loại mối, cách sửa hồ sơ, nghĩa “Ngày gần nhất”.
- [ ] Nhận từ Trinh đủ 5 loại biểu mẫu và giải thích từng trường theo dự án/FBW/ATW; liệt kê mẫu còn thiếu.
- [ ] Lập bảng ánh xạ từng trường trên biểu mẫu sang nhật ký hàn, GPS, báo cáo ngày, dự án, nhân lực, thiết bị hoặc trường người dùng bổ sung.
- [ ] Chọn một dự án thí điểm; lấy bộ mối ví dụ có đủ đạt, lỗi, thiếu đo, chưa NDT, hàn lại, miễn NDT và dữ liệu cũ.
- [ ] Đối chiếu schema đang chạy với migration trong kho mã ở môi trường thử nghiệm; ghi nhận RPC/view thực sự hiện hữu.
- [ ] Thống kê dữ liệu cũ chỉ có Đạt/Không đạt và phương án xác nhận hồ sơ lịch sử nếu cần.

**Đầu ra:** bảng quy tắc đã chốt, bộ mẫu có phiên bản, bảng nguồn dữ liệu và bộ tình huống nghiệm thu. Có thể tiếp tục phần không phụ thuộc mẫu; chưa công bố bản in chính thức khi chưa nhận mẫu.

### Giai đoạn 1 — Bổ sung nền dữ liệu và quy tắc chất lượng

**Phụ thuộc:** quy tắc cốt lõi giai đoạn 0. **Phạm vi:** migration mới trong `supabase/`, `weldReportData.ts`, lớp dữ liệu chất lượng và các view/RPC liên quan.

- [x] Tạo cấu trúc kiểm tra từng mối, cấu hình bốn dung sai và các hồ sơ theo mục 4.3; không xoá/tạo lại bảng sản xuất.
- [x] Tạo khoá ngoại, ràng buộc phương pháp/kết quả, giới hạn số đo hữu hạn, khoảng dưới không lớn hơn khoảng trên và chỉ mục theo mối/dự án/ngày.
- [x] Viết bộ quy tắc TypeScript và DB để xét trực quan/hình học/NDT, điều kiện RFI và điều kiện hoàn thành; có test đối chiếu.
- [x] Cho phép nhập dấu âm, số 0 và số thập phân; phân biệt để trống với số 0, chuẩn hoá trước khi lưu.
- [x] Bổ sung transaction, khoá dòng, phiên bản kiểm tra và ràng buộc chống hoàn thành trùng; kiểm thử lần gọi lặp, chưa thử nhiều kết nối đồng thời.
- [x] Giới hạn dữ liệu/RPC chất lượng cho `service_role` qua lớp `server-only`; không mở HTTP endpoint hoặc cấp quyền từ người dùng giả lập trên UI.
- [x] Giữ dữ liệu cũ nguyên trạng; không suy ra đã nghiệm thu từ số lỗi/NDT Đạt; có view danh sách cần bổ sung/xác minh.
- [x] Rà soát đầu vào/fallback và khởi tạo nguyên tử bằng trigger tại bảng gốc; kiểm thử insert bằng quyền `anon` và thao tác xoá mối trống.
- [x] Chạy thử migration trên schema thật rồi hoàn tác; áp dụng DB thật theo yêu cầu người dùng và đối soát số dòng, dấu kiểm tra dữ liệu, RLS/quyền/view/RPC/trigger sau commit.
- [ ] Kiểm thử bổ sung trên bản sao đầy đủ và nhiều kết nối đồng thời trước khi mở luồng nghiệm thu cho người dùng ở các giai đoạn sau.

**Tiêu chí hoàn thành:** migration chạy được trên bản sao dữ liệu; dữ liệu sản xuất và các liên kết cũ giữ nguyên; giới hạn âm/dương được xét đúng; ghi hồ sơ lỗi giữa chừng không để mối ở trạng thái đã nghiệm thu.

### Giai đoạn 2 — Sửa Nhật ký hàn: mài, trực quan, hình học và NDT

**Phụ thuộc:** giai đoạn 1. **Phạm vi:** `WeldingJournalList.tsx`, lớp dữ liệu nhật ký, mẫu/import/export Excel, các đường tạo hàng loạt.

- [x] Thêm phần Kiểm tra sau mài: ngày mài, trực quan, bốn phép đo; hiện dung sai và kết luận từng chỉ tiêu.
- [x] Thêm NDT: mặc định Siêu âm, chọn Từ tính/Thẩm thấu, ngày, Đạt/Không đạt và ghi chú kiểm tra.
- [x] Chọn nhiều và Đạt tất trực quan/NDT chỉ trên tập đã chọn, nêu số lượng và không tự điền hình học.
- [x] Tách chọn trang hiện tại/toàn bộ kết quả lọc, giữ ID khi chuyển trang và bỏ chọn khi đổi bộ lọc.
- [x] Tự tính tình trạng; hiển thị chỉ tiêu thiếu/lỗi và lý do chưa đủ điều kiện RFI.
- [x] Dùng trigger bảng gốc đã triển khai để khởi tạo cho nhập đơn/nhiều/Excel/Autolisp; giữ dữ liệu cũ và quy tắc miễn NDT cho đến khi có tiêu chí xác nhận.
- [x] Cập nhật desktop/mobile/chi tiết/form sửa/lọc/Excel/mẫu; kết quả cũ không tạo kết luận nghiệm thu.
- [x] Làm mới cache/báo cáo/rollup, đồng bộ NDT nguyên tử và báo lỗi từng mối khi thao tác hàng loạt.
- [ ] Cấu hình Basic Auth, đăng nhập và kiểm thử nhập–lưu–mở lại trên ứng dụng thật trước khi sử dụng vận hành.

**Tiêu chí hoàn thành:** tạo mối → mài → nhập kiểm tra → NDT chạy đúng theo loại; tải lại trang vẫn còn dữ liệu; nhập một chỉ tiêu ngoài giới hạn là Không đạt; chưa đo không trở thành Đạt; kiểm tra hàng loạt không ghi nhầm mối.

### Giai đoạn 3 — Nhật ký thi công tự lưu theo ngày

**Phụ thuộc:** bảng ánh xạ/mẫu ở giai đoạn 0 và nền dữ liệu giai đoạn 1; có thể triển khai độc lập với giao diện NDT sau khi ổn định dữ liệu.

- [ ] Bên trong module Biên bản mối hàn có phần Nhật ký thi công, lọc dự án và ngày/khoảng ngày.
- [ ] Tự lấy khối lượng từ mối thực tế trong nhật ký, không đếm theo số lần in hay số bản RFI; giữ cách đếm thống nhất với báo cáo hiện có.
- [ ] Tự điền dự án, ngày, vị trí, máy, nhân lực, thời gian và dữ liệu khác đã có theo bảng ánh xạ; thông tin không có phải để bổ sung, không lấy số giả.
- [ ] Có cách khai báo số người VNR ở ô công nhân, phạm vi VNR và công việc hàn ray; tránh đếm một người hai lần giữa các nguồn nhân lực.
- [ ] Với FBW, điền đúng nội dung **“Hàn ray chảy giáp mép trên tuyến”**; ATW theo mẫu đã chốt, không dùng chung mô tả FBW.
- [ ] Tự lưu theo dự án/ngày khi dữ liệu nguồn thay đổi hoặc bổ sung; phân biệt dữ liệu tự điền với nội dung người dùng sửa để không ghi đè phần đã sửa.
- [ ] Khi có nghiệm thu, thể hiện khối lượng nghiệm thu trong ngày nếu mẫu yêu cầu, tách rõ ngày hàn và ngày nghiệm thu.
- [ ] In một ngày hoặc nhiều ngày; mỗi ngày có phần thông tin và chữ ký đúng mẫu. In lại không tạo nhật ký trùng.

**Tiêu chí hoàn thành:** khối lượng đối chiếu khớp nhật ký hàn; nhân lực VNR không bị bỏ sót; thông tin sửa tay tồn tại sau tải lại; bản in nhiều ngày không lẫn dự án/ngày.

### Giai đoạn 4 — Lập và phát Phiếu yêu cầu nghiệm thu (RFI)

**Phụ thuộc:** giai đoạn 1–2 và quyết định thứ tự RFI/NDT ở giai đoạn 0. **Phạm vi:** phần RFI trong tab hiện có, lớp dữ liệu, truy vấn lý trình và mẫu phiếu.

- [ ] Chọn một dự án cho một phiếu; tìm theo tên/mã mối và hỗ trợ từ mối–đến mối, từ ngày–đến ngày, từ km–đến km.
- [ ] Chốt cách sắp thứ tự khoảng mã mối, không dùng so sánh chuỗi làm “mối 10” đứng trước “mối 2”. Chuẩn hoá lý trình về giá trị số khi lọc km.
- [ ] Giữ tập ID đã chọn khi chuyển trang; không giới hạn ngầm ở trang hiện tại hoặc giới hạn mặc định của truy vấn Supabase.
- [ ] Kiểm tra điều kiện trên từng mối: trực quan đạt, đủ đo hình học đạt và NDT nếu luồng đã chốt yêu cầu; hiển thị mối bị loại cùng lý do.
- [ ] Mối thiếu lý trình không tự lọt vào khoảng km; vẫn cho tìm/chọn bằng mã nếu đủ điều kiện khác.
- [ ] Tự điền các bên, ngày, địa điểm, phạm vi và mối; cho sửa thông tin hồ sơ, xem trước và lưu nháp trước phát hành.
- [ ] Phát hành lưu số phiếu, phiên bản, danh sách ID và dữ liệu chốt; xem/in lại được sau khi thoát màn hình.
- [ ] Ngăn đưa cùng mối vào nhiều RFI đang có hiệu lực ngoài quy tắc cho phép; sửa/huỷ phiếu phải giữ khả năng truy vết.

**Tiêu chí hoàn thành:** phiếu chỉ chứa mối đúng dự án, đúng tập chọn và đủ điều kiện; không tự phát theo ngày sản xuất; tải lại/in lại đúng khối lượng đã phát hành.

### Giai đoạn 5 — Nghiệm thu theo RFI và Hoàn thành nghiệm thu

**Phụ thuộc:** giai đoạn 4 và dữ liệu NDT giai đoạn 2. **Phạm vi:** phần nghiệm thu, RPC/API hoàn thành, đồng bộ tình trạng và lỗi/hàn lại.

- [ ] Mở đợt nghiệm thu từ RFI đã phát; tự lấy các mối còn hiệu lực, các bên và khối lượng trong phiếu.
- [ ] Mặc định chọn “Hoàn thành” các mối trong phạm vi theo Word; mặc định này chỉ là lựa chọn, không tự tạo kết quả kiểm tra Đạt.
- [ ] Cho bỏ chọn từng mối và chọn lý do: chưa nghiệm thu, chưa hoàn thành hoặc không đạt. Mối lỗi được giữ trong lịch sử và danh sách cần khắc phục.
- [ ] Cho cập nhật kết quả thực tế khi nghiệm thu; kiểm tra lại trực quan/hình học/NDT theo yêu cầu và làm rõ mục “Kiểm tra” còn dang dở trong Word ở giai đoạn 0.
- [ ] Trước hoàn thành, hiển thị tổng mối RFI, mối được chấp nhận, mối loại trừ, thiếu tiêu chí và những hồ sơ sẽ sinh.
- [ ] Server/DB kiểm tra lại phiên bản và điều kiện từng mối; không tin riêng ô tích trên trình duyệt, không cho kết thúc với 0 mối được chấp nhận.
- [ ] Một transaction lưu đợt, danh sách được chấp nhận/loại trừ, dữ liệu chốt của ba hồ sơ và trạng thái Nghiệm thu đạt; không thành công một nửa.
- [ ] Nếu có bước tạo file bên ngoài transaction, lưu trạng thái tạo file và cho thử lại từ dữ liệu đã chốt; lỗi in/tạo file không bắt người dùng nghiệm thu lần nữa.
- [ ] Liên kết sửa chữa/hàn lại với mối gốc bằng cơ chế đang có; không xoá lỗi gốc khi phát sinh mối thay thế và không đếm mối bị loại vào khối lượng đạt.
- [ ] Sau thành công, cập nhật nhật ký, RFI còn lại, kho hồ sơ và Dashboard; có thể mở bộ hồ sơ để in ngay.

**Tiêu chí hoàn thành:** với RFI 10 mối, chấp nhận 8 và loại 2 thì biên bản, trạng thái và KPI chỉ tăng 8; bấm lại không tạo thêm đợt/hồ sơ; hai người cùng hoàn thành không ghi nhận trùng; lỗi lưu không tạo trạng thái nghiệm thu đạt giả.

### Giai đoạn 6 — Hoàn thiện đủ 5 biểu mẫu, lưu trữ và in

**Phụ thuộc:** mẫu chính thức giai đoạn 0, dữ liệu từ giai đoạn 3–5. Phần dựng mẫu có thể làm trước, nhưng phải kiểm thử với dữ liệu thật của quy trình.

| Loại biểu mẫu theo Word | Thời điểm hình thành | Dữ liệu chính |
| --- | --- | --- |
| Nhật ký thi công | Theo ngày sản xuất | Dự án/ngày, nhân lực gồm VNR, thiết bị, công việc, khối lượng |
| Phiếu yêu cầu nghiệm thu | Khi phát RFI | Phạm vi, danh sách mối, các bên, lịch mời và nội dung kiểm tra |
| Phiếu nghiệm thu hoàn thành công việc xây dựng | Khi hoàn thành nghiệm thu | Kết quả thực tế, khối lượng được chấp nhận, căn cứ và thành phần |
| Phụ lục nghiệm thu công việc xây dựng | Cùng đợt nghiệm thu | Danh sách mối được chấp nhận và dữ liệu chi tiết theo mẫu |
| Phiếu nghiệm thu giai đoạn xây dựng | Theo yêu cầu sinh hồ sơ của Word; cần chốt mốc áp dụng | Thông tin giai đoạn/phạm vi và khối lượng đã được chấp nhận |

- [ ] Chọn mẫu theo dự án và công nghệ FBW/ATW; không dùng cứng mẫu nhiệt nhôm hiện tại cho mọi loại.
- [ ] Lập ánh xạ trường và kiểm tra trường bắt buộc cho từng mẫu; tự điền tối đa từ dữ liệu đã lưu, cho sửa nội dung được phép trước phát hành.
- [ ] Kho hồ sơ lọc theo dự án, loại phiếu, số phiếu, ngày, RFI/đợt và tình trạng ký; có xem lại, sửa theo quy tắc phiên bản, in riêng hoặc in bộ.
- [ ] Bản đã phát hành dùng dữ liệu chốt, không kéo lại số đo/tên mối mới khi in; bản sửa đổi lưu quan hệ với bản trước.
- [ ] Lưu tình trạng chờ ký/đã ký và file ký nếu nghiệp vụ xác nhận cần; không coi “Hoàn thành nghiệm thu” đồng nghĩa “Đã ký”.
- [ ] Dùng chức năng in/PDF qua trình duyệt hiện có trước; chỉ bổ sung cách lưu file máy chủ nếu yêu cầu lưu trữ chính thức cần. Phân biệt lưu dữ liệu hồ sơ với lưu một file PDF trên máy chủ.
- [ ] Kiểm tra A4 theo mẫu: hướng giấy, nhiều trang, lặp tiêu đề bảng, ngắt trang, vùng chữ ký, dấu tiếng Việt và các dòng dài; ẩn nút thao tác khi in.

**Tiêu chí hoàn thành:** một đợt tạo được đúng bộ ba hồ sơ theo mẫu đã chốt, còn hai mẫu trước đó liên kết đầy đủ; tổng mối giữa RFI/biên bản/phụ lục đối chiếu được; tải lại và in lại vẫn đúng phiên bản; chưa có mẫu thì không ghi “đã hoàn thiện mẫu chính thức”.

### Giai đoạn 7 — Sửa Dashboard và đồng bộ các báo cáo

**Phụ thuộc:** quy tắc trạng thái giai đoạn 1 và hoàn thành nghiệm thu giai đoạn 5.

- [ ] Đổi thẻ “Đạt” thành **“Nghiệm thu đạt”** và đếm theo mối thực sự thuộc đợt nghiệm thu hoàn thành; cập nhật cả danh sách mở ra khi bấm thẻ.
- [ ] Bổ sung **“Chờ mài”**, có drill-down đúng danh sách, bộ lọc dự án và kỳ báo cáo như các thẻ khác.
- [ ] Giữ Dự án, Tổng số mối hàn thực hiện, Hôm nay, Không đạt, Mối hàn lại, Chờ thí nghiệm theo yêu cầu; đối chiếu lại tập dữ liệu để không làm đổi chỉ số ngoài phạm vi.
- [ ] Chốt “Ngày gần nhất”: mặc định đề xuất là ngày có sản xuất gần nhất trong bộ lọc, không nhận ngày tương lai. Nếu nghiệp vụ muốn “ngày gần nhất trước hôm nay”, áp dụng điều kiện riêng đã thống nhất.
- [ ] Kiểm tra nguồn `latestDailyPoint`, ngày thật, chuỗi biểu đồ và rollup; mã hiện tại đã có tính ngày gần nhất nên cần tái hiện lỗi trước khi sửa.
- [ ] Đồng bộ chỉ số mới ở ba nguồn: chi tiết nhật ký, `overviewAggregates.ts` và `weldDailyStats.ts`; bổ sung cột thống kê/trigger/view tương ứng thay vì chỉ đổi tên thẻ.
- [ ] Quy định ngày dùng khi lọc: ngày hàn hay ngày nghiệm thu. Đề xuất giữ kỳ sản xuất của Dashboard hiện tại và đếm số mối trong kỳ đó đã nghiệm thu; báo cáo riêng theo ngày nghiệm thu nếu mẫu yêu cầu.
- [ ] Sửa mô tả phần trăm của thẻ mới cho đúng mẫu số đã chốt; không giữ câu “số mối sản xuất đã thí nghiệm” nếu đang thể hiện tỷ lệ nghiệm thu trên tổng sản xuất.
- [ ] Rà soát `QualityReportDashboard.tsx`, `YearlyWeldReport.tsx`, lịch sử hàn, thống kê lỗi và LWR/GPS để tiếp tục phân biệt NDT Đạt với Nghiệm thu đạt; không đổi nghĩa các chỉ số thí nghiệm mà không có yêu cầu.
- [ ] Đồng bộ cache/hook khi hoàn thành hoặc sửa hồ sơ, để Dashboard không giữ số cũ trong khi nhật ký đã đổi.

**Tiêu chí hoàn thành:** KPI khớp danh sách bấm xem ở mọi nguồn dữ liệu; ngày không có sản xuất hiển thị Hôm nay = 0 và Ngày gần nhất = ngày có dữ liệu thực; NDT đạt nhưng chưa nghiệm thu không được đếm Nghiệm thu đạt.

### Giai đoạn 8 — Kiểm thử tích hợp, chuyển đổi và bàn giao

**Phụ thuộc:** giai đoạn 1–7; việc kiểm thử đơn vị phải thực hiện ngay trong mỗi giai đoạn, không dồn hết về cuối.

- [ ] Chạy các ca kiểm tra ở mục 7 trên dự án thí điểm và bản sao dữ liệu cũ; kiểm tra desktop/mobile và in/PDF.
- [ ] Dùng cách kiểm thử sẵn có của kho mã, bổ sung các bài nhỏ cho dung sai, chuyển trạng thái, điều kiện RFI và hoàn thành trùng; không thêm framework chỉ cho thay đổi này.
- [ ] Chạy lint, kiểm tra TypeScript và build từ `quan-ly-nhan-su`; thực hiện test hồi quy nhật ký/phân trang/Autolisp/GPS/báo cáo liên quan. Ghi lệnh và kết quả thực tế khi triển khai.
- [ ] Sao lưu DB và thống kê số bản ghi trước chuyển đổi; chạy migration mới trong môi trường thử nghiệm trước, kiểm tra lại số mối/liên kết/RPC/view/rollup sau chạy.
- [ ] Dữ liệu lịch sử chỉ được chuyển thành đã nghiệm thu khi có hồ sơ/căn cứ xác nhận, có báo cáo số lượng được chuyển và chưa chuyển.
- [ ] Thử một chu kỳ đầy đủ với người phụ trách chất lượng: nhập mối → kiểm tra → RFI → nghiệm thu một phần → sinh/in hồ sơ → ký/lưu lại.
- [ ] Triển khai theo thứ tự DB tương thích → ứng dụng → đối chiếu số liệu; nếu phát hiện sai lệch, dừng thao tác mới và khôi phục phiên bản ứng dụng phù hợp, giữ dữ liệu hồ sơ để đối soát.
- [ ] Cập nhật README ứng dụng: migration thực tế cần chạy, thao tác từng bước, ý nghĩa tình trạng, cách sửa/in lại và giới hạn còn lại. Không thay hướng dẫn DB hiện có bằng suy đoán.

**Tiêu chí hoàn thành:** người phụ trách chất lượng xác nhận đúng quy trình/mẫu; số liệu trước/sau đối chiếu được; không mất dữ liệu; có hướng dẫn và phương án quay lui đã thử.

## 6. Bản đồ ảnh hưởng phải rà soát khi thực hiện

Không phải mọi file đều cần sửa. Các nơi sau phải được kiểm tra vì đang tạo, đọc hoặc suy luận dữ liệu có liên quan:

- **Đầu vào:** `WeldingJournalList.tsx`, `BulkAutolispWeldDialog.tsx`, `bulkCreateWeldsFromAutolisp.ts`, `parseWeldJournalExcel.ts`, `weldingHistoryDb.ts`, các RPC thêm nhật ký trong `supabase/`.
- **Dữ liệu dùng chung:** `weldReportData.ts`, `weldDailyStats.ts`, `overviewAggregates.ts`, `useWeldReportData.ts`, `useWeldDailyRollup.ts`, `useOverviewAggregates.ts` và logic xoá cache.
- **Giao diện/hồ sơ:** `WeldAcceptanceReport.tsx`, `DailyWorkReport.tsx`, `DailyWorkReportPrint.tsx`, `dailyReportDb.ts`, `AppShell.tsx`, `navigation.ts`, `tabModules.ts`, các nhãn dịch cần thiết trong `src/i18n/`.
- **Đọc phụ thuộc:** `WeldingHistoryList.tsx`, `QualityReportDashboard.tsx`, `YearlyWeldReport.tsx`, `ErrorLibrary.tsx`, `MachineAssignmentList.tsx`, `machineRunSchedulesDb.ts`, `src/features/lwr/lib/weld-journal.ts` và `src/features/lwr/types/weld.ts`.
- **Dự án/tiêu chuẩn/vị trí:** `projectsDb.ts`, `projectMetadataClient.ts`, `qualityMetadataClient.ts`, `mapPointsDb.ts`, các API tương ứng và nguồn lý trình `toa_do`.
- **Database:** bảng `lich_su_moi_han`, view `bao_cao_moi_han_theo_du_an`, lịch sử hàn, bảng/view/trigger `thong_ke_moi_han_theo_ngay`, RPC thêm nhật ký và các bảng mới. Tạo migration mới; không sửa migration lịch sử để giả định môi trường đã được cập nhật.
- **Kiểm thử/fixture:** tận dụng cách viết trong `scripts/`; rà soát `test-journal-pagination.mjs`, `test-overview-report.mjs` và các test LWR/nhập dữ liệu có dùng trạng thái. Bộ fixture mới cần cả dữ liệu thiếu, lỗi, đạt, miễn NDT và nghiệm thu một phần.

## 7. Bộ ca kiểm tra nghiệm thu tối thiểu

| Mã | Tình huống | Kết quả phải đạt |
| --- | --- | --- |
| KT-01 | Trực quan đạt, một hoặc nhiều số đo còn trống | Chưa đủ hình học, không được phát RFI theo điều kiện đề xuất |
| KT-02 | Nhập 0, số âm, dấu phẩy thập phân, giá trị không phải số | Số hợp lệ giữ đúng giá trị/dấu; dữ liệu không hợp lệ bị chặn và báo trường lỗi |
| KT-03 | Dọc mặt lăn: -0,11; -0,10; 0; +0,40; +0,41 | Hai giá trị ngoài khoảng không đạt; hai giá trị biên theo quyết định ở giai đoạn 0 |
| KT-04 | Ngang nấm/chân ray và độ phẳng tại biên, sát trong, sát ngoài | Kết quả đúng từng giới hạn; không dùng trị tuyệt đối cho khoảng bất đối xứng |
| KT-05 | Trực quan lỗi hoặc hình học lỗi dù NDT đạt | Không đạt; không được hoàn thành nghiệm thu |
| KT-06 | “Đạt tất” khi có phân trang, đổi lọc hoặc mối đang ẩn | Chỉ đúng tập ID người dùng đã chọn, không sửa ngoài phạm vi |
| KT-07 | Mối cũ có NDT Đạt và không có biên bản | Không tự thành Nghiệm thu đạt |
| KT-08 | Mối miễn NDT, mối Thử nghiệm/Chấp thuận và loại Đào tạo | Khởi tạo và điều kiện tham gia hồ sơ đúng bảng quy tắc; không mặc định miễn NDT là đạt |
| KT-09 | RFI lọc khoảng tên mối/ngày/km, dữ liệu hơn một trang | Danh sách đủ và đúng, không mất mối do phân trang; thiếu lý trình được chỉ rõ |
| KT-10 | Phát RFI khi chưa đủ điều kiện hoặc cùng mối đang thuộc phiếu hiệu lực khác | Chặn đúng ở server/DB, trả lý do rõ ràng |
| KT-11 | RFI 10 mối, chấp nhận 8, 1 chưa nghiệm thu, 1 lỗi | Hồ sơ hoàn thành chỉ có 8; mối chưa nghiệm thu không bị coi lỗi; mối lỗi còn lịch sử xử lý |
| KT-12 | Bấm Hoàn thành hai lần, hai người đồng thời, dữ liệu đổi trong lúc mở màn hình | Không trùng khối lượng/hồ sơ; dữ liệu cũ bị từ chối hoặc yêu cầu tải lại |
| KT-13 | Lỗi giữa transaction hoặc lỗi tạo PDF sau khi lưu | Không có hồ sơ nghiệp vụ dở dang; tạo/in file lại được mà không nghiệm thu trùng |
| KT-14 | Sửa dung sai, tên mối, nhân lực nguồn sau phát hành | Bản in cũ giữ đúng dữ liệu chốt; bản sửa đổi truy vết được |
| KT-15 | Nhật ký nhiều ngày, có FBW/ATW và nhân lực VNR | Đúng mẫu, đúng mô tả FBW, số người/máy/khối lượng không bị đếm trùng |
| KT-16 | Hôm nay không sản xuất, ngày cuối có sản xuất là hôm trước | Hôm nay = 0; Ngày gần nhất và danh sách chi tiết đúng quyết định nghiệp vụ |
| KT-17 | Dashboard dùng nguồn chi tiết, tổng hợp nhanh hoặc rollup | Cùng bộ lọc cho cùng KPI và danh sách, đặc biệt Chờ mài/Nghiệm thu đạt |
| KT-18 | Tải lại, chuyển thiết bị, mở lại RFI/hồ sơ | Dữ liệu đã lưu đầy đủ; không phụ thuộc state của một phiên trình duyệt |
| KT-19 | In bộ nhiều trang, tên dài, nhiều mối, chưa ký/đã ký | Không cắt cột/chữ ký; đủ trang và đúng phiên bản mẫu; không tự gắn Đã ký |
| KT-20 | Import Excel cũ, thêm hàng loạt Autolisp và sửa nhật ký đang có GPS | Không mất tương thích/liên kết; không tự sinh kết luận nghiệm thu |
| KT-21 | Người không có quyền gửi yêu cầu phát hành/hoàn thành trực tiếp | Bị chặn ở phía server/DB theo cơ chế quyền đã thống nhất |

## 8. Thứ tự ưu tiên, phụ thuộc và dự trù

Ước lượng dưới đây là **ngày công phát triển và kiểm thử**, chưa phải lịch cam kết; chưa tính thời gian chờ biểu mẫu, xác nhận nghiệp vụ, quyền môi trường hoặc làm sạch dữ liệu lịch sử.

| Giai đoạn | Ưu tiên | Dự trù | Điều kiện bắt đầu |
| --- | --- | --- | --- |
| 0. Chốt nghiệp vụ/mẫu | P0 | 1–2 ngày | Có người phụ trách chất lượng và đầu mối biểu mẫu |
| 1. Dữ liệu/quy tắc | P0 | 2–3 ngày | Chốt quy tắc cốt lõi và có DB thử nghiệm |
| 2. Nhật ký/kiểm tra | P0 | 2–3 ngày | Nền dữ liệu giai đoạn 1 |
| 3. Nhật ký thi công | P1 | 1–2 ngày | Có mẫu và ánh xạ dữ liệu |
| 4. RFI | P0 | 2–3 ngày | Kiểm tra nội bộ và điều kiện phát phiếu |
| 5. Nghiệm thu/hoàn thành | P0 | 2–3 ngày | RFI và kết quả NDT |
| 6. Biểu mẫu/lưu/in | P0 | 2–4 ngày | Đủ mẫu và dữ liệu hồ sơ |
| 7. Dashboard/báo cáo | P1 | 1–2 ngày | Nguồn trạng thái nghiệm thu ổn định |
| 8. Tích hợp/bàn giao | P0 | 2–3 ngày | Các luồng và biểu mẫu đã hoàn thiện |

Tổng dự trù khi thực hiện tuần tự: **15–25 ngày công**. Nếu mẫu hoặc quy tắc thay đổi, cập nhật dự trù sau giai đoạn 0. Không tách giao diện và DB thành hai đợt đưa lên thật khi chưa tương thích.

Các mốc bàn giao có thể kiểm chứng:

1. **Mốc A — Ghi nhận chất lượng:** hết giai đoạn 2, nhập/lưu/xét kiểm tra từng mối hoạt động; chưa tuyên bố đã có đủ hồ sơ nghiệm thu.
2. **Mốc B — Nghiệm thu được:** hết giai đoạn 4–5, có RFI, nghiệm thu một phần, hoàn thành có kiểm tra và lưu dữ liệu bộ hồ sơ.
3. **Mốc C — Hồ sơ dùng được:** hết giai đoạn 3 và 6, đủ 5 mẫu, đúng dự án/công nghệ, có sửa/lưu/in lại.
4. **Mốc D — Sẵn sàng vận hành:** hết giai đoạn 7–8, Dashboard khớp, hồi quy đạt, dữ liệu cũ an toàn và người phụ trách xác nhận.

## 9. Bảng đối chiếu yêu cầu Word với giai đoạn thực hiện

| Nội dung gốc | Nơi xử lý |
| --- | --- |
| Chọn mối theo tên/ngày; Hoàn thành tự điền/lưu/in | Giai đoạn 4–6 |
| Bảng Tiêu chí nghiệm thu: trực quan, bốn chỉ tiêu thẳng/phẳng, NDT | Giai đoạn 0–2 |
| Số hoá đầu vào; mặc định Siêu âm, thêm Từ tính/Thẩm thấu | Giai đoạn 1–2 |
| Hàn không thay đổi; sau mài nhập kiểm tra; sau siêu âm tick Đạt/Lỗi | Giai đoạn 2 |
| Mẫu theo dự án/loại hàn; Trinh bổ sung | Giai đoạn 0 và 6 |
| Nhật ký thi công: VNR, mô tả FBW, máy, khối lượng | Giai đoạn 3 |
| Nhật ký tự lưu theo ngày, in một/nhiều ngày | Giai đoạn 3 và 6 |
| RFI chỉ phát khi đủ điều kiện, chọn dự án/mối/ngày/km | Giai đoạn 0 và 4 |
| Nghiệm thu theo phiếu, mặc định khối lượng trong phiếu | Giai đoạn 5 |
| Loại mối chưa hoàn thành/không đạt để khắc phục hoặc hàn lại | Giai đoạn 5 |
| Hoàn thành sinh ba hồ sơ, lưu trữ và in | Giai đoạn 5–6 |
| Tất cả module cho chỉnh sửa | Giai đoạn 0, 3–6; sửa bản đã phát hành có lịch sử |
| Tình trạng Chờ mài/Chờ thí nghiệm/Nghiệm thu đạt/Không đạt/Không thí nghiệm | Giai đoạn 0–2 và 7 |
| Đạt tất cho trực quan/NDT, hình học tự xét dung sai | Giai đoạn 2 |
| Dashboard: Nghiệm thu đạt, Chờ mài, Ngày gần nhất | Giai đoạn 7 |
| Ký biên bản | Giai đoạn 0 và 6; không mặc định triển khai ký số |

## 10. Điều kiện nghiệm thu toàn bộ thay đổi

- [ ] Các điểm chưa rõ trong mục 3 đã có quyết định được ghi lại, biểu mẫu có người xác nhận.
- [ ] Mỗi mối truy được từ nhật ký → kiểm tra → RFI → đợt nghiệm thu → bộ hồ sơ.
- [ ] Không có đường nhập đơn/hàng loạt/import/RPC nào tự bỏ qua điều kiện bắt buộc để thành Nghiệm thu đạt.
- [ ] Các số liệu mối hàn, khối lượng RFI, khối lượng nghiệm thu, phụ lục và Dashboard đối chiếu được.
- [ ] Đủ 5 loại biểu mẫu theo phạm vi đã chốt; bản đã phát hành lưu/in lại được, thông tin thay đổi có phiên bản.
- [ ] Mối không đạt, mối chưa nghiệm thu và mối hàn lại được phân biệt; dữ liệu cũ không bị đổi kết luận thiếu căn cứ.
- [ ] Test nghiệp vụ/hồi quy, kiểm tra quyền, lint, TypeScript, build và kiểm tra bản in được ghi kết quả thực tế.
- [ ] Đã thử trên dự án thí điểm, có sao lưu và hướng dẫn vận hành/quay lui.

**Giới hạn:** mã và schema giai đoạn 1–2 đã triển khai như mục Tiến độ; nội dung nhật ký cũ không bị sửa khi chạy migration. Chưa cấu hình đăng nhập để bật luồng kiểm tra thực tế, chưa hoàn tất kiểm thử nhập–lưu bằng trình duyệt, chưa thử nhiều kết nối DB thật, chưa kiểm chứng phân trang toàn bộ Word và chưa xác nhận mẫu/quy định dự án. Các giai đoạn 3 trở đi và triển khai giao diện lên hosting chưa thực hiện. Không sửa Word gốc hoặc tạo dữ liệu thử trong DB thật. Các quyết định ở mục 3 vẫn cần xác nhận khi triển khai tiếp.
