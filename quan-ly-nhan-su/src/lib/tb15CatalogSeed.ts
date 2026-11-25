import type { Tb15CatalogKey, Tb15Row } from "@/lib/tb15Catalogs";
import { TB15_CLIMATE_SEED } from "@/lib/tb15ClimateSeed.generated";

/** Seed khi chưa chạy migration / file JSON trống (Excel Tra cứu + QCVN A.5/A.6 đủ trạm). */
export const TB15_SEED: Partial<Record<Tb15CatalogKey, Tb15Row[]>> = {
  khi_hau: TB15_CLIMATE_SEED,
  loai_ray: [
    { id: "lr-50-0", loai_kg_m: 50, do_mon_mm: 0, f_mm2: 6580, w_dau_mm3: 250000, w_day_mm3: 289000, i_x_mm4: 20370000, i_y_mm4: 3770000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-50-3", loai_kg_m: 50, do_mon_mm: 3, f_mm2: 6580, w_dau_mm3: 242000, w_day_mm3: 283000, i_x_mm4: 19460000, i_y_mm4: 3770000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-50-6", loai_kg_m: 50, do_mon_mm: 6, f_mm2: 6580, w_dau_mm3: 230000, w_day_mm3: 275000, i_x_mm4: 18270000, i_y_mm4: 3770000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-50-9", loai_kg_m: 50, do_mon_mm: 9, f_mm2: 6580, w_dau_mm3: 216000, w_day_mm3: 264000, i_x_mm4: 17020000, i_y_mm4: 3770000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-60-0", loai_kg_m: 60, do_mon_mm: 0, f_mm2: 7745, w_dau_mm3: 339400, w_day_mm3: 396000, i_x_mm4: 32170000, i_y_mm4: 5240000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-60-3", loai_kg_m: 60, do_mon_mm: 3, f_mm2: 7745, w_dau_mm3: 318000, w_day_mm3: 385000, i_x_mm4: 30690000, i_y_mm4: 5240000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-60-6", loai_kg_m: 60, do_mon_mm: 6, f_mm2: 7745, w_dau_mm3: 291000, w_day_mm3: 375000, i_x_mm4: 28790000, i_y_mm4: 5240000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-60-9", loai_kg_m: 60, do_mon_mm: 9, f_mm2: 7745, w_dau_mm3: 264000, w_day_mm3: 363000, i_x_mm4: 26900000, i_y_mm4: 5240000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 18, ghi_chu: "" },
    { id: "lr-75-0", loai_kg_m: 75, do_mon_mm: 0, f_mm2: 9504, w_dau_mm3: 432000, w_day_mm3: 509000, i_x_mm4: 44890000, i_y_mm4: 6610000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 20, ghi_chu: "" },
    { id: "lr-75-3", loai_kg_m: 75, do_mon_mm: 3, f_mm2: 9504, w_dau_mm3: 420000, w_day_mm3: 496000, i_x_mm4: 43280000, i_y_mm4: 6610000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 20, ghi_chu: "" },
    { id: "lr-75-6", loai_kg_m: 75, do_mon_mm: 6, f_mm2: 9504, w_dau_mm3: 405000, w_day_mm3: 482000, i_x_mm4: 40890000, i_y_mm4: 6610000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 20, ghi_chu: "" },
    { id: "lr-75-9", loai_kg_m: 75, do_mon_mm: 9, f_mm2: 9504, w_dau_mm3: 390000, w_day_mm3: 480000, i_x_mm4: 38980000, i_y_mm4: 6610000, k_an_toan: 1.3, e_mpa: 210000, alpha: 0.0000118, pj_kn: 400, khe_ho_mm: 20, ghi_chu: "" },
  ],
  mac_thep: [
    { id: "mt-u71", mac_thep: "U71Mn / U71MnG", sigma_s_mpa: 457, ghi_chu: "3.2.4" },
    { id: "mt-u75", mac_thep: "U75V / U75VG / U76CrRE / U77MnCr / U78CrV", sigma_s_mpa: 472, ghi_chu: "3.2.4" },
  ],
  ket_cau_duong: [
    { id: "kc-iii", ten: "Có ba lát – tà vẹt BT loại III (1 667 thanh/km)", loai_duong: "co_ba_lat", so_thanh_km: 1667, r_khong_tai_hs: 7.5, r_khong_tai: 15, r_dau_may_hs: 11.6, r_co_tai: 23.2, r_toa_xe_hs: 7.5, r_toa_xe: 15, q_kn_m: 11.5, loai_ta_vet: "III", cu_ly_nut_a_m: 0.6, ghi_chu: "3.2.2-1" },
    { id: "kc-ii-1760", ten: "Có ba lát – tà vẹt BT loại II mới (1 760 thanh/km)", loai_duong: "co_ba_lat", so_thanh_km: 1760, r_khong_tai_hs: 4.4, r_khong_tai: 8.8, r_dau_may_hs: 6.8, r_co_tai: 13.6, r_toa_xe_hs: 4.4, r_toa_xe: 8.8, q_kn_m: 8.5, loai_ta_vet: "II", cu_ly_nut_a_m: 0.568, ghi_chu: "3.2.2-1" },
    { id: "kc-ii-1840", ten: "Có ba lát – tà vẹt BT loại II mới (1 840 thanh/km)", loai_duong: "co_ba_lat", so_thanh_km: 1840, r_khong_tai_hs: 4.4, r_khong_tai: 8.8, r_dau_may_hs: 6.8, r_co_tai: 13.6, r_toa_xe_hs: 4.4, r_toa_xe: 8.8, q_kn_m: 8.9, loai_ta_vet: "II", cu_ly_nut_a_m: 0.543, ghi_chu: "r lấy bằng loại II 1 760 thanh/km" },
    { id: "kc-wj", ten: "Không ba lát – phụ kiện WJ-7 / WJ-8 (nút cách 625 mm)", loai_duong: "khong_ba_lat", so_thanh_km: null, r_khong_tai_hs: null, r_khong_tai: 24, r_dau_may_hs: null, r_co_tai: 37.2, r_toa_xe_hs: null, r_toa_xe: null, q_kn_m: 0, loai_ta_vet: "", cu_ly_nut_a_m: 0.625, ghi_chu: "" },
    { id: "kc-cau-nho", ten: "Phụ kiện sức cản nhỏ trên cầu (lò xo V)", loai_duong: "co_ba_lat", so_thanh_km: null, r_khong_tai_hs: null, r_khong_tai: 8, r_dau_may_hs: null, r_co_tai: null, r_toa_xe_hs: null, r_toa_xe: null, q_kn_m: null, loai_ta_vet: "", cu_ly_nut_a_m: 0.6, ghi_chu: "3.2.2 — r = 8,0 kN/(m·ray), nút 600 mm" },
  ],
  do_cung_goi: [
    { id: "dc-ii-110", loai_duong: "co_ba_lat", phuong_an: "Tà vẹt bê tông loại II", dem_kn_mm: 110, dem_sai_so_kn_mm: null, d_kn_mm: 30, tinh_min_kn_mm: null, tinh_max_kn_mm: null, ghi_chu: "A.0.3-1" },
    { id: "dc-ii-80", loai_duong: "co_ba_lat", phuong_an: "Tà vẹt bê tông loại II", dem_kn_mm: 80, dem_sai_so_kn_mm: null, d_kn_mm: 27.2, tinh_min_kn_mm: null, tinh_max_kn_mm: null, ghi_chu: "A.0.3-1" },
    { id: "dc-iii-80", loai_duong: "co_ba_lat", phuong_an: "Tà vẹt bê tông loại III", dem_kn_mm: 80, dem_sai_so_kn_mm: null, d_kn_mm: 33, tinh_min_kn_mm: null, tinh_max_kn_mm: null, ghi_chu: "A.0.3-1" },
    { id: "dc-wj-7a", loai_duong: "khong_ba_lat", phuong_an: "WJ-7A", dem_kn_mm: 35, dem_sai_so_kn_mm: 5, d_kn_mm: null, tinh_min_kn_mm: 35, tinh_max_kn_mm: 50, ghi_chu: "A.0.3-2" },
    { id: "dc-wj-7b", loai_duong: "khong_ba_lat", phuong_an: "WJ-7B", dem_kn_mm: 23, dem_sai_so_kn_mm: 3, d_kn_mm: null, tinh_min_kn_mm: 25, tinh_max_kn_mm: 35, ghi_chu: "A.0.3-2" },
    { id: "dc-wj-8a", loai_duong: "khong_ba_lat", phuong_an: "WJ-8A", dem_kn_mm: 35, dem_sai_so_kn_mm: 5, d_kn_mm: null, tinh_min_kn_mm: 35, tinh_max_kn_mm: 50, ghi_chu: "A.0.3-2" },
    { id: "dc-wj-8bc", loai_duong: "khong_ba_lat", phuong_an: "WJ-8B, WJ-8C", dem_kn_mm: 23, dem_sai_so_kn_mm: 3, d_kn_mm: null, tinh_min_kn_mm: 25, tinh_max_kn_mm: 35, ghi_chu: "A.0.3-2" },
  ],
  on_dinh_nen: [
    { id: "od-ii", loai_ta_vet: "II", bo_tri: "1 840 thanh/km", q0: 23, b_hs: 63, z_hs: 1.2, c_hs: 106, n_hs: 2.5, ghi_chu: "B.0.4-1" },
    { id: "od-iii", loai_ta_vet: "III", bo_tri: "1 760 thanh/km", q0: 27.4, b_hs: 92, z_hs: 1.2, c_hs: 179, n_hs: 2.5, ghi_chu: "B.0.4-1" },
  ],
  mo_men_can: [
    { id: "mmc-dan-hoi-ii", loai_phu_kien: "Loại đàn hồi II", h_ncm_cm: 22000, mu: 2, psi: 3.0983, ghi_chu: "B.0.4-2" },
  ],
  mo_men_can: [
    {
      id: "mm-dh-ii",
      loai_phu_kien: "Loại đàn hồi II",
      h_ncm_cm: 22000,
      mu: 2,
      psi: 3.0983,
      ghi_chu: "B.0.4-2",
    },
  ],
  he_so_tai: [
    { id: "hs-v160", loai: "van_toc", nhan: "v > 160", v_min_kmh: 160.01, v_max_kmh: null, loai_keo: null, r_tu_m: null, he_so: 1, ghi_chu: "A.0.2-1" },
    { id: "hs-dien", loai: "van_toc", nhan: "Điện v≤160", v_min_kmh: 0, v_max_kmh: 160, loai_keo: "Dien", r_tu_m: null, he_so: 0.6, ghi_chu: "0.6*v/100" },
    { id: "hs-diesel", loai: "van_toc", nhan: "Diesel v≤160", v_min_kmh: 0, v_max_kmh: 160, loai_keo: "Diesel", r_tu_m: null, he_so: 0.4, ghi_chu: "0.4*v/100" },
    { id: "hs-thang", loai: "luc_ngang", nhan: "Đường thẳng", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 0, he_so: 1.25, ghi_chu: "A.0.2-2" },
    { id: "hs-r300", loai: "luc_ngang", nhan: "R ≥ 300", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 300, he_so: 2, ghi_chu: "A.0.2-2" },
    { id: "hs-r400", loai: "luc_ngang", nhan: "R ≥ 400", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 400, he_so: 1.8, ghi_chu: "A.0.2-2" },
    { id: "hs-r500", loai: "luc_ngang", nhan: "R ≥ 500", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 500, he_so: 1.7, ghi_chu: "A.0.2-2" },
    { id: "hs-r600", loai: "luc_ngang", nhan: "R ≥ 600", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 600, he_so: 1.6, ghi_chu: "A.0.2-2" },
    { id: "hs-r800", loai: "luc_ngang", nhan: "R ≥ 800", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 800, he_so: 1.45, ghi_chu: "A.0.2-2" },
    { id: "hs-r2000", loai: "luc_ngang", nhan: "R ≥ 2000", v_min_kmh: null, v_max_kmh: null, loai_keo: null, r_tu_m: 2000, he_so: 1.3, ghi_chu: "A.0.2-2" },
  ],
  so_do_tai: [
    {
      id: "sd-emu-17t",
      ma: "EMU-17T",
      ten: "EMU tải trục 17 t (ví dụ Excel)",
      mo_ta: "P_j ≈ 83,4 kN/bánh",
      wheels: [
        { id: "w1", stt: 1, x_m: -17.5, p_j_kn: 83.4 },
        { id: "w2", stt: 2, x_m: -15, p_j_kn: 83.4 },
        { id: "w3", stt: 3, x_m: 0, p_j_kn: 83.4 },
        { id: "w4", stt: 4, x_m: 2.5, p_j_kn: 83.4 },
        { id: "w5", stt: 5, x_m: 7.5, p_j_kn: 83.4 },
        { id: "w6", stt: 6, x_m: 10, p_j_kn: 83.4 },
        { id: "w7", stt: 7, x_m: 25, p_j_kn: 83.4 },
        { id: "w8", stt: 8, x_m: 27.5, p_j_kn: 83.4 },
      ],
    },
  ],
};
