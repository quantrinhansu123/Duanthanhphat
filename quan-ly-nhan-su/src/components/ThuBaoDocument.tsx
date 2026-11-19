"use client";

import { useEffect, useMemo, useState } from "react";
import PrintFrame from "@/components/PrintFrame";
import { qualityRequest } from "@/lib/weldQualityClient";
import { loadRfiSignatures } from "@/lib/rfiSignatures";
import { fieldWeldCode } from "@/lib/weldCode";
import { parseChainageMeters } from "@/lib/weldAcceptance";

const css = `
#thu-bao-print, #thu-bao-print * {
  font-family: 'Times New Roman', Times, serif !important;
}
#thu-bao-print {
  font-size: 13pt;
  font-weight: 400;
  line-height: 1.35;
  color: #000;
}
#thu-bao-print .tb-n { font-weight: 400 !important; font-style: normal; }
#thu-bao-print .tb-b { font-weight: 700 !important; }
#thu-bao-print .tb-i { font-weight: 400 !important; font-style: italic !important; }
#thu-bao-print .tb-13 { font-size: 13pt !important; }
#thu-bao-print .tb-14 { font-size: 14pt !important; }
#thu-bao-print .tb-12 { font-size: 12pt !important; }
#thu-bao-print .tb-title { font-size: 14pt !important; font-weight: 700 !important; letter-spacing: 0.04em; }
#thu-bao-print table.tb-table { width: 100%; border-collapse: collapse; font-size: 12pt; table-layout: fixed; }
#thu-bao-print table.tb-table th,
#thu-bao-print table.tb-table td { border: 1px solid #000; padding: 5px 6px; vertical-align: middle; word-wrap: break-word; }
#thu-bao-print table.tb-table th { font-weight: 700 !important; text-align: center; font-size: 11pt; }
#thu-bao-print table.tb-table td { font-weight: 400 !important; }
#thu-bao-print table.tb-table .tb-ngay { white-space: nowrap; text-align: center; }
#thu-bao-print table.tb-table .tb-ly-trinh { white-space: pre-line; line-height: 1.25; }
#thu-bao-print table.tb-table .tb-ky-su { white-space: pre-line; line-height: 1.35; text-align: center; font-size: 11pt; }
#thu-bao-print .tb-sign { min-height: 11rem; }
#thu-bao-print .tb-sign img { display: block; margin: 0.4rem auto; max-height: 7.5rem; max-width: 95%; object-fit: contain; }
@media print {
  body * { visibility: hidden !important; }
  #thu-bao-print, #thu-bao-print * { visibility: visible !important; }
  #thu-bao-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; max-width: none; }
  .thu-bao-actions, .thu-bao-edit, .thu-bao-tabs { display: none !important; }
  #thu-bao-print thead { display: table-header-group; }
  #thu-bao-print tr { break-inside: avoid; }
  @page { size: A4 portrait; margin: 0; }
}`;

const KINH_GUI = [
  "Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc;",
  "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North).",
].join("\n");

const SHARED = {
  duAn: "Tuyến tàu điện đô thị đoạn 1",
  hangMuc: "Gói thầu XL03: Cung cấp và thi công lắp đặt hệ thống ray",
  diaDiem: "Đặc khu Phú Quốc, Tỉnh An Giang",
  noiLap: "Phú Quốc",
  kinhGui: KINH_GUI,
  tvgsChucVu: "Tư vấn giám sát trưởng",
  tvgsTen: "Trần Văn Thanh",
  chtChucVu: "Chỉ huy trưởng",
  chtTen: "Nguyễn Tất Đạt",
};

/** Mặc định cột Kỹ sư phụ trách — chức danh + tên, mỗi dòng một. */
const DEFAULT_KY_SU = [
  "Cán bộ kỹ thuật:",
  "Nguyễn Minh Đức",
  "Cán bộ thí nghiệm:",
  "Nguyễn Kim Sơn",
].join("\n");

type WorkRow = {
  ngay: string;
  thoiGian: string;
  noiDung: string;
  diaDiem: string;
  kySu: string;
  ghiChu: string;
};

type TabId = "sieu-am" | "bt-phu-thanh" | "las-xd845" | "thep-det" | "thep-tron";

type TabState = {
  ngayLap: string;
  ngayNoiDung: string;
  duAn: string;
  hangMuc: string;
  diaDiem: string;
  noiLap: string;
  kinhGui: string;
  tvgsChucVu: string;
  tvgsTen: string;
  chtChucVu: string;
  chtTen: string;
  rows: WorkRow[];
};

type UtWeld = { moi_han_id: string; ma_lich_su: string; ly_trinh?: string | null };

const TABS: { id: TabId; label: string }[] = [
  { id: "sieu-am", label: "Thư báo siêu âm" },
  { id: "bt-phu-thanh", label: "Thu bao BT PHÚ THÀNH" },
  { id: "las-xd845", label: "Thu bao LAS-XD845" },
  { id: "thep-det", label: "Thu bao thép dẹt 50x5" },
  { id: "thep-tron", label: "Thu bao thep tron" },
];

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

function addDaysIso(iso: string, days: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return d.toISOString().slice(0, 10);
}

function makeBase(partial: Partial<TabState> & { rows: WorkRow[] }): TabState {
  return {
    ngayLap: "",
    ngayNoiDung: "",
    duAn: SHARED.duAn,
    hangMuc: SHARED.hangMuc,
    diaDiem: SHARED.diaDiem,
    noiLap: SHARED.noiLap,
    kinhGui: SHARED.kinhGui,
    tvgsChucVu: SHARED.tvgsChucVu,
    tvgsTen: SHARED.tvgsTen,
    chtChucVu: SHARED.chtChucVu,
    chtTen: SHARED.chtTen,
    ...partial,
  };
}

function buildInitial(): Record<TabId, TabState> {
  const ngayMoi = todayIso();
  const ngayThucHien = addDaysIso(ngayMoi, 1);
  return {
    "sieu-am": makeBase({
      ngayLap: ngayMoi,
      ngayNoiDung: ngayThucHien,
      rows: [{ ngay: ngayThucHien, thoiGian: "8:00", noiDung: "", diaDiem: "", kySu: DEFAULT_KY_SU, ghiChu: "" }],
    }),
    "bt-phu-thanh": makeBase({
      ngayLap: ngayMoi,
      ngayNoiDung: ngayThucHien,
      rows: [
        {
          ngay: ngayThucHien,
          thoiGian: "8:00",
          noiDung: "Kiểm tra trạm bê tông của công ty xây dựng Phú Thành + lấy mẫu vật liệu nguồn",
          diaDiem: "-Nhà máy xi măng Hà Tiên.\n-Mỏ đá Trà Đuốc - An Giang.\n-Nhà máy phụ gia tại VP đại diện TP. Hồ Chí Minh.",
          kySu: DEFAULT_KY_SU,
          ghiChu: "",
        },
      ],
    }),
    "las-xd845": makeBase({
      ngayLap: ngayMoi,
      ngayNoiDung: ngayThucHien,
      rows: [
        {
          ngay: ngayThucHien,
          thoiGian: "8:00",
          noiDung: "Kiểm tra Trạm Thí Nghiệm hiện trường LAS-XD845",
          diaDiem: "Trạm thí nghiệm hiện trường Km15+200",
          kySu: DEFAULT_KY_SU,
          ghiChu: "",
        },
      ],
    }),
    "thep-det": makeBase({
      ngayLap: ngayMoi,
      ngayNoiDung: ngayThucHien,
      rows: [
        {
          ngay: ngayThucHien,
          thoiGian: "8:00",
          noiDung: "Kiểm tra, lấy mẫu vật liệu, sản phẩm xây dựng thép không gỉ mác 304",
          diaDiem: "Lấy mẫu tại hiện trường",
          kySu: DEFAULT_KY_SU,
          ghiChu: "",
        },
      ],
    }),
    "thep-tron": makeBase({
      ngayLap: ngayMoi,
      ngayNoiDung: ngayThucHien,
      rows: [
        {
          ngay: ngayThucHien,
          thoiGian: "8:00",
          noiDung: "Kiểm tra, lấy mẫu vật liệu, sản phẩm xây dựng thép tròn",
          diaDiem: "Lấy mẫu tại nhà máy",
          kySu: DEFAULT_KY_SU,
          ghiChu: "",
        },
      ],
    }),
  };
}

function formatViDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return { day: "   ", month: "   ", year: "2026" };
  return { day: m[3], month: m[2], year: m[1] };
}

/** Ngày tháng trong bảng: gọn 1 dòng dd/mm/yy. */
function displayDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : "";
}

function emptyRow(ngay = ""): WorkRow {
  return { ngay, thoiGian: "8:00", noiDung: "", diaDiem: "", kySu: DEFAULT_KY_SU, ghiChu: "" };
}

function chainageRange(welds: UtWeld[]): string {
  const items = welds
    .map((w) => ({ raw: (w.ly_trinh ?? "").trim(), m: parseChainageMeters(w.ly_trinh) }))
    .filter((x) => x.raw);
  if (!items.length) return "";
  const numbered = items.filter((x) => x.m != null).sort((a, b) => a.m! - b.m!);
  // Ưu tiên cột Kỹ sư phụ trách rộng — lý trình cho phép 2 dòng.
  if (numbered.length >= 2) return `Từ ${numbered[0].raw}\nđến ${numbered[numbered.length - 1].raw}`;
  if (numbered.length === 1) return numbered[0].raw;
  return items.map((x) => x.raw).join("\n");
}

function weldContent(welds: UtWeld[]): string {
  if (!welds.length) return "";
  const codes = welds.map((w) => fieldWeldCode(w.ma_lich_su)).filter(Boolean);
  return `Nghiệm thu siêu âm các mối: ${codes.join(", ")}`;
}

export default function ThuBaoDocument({
  projectId,
  projectName: _projectName,
  onClose,
  embedded = false,
}: {
  projectId?: string;
  projectName: string;
  onClose?: () => void;
  /** true = hiện trong tab (giống RFI), không phải overlay. */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("sieu-am");
  const [byTab, setByTab] = useState<Record<TabId, TabState>>(buildInitial);
  const data = byTab[tab];
  const [utWelds, setUtWelds] = useState<UtWeld[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [utError, setUtError] = useState("");
  const [utLoading, setUtLoading] = useState(false);
  const [chtSig, setChtSig] = useState<string>("");
  const [step, setStep] = useState<"chon" | "thong-tin" | "in">("chon");

  useEffect(() => {
    if (embedded || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, onClose]);

  useEffect(() => {
    loadRfiSignatures()
      .then((s) => setChtSig(s["chi-huy-truong"] ?? ""))
      .catch(() => setChtSig(""));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setUtWelds([]);
      setUtError("");
      return;
    }
    let alive = true;
    setUtLoading(true);
    setUtError("");
    qualityRequest<{ candidates: UtWeld[] }>({ action: "split-list", du_an_id: projectId, loai: "sieu-am" })
      .then((res) => {
        if (!alive) return;
        setUtWelds(res.candidates ?? []);
      })
      .catch((e) => {
        if (!alive) return;
        setUtWelds([]);
        setUtError(e instanceof Error ? e.message : "Không tải được danh sách mối siêu âm.");
      })
      .finally(() => {
        if (alive) setUtLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selectedWelds = useMemo(
    () => utWelds.filter((w) => selected.includes(w.moi_han_id)),
    [utWelds, selected],
  );

  const [fillNote, setFillNote] = useState("");

  const lap = useMemo(() => formatViDate(data.ngayLap), [data.ngayLap]);
  const noiDungNgay = useMemo(() => formatViDate(data.ngayNoiDung), [data.ngayNoiDung]);
  const recipients = data.kinhGui.split("\n").map((l) => l.trim()).filter(Boolean);

  function patch(next: Partial<TabState>) {
    setByTab((cur) => ({ ...cur, [tab]: { ...cur[tab], ...next } }));
  }

  function setNgayMoi(value: string) {
    const plus1 = addDaysIso(value, 1);
    setByTab((cur) => {
      const rows = cur[tab].rows.map((row, i) => (i === 0 ? { ...row, ngay: plus1 || row.ngay } : row));
      return { ...cur, [tab]: { ...cur[tab], ngayLap: value, ngayNoiDung: plus1 || cur[tab].ngayNoiDung, rows } };
    });
  }

  function patchRow(index: number, rowPatch: Partial<WorkRow>) {
    setByTab((cur) => {
      const rows = cur[tab].rows.map((row, i) => (i === index ? { ...row, ...rowPatch } : row));
      const ngayNoiDung = index === 0 && rowPatch.ngay != null ? rowPatch.ngay : cur[tab].ngayNoiDung;
      return { ...cur, [tab]: { ...cur[tab], rows, ngayNoiDung } };
    });
  }

  function toggleWeld(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  /** Giống RFI: chọn mối xong phải bấm Điền mới đổ vào phiếu. */
  function fillFromSelected() {
    const welds = selectedWelds.length ? selectedWelds : utWelds;
    if (!welds.length) {
      setFillNote("Chưa có mối «Chờ siêu âm» để điền.");
      return;
    }
    const ngayMoi = todayIso();
    const ngayThucHien = addDaysIso(ngayMoi, 1);
    const noiDung = weldContent(welds);
    const diaDiem = chainageRange(welds);
    setSelected(welds.map((w) => w.moi_han_id));
    setByTab((cur) => ({
      ...cur,
      "sieu-am": {
        ...cur["sieu-am"],
        ngayLap: ngayMoi,
        ngayNoiDung: ngayThucHien,
        rows: [
          {
            ngay: ngayThucHien,
            thoiGian: "8:00",
            noiDung,
            diaDiem,
            kySu: DEFAULT_KY_SU,
            ghiChu: "",
          },
        ],
      },
    }));
    setTab("sieu-am");
    setStep("thong-tin");
    setFillNote(`Đã điền ${welds.length} mối · ngày mời ${displayDate(ngayMoi)} · ngày tháng ${displayDate(ngayThucHien)} · 8:00`);
  }

  function printDoc() {
    const previous = document.title;
    document.title = " ";
    const restore = () => {
      document.title = previous;
    };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  }

  const shellClass = embedded
    ? "space-y-3"
    : "fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4";
  const actionsClass = embedded
    ? "thu-bao-actions flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow"
    : "thu-bao-actions mx-auto mb-3 flex max-w-5xl flex-wrap items-center justify-between gap-2";
  const titleClass = embedded ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-white";
  const noteClass = embedded ? "mt-0.5 text-xs text-emerald-700" : "mt-0.5 text-xs text-emerald-200";
  const closeBtnClass = embedded
    ? "h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    : "h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  const boxClass = embedded
    ? "thu-bao-edit space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow"
    : "thu-bao-edit mx-auto mb-3 max-w-5xl space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow";
  const tabsClass = embedded
    ? "thu-bao-tabs flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow"
    : "thu-bao-tabs mx-auto mb-3 flex max-w-5xl flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow";
  const printClass = embedded
    ? "rounded-lg bg-white p-4 text-black shadow-lg sm:p-6"
    : "mx-auto max-w-5xl rounded-lg bg-white p-4 text-black shadow-lg sm:p-6";

  const weldPicker = (
    <div className="space-y-2 rounded-lg border border-[#0047AB]/25 bg-[#0047AB]/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800">1. Chọn mối chờ siêu âm</p>
          <p className="text-xs text-slate-600">Giống RFI: tick mối → bấm Điền mới đổ vào phiếu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
            disabled={!utWelds.length}
            onClick={() => setSelected(utWelds.map((w) => w.moi_han_id))}
          >
            Chọn tất cả ({utWelds.length})
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"
            onClick={() => setSelected([])}
          >
            Bỏ chọn
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={!projectId || utLoading || (!selected.length && !utWelds.length)}
            onClick={fillFromSelected}
          >
            Điền vào thư báo{selected.length ? ` (${selected.length})` : utWelds.length ? ` (tất cả ${utWelds.length})` : ""}
          </button>
        </div>
      </div>
      {!projectId ? (
        <p className="text-sm text-amber-800">Chọn dự án ở màn Biên bản mối hàn để tải danh sách mối.</p>
      ) : utLoading ? (
        <p className="text-sm text-slate-500">Đang tải mối chờ siêu âm…</p>
      ) : utError ? (
        <p className="text-sm text-rose-700">{utError}</p>
      ) : !utWelds.length ? (
        <p className="text-sm text-slate-500">Không có mối «Chờ siêu âm».</p>
      ) : (
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
          {utWelds.map((w) => (
            <label key={w.moi_han_id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-100 px-3 text-sm last:border-0 hover:bg-slate-50">
              <input type="checkbox" className="size-4" checked={selected.includes(w.moi_han_id)} onChange={() => toggleWeld(w.moi_han_id)} />
              <span className="font-semibold text-slate-900">{fieldWeldCode(w.ma_lich_su)}</span>
              <span className="text-slate-500">{w.ly_trinh || "— thiếu KM"}</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-600">Đã chọn <b>{selected.length}</b> / {utWelds.length} mối.</p>
    </div>
  );

  return (
    <div
      className={shellClass}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-label="Mẫu in thư báo"
    >
      <style>{css}</style>
      <div className={actionsClass}>
        <div>
          <p className={titleClass}>Thư báo — chọn mối &amp; điền như RFI</p>
          {fillNote ? <p className={noteClass}>{fillNote}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fillFromSelected}
            disabled={!projectId || utLoading || (!selected.length && !utWelds.length)}
            className="h-9 cursor-pointer rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Điền vào thư báo{selected.length ? ` (${selected.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => { setStep("in"); printDoc(); }}
            className="h-9 cursor-pointer rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A]"
          >
            In thư báo
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} className={closeBtnClass}>
              {embedded ? "Đóng tab" : "Đóng"}
            </button>
          ) : null}
        </div>
      </div>

      <div className={`no-print grid grid-cols-3 gap-2 ${embedded ? "" : "mx-auto mb-3 max-w-5xl"}`}>
        {([["chon", "1. Chọn mối"], ["thong-tin", "2. Thông tin phiếu"], ["in", "3. Xem / In"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStep(id)}
            className={`min-h-11 rounded-lg px-2 text-sm font-semibold ${step === id ? "bg-[#0047AB] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={tabsClass}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setTab(item.id); if (item.id === "sieu-am") setStep("chon"); }}
            className={`min-h-9 flex-1 rounded-lg px-2 py-1.5 text-center text-[11px] sm:text-xs ${
              tab === item.id
                ? "bg-emerald-700 font-bold text-white"
                : "border border-transparent bg-slate-50 font-normal text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(step === "chon" || !embedded) && tab === "sieu-am" ? (
        <div className={embedded ? "" : "mx-auto mb-3 max-w-5xl"}>{weldPicker}</div>
      ) : null}

      {(step !== "chon" || !embedded || tab !== "sieu-am") ? (
      <div className={boxClass}>
        {embedded && step === "thong-tin" && tab === "sieu-am" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Bước 2 — kiểm tra / sửa thông tin đã điền. Quay lại bước 1 nếu cần chọn thêm mối.
            <button type="button" className="ml-2 font-bold underline" onClick={() => setStep("chon")}>← Chọn mối</button>
          </div>
        ) : null}

        {tab === "sieu-am" && step !== "chon" && !embedded ? weldPicker : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 font-semibold text-slate-700">
            Ngày mời (hôm nay)
            <input type="date" className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.ngayLap} onChange={(e) => setNgayMoi(e.target.value)} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700">
            Ngày nội dung (= ngày mời + 1, sửa được)
            <input type="date" className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.ngayNoiDung} onChange={(e) => patchRow(0, { ngay: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700">
            Nơi lập
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.noiLap} onChange={(e) => patch({ noiLap: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700 sm:col-span-2">
            Dự án
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.duAn} onChange={(e) => patch({ duAn: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700">
            Địa điểm
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.diaDiem} onChange={(e) => patch({ diaDiem: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700 sm:col-span-3">
            Hạng mục
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.hangMuc} onChange={(e) => patch({ hangMuc: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700 sm:col-span-3">
            Kính gửi (đã bỏ Thủy văn)
            <textarea className="min-h-[4.5rem] rounded-lg border border-slate-300 px-2 py-1.5 font-normal" value={data.kinhGui} onChange={(e) => patch({ kinhGui: e.target.value })} />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-slate-800">Nội dung công việc</p>
            <button
              type="button"
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"
              onClick={() => patch({ rows: [...data.rows, emptyRow(data.ngayNoiDung)] })}
            >
              Thêm dòng
            </button>
          </div>
          {data.rows.map((row, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="grid gap-0.5 text-xs font-semibold text-slate-600">
                Ngày tháng (mời + 1 / sửa)
                <input type="date" className="h-8 rounded border border-slate-300 px-2 text-sm font-normal" value={row.ngay} onChange={(e) => patchRow(index, { ngay: e.target.value })} />
              </label>
              <label className="grid gap-0.5 text-xs font-semibold text-slate-600">
                Thời gian thực hiện
                <input className="h-8 rounded border border-slate-300 px-2 text-sm font-normal" value={row.thoiGian} onChange={(e) => patchRow(index, { thoiGian: e.target.value })} placeholder="8:00" />
              </label>
              <label className="grid gap-0.5 text-xs font-semibold text-slate-600">
                Kỹ sư phụ trách
                <textarea
                  className="min-h-[4.5rem] rounded border border-slate-300 px-2 py-1 text-sm font-normal leading-snug"
                  value={row.kySu}
                  onChange={(e) => patchRow(index, { kySu: e.target.value })}
                  placeholder={"Cán bộ kỹ thuật:\nNguyễn Minh Đức\nCán bộ thí nghiệm:\nNguyễn Kim Sơn"}
                />
              </label>
              <label className="grid gap-0.5 text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-3">
                Nội dung công việc
                <textarea className="min-h-[2.5rem] rounded border border-slate-300 px-2 py-1 text-sm font-normal" value={row.noiDung} onChange={(e) => patchRow(index, { noiDung: e.target.value })} />
              </label>
              <label className="grid gap-0.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                Địa điểm, vị trí, lý trình
                <textarea className="min-h-[2.5rem] rounded border border-slate-300 px-2 py-1 text-sm font-normal" value={row.diaDiem} onChange={(e) => patchRow(index, { diaDiem: e.target.value })} />
              </label>
              <label className="grid gap-0.5 text-xs font-semibold text-slate-600">
                Ghi chú
                <input className="h-8 rounded border border-slate-300 px-2 text-sm font-normal" value={row.ghiChu} onChange={(e) => patchRow(index, { ghiChu: e.target.value })} />
              </label>
              {data.rows.length > 1 ? (
                <button type="button" className="h-8 justify-self-start rounded border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700" onClick={() => patch({ rows: data.rows.filter((_, i) => i !== index) })}>
                  Xóa dòng
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-semibold text-slate-700">
            Chức vụ TVGS
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.tvgsChucVu} onChange={(e) => patch({ tvgsChucVu: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700">
            Tên TVGS
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.tvgsTen} onChange={(e) => patch({ tvgsTen: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700">
            Chức vụ đơn vị thi công
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.chtChucVu} onChange={(e) => patch({ chtChucVu: e.target.value })} />
          </label>
          <label className="grid gap-1 font-semibold text-slate-700">
            Tên chỉ huy trưởng
            <input className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.chtTen} onChange={(e) => patch({ chtTen: e.target.value })} />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Chữ ký CHT: {chtSig ? "đã gắn ảnh từ cấu hình RFI" : "chưa có ảnh — tải ở phiếu RFI (chi-huy-truong)"}.
        </p>
        {embedded ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700" onClick={() => setStep("chon")}>← Chọn mối</button>
            <button type="button" className="h-9 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white" onClick={() => setStep("in")}>3. Xem / In →</button>
          </div>
        ) : null}
      </div>
      ) : null}

      {(step === "in" || !embedded) ? (
      <article id="thu-bao-print" className={printClass}>
        <PrintFrame>
          <header className="text-center">
            <p className="tb-b tb-13 uppercase leading-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="tb-b tb-13 inline-block border-b border-black pb-0.5 leading-tight">Độc lập - Tự do - Hạnh phúc</p>
          </header>
          <p className="tb-i tb-13 mt-3 text-right">
            {data.noiLap || "………………"}, ngày {lap.day} tháng {lap.month} năm {lap.year}
          </p>
          <h1 className="tb-title mt-4 text-center uppercase">THƯ BÁO</h1>

          <dl className="tb-13 mt-4 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1">
            <dt className="tb-b">Dự án:</dt>
            <dd className="tb-n">{data.duAn || "………………"}</dd>
            <dt className="tb-b">Hạng mục:</dt>
            <dd className="tb-n">{data.hangMuc || "………………"}</dd>
            <dt className="tb-b">Địa điểm:</dt>
            <dd className="tb-n">{data.diaDiem || "………………"}</dd>
          </dl>

          <p className="tb-b tb-13 mt-4">Kính gửi:</p>
          <ul className="tb-b tb-12 mt-1 list-none space-y-0.5 pl-6">
            {(recipients.length ? recipients : ["………………"]).map((line, i) => (
              <li key={i}>- {line}</li>
            ))}
          </ul>

          <p className="tb-n tb-13 mt-4">
            Nội dung: Nhà thầu gửi thư báo cho nội dung công việc ngày {noiDungNgay.day} tháng {noiDungNgay.month} năm {noiDungNgay.year} với các nội dung gồm:
          </p>

          <table className="tb-table mt-3">
            <thead>
              <tr>
                <th className="w-[11%]">Ngày tháng</th>
                <th className="w-[12%]">Thời gian thực hiện</th>
                <th className="w-[24%]">Nội dung công việc</th>
                <th className="w-[16%]">Địa điểm, vị trí, lý trình</th>
                <th className="w-[22%]">Kỹ sư phụ trách</th>
                <th className="w-[15%]">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={index}>
                  <td className="tb-ngay">{displayDate(row.ngay)}</td>
                  <td className="text-center whitespace-pre-wrap">{row.thoiGian}</td>
                  <td className="whitespace-pre-wrap">{row.noiDung}</td>
                  <td className="tb-ly-trinh">{row.diaDiem}</td>
                  <td className="tb-ky-su">{row.kySu}</td>
                  <td className="whitespace-pre-wrap">{row.ghiChu}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10 grid grid-cols-2 gap-10 text-center">
            <div className="tb-sign">
              <p className="tb-b tb-14 uppercase">ĐẠI DIỆN TƯ VẤN GIÁM SÁT</p>
              <p className="tb-n tb-14 mt-1">{data.tvgsChucVu || "Tư vấn giám sát trưởng"}</p>
              <div className="h-28" />
              <p className="tb-b tb-14">{data.tvgsTen || "………………"}</p>
            </div>
            <div className="tb-sign">
              <p className="tb-b tb-14 uppercase">ĐẠI DIỆN ĐƠN VỊ THI CÔNG</p>
              <p className="tb-n tb-14 mt-1">{data.chtChucVu || "Chỉ huy trưởng"}</p>
              {chtSig ? <img src={chtSig} alt="Chữ ký chỉ huy trưởng" /> : <div className="h-28" />}
              <p className="tb-b tb-14">{data.chtTen || "………………"}</p>
            </div>
          </div>
        </PrintFrame>
      </article>
      ) : null}
    </div>
  );
}
