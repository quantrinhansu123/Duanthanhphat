/** Schema / field defs for 8 TB10015 input catalog tables. */

export const TB15_CATALOG_KEYS = [
  "khi_hau",
  "loai_ray",
  "mac_thep",
  "ket_cau_duong",
  "do_cung_goi",
  "on_dinh_nen",
  "he_so_tai",
  "so_do_tai",
] as const;

export type Tb15CatalogKey = (typeof TB15_CATALOG_KEYS)[number];

export type Tb15FieldType = "text" | "number" | "select";

export type Tb15Field = {
  key: string;
  label: string;
  type: Tb15FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  step?: string;
};

export type Tb15CatalogMeta = {
  key: Tb15CatalogKey;
  tabId: string;
  table: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  fields: Tb15Field[];
  /** Nested wheels for load schemes */
  hasWheels?: boolean;
};

export const TB15_CATALOGS: Tb15CatalogMeta[] = [
  {
    key: "khi_hau",
    tabId: "kiem-toan-cwr-nhiet-do-vung",
    table: "tb15_khi_hau",
    title: "Nhiệt độ vùng (khí hậu VN)",
    titleEn: "Regional climate (VN)",
    description: "Nhiệt độ không khí cao nhất / thấp nhất theo trạm — QCVN 02:2022/BXD (A.5 / A.6)",
    descriptionEn: "Air temperature extremes by station from QCVN 02:2022/BXD",
    fields: [
      { key: "ma_tram", label: "Mã trạm", type: "text" },
      { key: "ten_tram", label: "Tên trạm", type: "text", required: true },
      { key: "tinh", label: "Tỉnh / thành", type: "text" },
      { key: "t_kk_max", label: "Nhiệt độ không khí cao nhất (°C)", type: "number", required: true, step: "0.1" },
      { key: "t_kk_min", label: "Nhiệt độ không khí thấp nhất (°C)", type: "number", required: true, step: "0.1" },
      { key: "nguon", label: "Nguồn", type: "text" },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "loai_ray",
    tabId: "kiem-toan-cwr-loai-ray",
    table: "tb15_loai_ray",
    title: "Loại ray & mặt cắt",
    titleEn: "Rail type & section",
    description: "Phụ lục C: F, W, I theo loại ray và độ mòn",
    descriptionEn: "Appendix C section properties by rail type and wear",
    fields: [
      { key: "loai_kg_m", label: "Loại (kg/m)", type: "number", required: true },
      { key: "do_mon_mm", label: "Độ mòn (mm)", type: "number", required: true },
      { key: "f_mm2", label: "F (mm²)", type: "number", required: true },
      { key: "w_dau_mm3", label: "W đầu (mm³)", type: "number", required: true },
      { key: "w_day_mm3", label: "W đáy (mm³)", type: "number", required: true },
      { key: "i_x_mm4", label: "I_x (mm⁴)", type: "number", required: true },
      { key: "i_y_mm4", label: "I_y (mm⁴)", type: "number", required: true },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "mac_thep",
    tabId: "kiem-toan-cwr-mac-thep",
    table: "tb15_mac_thep",
    title: "Mác thép ray",
    titleEn: "Rail steel grade",
    description: "Bảng 3.2.4 — σ_s → [σ] = σ_s / K",
    descriptionEn: "Table 3.2.4 yield strength σ_s",
    fields: [
      { key: "mac_thep", label: "Mác thép", type: "text", required: true },
      { key: "sigma_s_mpa", label: "σ_s (MPa)", type: "number", required: true },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "ket_cau_duong",
    tabId: "kiem-toan-cwr-ket-cau-duong",
    table: "tb15_ket_cau_duong",
    title: "Kết cấu đường / tà vẹt",
    titleEn: "Track structure / sleepers",
    description: "Điều 3.2.2–3.2.3: r, Q, cự ly nút a",
    descriptionEn: "Longitudinal/lateral resistance and fastener spacing",
    fields: [
      { key: "ten", label: "Tên phương án", type: "text", required: true },
      {
        key: "loai_duong",
        label: "Loại đường",
        type: "select",
        required: true,
        options: [
          { value: "co_ba_lat", label: "Có ba lát" },
          { value: "khong_ba_lat", label: "Không ba lát" },
        ],
      },
      { key: "r_khong_tai", label: "r không tải", type: "number", step: "0.001" },
      { key: "r_co_tai", label: "r có tải", type: "number", step: "0.001" },
      { key: "q_kn_m", label: "Q (kN/m)", type: "number", step: "0.001" },
      { key: "loai_ta_vet", label: "Loại tà vẹt", type: "text" },
      { key: "cu_ly_nut_a_m", label: "Cự ly nút a (m)", type: "number", step: "0.001" },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "do_cung_goi",
    tabId: "kiem-toan-cwr-do-cung-goi-ray",
    table: "tb15_do_cung_goi",
    title: "Độ cứng gối ray D",
    titleEn: "Rail seat stiffness D",
    description: "Bảng A.0.3 — D (kN/mm)",
    descriptionEn: "Appendix A.0.3 seat stiffness D",
    fields: [
      { key: "phuong_an", label: "Phương án", type: "text", required: true },
      { key: "d_kn_mm", label: "D (kN/mm)", type: "number", required: true, step: "0.001" },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "on_dinh_nen",
    tabId: "kiem-toan-cwr-on-dinh-nen-da",
    table: "tb15_on_dinh_nen",
    title: "Ổn định nền đá",
    titleEn: "Ballast stability params",
    description: "B.0.4-1: q0, B, Z, C, N theo loại tà vẹt",
    descriptionEn: "B.0.4-1 lateral resistance parameters",
    fields: [
      { key: "loai_ta_vet", label: "Loại tà vẹt", type: "text", required: true },
      { key: "q0", label: "q0", type: "number", required: true, step: "0.0001" },
      { key: "b_hs", label: "B", type: "number", required: true, step: "0.0001" },
      { key: "z_hs", label: "Z", type: "number", required: true, step: "0.0001" },
      { key: "c_hs", label: "C", type: "number", required: true, step: "0.0001" },
      { key: "n_hs", label: "N", type: "number", required: true, step: "0.0001" },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "he_so_tai",
    tabId: "kiem-toan-cwr-he-so-van-toc-luc-ngang",
    table: "tb15_he_so_tai",
    title: "Hệ số vận tốc / lực ngang",
    titleEn: "Speed / lateral factors",
    description: "A.0.2-1 hệ số vận tốc; A.0.2-2 hệ số lực ngang f",
    descriptionEn: "A.0.2-1 speed factor and A.0.2-2 lateral factor",
    fields: [
      {
        key: "loai",
        label: "Loại",
        type: "select",
        required: true,
        options: [
          { value: "van_toc", label: "Vận tốc" },
          { value: "luc_ngang", label: "Lực ngang" },
        ],
      },
      { key: "nhan", label: "Nhãn", type: "text" },
      { key: "v_min_kmh", label: "v min (km/h)", type: "number" },
      { key: "v_max_kmh", label: "v max (km/h)", type: "number" },
      { key: "loai_keo", label: "Loại kéo", type: "text" },
      { key: "r_tu_m", label: "R từ (m)", type: "number" },
      { key: "he_so", label: "Hệ số", type: "number", required: true, step: "0.0001" },
      { key: "ghi_chu", label: "Ghi chú", type: "text" },
    ],
  },
  {
    key: "so_do_tai",
    tabId: "kiem-toan-cwr-so-do-tai-banh-xe",
    table: "tb15_so_do_tai",
    title: "Sơ đồ tải bánh xe",
    titleEn: "Axle-load schemes",
    description: "Phụ lục A: vị trí x (m) và P_j (kN) từng bánh",
    descriptionEn: "Appendix A wheel positions and loads",
    hasWheels: true,
    fields: [
      { key: "ma", label: "Mã sơ đồ", type: "text", required: true },
      { key: "ten", label: "Tên sơ đồ", type: "text", required: true },
      { key: "mo_ta", label: "Mô tả", type: "text" },
    ],
  },
];

export function catalogByTabId(tabId: string) {
  return TB15_CATALOGS.find((c) => c.tabId === tabId) ?? null;
}

export function catalogByKey(key: string) {
  return TB15_CATALOGS.find((c) => c.key === key) ?? null;
}

export type Tb15Wheel = { id?: string; stt: number; x_m: number; p_j_kn: number };

export type Tb15Row = Record<string, unknown> & {
  id?: string;
  wheels?: Tb15Wheel[];
};
