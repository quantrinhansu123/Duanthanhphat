"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
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
#thu-bao-print .tb-sign {
  min-height: 11rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
#thu-bao-print .tb-sign-slot {
  width: 100%;
  height: 7.5rem;
  margin: 0.35rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
#thu-bao-print .tb-sign-slot img {
  display: block;
  max-height: 7.5rem;
  max-width: 95%;
  object-fit: contain;
}
#thu-bao-print .tb-sign-name { margin-top: auto; }
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
  chtTen: "Nguyễn Minh Đức",
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
/** Phiếu RFI siêu âm đã phát — mỗi phiếu tự sinh một thư báo. */
type UtTicket = { id: string; so_phieu: string; ngay_moi: string; ngay_nghiem_thu: string | null; thong_tin?: Record<string, string> | null };

const TABS: { id: TabId; label: string }[] = [
  { id: "sieu-am", label: "Thư báo siêu âm" },
  { id: "bt-phu-thanh", label: "Thư báo BT PHÚ THÀNH" },
  { id: "las-xd845", label: "Thư báo LAS-XD845" },
  { id: "thep-det", label: "Thư báo thép dẹt 50×5" },
  { id: "thep-tron", label: "Thư báo thép tròn" },
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
  if (!codes.length) return "";
  if (codes.length === 1) return `Nghiệm thu siêu âm các mối:\n${codes[0]}`;
  return `Nghiệm thu siêu âm các mối:\nTừ ${codes[0]}\nđến ${codes[codes.length - 1]}`;
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
  const [tickets, setTickets] = useState<UtTicket[]>([]);
  const [openedId, setOpenedId] = useState("");
  const [utError, setUtError] = useState("");
  const [utLoading, setUtLoading] = useState(false);
  const [chtSig, setChtSig] = useState<string>("");
  /** true = in / preview dán sẵn chữ ký CHT (như RFI «In có chữ ký»). */
  const [withSignatures, setWithSignatures] = useState(true);
  const [step, setStep] = useState<"chon" | "thong-tin" | "in">("chon");
  /** Modal rộng khi bấm Xem: form sửa + preview phiếu. */
  const [viewOpen, setViewOpen] = useState(false);
  /** Giữ #thu-bao-print trong DOM để In ngay không cần mở modal. */
  const [printArmed, setPrintArmed] = useState(false);
  /** Popup chọn mẫu in trước khi Xem / In. */
  const [pickOpen, setPickOpen] = useState(false);
  /** Sau khi chọn mẫu (chế độ In): hỏi In có chữ ký / In ký tay. */
  const [sigPickOpen, setSigPickOpen] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<UtTicket | null>(null);
  const [pendingMode, setPendingMode] = useState<"xem" | "in">("xem");
  const [pickBusy, setPickBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sigPickOpen) {
        setSigPickOpen(false);
        return;
      }
      if (pickOpen) {
        if (!pickBusy) {
          setPickOpen(false);
          setPendingTicket(null);
        }
        return;
      }
      if (viewOpen) {
        setViewOpen(false);
        setStep("chon");
        return;
      }
      if (!embedded && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, onClose, viewOpen, pickOpen, pickBusy, sigPickOpen]);

  useEffect(() => {
    loadRfiSignatures()
      .then((s) => setChtSig(s["chi-huy-truong"] ?? ""))
      .catch(() => setChtSig(""));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setTickets([]);
      setUtError("");
      return;
    }
    let alive = true;
    setUtLoading(true);
    setUtError("");
    qualityRequest<{ tickets: UtTicket[] }>({ action: "split-list", du_an_id: projectId, loai: "sieu-am" })
      .then((res) => {
        if (!alive) return;
        const list = [...(res.tickets ?? [])].sort((a, b) => b.ngay_moi.localeCompare(a.ngay_moi) || b.so_phieu.localeCompare(a.so_phieu, "vi", { numeric: true }));
        setTickets(list);
      })
      .catch((e) => {
        if (!alive) return;
        setTickets([]);
        setUtError(e instanceof Error ? e.message : "Không tải được danh sách phiếu RFI siêu âm.");
      })
      .finally(() => {
        if (alive) setUtLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  /** Bước 1: mở popup chọn mẫu in. */
  function askTemplate(t: UtTicket, mode: "xem" | "in") {
    setPendingTicket(t);
    setPendingMode(mode);
    setPickOpen(true);
    setUtError("");
  }

  /**
   * Thư báo theo phiếu RFI + mẫu đã chọn.
   * sieu-am: nội dung/lý trình từ phiếu; mẫu khác: giữ nội dung mẫu, gắn ngày/giờ từ RFI.
   * mode "xem" = modal rộng; "in" = in ngay.
   */
  async function openTicket(t: UtTicket, mode: "xem" | "in", templateId: TabId) {
    setOpenedId(t.id);
    setUtError("");
    setPickBusy(true);
    try {
      const ngay = t.ngay_moi;
      const gio = (t.thong_tin?.gio_bat_dau || "08:00").replace(/^0(\d)/, "$1");
      const ngayLap = addDaysIso(ngay, -1) || ngay;
      let note = `Thư báo theo ${t.so_phieu} · ${displayDate(ngay)} ${gio}`;

      if (templateId === "sieu-am") {
        const { items } = await qualityRequest<{ items: UtWeld[] }>({ action: "split-detail", du_an_id: projectId, loai: "sieu-am", id: t.id });
        note = `Thư báo theo ${t.so_phieu} · ${items.length} mối · ${displayDate(ngay)} ${gio}`;
        flushSync(() => {
          setByTab((cur) => ({
            ...cur,
            "sieu-am": {
              ...cur["sieu-am"],
              ngayLap,
              ngayNoiDung: ngay,
              rows: [{ ngay, thoiGian: gio, noiDung: weldContent(items), diaDiem: chainageRange(items), kySu: DEFAULT_KY_SU, ghiChu: "" }],
            },
          }));
          setTab("sieu-am");
          setFillNote(note);
          if (mode === "xem") {
            setStep("thong-tin");
            setViewOpen(true);
            setPrintArmed(false);
          } else {
            setStep("in");
            setViewOpen(false);
            setPrintArmed(true);
          }
        });
      } else {
        flushSync(() => {
          setByTab((cur) => {
            const base = cur[templateId];
            const rows = base.rows.map((row, i) => (i === 0 ? { ...row, ngay, thoiGian: gio } : row));
            return { ...cur, [templateId]: { ...base, ngayLap, ngayNoiDung: ngay, rows } };
          });
          setTab(templateId);
          setFillNote(`${TABS.find((x) => x.id === templateId)?.label ?? "Thư báo"} · ${t.so_phieu} · ${displayDate(ngay)} ${gio}`);
          if (mode === "xem") {
            setStep("thong-tin");
            setViewOpen(true);
            setPrintArmed(false);
          } else {
            setStep("in");
            setViewOpen(false);
            setPrintArmed(true);
          }
        });
      }
      setPickOpen(false);
      setPendingTicket(null);
      // In từ danh sách → hỏi In có chữ ký / In ký tay (không in ngay).
      if (mode === "in") setSigPickOpen(true);
    } catch (e) {
      setUtError(e instanceof Error ? e.message : "Không tải được phiếu RFI siêu âm.");
    } finally {
      setPickBusy(false);
    }
  }

  function closeView() {
    setViewOpen(false);
    setStep("chon");
    setTab("sieu-am");
  }

  function closePick() {
    if (pickBusy) return;
    setPickOpen(false);
    setPendingTicket(null);
  }

  function closeSigPick() {
    setSigPickOpen(false);
    setPrintArmed(false);
    setStep("chon");
    setTab("sieu-am");
  }

  function confirmSigPrint(withSig: boolean) {
    setSigPickOpen(false);
    printVersion(withSig);
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

  /** Giống phiếu RFI: in có chữ ký dán sẵn hoặc in trống để ký tay. */
  function printVersion(withSig: boolean) {
    flushSync(() => setWithSignatures(withSig));
    printDoc();
    // Preview modal giữ chữ ký sau khi in ký tay xong.
    if (!withSig && viewOpen) {
      window.addEventListener("afterprint", () => setWithSignatures(true), { once: true });
    }
  }

  const printButtons = (
    <>
      <button
        type="button"
        onClick={() => printVersion(true)}
        title={chtSig ? "Chữ ký CHT đã dán sẵn trên phiếu — phát hành ngay" : "Chưa có ảnh chữ ký CHT — tải ở cấu hình RFI (chi-huy-truong)"}
        className="h-9 cursor-pointer rounded-lg bg-[#0047AB] px-3 text-sm font-semibold text-white hover:bg-[#00388A]"
      >
        In có chữ ký
      </button>
      <button
        type="button"
        onClick={() => printVersion(false)}
        title="Không dán chữ ký — in ra để ký trực tiếp"
        className="h-9 cursor-pointer rounded-lg border border-[#0047AB] bg-white px-3 text-sm font-semibold text-[#0047AB] hover:bg-blue-50"
      >
        In ký tay
      </button>
    </>
  );

  const shellClass = embedded
    ? "space-y-3"
    : "fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4";
  const actionsClass = embedded
    ? "thu-bao-actions flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow"
    : "thu-bao-actions mx-auto mb-3 flex max-w-5xl flex-wrap items-center justify-between gap-2";
  const titleClass = embedded ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-white";
  const noteClass = embedded ? "mt-0.5 text-xs text-emerald-700" : "mt-0.5 text-xs text-emerald-200";
  const closeBtnClass =
    "h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  const boxClass =
    "thu-bao-edit space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow sm:p-5";
  const printClass = "rounded-lg border border-slate-200 bg-white p-4 text-black sm:p-8";
  /** Không còn thanh tab mẫu — chọn mẫu qua popup Xem/In. */
  const showInlineEditor = !embedded && step !== "chon";
  const showPrintDoc = viewOpen || printArmed || !embedded;
  /** In từ danh sách: phiếu ẩn; không che danh sách. */
  const printOffscreen = printArmed && !viewOpen && embedded;

  const weldPicker = (
    <div className="space-y-2 rounded-lg border border-[#0047AB]/25 bg-[#0047AB]/5 p-3">
      <div>
        <p className="font-bold text-slate-800">1. Thư báo theo phiếu RFI siêu âm đã phát</p>
        <p className="text-xs text-slate-600">Bấm <b>Xem</b> (chọn mẫu → form + preview) hoặc <b>In</b> (chọn mẫu → hỏi In có chữ ký / In ký tay). Ngày/giờ lấy từ phiếu RFI.</p>
      </div>
      {!projectId ? (
        <p className="text-sm text-amber-800">Chọn dự án ở màn Biên bản mối hàn để tải danh sách phiếu.</p>
      ) : utLoading ? (
        <p className="text-sm text-slate-500">Đang tải phiếu RFI siêu âm…</p>
      ) : utError ? (
        <p className="text-sm text-rose-700">{utError}</p>
      ) : !tickets.length ? (
        <p className="text-sm text-slate-500">Chưa phát phiếu RFI siêu âm nào.</p>
      ) : (
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`flex min-h-12 flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 ${openedId === t.id ? "bg-emerald-50" : ""}`}
            >
              <span className="min-w-[7rem] font-semibold text-slate-900">{t.so_phieu}</span>
              <span className="text-slate-500">{displayDate(t.ngay_moi)} {(t.thong_tin?.gio_bat_dau || "08:00").replace(/^0(\d)/, "$1")}</span>
              <span className="text-xs text-slate-500">{t.ngay_nghiem_thu ? "Đã nghiệm thu" : "Chờ nghiệm thu"}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-[#0047AB]/60 hover:bg-blue-50"
                  onClick={() => askTemplate(t, "xem")}
                >
                  Xem
                </button>
                <button
                  type="button"
                  className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs font-semibold text-white hover:bg-[#00388A]"
                  onClick={() => askTemplate(t, "in")}
                >
                  In
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const editFormFields = (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 font-semibold text-slate-700">
          Ngày lập thư báo (= ngày mời RFI − 1)
          <input type="date" className="h-9 rounded-lg border border-slate-300 px-2 font-normal" value={data.ngayLap} onChange={(e) => setNgayMoi(e.target.value)} />
        </label>
        <label className="grid gap-1 font-semibold text-slate-700">
          Ngày thực hiện (= ngày mời RFI, sửa được)
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
        Chữ ký CHT: {chtSig ? "đã gắn ảnh từ cấu hình RFI — dùng nút «In có chữ ký»" : "chưa có ảnh — tải ở phiếu RFI (chi-huy-truong), rồi «In có chữ ký»"}.
      </p>
    </>
  );

  const printBody = (
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
          <div className="tb-sign-slot" aria-hidden />
          <p className="tb-b tb-14 tb-sign-name">{data.tvgsTen || "………………"}</p>
        </div>
        <div className="tb-sign">
          <p className="tb-b tb-14 uppercase">ĐẠI DIỆN ĐƠN VỊ THI CÔNG</p>
          <p className="tb-n tb-14 mt-1">{data.chtChucVu || "Chỉ huy trưởng"}</p>
          <div className="tb-sign-slot">
            {withSignatures && chtSig ? <img src={chtSig} alt="Chữ ký chỉ huy trưởng" /> : null}
          </div>
          <p className="tb-b tb-14 tb-sign-name">{data.chtTen || "………………"}</p>
        </div>
      </div>
    </PrintFrame>
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
          <p className={titleClass}>Thư báo — tự sinh từ phiếu RFI siêu âm</p>
          {fillNote ? <p className={noteClass}>{fillNote}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {printButtons}
          {onClose ? (
            <button type="button" onClick={onClose} className={closeBtnClass}>
              {embedded ? "Đóng tab" : "Đóng"}
            </button>
          ) : null}
        </div>
      </div>

      {!embedded ? (
        <div className="no-print mx-auto mb-3 grid max-w-5xl grid-cols-3 gap-2">
          {([["chon", `1. Phiếu RFI siêu âm (${tickets.length})`], ["thong-tin", "2. Thông tin phiếu"], ["in", "3. Xem / In"]] as const).map(([id, label]) => (
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
      ) : null}

      {(embedded || step === "chon") ? (
        <div className={embedded ? "" : "mx-auto mb-3 max-w-5xl"}>{weldPicker}</div>
      ) : null}

      {showInlineEditor ? (
        <div className={`mx-auto mb-3 max-w-5xl ${boxClass}`}>
          {editFormFields}
        </div>
      ) : null}

      {/* In ngay / tab khác: phiếu trên trang; In từ danh sách SA: ẩn nhưng vẫn in được */}
      {showPrintDoc && !viewOpen ? (
        <article
          id="thu-bao-print"
          className={printOffscreen ? "absolute left-[-9999px] top-0 w-[210mm]" : `${embedded ? "" : "mx-auto max-w-5xl "}${printClass}`}
        >
          {printBody}
        </article>
      ) : null}

      {pickOpen && pendingTicket ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Chọn mẫu in thư báo">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-slate-900">Chọn mẫu in thư báo</p>
                <p className="mt-1 text-xs text-slate-600">
                  Phiếu <b>{pendingTicket.so_phieu}</b> · {pendingMode === "xem" ? "Xem / sửa" : "In — chọn mẫu rồi hỏi chữ ký"}
                </p>
              </div>
              <button type="button" onClick={closePick} disabled={pickBusy} className={closeBtnClass}>
                Đóng
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={pickBusy}
                  onClick={() => void openTicket(pendingTicket, pendingMode, item.id)}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:border-[#0047AB]/50 hover:bg-blue-50 disabled:opacity-60"
                >
                  <span>{item.label}</span>
                  <span className="text-xs font-normal text-slate-500">{item.id === "sieu-am" ? "theo phiếu RFI" : "theo mẫu"}</span>
                </button>
              ))}
            </div>
            {pickBusy ? <p className="mt-3 text-center text-xs text-slate-500">Đang mở mẫu…</p> : null}
            {utError ? <p className="mt-3 text-sm text-rose-700">{utError}</p> : null}
          </div>
        </div>
      ) : null}

      {sigPickOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Chọn cách in chữ ký">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-slate-900">In thư báo thế nào?</p>
                <p className="mt-1 text-xs text-slate-600">
                  {fillNote || "Chọn in sẵn chữ ký CHT hoặc để trống ký tay"}
                </p>
              </div>
              <button type="button" onClick={closeSigPick} className={closeBtnClass}>
                Đóng
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => confirmSigPrint(true)}
                title={chtSig ? "Dán sẵn chữ ký CHT" : "Chưa có ảnh chữ ký — vẫn in (ô có thể trống)"}
                className="flex min-h-12 items-center justify-center rounded-xl bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A]"
              >
                In có chữ ký
              </button>
              <button
                type="button"
                onClick={() => confirmSigPrint(false)}
                className="flex min-h-12 items-center justify-center rounded-xl border border-[#0047AB] bg-white px-4 text-sm font-semibold text-[#0047AB] hover:bg-blue-50"
              >
                In ký tay
              </button>
            </div>
            {!chtSig ? (
              <p className="mt-3 text-xs text-amber-700">Chưa có ảnh chữ ký CHT — tải ở cấu hình RFI (chi-huy-truong).</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {viewOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/75 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Xem thư báo">
          <div className="flex max-h-[min(90dvh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl">
            <div className="thu-bao-actions flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">Xem / sửa thư báo</p>
                {fillNote ? <p className="mt-0.5 truncate text-xs text-emerald-700">{fillNote}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {printButtons}
                <button type="button" onClick={closeView} className={`${closeBtnClass} h-9`}>
                  Đóng
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <div className={`mb-4 ${boxClass}`}>{editFormFields}</div>
              <p className="thu-bao-actions mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preview phiếu {withSignatures && chtSig ? "· có chữ ký CHT" : withSignatures ? "· chưa có ảnh chữ ký" : "· bản ký tay"}
              </p>
              <article id="thu-bao-print" className={printClass}>
                {printBody}
              </article>
            </div>
            <div className="thu-bao-actions flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2.5 sm:px-5">
              {printButtons}
              <button type="button" onClick={closeView} className={`${closeBtnClass} h-9`}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
