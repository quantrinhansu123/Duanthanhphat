# Hướng dẫn giải trình — Đồng bộ mã mối hàn

**Phần mềm:** Quản lý hàn ray / nhật ký mối hàn  
**Ngày lập:** 26/10/2026  
**Mục đích tài liệu:** Giải trình logic đánh số, luồng nhập liệu và cách tra cứu khi kiểm tra, nghiệm thu hoặc đối chiếu hiện trường.

---

## 1. Vì sao cần đồng bộ?

Trên công trường, **một mối hàn** xuất hiện ở ba nơi với ba cách đánh số khác nhau:

| Nguồn | Ai tạo | Mục đích | Ví dụ |
|--------|--------|----------|--------|
| **Thiết kế Autolisp / CAD** | Phần mềm thiết kế tuyến | Định vị trên bản vẽ, Km, tọa độ | `HT0166`, `TP0169` |
| **Máy hàn** | Log máy UN5 / K922 | Theo dõi thông số kỹ thuật trên thiết bị | UN5: `2026-9-11-001` · K922: `42` |
| **Hiện trường (sơn bụng ray)** | Tổ thi công sơn lên ray | Nhận diện nhanh tại hiện trường | `FBW-25-08-26-0001` |

Nếu không liên kết, khi cần đối chiếu “mối số bao nhiêu trên máy = điểm nào trên bản vẽ = chữ sơn nào trên ray” sẽ phải tra tay, dễ sai và chậm.

**Phần mềm đồng bộ** bằng cách gắn cả ba (và mã quản lý nội bộ) vào **một bản ghi nhật ký mối hàn**.

---

## 2. Mô hình mã trong phần mềm (giải trình ngắn)

Mỗi mối hàn lưu tối đa **4 mã** + **1 điểm GPS/Autolisp**:

```
┌─────────────────────────────────────────────────────────────┐
│  Điểm Autolisp (toa_do)                                     │
│  ma_diem: HT / HP / TT / TP + số   · ly_trinh · kinh/vĩ độ │
└──────────────────────────┬──────────────────────────────────┘
                           │ liên kết
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Nhật ký mối hàn (lich_su_moi_han)                          │
│  1. Mã hệ thống      ma_lich_su          — quản lý nội bộ  │
│  2. Mã hiện trường   ma_hien_truong      — sơn bụng ray    │
│  3. Mã trong máy     ten_moi_han_theo_may— log máy hàn     │
│  (+ ngày, máy, thợ, dự án, kết quả thí nghiệm…)             │
└─────────────────────────────────────────────────────────────┘
```

### 2.1. Mã Autolisp (thiết kế)

Đánh số theo **4 dải ray**, từ đầu tuyến (Km0) đến cuối tuyến:

| Tiền tố | Ý nghĩa |
|---------|---------|
| **HT** | Đường **Hạ** — ray **trái** |
| **HP** | Đường **Hạ** — ray **phải** |
| **TT** | Đường **Thượng** — ray **trái** |
| **TP** | Đường **Thượng** — ray **phải** |

- Format: `{HT|HP|TT|TP}` + số thứ tự (vd `HT0001`, `TT0166`).
- Mỗi dải đếm **riêng** (1 → n).
- Kèm **lý trình (Km)** và **tọa độ** theo tuyến thiết kế.
- Import từ Excel Autolisp / CAD; phần mềm chấp nhận cả dạng `R.TT173`.

### 2.2. Mã hệ thống (phần mềm)

- Format: `{mã dự án}-{công nghệ}-{DD}-{MM}-{YY}-{xxxx}`  
  Ví dụ: `PQ-FBW-25-10-26-0001`
- Số TT đếm theo **dự án + công nghệ** (FBW / ATW).
- **Không chỉnh tay** — hệ thống tự cấp để tránh trùng.

### 2.3. Mã hiện trường (sơn bụng ray)

- Format: `{công nghệ}-{DD}-{MM}-{YY}-{xxxx}`  
  Ví dụ: `FBW-25-08-26-0001`
- **Cùng số TT** với mã hệ thống (bỏ tiền tố dự án).
- Đây là mã dùng để đối chiếu với chữ sơn trên bụng ray (trên phần mềm dùng dấu `-` thay khoảng trắng cho dễ tìm kiếm).
- Có thể sửa tay khi cần khớp thực tế hiện trường.

### 2.4. Mã trong máy

Phụ thuộc loại máy:

| Máy | Quy tắc | Ví dụ | Ghi chú giải trình |
|-----|---------|-------|---------------------|
| **UN5** | `Năm-Tháng-Ngày-xxx` | `2026-9-11-001` | Theo log máy; **reset mỗi ngày** |
| **K922 / KCM** | Số thứ tự cộng dồn | `1`, `2`, … `n` | Theo máy; **không reset ngày** |
| Máy khác | `DD-MM-YY-xxxx` | `25-10-26-0001` | Fallback; reset mỗi ngày |

Người dùng có thể sửa hậu tố / số TT khi thực tế thi công **xen kẽ trái–phải** (không theo đúng thứ tự thiết kế).

---

## 3. Luồng thao tác chuẩn (để giải trình quy trình)

### Bước A — Đưa điểm Autolisp vào phần mềm

1. Xuất Excel từ Autolisp / CAD (cột tối thiểu: `ma_diem`, `kinh_do`, `vi_do`; nên có `ly_trinh`).
2. Vào màn **Bản đồ / Tọa độ** → **Tải Excel** (hoặc dùng mẫu *mau-toa-do-autolisp.xlsx*).
3. Kiểm tra mã đã về đúng 4 dải HT/HP/TT/TP và lý trình.

### Bước B — Nhập nhật ký mối hàn (đồng bộ)

**Cách nhanh (hàng loạt):** trên màn **Nhật ký hàn** bấm **Autolisp → nhật ký**.

1. Chọn dự án, ngày, máy, thợ, công nghệ; lọc dải HT/HP/TT/TP và (tuỳ chọn) khoảng Km.
2. **Xem trước khớp mã** — bảng liệt kê từng điểm: Autolisp · Km · mã hệ thống · mã sơn · mã máy.
3. Bỏ tick điểm chưa hàn / sửa mã máy nếu xen kẽ trái–phải.
4. **Tạo N nhật ký** — hệ thống tạo bản ghi và gắn `toa_do` (tối đa 200 mối/lần). Điểm đã liên kết bị bỏ qua.

**Cách từng mối:**

1. **Thêm nhật ký** → chọn **dự án**, **máy**, **thợ**, **ngày**.
2. Chọn **điểm Autolisp** (vd `HT0166`) → hệ thống tự điền Km / tọa độ.
3. Hệ thống tự điền mã hệ thống, mã sơn, mã máy.
4. Chỉ sửa tay khi cần; Lưu → điểm Autolisp được **liên kết**.

**Ước lượng hiệu suất:** đã import Autolisp thì tạo hàng loạt ~40 mối chỉ cần soát mã máy trên preview — vài phút.

### Bước C — Tra cứu / đối chiếu khi giải trình

Trên màn **Nhật ký hàn**, ô tìm kiếm hỗ trợ cả ba loại mã:

- Gõ mã hệ thống → ra bản ghi  
- Gõ mã sơn hiện trường → ra bản ghi  
- Gõ mã trong máy → ra bản ghi  

Từ bản ghi xem thêm: điểm Autolisp, Km, GPS, thợ, máy, kết quả thí nghiệm.

---

## 4. Các câu hỏi thường gặp khi giải trình

### “Vì sao mã trên máy không trùng số với mã Autolisp?”

Vì hai hệ đếm **khác mục đích**:

- Autolisp đếm theo **vị trí thiết kế** trên từng dải ray (HT/HP/TT/TP).
- Máy đếm theo **thứ tự hàn thực tế** trên thiết bị (UN5 theo ngày; K922 cộng dồn).

Thi công thực tế thường **hàn xen kẽ trái/phải**, không đi tuần tự theo một dải Autolisp. Do đó phần mềm **liên kết** hai mã trên cùng một bản ghi thay vì buộc chúng bằng nhau.

### “Mã sơn và mã hệ thống khác nhau chỗ nào?”

Mã sơn = mã hệ thống **bỏ mã dự án**.  
Cùng số TT trong ngày/công nghệ, để đội hiện trường sơn ngắn gọn, còn phòng kỹ thuật vẫn quản lý theo dự án.

### “Ai được sửa mã?”

- Mã hệ thống: **không sửa tay** (tránh trùng, phục vụ báo cáo).  
- Mã hiện trường / mã máy: **sửa được** để khớp thực tế sơn và log máy.  
- Điểm Autolisp: chọn từ danh sách thiết kế đã import; không bịa mã tùy tiện nếu đã có bản vẽ.

### “Dữ liệu cũ trước khi đồng bộ thì sao?”

Bản ghi cũ vẫn giữ mã đã nhập. Có thể bổ sung dần điểm Autolisp và mã máy/sơn khi đối chiếu. Migration DB bổ sung sequence 4 dải và chỉ mục tìm kiếm — **không xóa** dữ liệu cũ.

---

## 5. File / màn hình liên quan (cho kỹ thuật)

| Hạng mục | Vị trí |
|----------|--------|
| Rule mã | `src/lib/weldCode.ts` |
| Import Excel Autolisp | `src/lib/parseCoordinatesExcel.ts` · màn Bản đồ |
| Form nhật ký + tìm kiếm | `src/components/WeldingJournalList.tsx` |
| Nhập hàng loạt Autolisp | `src/components/BulkAutolispWeldDialog.tsx` · `src/lib/bulkCreateWeldsFromAutolisp.ts` |
| Bảng điểm thiết kế | `public.toa_do` (`ma_diem`, `ly_trinh`, tọa độ) |
| Bảng nhật ký | `public.lich_su_moi_han` (`ma_lich_su`, `ma_hien_truong`, `ten_moi_han_theo_may`) |
| Migration 4 dải Autolisp | `supabase/migration_20261026_dong_bo_autolisp_4_dai.sql` |

**Lưu ý vận hành:** chạy migration trên Supabase SQL Editor trước khi dùng sequence / tìm kiếm tối ưu trên môi trường mới.

---

## 6. Tóm tắt một câu (đọc khi trình bày)

> Phần mềm lấy **điểm Autolisp** làm neo vị trí, cấp **mã hệ thống + mã sơn** thống nhất theo dự án/ngày, và gắn **mã máy UN5/K922** theo đúng rule thiết bị — để từ hiện trường, máy hàn hay bản vẽ đều truy về **cùng một mối hàn**.

---

*Tài liệu phục vụ giải trình nội bộ / đối tác / nghiệm thu. Cập nhật khi đổi rule đánh số.*
