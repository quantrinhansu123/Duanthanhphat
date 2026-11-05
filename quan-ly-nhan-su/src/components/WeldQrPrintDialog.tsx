"use client";

import { useEffect, useMemo, useState } from "react";
import PrintFrame from "@/components/PrintFrame";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import type { MachineOption } from "@/data/machineAssignments";
import {
  buildAutolispBulkPreview,
  filterAutolispPointsForBulk,
  parseAutolispChainageMetres,
  type AutolispBulkContext,
} from "@/lib/bulkCreateWeldsFromAutolisp";
import { fetchMapPointsFromDb } from "@/lib/mapPointsDb";
import { loadMachineFieldCodesForSuggestion, loadWeldCodesWithPrefix } from "@/lib/weldReportData";
import {
  COORDINATE_RAIL_PREFIXES,
  buildWeldCodePrefix,
  normalizeCoordinateCode,
  normalizeWeldSitePrefix,
  parseCoordinateCode,
  type CoordinateRailPrefix,
} from "@/lib/weldCode";
import { buildWeldQrText } from "@/lib/weldQr";

type ProjectOption = { id: string; label: string; ma_du_an: string };

type Tag = {
  pointId: string;
  prefix: CoordinateRailPrefix;
  lispCode: string;
  chainage: string;
  systemCode: string;
  siteCode: string;
  machineCode: string;
  qrText: string;
  /** true = điểm đã có nhật ký (đã hàn) — vẫn vẽ để sơ đồ liền mạch, không in QR. */
  linked: boolean;
};

const MAX_TAGS = 120;
const STRIP_COLUMNS = 10;
/** Hai điểm ở hai ray coi là cùng một vị trí khi lệch lý trình không quá ngần này (mét). */
const PAIR_TOLERANCE_M = 1;
type StripColumn = { metres: number; left?: Tag; right?: Tag; gap?: string };
const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * In tem QR theo ngày làm việc: chọn dự án, ngày, máy, dải ray và đoạn Km sẽ hàn →
 * mỗi điểm Autolisp chưa có nhật ký thành một tem (mã Lisp + mã hệ thống/hiện trường/máy dự kiến + QR).
 * Dán tem lên ray, ngoài hiện trường bấm "Quét QR" ở Nhật ký hàn để tạo nhật ký đã điền sẵn.
 */
export default function WeldQrPrintDialog({
  open,
  onClose,
  projects,
  machines,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  machines: MachineOption[];
}) {
  const [duAnId, setDuAnId] = useState(projects[0]?.id ?? "");
  const [mayId, setMayId] = useState(machines[0]?.id ?? "");
  const [performedAt, setPerformedAt] = useState(todayIso());
  const [congNghe, setCongNghe] = useState<"FBW" | "ATW">("FBW");
  const [prefixes, setPrefixes] = useState<CoordinateRailPrefix[]>([...COORDINATE_RAIL_PREFIXES]);
  const [kmFrom, setKmFrom] = useState("");
  const [kmTo, setKmTo] = useState("");
  const [limit, setLimit] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setDuAnId((prev) => prev || projects[0]?.id || "");
    setMayId((prev) => prev || machines[0]?.id || "");
  }, [open, projects, machines]);

  const project = projects.find((item) => item.id === duAnId);
  const machine = machines.find((item) => item.id === mayId);
  const sitePrefix = normalizeWeldSitePrefix(project?.ma_du_an);

  async function generate() {
    setError("");
    if (!duAnId) { setError("Chọn dự án."); return; }
    if (!prefixes.length) { setError("Chọn ít nhất một dải (HT/HP/TT/TP)."); return; }
    const fromM = kmFrom.trim() ? parseAutolispChainageMetres(kmFrom) : null;
    const toM = kmTo.trim() ? parseAutolispChainageMetres(kmTo) : null;
    if (kmFrom.trim() && fromM === null) { setError("Lý trình đầu không hợp lệ (vd 0+850)."); return; }
    if (kmTo.trim() && toM === null) { setError("Lý trình cuối không hợp lệ (vd 1+500)."); return; }
    const count = Math.min(MAX_TAGS, Math.max(1, Math.round(limit) || 1));
    setBusy(true);
    try {
      const allPoints = (await fetchMapPointsFromDb({ force: true })).points;
      // Lấy toàn bộ điểm trong khoảng Km (kể cả đã hàn) để sơ đồ liền mạch.
      const filtered = filterAutolispPointsForBulk(allPoints, {
        prefixes,
        chainageFromM: fromM,
        chainageToM: toM,
        projectId: duAnId,
        onlyUnlinked: false,
      });
      if (!filtered.length) {
        setTags([]);
        setError("Không có điểm Autolisp khớp bộ lọc. Kiểm tra dự án, dải và đoạn Km.");
        return;
      }
      // Thứ tự hàn thực tế: theo lý trình, hai ray cùng vị trí đi liền nhau (HT001, HP001, HT002, …).
      const order = (point: (typeof filtered)[number]) => {
        const parsed = parseCoordinateCode(normalizeCoordinateCode(point.code) || point.code);
        return {
          metres: parseAutolispChainageMetres(point.chainage) ?? Number.MAX_SAFE_INTEGER,
          rail: parsed ? COORDINATE_RAIL_PREFIXES.indexOf(parsed.prefix) : 9,
          seq: parsed?.seq ?? 0,
        };
      };
      // Sơ đồ luôn đủ mọi điểm trong đoạn Km; chỉ giới hạn số TEM QR mới được cấp.
      const picked = [...filtered]
        .sort((a, b) => {
          const x = order(a), y = order(b);
          return x.metres - y.metres || x.seq - y.seq || x.rail - y.rail;
        });

      const context: AutolispBulkContext = {
        performedAt,
        du_an_id: duAnId,
        sitePrefix,
        tho_han_id: "",
        may_id: mayId,
        machine,
        loai_ray: "",
        cong_nghe_han: congNghe,
        loai_moi_han: "Sản xuất",
        chung_chi_su_dung: "",
      };
      const codePrefix = buildWeldCodePrefix(congNghe, `${performedAt.slice(0, 10)}T08:00`, sitePrefix, "Sản xuất");
      const [systemCodes, machineCodes] = await Promise.all([
        loadWeldCodesWithPrefix(codePrefix),
        loadMachineFieldCodesForSuggestion(performedAt.slice(0, 10), machine),
      ]);
      // Cấp mã lần lượt từng điểm theo đúng thứ tự trên (mỗi lần cộng dồn mã đã dùng).
      const usedSystem = [...systemCodes];
      const usedMachine = [...machineCodes];
      let newTagsBudget = count;
      const next: Tag[] = [];
      for (const point of picked) {
        const linked = Boolean(point.isLinked || point.weldId);
        if (linked) {
          // Điểm đã hàn: giữ mã hiện có, chỉ vẽ vị trí, không in QR.
          next.push({
            pointId: point.id,
            prefix: parseCoordinateCode(normalizeCoordinateCode(point.code) || point.code)?.prefix ?? "TT",
            lispCode: normalizeCoordinateCode(point.code) || point.code.toUpperCase(),
            chainage: point.chainage || "",
            systemCode: point.weldCode || "",
            siteCode: "",
            machineCode: "",
            qrText: "",
            linked: true,
          });
          continue;
        }
        if (newTagsBudget <= 0) continue;
        const row = buildAutolispBulkPreview([point], context, usedSystem, usedMachine)[0];
        if (!row || row.skipReason) continue;
        if (row.ma_lich_su) usedSystem.push(row.ma_lich_su);
        if (row.ten_moi_han_theo_may) usedMachine.push(row.ten_moi_han_theo_may);
        newTagsBudget -= 1;
        next.push({
          pointId: row.pointId,
          prefix: row.prefix,
          lispCode: row.maDiem,
          chainage: row.lyTrinh,
          systemCode: row.ma_lich_su,
          siteCode: row.ma_hien_truong,
          machineCode: row.ten_moi_han_theo_may,
          // QR chỉ chứa mã Lisp: mã hệ thống/hiện trường/máy phụ thuộc ngày hàn thực tế nên cấp khi lưu nhật ký.
          qrText: buildWeldQrText({ lispCode: row.maDiem }),
          linked: false,
        });
      }
      setTags(next);
    } catch (cause) {
      setTags([]);
      setError(cause instanceof Error ? cause.message : "Không tạo được danh sách tem.");
    } finally {
      setBusy(false);
    }
  }

  // Tạo ảnh QR cho từng tem.
  useEffect(() => {
    let active = true;
    Promise.all(
      tags.map(async (tag) => [tag.pointId, await QRCode.toDataURL(tag.qrText, { margin: 0, width: 240, errorCorrectionLevel: "M" })] as const),
    )
      .then((entries) => { if (active) setQrImages(Object.fromEntries(entries)); })
      .catch(() => { if (active) setQrImages({}); });
    return () => { active = false; };
  }, [tags]);

  // Bố cục: mỗi tuyến một dải, các cột chạy theo LÝ TRÌNH tăng dần. Hai ray chung một cột khi lệch nhau ≤ PAIR_TOLERANCE_M;
  // đoạn không có mối (bước nhảy lớn hơn 1,5 lần bước thường gặp) được chèn cột "trống" để khỏi nhầm.
  const strips = useMemo(() => {
    const routes = [
      { id: "ha", label: "TUYẾN HẠ", left: "HT", right: "HP" },
      { id: "thuong", label: "TUYẾN THƯỢNG", left: "TT", right: "TP" },
    ] as const;
    const seqOf = (tag: Tag) => parseCoordinateCode(normalizeCoordinateCode(tag.lispCode) || tag.lispCode)?.seq ?? 0;
    const out: { key: string; route: string; left: string; right: string; columns: StripColumn[] }[] = [];
    for (const route of routes) {
      const items = tags
        .filter((tag) => tag.prefix === route.left || tag.prefix === route.right)
        .map((tag) => ({ tag, metres: parseAutolispChainageMetres(tag.chainage) ?? Number.MAX_SAFE_INTEGER }))
        .sort((a, b) => a.metres - b.metres || seqOf(a.tag) - seqOf(b.tag));
      const cols: StripColumn[] = [];
      for (const { tag, metres } of items) {
        const side = tag.prefix === route.left ? "left" : "right";
        const last = cols[cols.length - 1];
        if (last && !last[side] && Math.abs(last.metres - metres) <= PAIR_TOLERANCE_M) last[side] = tag;
        else cols.push({ metres, [side]: tag });
      }
      const steps = cols.slice(1).map((c, i) => c.metres - cols[i].metres).filter((d) => d > 0 && d < 1e9).sort((a, b) => a - b);
      const typical = steps[Math.floor(steps.length / 2)] ?? 0;
      const ordered: StripColumn[] = [];
      cols.forEach((col, i) => {
        const prev = cols[i - 1];
        const jump = prev ? col.metres - prev.metres : 0;
        if (typical > 0 && jump > typical * 1.5 && col.metres < 1e9) {
          ordered.push({ metres: prev.metres, gap: `Trống ${Math.round(jump)} m` });
        }
        ordered.push(col);
      });
      for (let i = 0; i < ordered.length; i += STRIP_COLUMNS) {
        out.push({ key: `${route.id}-${i}`, route: route.label, left: route.left, right: route.right, columns: ordered.slice(i, i + STRIP_COLUMNS) });
      }
    }
    return out;
  }, [tags]);

  if (!open) return null;

  return createPortal(
    <div id="weld-qr-print" role="dialog" aria-modal="true" aria-label="In tem QR vị trí hàn">
      <style>{`
      #weld-qr-print { position:fixed; inset:0; z-index:2100; background:#e2e8f0; overflow:auto; color:#111; font-family:system-ui,sans-serif; }
      #weld-qr-print .toolbar { position:sticky; top:0; z-index:2; background:#fff; border-bottom:1px solid #cbd5e1; padding:12px; }
      #weld-qr-print .sheet { width:297mm; box-sizing:border-box; margin:16px auto; padding:10mm; background:#fff; font-family:'Times New Roman',serif; }
      #weld-qr-print h1 { margin:0 0 2mm; text-align:center; font-size:14pt; text-transform:uppercase; }
      #weld-qr-print .meta { text-align:center; font-size:9.5pt; margin:0 0 4mm; }
      #weld-qr-print h2 { margin:5mm 0 2mm; font-size:10.5pt; border-bottom:1px solid #333; padding-bottom:1mm; }
      #weld-qr-print .strip { width:100%; margin:0 0 7mm; border-collapse:collapse; table-layout:fixed; break-inside:avoid; border-top:0.3mm solid #333; }
      #weld-qr-print .strip td { min-width:0; padding:0; text-align:center; vertical-align:middle; border-bottom:0.2mm solid #bbb; }
      #weld-qr-print .strip col.c-route { width:22mm; }
      #weld-qr-print .strip col.c-rail { width:15mm; }
      #weld-qr-print .strip tr.gaprow td { height:3mm; border-bottom:0; }
      #weld-qr-print .route { font-size:9.5pt; font-weight:bold; text-align:left!important; padding-left:1mm; }
      #weld-qr-print .rail-name { font-size:8.5pt; font-weight:bold; text-align:left!important; }
      #weld-qr-print .lab { font-size:7pt; line-height:1.3; padding:1.2mm 0; }
      #weld-qr-print .lab .lisp { font-size:8.5pt; }
      #weld-qr-print .lab .km { color:#444; }
      #weld-qr-print .rail { position:relative; height:9mm; }
      #weld-qr-print .rail::before { content:""; position:absolute; left:0; right:0; top:50%; height:1.1mm; margin-top:-0.55mm; background:#2f5fb3; }
      #weld-qr-print .rail .dot { position:absolute; left:50%; top:50%; width:2.2mm; height:2.2mm; margin:-1.1mm 0 0 -1.1mm; border-radius:50%; background:#111; }
      #weld-qr-print .qr img { display:block; width:17mm; height:17mm; margin:1.5mm auto; image-rendering:pixelated; }
      #weld-qr-print .gap { height:3mm; border-bottom:0; }
      #weld-qr-print .hint { margin-top:4mm; font-size:8.5pt; color:#444; }
      @media print {
        @page { size:A4 landscape; margin: 0; }
        body:has(#weld-qr-print) > :not(#weld-qr-print) { display:none!important; }
        #weld-qr-print { position:static; overflow:visible; background:#fff; }
        #weld-qr-print .toolbar { display:none; }
        #weld-qr-print .sheet { width:auto; margin:0; padding:0; }
        #weld-qr-print, #weld-qr-print * { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      }
    `}</style>
      <div className="toolbar">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <label className="col-span-2 text-xs font-semibold text-slate-700">Dự án
            <select className={inputClass} value={duAnId} onChange={(e) => setDuAnId(e.target.value)}>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Ngày hàn
            <input type="date" className={inputClass} value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-700">Công nghệ
            <select className={inputClass} value={congNghe} onChange={(e) => setCongNghe(e.target.value as "FBW" | "ATW")}>
              <option value="FBW">FBW</option>
              <option value="ATW">ATW</option>
            </select>
          </label>
          <label className="col-span-2 text-xs font-semibold text-slate-700">Máy hàn (cấp mã máy)
            <select className={inputClass} value={mayId} onChange={(e) => setMayId(e.target.value)}>
              {machines.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Km từ
            <input className={inputClass} value={kmFrom} onChange={(e) => setKmFrom(e.target.value)} placeholder="0+000" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Km đến
            <input className={inputClass} value={kmTo} onChange={(e) => setKmTo(e.target.value)} placeholder="0+500" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Số tem mới tối đa
            <input type="number" min={1} max={MAX_TAGS} className={inputClass} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </label>
          <div className="col-span-2 text-xs font-semibold text-slate-700">Dải ray
            <div className="mt-1 flex h-10 flex-wrap items-center gap-2">
              {COORDINATE_RAIL_PREFIXES.map((prefix) => (
                <label key={prefix} className="inline-flex cursor-pointer items-center gap-1 font-normal">
                  <input
                    type="checkbox"
                    checked={prefixes.includes(prefix)}
                    onChange={() => setPrefixes((prev) => prev.includes(prefix) ? prev.filter((p) => p !== prefix) : [...prev, prefix])}
                  />
                  {prefix}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void generate()} className="h-10 cursor-pointer rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-60">
            {busy ? "Đang tạo…" : "Tạo danh sách tem"}
          </button>
          <button type="button" disabled={tags.length === 0} onClick={() => window.print()} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            In ({tags.filter((t) => !t.linked).length} tem mới)
          </button>
          <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200">Đóng</button>
          {error && <span role="alert" className="text-sm font-medium text-rose-700">{error}</span>}
        </div>
      </div>

      <article className="sheet">
<PrintFrame>
        <h1>Tem QR vị trí hàn ray</h1>
        <p className="meta">
          Dự án: {project?.label ?? "—"} · Ngày hàn: {performedAt.split("-").reverse().join("/")} · Máy: {machine?.code ?? "—"} · {congNghe} · {tags.filter((t) => !t.linked).length} tem mới
        </p>
        {strips.length === 0 ? (
          <p className="hint">Chọn dự án, ngày, đoạn Km rồi bấm “Tạo danh sách tem”. Sơ đồ hiển thị đủ mọi điểm trong đoạn Km; điểm đã hàn ghi “Đã hàn” và không in QR.</p>
        ) : strips.map((strip) => {
          const cols = strip.columns;
          const label = (tag?: Tag) => (
            <div className="lab">
              {tag ? (
                <>
                  <div className="lisp">{tag.lispCode}</div>
                  {tag.linked ? (
                    <div className="km" style={{ color: "#0a7d3d", fontWeight: 700 }}>Đã hàn</div>
                  ) : (
                    null
                  )}
                  {tag.chainage ? <div className="km">Km{tag.chainage.replace(/^km\s*/i, "")}</div> : null}
                </>
              ) : null}
            </div>
          );
          const qr = (tag?: Tag) => (
            <div className="qr">
              {tag && !tag.linked && qrImages[tag.pointId] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qrImages[tag.pointId]} alt={`QR ${tag.lispCode}`} /> : null}
            </div>
          );
          return (
            <table className="strip" key={strip.key}>
              <colgroup>
                <col className="c-route" />
                <col className="c-rail" />
                {cols.map((_, i) => <col key={i} />)}
              </colgroup>
              <tbody>
                {/* Dải 1: sơ đồ ray với các điểm theo lý trình */}
                <tr><td /><td />{cols.map((c, i) => <td key={i}>{c.gap ? <div className="lab" style={{ color: "#b45309", fontWeight: 700 }}>{c.gap}</div> : label(c.left)}</td>)}</tr>
                <tr><td className="route">{strip.route}</td><td className="rail-name">RAY TRÁI</td>{cols.map((c, i) => <td key={i} className="rail">{c.left ? <span className="dot" /> : null}</td>)}</tr>
                <tr><td /><td className="rail-name">RAY PHẢI</td>{cols.map((c, i) => <td key={i} className="rail">{c.right ? <span className="dot" /> : null}</td>)}</tr>
                <tr><td /><td />{cols.map((c, i) => <td key={i}>{label(c.right)}</td>)}</tr>
                <tr className="gaprow"><td /><td />{cols.map((_, i) => <td key={i} />)}</tr>
                {/* Dải 2: tem QR dán lên ray */}
                <tr><td /><td />{cols.map((c, i) => <td key={i}>{c.gap ? <div className="lab" style={{ color: "#b45309", fontWeight: 700 }}>{c.gap}</div> : label(c.left)}</td>)}</tr>
                <tr><td className="route">{strip.route}</td><td className="rail-name">RAY TRÁI</td>{cols.map((c, i) => <td key={i}>{qr(c.left)}</td>)}</tr>
                <tr><td /><td className="rail-name">RAY PHẢI</td>{cols.map((c, i) => <td key={i}>{qr(c.right)}</td>)}</tr>
                <tr><td /><td />{cols.map((c, i) => <td key={i}>{label(c.right)}</td>)}</tr>
              </tbody>
            </table>
          );
        })}
        {strips.length > 0 && (
          <p className="hint">Dán tem lên ray theo đúng vị trí. Ngoài hiện trường: Nhật ký hàn → Quét QR → kiểm tra thợ hàn, máy, kết quả rồi Lưu. Mã hệ thống, mã hiện trường và mã máy được cấp khi lưu nhật ký theo ngày hàn thực tế.</p>
        )}
</PrintFrame>
      </article>
    </div>,
    document.body,
  );
}
