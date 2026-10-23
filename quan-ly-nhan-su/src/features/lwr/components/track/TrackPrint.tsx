"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatChainage, getPlacementSpan, trackExtent, TRACK_PIXELS_PER_METRE, type TrackLayout } from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";
import { RailGrid } from "./RailGrid";

const noop = () => {};

const FORMATS = {
  A4: { label: "A4 ngang", size: "297mm 210mm", width: "297mm", px: 1000 },
  A3: { label: "A3 ngang", size: "420mm 297mm", width: "420mm", px: 1500 },
  LONG: { label: "A3 kéo dài (841 × 297 mm)", size: "841mm 297mm", width: "841mm", px: 3100 },
};

export function TrackPrint({ layout, joints, symbols, onClose, projectName }: { layout: TrackLayout; joints: RailJoint[]; symbols: StructureSymbol[]; onClose: () => void; projectName?: string }) {
  const [format, setFormat] = useState<keyof typeof FORMATS>("A4");
  const config = FORMATS[format];
  const extent = trackExtent(layout.rows);
  // RailGrid is ~150px label column + track + gutter; scale it down to the printable width (px).
  const contentPx = 150 + 56 + 32 + Math.max(240, (extent.endMetres - extent.startMetres) * TRACK_PIXELS_PER_METRE);
  const fit = Math.min(1, config.px / contentPx);
  const stamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const plotted = layout.longRails.flatMap(rail => { const span = getPlacementSpan(layout.rows, rail); return span ? [{ rail, span }] : []; });
  return createPortal(<div id="lwr-track-print" role="dialog" aria-modal="true" aria-label="Xem trước bản in sơ đồ tuyến">
    <style>{`
      #lwr-track-print { position:fixed; inset:0; z-index:2100; background:#e2e8f0; overflow:auto; color:#111; }
      #lwr-track-print .toolbar { position:sticky; top:0; z-index:1; display:flex; gap:12px; padding:12px; background:white; border-bottom:1px solid #aaa; }
      #lwr-track-print .toolbar button, #lwr-track-print select { border:1px solid #aaa; border-radius:4px; padding:6px 12px; }
      #lwr-track-print article { width:${config.width}; box-sizing:border-box; margin:16px auto; padding:10mm; background:white; font:10pt 'Times New Roman',serif; }
      #lwr-track-print h1 { font-size:15pt; text-align:center; font-weight:bold; margin:4px; }
      #lwr-track-print p { margin:3px 0; }
      #lwr-track-print table { border-collapse:collapse; width:100%; margin-top:8px; font-size:9pt; }
      #lwr-track-print th,#lwr-track-print td { border:1px solid #888; padding:4px 6px; text-align:left; }
      #lwr-track-print tr { break-inside:avoid; }
      @media print {
        @page { size:${config.size}; margin:8mm; }
        body:has(#lwr-track-print) > :not(#lwr-track-print) { display:none!important; }
        #lwr-track-print { position:static; overflow:visible; background:white; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        #lwr-track-print .toolbar { display:none; }
        #lwr-track-print article { width:auto; margin:0; padding:0; break-after:page; }
        #lwr-track-print article:last-child { break-after:auto; }
        #lwr-track-print thead { display:table-header-group; }
      }
    `}</style>
    <div className="toolbar"><select aria-label="Khổ giấy" value={format} onChange={e => setFormat(e.target.value as keyof typeof FORMATS)}>{Object.entries(FORMATS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><button onClick={() => window.print()}>In / lưu PDF</button><button onClick={onClose}>Đóng</button></div>
    <article>
      <p>CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</p>
      <h1>SƠ ĐỒ TUYẾN VÀ GIẢI TOẢ ỨNG SUẤT LWR</h1>
      <p>Dự án: {projectName ?? "Chưa gán dự án"}</p>
      <p>Km{formatChainage(extent.startMetres)} – Km{formatChainage(extent.endMetres)} · {stamp}</p>
      {/* Same grid as the screen, shrunk to the paper width. */}
      <div style={{ zoom: fit, fontFamily: "system-ui, sans-serif" }}>
        <RailGrid
          rows={layout.rows}
          longRails={layout.longRails}
          joints={joints}
          selectedId=""
          onSelect={noop}
          embedded
          structures={{ placements: layout.placements, symbols, editingPlacementId: null, onEditPlacement: noop, onRemovePlacement: noop }}
        />
      </div>
      <table><thead><tr><th>Mã</th><th>Dải ray</th><th>Ngày thi công</th><th>Lý trình thực</th><th>Chiều dài</th><th>Trạng thái</th></tr></thead><tbody>{plotted.map(({ rail, span }) => <tr key={rail.id}><td>{rail.code}</td><td>{rail.rowKey}</td><td>{rail.releaseDate ?? "—"}</td><td>{formatChainage(span.startMetres)} – {formatChainage(span.endMetres)}</td><td>{span.endMetres - span.startMetres} m</td><td>{rail.completedAt ? "Đã giải toả" : "Chưa hoàn thành"}</td></tr>)}</tbody></table>
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: "6mm", marginBottom: "6mm" }}><b>Người lập</b><b>Người kiểm tra</b><b>Đại diện bên A</b></div>
    </article>
  </div>, document.body);
}
