# Tự động nhập, kiểm tra và trả lời về số tiền

Mặc định mới không yêu cầu nhân viên duyệt từng tài liệu để chatbot trả lời. Worker đọc/OCR, trích xuất JSON, chạy kiểm tra có quy tắc và lưu kết quả; PostgreSQL tổng hợp toàn bộ dữ kiện đủ căn cứ. Không tự đổi dữ kiện thành trạng thái được người duyệt.

## Luồng người dùng

1. Tạo/chọn kho và đưa tài liệu vào, hoặc cấu hình worker `--watch --project <UUID> --folder <đường dẫn tương đối>` để định kỳ quét thư mục máy chủ. Kết nối thư mục và quyền do quản trị cấu hình một lần. Chưa tự động liên thông mọi thư mục Google Drive của module cũ.
2. Worker tự xử lý hàng đợi. Mỗi tệp/phiên bản chỉ đọc một lần khi cache và checkpoint còn nguyên. Không phải mở màn kiểm tra rồi duyệt toàn bộ để hỏi.

   Khi chạy `--watch`, lỗi API tạm thời (timeout, 429, 5xx được hỗ trợ) tự thử lại sau thời gian chờ tăng dần; tối đa 4 lần nhận job. Tận dụng checkpoint, không lặp vô hạn. Lỗi khóa/quyền/cấu hình hoặc dữ liệu không hợp lệ không bị retry vô hạn để che lỗi.
3. Khách mở chatbot có sẵn, chọn đúng kho và hỏi. Hỏi về tiền dùng SQL; hỏi điều khoản lấy đoạn liên quan cho Codex đọc.
4. Màn Kho hồ sơ hiển thị tiến độ, tổng tự động, cảnh báo và nguồn. Phần **Kiểm tra hoặc sửa số liệu (tùy chọn)** dành cho sửa lỗi hoặc xác minh thêm.

## Ví dụ “83 file này bao tiền?”

Bot trình bày riêng `contract_total`, `accepted_total`, `paid_total`. Không cộng ba chỉ tiêu này với nhau. 83 tệp có thể gồm nhiều chứng từ của cùng một hợp đồng.

- Câu thông dụng ở lượt đầu được backend nhận diện, chạy 3 RPC SQL, không gọi Codex hoặc embedding.
- Có số lượng tệp trong câu hỏi thì đối chiếu với số tệp hiện có trong kho. Số lượng khác nhau: chưa trả tổng thay cho nhóm đó; yêu cầu chọn đúng phạm vi. Chưa hỗ trợ chọn một tập con chỉ bằng số lượng, ví dụ “2 trong 83 tệp”.
- Câu có mã hợp đồng/ngày chốt dùng planner Codex chọn hàm và tham số; chỉ gửi câu hỏi ngắn cùng schema, không gửi toàn bộ tệp.
- Trả số lượng tệp đã xử lý, dữ kiện chưa đủ căn cứ, bản ghi lặp và mâu thuẫn. Nguồn dẫn giới hạn 20 mỗi chỉ tiêu; phép tính vẫn dùng toàn bộ dữ kiện hợp lệ.
- Không có chứng từ thực chuyển thì trả chưa đủ căn cứ, không đổi thành 0 hoặc dùng số nghiệm thu thay thế.

## Kiểm tra tự động

`documentKnowledgeAutomatic.ts` kiểm tra số tiền khớp token tiền VND trong đoạn nguyên văn, không ghép tất cả chữ số thành một số. Kiểm tra ngày/mã hợp đồng trên trang nguồn, nhãn nghiệp vụ, đợt và chữ lũy kế. Chuyển khoản cần trạng thái hoàn thành và mã giao dịch có nhãn rõ; đề nghị không thành thực trả. Phụ lục cần phần tăng/giảm và số chứng từ, không lấy tổng mới làm phần tăng.

Mỗi dữ kiện có `automatic_check` riêng: phiên bản, đủ căn cứ hay chưa, định danh nghiệp vụ và lý do. Trùng cùng định danh và cùng giá trị được tính một lần; hai giá trị/ngày khác nhau cùng định danh gây mâu thuẫn và chặn chỉ tiêu liên quan. Tham chiếu chuyển khoản dùng cho nhiều hợp đồng cần căn cứ phân bổ; chưa có thì không tự cộng cả hai.

SQL giữ quy tắc số lũy kế bao gồm các đợt trước, chỉ cộng đợt sau; kiểm tra thứ tự kỳ/ngày và phụ lục thiếu hợp đồng gốc. Dữ kiện thiếu căn cứ bị loại khỏi phép tính và báo thiếu, không âm thầm coi đó là tổng đầy đủ. Tệp xử lý lỗi vẫn xuất hiện trong độ phủ.

Các kiểm tra này không chứng minh mọi lỗi OCR, phân loại hoặc bỏ sót đều đã được phát hiện. “Hoàn tất xử lý và kiểm tra tự động” là độ phủ kỹ thuật của dữ liệu hiện có, không phải xác nhận nghiệp vụ hoặc cam kết số đúng 100%.

## Tự động và xác minh thủ công

`dk_automatic_summary`: kết quả mặc định, gồm dữ kiện đủ kiểm tra tự động và dữ kiện đã được người xác minh; gắn nhãn **Kết quả tự động, chưa xác minh nghiệp vụ** khi còn dùng dữ kiện tự động.

`dk_financial_summary`: giữ nguyên luồng chỉ tính dữ kiện `approved`. Trong giao diện chọn **Cách tổng hợp → Chỉ số liệu đã xác minh thủ công**; API tương ứng `mode=verified`. Chat mặc định dùng tự động; yêu cầu chỉ số được người duyệt thì hướng dẫn dùng lựa chọn này.

Không tự cập nhật `reviewed_by`, `reviewed_at`, `status=approved` hoặc `review_state=verified`. Người phụ trách vẫn có thể loại/sửa dữ kiện và xác minh thêm. Số tự động giúp tra cứu vận hành; không gắn nhãn là đã đối soát kế toán.

## Triển khai và kiểm chứng

- Chạy file migration mới nhất; bổ sung `automatic_check` cho tài liệu/dữ kiện và RPC `dk_automatic_summary`. `dk_complete_job` nhận thêm `p_automatic` tùy chọn, còn tương thích lời gọi cũ 6 tham số. Hàm ghi chỉ cấp service role, hàm đọc kiểm tra membership.
- Pipeline chuyển `dk-v3:dk-auto-v1:...`. Tài liệu pipeline cũ cần quét/đăng ký lại để xử lý phiên bản mới; không tự coi dữ liệu chưa kiểm tra thành đủ căn cứ.
- `pnpm test:knowledge` có PostgreSQL/pgvector thật qua PGlite, phép thử 83 tài liệu không có bản duyệt thủ công, các ca trùng/mâu thuẫn/phạm vi và quyền truy cập.
- Đã gọi Gemini thật trên 3 trang chữ synthetic (hợp đồng, nghiệm thu lũy kế, chuyển khoản); các trường trích xuất qua kiểm tra nguồn tự động. Chưa nghiệm thu trên 83 hồ sơ thực tế của nhóm.
- Có thể chạy lại kiểm tra model bằng `pnpm knowledge:automatic:smoke -- --live`; lệnh có dùng hạn mức API và chỉ gửi 3 trang chữ synthetic.
- Supabase thật vẫn chưa chạy migration theo yêu cầu bàn giao; feature flag giữ false.
