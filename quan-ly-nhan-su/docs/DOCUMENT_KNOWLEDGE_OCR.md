# OCR: Gemini mặc định, PaddleOCR tùy chọn có kiểm chứng

Theo quyết định cuối của anh Huy, ưu tiên chất lượng và độ ổn định thay vì bắt buộc một engine: **Gemini là OCR mặc định đã thử; PaddleOCR-VL là lựa chọn server tùy chọn, chưa nghiệm thu model thật**. Máy dev không quyết định cấu hình máy vận hành. Nếu chọn Paddle, trang đã xử lý tốt không gọi Gemini; dự phòng có cờ riêng và giới hạn.

## Model được chọn

| Phần | Model/thư viện |
| --- | --- |
| Mặc định đã thử | Gemini 3.5 Flash-Lite API |
| Paddle tùy chọn cần nghiệm thu server | `PaddleOCR-VL-1.6-0.9B` + `PP-DocLayoutV3` |
| Profile classic để đối chiếu | `PP-OCRv6_small_det` + `latin_PP-OCRv5_mobile_rec` |
| Runtime | PaddleOCR 3.7.0, PaddleX 3.7.2, PaddlePaddle CPU 3.3.1 |
| PDF/ảnh mặc định đã thử | PyMuPDF 1.28.0, Pillow 12.2.0 |
| Dự phòng khi chọn Paddle | Gemini 3.5 Flash-Lite qua API hiện có |

Không dùng `PP-OCRv6_small_rec` làm mặc định: [issue #18254](https://github.com/PaddlePaddle/PaddleOCR/issues/18254) có xác nhận của maintainer về thiếu ký tự tiếng Việt có dấu trong dictionary; không được tự thay dictionary vì chỉ số lớp nhận dạng sẽ sai nếu model chưa được huấn luyện/xuất lại. Thử thật với Latin v5/v3 cũng làm mất dấu ở tên và nhãn tiếng Việt dù điểm trung bình cao, nên không được coi cấu hình classic là đạt tiếng Việt. Các số tiền synthetic đúng không bù cho lỗi mất tên/điều khoản.

Khi chọn Paddle, profile `vl` đọc block theo thứ tự layout, lưu cả bảng và nội dung block; không tự tạo điểm confidence khi model không cung cấp. Profile `classic` chỉ sắp dòng theo tọa độ, chưa khôi phục bảng nhiều cột/ô gộp. VL tăng yêu cầu tài nguyên; cần nghiệm thu trên server vận hành trước khi đổi mặc định. Trong đợt này mới kiểm tra contract/mock của adapter VL; việc tải/khởi tạo/inference đầy đủ chưa được xác nhận đạt. [Hướng dẫn PaddleOCR-VL](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html).

## Cài worker mặc định

Gemini mode chỉ cần `scripts/requirements-knowledge.txt` (PyMuPDF/Pillow), không tải Paddle hoặc model weights. Gemini key chỉ ở Node worker, không truyền cho Python. Cấu hình mặc định trong `.env.example`:

```dotenv
KNOWLEDGE_OCR=gemini
```

`pnpm knowledge:ocr:check` kiểm tra dependency của engine được chọn. `pnpm knowledge:smoke -- --live` kiểm tra API thật với ảnh/PDF tiếng Việt synthetic, có sử dụng hạn mức API. Không tự chuyển sang engine chưa nghiệm thu nếu API hỏng; job báo lỗi và giữ checkpoint.

## Cài Paddle trên server để nghiệm thu

Khuyến nghị Python 3.12 và venv riêng. Windows CPU:

```powershell
cd quan-ly-nhan-su
python -m venv .venv-knowledge
.\.venv-knowledge\Scripts\python.exe -m pip install -r scripts/requirements-knowledge-paddle.txt
```

Linux CPU:

```bash
python3.12 -m venv .venv-knowledge
.venv-knowledge/bin/python -m pip install -r scripts/requirements-knowledge-paddle.txt
```

Đặt `KNOWLEDGE_PYTHON` thành executable của venv trên **máy worker**, không sao chép đường dẫn máy dev. Cấu hình ví dụ dùng CPU; chưa xác nhận RAM và thời gian inference thực của VL. Server GPU có thể dùng wheel `paddlepaddle-gpu` chính thức phù hợp CUDA thay cho dependency CPU và đặt `KNOWLEDGE_PADDLE_DEVICE=gpu:0`. Chưa nghiệm thu GPU trong đợt này. [Hướng dẫn PaddleOCR](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html).

```dotenv
KNOWLEDGE_OCR=paddle
KNOWLEDGE_OCR_FALLBACK=gemini
KNOWLEDGE_PADDLE_PROFILE=vl
KNOWLEDGE_PADDLE_DET_MODEL=PP-OCRv6_small_det
KNOWLEDGE_PADDLE_REC_MODEL=latin_PP-OCRv5_mobile_rec
KNOWLEDGE_PADDLE_DEVICE=cpu
KNOWLEDGE_PADDLE_CPU_THREADS=4
KNOWLEDGE_OCR_DPI=220
KNOWLEDGE_OCR_MIN_CONFIDENCE=0.85
KNOWLEDGE_OCR_TIMEOUT_SECONDS=600
KNOWLEDGE_OCR_MAX_FALLBACK_PAGES=20
```

`KNOWLEDGE_PADDLE_HOME` tùy chọn: thư mục model cache private trên ổ bền của worker; không public hoặc commit model weights. Lần đầu tải model qua nguồn chính thức BOS, cần mạng. Chạy preflight đến khi tải xong trước khi nhận hàng đợi. Timeout 600 giây tính từ lúc bắt đầu/chờ trang kế tiếp; điều chỉnh sau khi đo server. MKL-DNN được tắt trong baseline để tránh lỗi oneDNN/PIR đã gặp ở một số bản Windows; CPU threads có cấu hình rõ.

Chỉ sau khi đã chọn `KNOWLEDGE_OCR=paddle`, chạy preflight để tải và khởi tạo đúng model trước khi nhận tài liệu:

```powershell
pnpm.cmd knowledge:ocr:check
# Chạy model thật trên ảnh/PDF tiếng Việt synthetic; không gọi Google.
pnpm.cmd knowledge:ocr:smoke -- --live
pnpm.cmd knowledge:worker -- --watch
```

## Quy tắc xử lý

1. PDF có lớp chữ đủ dùng được lấy trực tiếp. Trang có ảnh chiếm phần lớn diện tích vẫn OCR dù có header chọn được. Trang trắng thuần được giữ lại và không tải model/gọi API.
2. Trang cần OCR render 220 DPI, giới hạn khoảng 16 triệu pixel; ảnh upload áp dụng EXIF orientation và giới hạn kích thước. PDF và PNG/JPEG/WebP đều qua cùng cơ chế chọn engine.
3. VL giữ các block và tọa độ theo thứ tự đọc; confidence là null, không áp ngưỡng 85% giả tạo. Classic giữ mọi dòng/hộp chữ/điểm, không bỏ dòng vì điểm thấp. Điểm trung bình thấp hơn ngưỡng hoặc tỷ lệ dòng dưới ngưỡng >15% đánh dấu dự phòng. Classic có chữ cái còn thêm `DK_OCR_CHARSET_REVIEW` vì dictionary không bảo đảm tiếng Việt; nội dung chỉ số có thể dùng trực tiếp. Đây là heuristic định tuyến, không phải chứng minh dữ kiện đúng.
4. Khi bật fallback, trang trống kết quả/không hợp lệ, lỗi inference theo trang hoặc tín hiệu chất lượng thấp được gửi tới Gemini. Các lỗi cứng vượt giới hạn/dữ liệu không hợp lệ vẫn dừng job. Không thể tự phát hiện mọi lỗi nội dung VL từ điểm số. Chỉ kết quả dự phòng hoàn tất mới lưu checkpoint. Giữ chữ Paddle gốc trong metadata để đối soát; ghi rõ engine cuối, cờ fallback và nguyên nhân. Nếu Gemini lỗi hoặc trả chữ ít hơn nửa phần Paddle đã đọc thì job thất bại có mã lỗi, không âm thầm chấp nhận phần thiếu.
5. Thiếu package/model hoặc lỗi khởi tạo Paddle là lỗi cấu hình và dừng job. Không tự gửi cả kho lên Gemini để che lỗi cài đặt. Sửa môi trường rồi retry. Timeout giết process OCR con để không treo worker vô hạn.
6. Khi dùng Paddle, tối đa 20 trang fallback mỗi tài liệu, tính cả checkpoint đã dùng fallback. Vượt mức báo `DK_OCR_FALLBACK_LIMIT`; người vận hành kiểm tra nguyên nhân rồi quyết định tăng giới hạn. Giới hạn 0 tắt fallback tự động về mặt ngân sách. Giới hạn này không áp cho mode Gemini chính; mode đó chủ động dùng API cho mọi trang cần OCR.
7. `KNOWLEDGE_OCR_FALLBACK=none` giữ OCR trên máy: trang còn chữ nhưng điểm thấp được giữ kèm cảnh báo để đối soát; trang không đọc ra chữ bị lỗi để tránh xác nhận nhầm hồ sơ rỗng. Muốn chủ động dùng toàn bộ OCR qua API có thể đặt `KNOWLEDGE_OCR=gemini` như bản trước.

Worker lưu checkpoint theo trang; retry gửi danh sách trang hoàn tất cho Python để bỏ qua cả bước Paddle inference, không chỉ bỏ lời gọi Gemini. Các tham số model, DPI, ngưỡng, fallback và phiên bản pipeline nằm trong fingerprint. Đổi cấu hình cần quét/đăng ký lại nguồn để tạo revision mới và duyệt dữ kiện lại; không trộn cache cũ.

Metadata nhận dạng được lưu ở `dk_pages.ocr_meta`; trang nguồn trên UI thể hiện engine, điểm và cảnh báo. Người duyệt phải mở ảnh/PDF gốc để kiểm tra tiền, ngày, mã hợp đồng. Không coi điểm 95% là dữ kiện đúng 95%, không tự duyệt số tiền bằng điểm OCR.

## Những phần vẫn dùng Gemini

Thay OCR chính không làm cả hệ thống offline. Trích xuất JSON từ chữ và embedding vẫn dùng Gemini API như bản đã triển khai; Codex vẫn dùng cho điều phối/diễn giải. `KNOWLEDGE_OCR_FALLBACK=none` chỉ tắt gửi ảnh dự phòng, không tắt hai bước API văn bản đó.

Schema mới chưa chạy trên database thật theo yêu cầu bàn giao. Migration hiện có đã thêm cột JSONB `dk_pages.ocr_meta`; đồng nghiệp cài file SQL mới nhất hoặc chạy lại file trên database đã cài bản trước. Không có cột metadata, worker sẽ dừng khi publish thay vì bỏ mất thông tin nhận dạng.
