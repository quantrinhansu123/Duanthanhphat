import type { Cell, Worksheet } from "exceljs";
import { displayWeldCode, type WeldReportRow } from "@/lib/weldReportData";

/** Số dòng mối hàn tối đa trên sheet "Nghiêm thu SX" (hàng 11–30). */
export const APPENDIX5_MAX_ROWS = 20;
const FIRST_ROW = 11;
const TEMPLATE_URL = "/templates/appendix5-fbw.xlsx";

export type Appendix5Weld = {
  row: WeldReportRow;
  /** Lý trình mối hàn (từ điểm GPS). */
  chainage?: string;
};

export type Appendix5Meta = {
  date: string; // dd/MM/yyyy
  rfiNo?: string;
  location?: string;
  rail?: "upper" | "lower" | null;
};

const BOX = "❐";
const TICKED = "☑";

/** Đổi ô ❐ thành ☑ (giữ nguyên định dạng rich text). */
function tick(cell: Cell) {
  const v = cell.value as unknown;
  if (typeof v === "string") {
    cell.value = v.replace(BOX, TICKED);
  } else if (v && typeof v === "object" && "richText" in v) {
    const rt = (v as { richText: { text: string }[] }).richText.map((part, i) =>
      i === 0 ? { ...part, text: part.text.replace(BOX, TICKED) } : part,
    );
    cell.value = { richText: rt } as never;
  }
}

/** Nối giá trị vào sau nhãn có sẵn của ô (VD "NGÀY NGHIỆM THU:" → "NGÀY NGHIỆM THU: 26/10/2026"). */
function append(cell: Cell, text: string) {
  if (!text) return;
  const v = cell.value as unknown;
  if (typeof v === "string") {
    cell.value = `${v.replace(/\s+$/, "")} ${text}`;
  } else if (v && typeof v === "object" && "richText" in v) {
    const parts = (v as { richText: { text: string }[] }).richText;
    cell.value = { richText: [...parts, { text: ` ${text}` }] } as never;
  } else {
    cell.value = text;
  }
}

function isNight(row: WeldReportRow) {
  if (row.ca_han) return /3|đêm|night/i.test(String(row.ca_han));
  const hour = Number((row.gio_bat_dau ?? row.gio_han ?? "").slice(0, 2));
  return Number.isFinite(hour) && (hour >= 18 || hour < 6);
}

/** Số đo mẫu trong dung sai để demo (chưa có dữ liệu thật trong nhật ký). */
function demoMeasure(seed: number, limit: number) {
  const v = (((seed * 37) % 7) - 3) / 10; // -0.3 … +0.3
  return Math.max(-limit, Math.min(limit, v));
}

function fillProductionSheet(ws: Worksheet, welds: Appendix5Weld[], meta: Appendix5Meta) {
  const first = welds[0].row;
  const last = welds[welds.length - 1];

  append(ws.getCell("B4"), meta.rfiNo ?? "");
  append(ws.getCell("A5"), meta.date);
  append(ws.getCell("A6"), meta.location ?? "");
  ws.getCell("E5").value = first.ten_tho_han?.trim() ?? "";
  ws.getCell("G5").value = `ID: ${first.ma_nhan_su ?? ""}`;

  tick(ws.getCell(isNight(first) ? "O3" : "M3"));
  tick(ws.getCell("M4")); // hàn cố định (máy FBW tại xưởng/hiện trường cố định)
  if (meta.rail === "upper") tick(ws.getCell("E6"));
  if (meta.rail === "lower") tick(ws.getCell("G6"));

  append(ws.getCell("N5"), welds[0].chainage ?? "");
  append(ws.getCell("P5"), last.chainage ?? "");

  const machine = first.ten_may?.trim() || first.ma_may?.trim();
  if (machine) ws.getCell("O6").value = `Máy hàn: ${machine}\nGoòng phẳng: KPS25-L8`;

  welds.forEach(({ row, chainage }, i) => {
    const r = FIRST_ROW + i;
    ws.getCell(`B${r}`).value = displayWeldCode(row.ma_lich_su);
    ws.getCell(`C${r}`).value = row.loai_ray || "60R2";
    ws.getCell(`D${r}`).value = chainage ?? "";
    ws.getCell(`G${r}`).value = row.so_luong_loi === 0 ? "ĐẠT" : "KHÔNG ĐẠT";
    ws.getCell(`H${r}`).value =
      row.tinh_trang_thi_nghiem === "Không đạt"
        ? "KHÔNG ĐẠT"
        : row.tinh_trang_thi_nghiem === "Đạt"
          ? "ĐẠT"
          : "ĐẠT"; // demo
    for (let c = 0; c < 5; c++) {
      ws.getCell(r, 9 + c).value = demoMeasure(i * 5 + c + 1, 0.4); // cột I..M
    }
    ws.getCell(`N${r}`).value = row.so_luong_loi === 0 ? "ĐẠT" : "KHÔNG ĐẠT";
    ws.getCell(`O${r}`).value = row.ghi_chu?.trim() ?? "";
  });
}

/** Rows có ô tick ❐ ở cột H..L (Weld 1..5) và ô đánh giá YES/NO ở cột M. */
const APPROVAL_TICK_ROWS = [12, 15, 16, 17, 20, 23, 26, 29, 32];

function fillApprovalSheet(ws: Worksheet, welds: Appendix5Weld[], meta: Appendix5Meta) {
  const first = welds[0].row;
  ws.getCell("C5").value = meta.rfiNo ?? "";
  append(ws.getCell("A6"), meta.date);
  append(ws.getCell("A7"), meta.location ?? "");
  append(ws.getCell("C6"), first.ten_tho_han?.trim() ?? "");

  tick(ws.getCell(isNight(first) ? "N4" : "L4"));
  tick(ws.getCell("L5")); // Stationery welding
  tick(ws.getCell("N7")); // 60R2 - U75V

  const machine = first.ten_may?.trim() || first.ma_may?.trim();
  if (machine) {
    ws.getCell("N6").value = { richText: [{ text: `FBW: ${machine}\nWagon: KPS25-L8` }] } as never;
  }

  const count = Math.min(5, welds.length);
  for (const r of APPROVAL_TICK_ROWS) {
    for (let c = 0; c < count; c++) {
      const cell = ws.getCell(r, 8 + c); // H..L
      if (String(cell.value ?? "").includes(BOX) || (cell.value && typeof cell.value === "object")) tick(cell);
    }
    ws.getCell(`M${r}`).value = "YES"; // demo
  }
}

/** Điền Appendix 5 cho tối đa 20 mối hàn → Blob .xlsx (cả 2 sheet). */
export async function fillAppendix5Fbw(welds: Appendix5Weld[], meta: Appendix5Meta): Promise<Blob> {
  if (!welds.length) throw new Error("Không có mối hàn để điền biên bản.");
  if (welds.length > APPENDIX5_MAX_ROWS) {
    throw new Error(`Mỗi biên bản tối đa ${APPENDIX5_MAX_ROWS} mối hàn.`);
  }
  const ExcelJS = (await import("exceljs")).default;
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("Không tải được file mẫu Appendix 5.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());

  const production = wb.getWorksheet("Nghiêm thu SX");
  const approval = wb.getWorksheet("Approval test by AIGRE");
  if (!production || !approval) throw new Error("File mẫu Appendix 5 sai cấu trúc sheet.");
  fillProductionSheet(production, welds, meta);
  fillApprovalSheet(approval, welds, meta);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
