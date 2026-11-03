"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import type { MachineOption } from "@/data/machineAssignments";
import {
  autolispPrefixLabel,
  buildAutolispBulkPreview,
  filterAutolispPointsForBulk,
  parseAutolispChainageMetres,
  type AutolispBulkContext,
} from "@/lib/bulkCreateWeldsFromAutolisp";
import { fetchUnlinkedGpsPoints } from "@/lib/mapPointsDb";
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
};

const MAX_TAGS = 120;
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
      const unlinked = await fetchUnlinkedGpsPoints();
      const filtered = filterAutolispPointsForBulk(unlinked, {
        prefixes,
        chainageFromM: fromM,
        chainageToM: toM,
        projectId: duAnId,
        onlyUnlinked: true,
      });
      if (!filtered.length) {
        setTags([]);
        setError("Không có điểm Autolisp chưa gắn nhật ký khớp bộ lọc. Kiểm tra dự án, dải và đoạn Km.");
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
      const picked = [...filtered]
        .sort((a, b) => {
          const x = order(a), y = order(b);
          return x.metres - y.metres || x.seq - y.seq || x.rail - y.rail;
        })
        .slice(0, count);

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
      const next: Tag[] = [];
      for (const point of picked) {
        const row = buildAutolispBulkPreview([point], context, usedSystem, usedMachine)[0];
        if (!row || row.skipReason) continue;
        if (row.ma_lich_su) usedSystem.push(row.ma_lich_su);
        if (row.ten_moi_han_theo_may) usedMachine.push(row.ten_moi_han_theo_may);
        next.push({
          pointId: row.pointId,
          prefix: row.prefix,
          lispCode: row.maDiem,
          chainage: row.lyTrinh,
          systemCode: row.ma_lich_su,
          siteCode: row.ma_hien_truong,
          machineCode: row.ten_moi_han_theo_may,
          qrText: buildWeldQrText({
            lispCode: row.maDiem,
            systemCode: row.ma_lich_su,
            siteCode: row.ma_hien_truong,
            machineCode: row.ten_moi_han_theo_may,
          }),
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

  const groups = useMemo(
    () => COORDINATE_RAIL_PREFIXES
      .map((prefix) => ({ prefix, items: tags.filter((tag) => tag.prefix === prefix) }))
      .filter((group) => group.items.length > 0),
    [tags],
  );

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
      #weld-qr-print .tags { display:grid; grid-template-columns:repeat(8, 1fr); gap:2mm; }
      #weld-qr-print .tag { border:1px dashed #666; padding:1.5mm; text-align:center; break-inside:avoid; font-size:6.8pt; line-height:1.25; }
      #weld-qr-print .tag .lisp { font-size:10pt; font-weight:bold; }
      #weld-qr-print .tag img { display:block; width:22mm; height:22mm; margin:1mm auto 0; image-rendering:pixelated; }
      #weld-qr-print .hint { margin-top:4mm; font-size:8.5pt; color:#444; }
      @media print {
        @page { size:A4 landscape; margin:10mm; }
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
          <label className="text-xs font-semibold text-slate-700">Số tem tối đa
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
            In ({tags.length} tem)
          </button>
          <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200">Đóng</button>
          {error && <span role="alert" className="text-sm font-medium text-rose-700">{error}</span>}
        </div>
      </div>

      <article className="sheet">
        <h1>Tem QR vị trí hàn ray</h1>
        <p className="meta">
          Dự án: {project?.label ?? "—"} · Ngày hàn: {performedAt.split("-").reverse().join("/")} · Máy: {machine?.code ?? "—"} · {congNghe} · {tags.length} vị trí
        </p>
        {groups.length === 0 ? (
          <p className="hint">Chọn dự án, ngày, đoạn Km rồi bấm “Tạo danh sách tem”. Chỉ liệt kê điểm Autolisp chưa có nhật ký.</p>
        ) : groups.map((group) => (
          <section key={group.prefix}>
            <h2>{autolispPrefixLabel(group.prefix)} ({group.prefix}) — {group.items.length} vị trí</h2>
            <div className="tags">
              {group.items.map((tag) => (
                <div className="tag" key={tag.pointId}>
                  <div className="lisp">{tag.lispCode}</div>
                  {tag.chainage ? <div>Km{tag.chainage.replace(/^km\s*/i, "")}</div> : null}
                  <div>{tag.siteCode}</div>
                  <div>{tag.machineCode}</div>
                  {qrImages[tag.pointId] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qrImages[tag.pointId]} alt={`QR ${tag.lispCode}`} /> : null}
                </div>
              ))}
            </div>
          </section>
        ))}
        {groups.length > 0 && (
          <p className="hint">Dán tem lên ray theo đúng vị trí. Ngoài hiện trường: Nhật ký hàn → Quét QR → kiểm tra thợ hàn, máy, kết quả rồi Lưu. Mã hệ thống, mã hiện trường và mã máy trên tem là mã dự kiến, được giữ khi lưu.</p>
        )}
      </article>
    </div>,
    document.body,
  );
}
