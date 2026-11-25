# Database thông số đầu vào TB 10015

Chạy lần lượt trên **Supabase → SQL Editor** (hoặc `psql`):

1. `migration_20261123_tb15_dau_vao.sql`  
   Tạo 8 bảng chính + seed Excel (ray, mác thép, kết cấu, D, B.0.4-1, hệ số tải, sơ đồ bánh).

2. `migration_20261124_tb15_mo_men_can_bo_tri.sql`  
   Thêm bảng `tb15_mo_men_can` (B.0.4-2) + cột `bo_tri` cho `tb15_on_dinh_nen`.

3. `migration_20261124_tb15_khi_hau_seed_151.sql`  
   Upsert đủ **151 trạm** QCVN A.5/A.6 (cột Năm).

## Bảng

| Bảng | Nội dung |
|---|---|
| `tb15_khi_hau` | Nhiệt độ vùng (A) |
| `tb15_loai_ray` | Phụ lục C — mặt cắt ray |
| `tb15_mac_thep` | Mác thép |
| `tb15_ket_cau_duong` | Sức cản dọc r / tà vẹt |
| `tb15_do_cung_goi` | Độ cứng gối D (A.0.3) |
| `tb15_on_dinh_nen` | B.0.4-1 sức cản ngang |
| `tb15_mo_men_can` | B.0.4-2 mô men cản phụ kiện |
| `tb15_he_so_tai` | A.0.2-1 / A.0.2-2 |
| `tb15_so_do_tai` + `_banh` | Sơ đồ tải bánh xe |

App fallback JSON (`tb15-catalogs.json`) nếu chưa chạy migration.
