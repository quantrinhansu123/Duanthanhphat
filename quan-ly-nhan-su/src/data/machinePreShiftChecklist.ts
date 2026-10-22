export const CHECKLIST_SHIFTS = ["Ca 1", "Ca 2"] as const;
export type ChecklistShift = (typeof CHECKLIST_SHIFTS)[number];

export type ChecklistMark = "D" | "K" | "NA";
export type ChecklistConclusion = "du_dieu_kien" | "dung_van_hanh" | "cho_khac_phuc";

export const CHECKLIST_CONCLUSIONS: { id: ChecklistConclusion; label: string; short: string }[] = [
  { id: "du_dieu_kien", label: "Đủ điều kiện vận hành", short: "Đủ ĐK" },
  { id: "dung_van_hanh", label: "Dừng vận hành", short: "Dừng VH" },
  { id: "cho_khac_phuc", label: "Chờ khắc phục", short: "Chờ KP" },
];

export type ChecklistItemDef = {
  ma: string;
  ten: string;
  tieuChi: string;
  extra?: "nhietDo";
};

export type ChecklistSectionDef = {
  id: string;
  letter: string;
  title: string;
  items: ChecklistItemDef[];
};

/** Mẫu checklist kiểm tra máy hàn MFBW trước ca. */
export const MFBW_PRE_SHIFT_SECTIONS: ChecklistSectionDef[] = [
  {
    id: "A",
    letter: "A",
    title: "DẦU MỠ VÀ THỦY LỰC",
    items: [
      {
        ma: "A01",
        ten: "Dầu nhớt máy phát",
        tieuChi: "Kiểm tra mức dầu còn trên vạch bằng que thăm dầu",
      },
      {
        ma: "A02",
        ten: "Mức dầu thủy lực",
        tieuChi: "Đủ mức quy định, không có cảnh báo",
      },
      {
        ma: "A03",
        ten: "Rò rỉ dầu",
        tieuChi: "Không có tại bơm, van, xi lanh, đầu nối và ống dẫn",
      },
      {
        ma: "A04",
        ten: "Bôi trơn cơ cấu chuyển động",
        tieuChi: "Các vị trí yêu cầu đã được bôi trơn, không thiếu mỡ",
      },
      {
        ma: "A05",
        ten: "Ống và khớp nối thủy lực",
        tieuChi: "Không nứt, phồng, lỏng hoặc có sát bất thường",
      },
      {
        ma: "A06",
        ten: "Dầu Diesel",
        tieuChi: "Kiểm tra bổ sung lượng dầu Diesel đủ cho ca làm việc",
      },
    ],
  },
  {
    id: "B",
    letter: "B",
    title: "HỆ THỐNG ĐIỆN",
    items: [
      {
        ma: "B01",
        ten: "Nguồn điện đầu vào",
        tieuChi: "Điện áp, tần số đúng yêu cầu máy",
      },
      {
        ma: "B02",
        ten: "Cáp điện và đầu nối",
        tieuChi: "Không đứt, cháy; lỏng hoặc hư hỏng cách điện",
      },
      {
        ma: "B03",
        ten: "Tiếp địa và bảo vệ điện",
        tieuChi: "Có mối chắc chắn, thiết bị bảo vệ sẵn sàng",
      },
      {
        ma: "B04",
        ten: "Cáp điện hàn, điện cực",
        tieuChi: "Kết nối chắc, sạch, không quá nhiệt hoặc cháy xém",
      },
      {
        ma: "B05",
        ten: "Bình ắc quy",
        tieuChi: "Hoạt động bình thường, đủ điều kiện khởi động",
      },
    ],
  },
  {
    id: "C",
    letter: "C",
    title: "HỆ THỐNG LÀM MÁT",
    items: [
      {
        ma: "C01",
        ten: "Mức nước làm mát",
        tieuChi: "Đủ mức quy định",
      },
      {
        ma: "C02",
        ten: "Ống nước và khớp nối",
        tieuChi: "Không rò rỉ, gấp ống hoặc lỏng đầu nối",
      },
      {
        ma: "C03",
        ten: "Bơm nước, chiller",
        tieuChi: "Hoạt động bình thường, lưu lượng và nhiệt độ đạt yêu cầu",
      },
      {
        ma: "C04",
        ten: "Nhiệt độ nước làm mát trước khi hàn",
        tieuChi: "Ghi nhiệt độ nước làm mát sau khi máy chạy ổn định",
        extra: "nhietDo",
      },
    ],
  },
  {
    id: "D",
    letter: "D",
    title: "CƠ KHÍ VÀ VẬN HÀNH",
    items: [
      {
        ma: "D01",
        ten: "Dao cắt ba via",
        tieuChi: "Không nứt, mẻ, cong vênh",
      },
      {
        ma: "D02",
        ten: "Hệ thống xi lanh kẹp ray",
        tieuChi: "Bình thường",
      },
      {
        ma: "D03",
        ten: "Hệ thống xi lanh ép",
        tieuChi: "Bình thường",
      },
      {
        ma: "D04",
        ten: "Bánh xe, truyền động, phanh",
        tieuChi: "Đủ điều kiện di chuyển và giữ máy ổn định",
      },
      {
        ma: "D05",
        ten: "Bu lông và chốt liên kết",
        tieuChi: "Không lỏng, thiếu hoặc hư hỏng",
      },
    ],
  },
  {
    id: "E",
    letter: "E",
    title: "ĐIỀU KHIỂN VÀ AN TOÀN",
    items: [
      {
        ma: "E01",
        ten: "Màn hình điều khiển, cảm biến",
        tieuChi: "Hoạt động, không có cảnh báo bất thường",
      },
      {
        ma: "E02",
        ten: "Chương trình hàn",
        tieuChi: "Đúng loại ray và chương trình đã phê duyệt",
      },
      {
        ma: "E03",
        ten: "Nút dừng khẩn cấp",
        tieuChi: "Hoạt động bình thường khi kiểm tra",
      },
      {
        ma: "E04",
        ten: "Chặn bánh goòng",
        tieuChi: "Kiểm tra đủ số lượng",
      },
    ],
  },
];

export const MFBW_PRE_SHIFT_ITEMS = MFBW_PRE_SHIFT_SECTIONS.flatMap((section) => section.items);
const SECTION_INSPECTORS_KEY = "_inspectors";

export type SectionInspector = { id: string; name: string };
export type SectionInspectors = Record<string, SectionInspector>;

export type ChecklistItemResult = {
  result: ChecklistMark | "";
  note: string;
  nhietDo?: string;
};

export type ChecklistResults = Record<string, ChecklistItemResult>;

export function emptyChecklistResults(): ChecklistResults {
  const next: ChecklistResults = {};
  for (const item of MFBW_PRE_SHIFT_ITEMS) {
    next[item.ma] = { result: "", note: "", nhietDo: item.extra === "nhietDo" ? "" : undefined };
  }
  return next;
}

export function emptySectionInspectors(seed?: SectionInspector): SectionInspectors {
  const next: SectionInspectors = {};
  const fallback = seed?.name.trim() ? { id: seed.id.trim(), name: seed.name.trim() } : { id: "", name: "" };
  for (const section of MFBW_PRE_SHIFT_SECTIONS) next[section.id] = { ...fallback };
  return next;
}

function readInspectorBag(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const nested = source[SECTION_INSPECTORS_KEY];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested as Record<string, unknown>;
  return source;
}

export function mergeSectionInspectors(raw: unknown, fallback?: SectionInspector): SectionInspectors {
  const base = emptySectionInspectors();
  const bag = readInspectorBag(raw);
  for (const section of MFBW_PRE_SHIFT_SECTIONS) {
    const value = bag[section.id];
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (name || id) base[section.id] = { id, name };
  }
  if (fallback?.name.trim()) {
    const seed = { id: fallback.id.trim(), name: fallback.name.trim() };
    for (const section of MFBW_PRE_SHIFT_SECTIONS) {
      if (!base[section.id].name) base[section.id] = seed;
    }
  }
  return base;
}

export function uniqueInspectorNames(inspectors: SectionInspectors): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const section of MFBW_PRE_SHIFT_SECTIONS) {
    const name = inspectors[section.id]?.name.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase("vi");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function summarizeInspectors(inspectors: SectionInspectors, fallback = "") {
  return uniqueInspectorNames(inspectors).join(", ") || fallback.trim();
}

export function firstSectionInspector(inspectors: SectionInspectors): SectionInspector {
  for (const section of MFBW_PRE_SHIFT_SECTIONS) {
    const row = inspectors[section.id];
    if (row?.name.trim()) return row;
  }
  return { id: "", name: "" };
}

export function missingSectionLetters(inspectors: SectionInspectors) {
  return MFBW_PRE_SHIFT_SECTIONS.filter((section) => !inspectors[section.id]?.name.trim()).map((section) => section.letter);
}

export function attachSectionInspectors(results: ChecklistResults, inspectors: SectionInspectors) {
  return { ...results, [SECTION_INSPECTORS_KEY]: inspectors };
}

export function mergeChecklistResults(raw: unknown): ChecklistResults {
  const base = emptyChecklistResults();
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Record<string, unknown>;
  for (const item of MFBW_PRE_SHIFT_ITEMS) {
    const value = source[item.ma];
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const result = row.result === "D" || row.result === "K" || row.result === "NA" ? row.result : "";
    const note = typeof row.note === "string" ? row.note : "";
    const nhietDo =
      item.extra === "nhietDo"
        ? typeof row.nhietDo === "number"
          ? String(row.nhietDo)
          : typeof row.nhietDo === "string"
            ? row.nhietDo
            : ""
        : undefined;
    base[item.ma] = { result, note, nhietDo };
  }
  return base;
}

export function countChecklistProgress(results: ChecklistResults) {
  let filled = 0;
  let pass = 0;
  let fail = 0;
  let na = 0;
  for (const item of MFBW_PRE_SHIFT_ITEMS) {
    const mark = results[item.ma]?.result;
    if (!mark) continue;
    filled += 1;
    if (mark === "D") pass += 1;
    else if (mark === "K") fail += 1;
    else na += 1;
  }
  return { total: MFBW_PRE_SHIFT_ITEMS.length, filled, pass, fail, na };
}

export function suggestChecklistConclusion(results: ChecklistResults): ChecklistConclusion | "" {
  const { filled, total, fail } = countChecklistProgress(results);
  if (filled === 0) return "";
  if (fail > 0) return "cho_khac_phuc";
  if (filled === total) return "du_dieu_kien";
  return "";
}

export function conclusionLabel(id: ChecklistConclusion | "" | null | undefined) {
  return CHECKLIST_CONCLUSIONS.find((item) => item.id === id)?.label ?? "";
}

export function conclusionShort(id: ChecklistConclusion | "" | null | undefined) {
  return CHECKLIST_CONCLUSIONS.find((item) => item.id === id)?.short ?? "Chưa xong";
}
