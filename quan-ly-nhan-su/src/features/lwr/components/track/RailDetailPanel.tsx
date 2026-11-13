"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { detailForCell } from "@lwr/lib/track-data";
import { DEFAULT_STRESS_INPUT, reportEndMovement, type StressInput } from "@lwr/lib/stress-release";
import {
  displayRailCode,
  lockTempFromSides,
  parseChainage,
  railCellLengthMetres,
  railCellSpanMetres,
  railCellLockTemp,
  type RailCellPatch,
} from "@lwr/lib/track-editor";
import type { RailCell, RailReportRow } from "@lwr/types/track";
import { StressReleaseCalculator, type StressSaveResult } from "./StressReleaseCalculator";

const inputClass =
  "mt-1 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

export function ReleaseStatusButtons({
  passed,
  onChange,
}: {
  passed: boolean;
  onChange: (passed: boolean) => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-sm font-semibold text-slate-800">Trạng thái giải tỏa ứng suất</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={!passed}
          onClick={() => onChange(false)}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            passed ? "border-slate-200 bg-white text-slate-500" : "border-slate-400 bg-slate-100 text-slate-800"
          }`}
        >
          Không đạt
        </button>
        <button
          type="button"
          aria-pressed={passed}
          onClick={() => onChange(true)}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            passed ? "border-emerald-700 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          Đạt
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Đạt → màu theo T khóa (≥30 xanh, &lt;30 cam). Không đạt → xám. T khóa = (T trái + T phải) / 2.
      </p>
    </div>
  );
}

const REPORT_DESIGN_MM = 5; // Giới hạn cho phép tại điểm M theo quy trình.
const EMPTY_REPORT_ROW: RailReportRow = { temp: "", mActual: "", eActual: "", note: "", measuredAt: "", airTemp: "" };

function sameChainage(draft: string, stored: string) {
  const parsed = parseChainage(draft);
  const current = parseChainage(stored);
  return parsed !== null && parsed === current;
}

function sideTempOf(cell: RailCell, side: "left" | "right") {
  if (side === "left") return cell.leftTemp ?? cell.temp;
  return cell.rightTemp ?? cell.temp;
}

export function RailDetailPanel({
  cell,
  trackSide = "LEFT",
  onClose,
  onPrev,
  onNext,
  onChange,
  onSaveParams,
  onRemove,
  savedParams,
  longRailCode,
}: {
  cell: RailCell;
  savedParams?: StressInput;
  /** Mã thanh LWR đang phủ đoạn ray này (hiện trên sơ đồ, VD HP0001). */
  longRailCode?: string;
  trackSide?: "LEFT" | "RIGHT";
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChange: (patch: RailCellPatch) => boolean;
  onSaveParams?: (params: StressInput) => StressSaveResult | boolean | void;
  onRemove?: () => boolean | void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [calculatorInput, setCalculatorInput] = useState<{ cellId: string; input: StressInput } | null>(null);
  const length = railCellLengthMetres(cell) ?? 0;
  const detail = detailForCell(cell);
  const lockTemp = railCellLockTemp(cell);
  const lengthLocked = Boolean(cell.released);
  const [fromDraft, setFromDraft] = useState(cell.from);
  const [toDraft, setToDraft] = useState(cell.to);
  const span = railCellSpanMetres(cell) ?? 0;
  const [adjustDraft, setAdjustDraft] = useState(String(cell.lengthAdjust ?? 0));
  const [leftTempDraft, setLeftTempDraft] = useState(String(sideTempOf(cell, "left")));
  const [rightTempDraft, setRightTempDraft] = useState(String(sideTempOf(cell, "right")));
  const [fieldError, setFieldError] = useState<string | null>(null);
  // Hai tab: «Giải tỏa» (nhập nhiệt độ, lý trình, tính toán) và «Báo cáo» (bảng chuyển vị điểm M / E).
  const [view, setView] = useState<"giai-toa" | "bao-cao">("giai-toa");
  // Phiếu chỉ hiện lần đo đầu tiên của đoạn ray này; nhiệt độ lấy từ tab Giải tỏa, chỉ nhập chuyển vị thực tế M / E + ghi chú.
  const [report, setReport] = useState<RailReportRow>(() => cell.report?.rows[0] ?? { ...EMPTY_REPORT_ROW });
  useEffect(() => { setReport(cell.report?.rows[0] ?? { ...EMPTY_REPORT_ROW }); }, [cell.id, cell.report]);

  function commitReport(next: RailReportRow) {
    const empty = !next.temp.trim() && !next.mActual.trim() && !next.eActual.trim() && !next.note.trim() && !next.measuredAt?.trim() && !next.airTemp?.trim();
    // Phiếu này chỉ ghi lần đo đầu tiên (mốc 0); các lần đo sau (nhập ở Theo dõi ray hàn dài) giữ nguyên.
    const rest = cell.report?.rows.slice(1) ?? [];
    const rows = empty ? rest : [next, ...rest];
    apply({ report: rows.length ? { rows } : null });
  }

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [cell.id]);

  useEffect(() => {
    setFromDraft(cell.from);
    setToDraft(cell.to);
    setAdjustDraft(String(cell.lengthAdjust ?? 0));
    setLeftTempDraft(String(sideTempOf(cell, "left")));
    setRightTempDraft(String(sideTempOf(cell, "right")));
    setFieldError(null);
  }, [cell.id, cell.from, cell.to, cell.temp, cell.leftTemp, cell.rightTemp, cell.lengthAdjust]);

  function apply(patch: RailCellPatch): boolean {
    const ok = onChange(patch);
    if (!ok) {
      setFromDraft(cell.from);
      setToDraft(cell.to);
      setAdjustDraft(String(cell.lengthAdjust ?? 0));
      setLeftTempDraft(String(sideTempOf(cell, "left")));
      setRightTempDraft(String(sideTempOf(cell, "right")));
      return false;
    }
    setFieldError(null);
    return true;
  }

  function commitFrom() {
    if (sameChainage(fromDraft, cell.from)) {
      setFromDraft(cell.from);
      return;
    }
    apply({ from: fromDraft });
  }

  function commitTo() {
    if (sameChainage(toDraft, cell.to)) {
      setToDraft(cell.to);
      return;
    }
    apply({ to: toDraft });
  }

  function commitAdjust() {
    if (lengthLocked) {
      setAdjustDraft(String(cell.lengthAdjust ?? 0));
      setFieldError("Chiều dài đã khóa vì thanh đã giải toả. Bỏ Đạt nếu cần sửa tiếp.");
      return;
    }
    const raw = adjustDraft.trim().replace(",", ".");
    const next = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(next) || Math.abs(next) > 1000) {
      setFieldError("Lượng điều chỉnh phải là số mét trong khoảng ±1000 (nhập âm nếu ngắn hơn lý trình).");
      setAdjustDraft(String(cell.lengthAdjust ?? 0));
      return;
    }
    if (next === (cell.lengthAdjust ?? 0)) {
      setAdjustDraft(String(next));
      return;
    }
    apply({ lengthAdjust: next });
  }

  function parseSideTemp(draft: string, fallback: number) {
    const next = Number(draft.trim().replace(",", "."));
    if (!Number.isFinite(next)) return null;
    return next;
  }

  function commitSideTemps(nextLeft?: number, nextRight?: number) {
    const left = nextLeft ?? parseSideTemp(leftTempDraft, sideTempOf(cell, "left"));
    const right = nextRight ?? parseSideTemp(rightTempDraft, sideTempOf(cell, "right"));
    if (left === null || right === null) {
      setFieldError("Nhiệt độ ray trái/phải phải là số hữu hạn.");
      setLeftTempDraft(String(sideTempOf(cell, "left")));
      setRightTempDraft(String(sideTempOf(cell, "right")));
      return;
    }
    if (left === sideTempOf(cell, "left") && right === sideTempOf(cell, "right")) {
      setLeftTempDraft(String(left));
      setRightTempDraft(String(right));
      return;
    }
    apply({ leftTemp: left, rightTemp: right });
  }

  function commitLeftTemp() {
    const left = parseSideTemp(leftTempDraft, sideTempOf(cell, "left"));
    if (left === null) {
      setFieldError("Nhiệt độ ray trái phải là số hữu hạn.");
      setLeftTempDraft(String(sideTempOf(cell, "left")));
      return;
    }
    commitSideTemps(left, parseSideTemp(rightTempDraft, sideTempOf(cell, "right")) ?? sideTempOf(cell, "right"));
  }

  function commitRightTemp() {
    const right = parseSideTemp(rightTempDraft, sideTempOf(cell, "right"));
    if (right === null) {
      setFieldError("Nhiệt độ ray phải phải là số hữu hạn.");
      setRightTempDraft(String(sideTempOf(cell, "right")));
      return;
    }
    commitSideTemps(parseSideTemp(leftTempDraft, sideTempOf(cell, "left")) ?? sideTempOf(cell, "left"), right);
  }

  const draftLockTemp = (() => {
    const left = parseSideTemp(leftTempDraft, sideTempOf(cell, "left"));
    const right = parseSideTemp(rightTempDraft, sideTempOf(cell, "right"));
    if (left === null || right === null) return lockTemp;
    try {
      return lockTempFromSides(left, right);
    } catch {
      return lockTemp;
    }
  })();

  return (
    <aside aria-labelledby="rail-detail-title" className="flex h-[calc(100dvh-100px)] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-900 xl:sticky xl:top-0">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 py-3">
          <div>
            <h2 id="rail-detail-title" className="text-lg font-bold">Chi tiết đoạn ray {displayRailCode(cell.id)}</h2>
            <p className="text-sm text-slate-500">{detail.title}{longRailCode ? ` · Thanh LWR ${displayRailCode(longRailCode)}` : ""}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onPrev} aria-label="Đoạn trước" className="rounded-lg border p-2"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={onNext} aria-label="Đoạn tiếp" className="rounded-lg border p-2"><ChevronRight className="size-5" /></button>
            {onRemove && cell.placed && !cell.released && (
              <button
                type="button"
                onClick={() => {
                  const ok = onRemove();
                  if (ok === false) setFieldError("Không xóa được thanh ngắn. Đọc thông báo lỗi trên sơ đồ.");
                }}
                aria-label={`Xóa thanh ngắn ${cell.id}`}
                title="Xóa thanh ngắn khỏi sơ đồ"
                className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
              >
                <Trash2 className="size-5" />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Đóng chi tiết" className="rounded-lg border p-2"><X className="size-5" /></button>
          </div>
        </header>
        <div role="tablist" aria-label="Chi tiết đoạn ray" className="grid shrink-0 grid-cols-2 gap-1 border-b bg-white px-3 pt-2">
          {([["giai-toa", "Giải tỏa"], ["bao-cao", "Báo cáo"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-t-lg border-b-2 px-3 py-2 text-sm font-bold ${view === key ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div ref={content} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
          {view === "giai-toa" && (<>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
            <label className="block min-w-0">
              <span className="font-semibold text-amber-900">Nhiệt độ ray trái (°C)</span>
              <span className="flex items-center gap-1">
                <input
                  className={`${inputClass} border-amber-400 bg-white`}
                  inputMode="decimal"
                  value={leftTempDraft}
                  aria-label="Nhiệt độ ray trái"
                  onChange={(event) => setLeftTempDraft(event.target.value)}
                  onBlur={commitLeftTemp}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitLeftTemp(); } }}
                />
                <span className="mt-1 shrink-0 font-semibold text-slate-500">°C</span>
              </span>
            </label>
            <label className="block min-w-0">
              <span className="font-semibold text-amber-900">Nhiệt độ ray phải (°C)</span>
              <span className="flex items-center gap-1">
                <input
                  className={`${inputClass} border-amber-400 bg-white`}
                  inputMode="decimal"
                  value={rightTempDraft}
                  aria-label="Nhiệt độ ray phải"
                  onChange={(event) => setRightTempDraft(event.target.value)}
                  onBlur={commitRightTemp}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitRightTemp(); } }}
                />
                <span className="mt-1 shrink-0 font-semibold text-slate-500">°C</span>
              </span>
            </label>
            <div className="col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-emerald-900">Nhiệt độ khóa đường (tính tự động)</p>
              <p className="mt-1 font-bold text-emerald-800">
                {draftLockTemp} °C
                <span className="ml-2 text-xs font-medium text-emerald-700">= (T trái + T phải) / 2</span>
              </p>
            </div>
            <label className="block min-w-0">
              <span className="text-slate-600">Lý trình đầu</span>
              <span className="flex items-center gap-1">
                <span className="mt-1 shrink-0 font-semibold text-slate-500">Km</span>
                <input
                  className={inputClass}
                  value={fromDraft}
                  aria-label="Lý trình đầu"
                  onChange={(event) => setFromDraft(event.target.value)}
                  onBlur={commitFrom}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitFrom(); } }}
                />
              </span>
            </label>
            <label className="block min-w-0">
              <span className="text-slate-600">Lý trình cuối</span>
              <span className="flex items-center gap-1">
                <span className="mt-1 shrink-0 font-semibold text-slate-500">Km</span>
                <input
                  className={inputClass}
                  value={toDraft}
                  aria-label="Lý trình cuối"
                  onChange={(event) => setToDraft(event.target.value)}
                  onBlur={commitTo}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitTo(); } }}
                />
              </span>
            </label>
            <label className="block min-w-0 col-span-2">
              <span className="text-slate-600">Lượng điều chỉnh {lengthLocked ? "(đã khóa)" : "(+/−, sửa khi cần)"}</span>
              <span className="flex items-center gap-1">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={adjustDraft}
                  aria-label="Lượng điều chỉnh chiều dài"
                  disabled={lengthLocked}
                  readOnly={lengthLocked}
                  onChange={(event) => setAdjustDraft(event.target.value)}
                  onBlur={commitAdjust}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitAdjust(); } }}
                />
                <span className="mt-1 shrink-0 font-semibold text-slate-500">m</span>
              </span>
            </label>
            <div className="col-span-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-sky-900">Chiều dài ray (tự tính)</p>
              <p className="mt-1 font-bold text-sky-800">
                {length.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} m
                <span className="ml-2 text-xs font-medium text-sky-700">
                  = lý trình cuối − lý trình đầu ({span.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} m) {(cell.lengthAdjust ?? 0) >= 0 ? "+" : "−"} điều chỉnh ({Math.abs(cell.lengthAdjust ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 })} m)
                </span>
              </p>
            </div>
          </div>
          <StressReleaseCalculator
            compact
            key={`${cell.id}-${lockTemp}`}
            segmentId={displayRailCode(cell.id)}
            statusSlot={
              <ReleaseStatusButtons passed={Boolean(cell.released)} onChange={(passed) => {
                // Bấm Đạt: lưu luôn thông số bảng tính (giờ, nhiệt độ…) trước khi chốt trạng thái.
                if (passed && calculatorInput?.cellId === cell.id && onSaveParams) onSaveParams(calculatorInput.input);
                apply({ released: passed });
              }} />
            }
            initialInput={{
              ...DEFAULT_STRESS_INPUT,
              ...savedParams,
              ...(calculatorInput?.cellId === cell.id ? calculatorInput.input : {}),
              trackSide,
              leftLength: length,
              rightLength: 0,
              startChainage: cell.from,
              endChainage: cell.to,
              lengthAdjust: cell.lengthAdjust ?? 0,
              leftTemp: sideTempOf(cell, "left"),
              rightTemp: sideTempOf(cell, "right"),
            }}
            onSave={onSaveParams}
            onInputChange={(input) => {
              setCalculatorInput(previous => previous?.cellId === cell.id && JSON.stringify(previous.input) === JSON.stringify(input)
                ? previous : { cellId: cell.id, input });
            }}
            onChainageCommit={(patch) => apply(patch)}
          />
          </>)}
          {view === "bao-cao" && (() => {
            // Nhiệt độ khóa = (T ray trái + T ray phải) / 2 lấy từ tab Giải tỏa; nhiệt độ đo nhập tại thời điểm đo M / E.
            const lock = draftLockTemp;
            const measuredNumber = Number(report.temp.trim().replace(",", "."));
            const diff = report.temp.trim() && Number.isFinite(measuredNumber) ? Math.round((measuredNumber - lock) * 1000) / 1000 : "—";
            const params = calculatorInput?.cellId === cell.id ? calculatorInput.input : savedParams;
            const eDesign = params && typeof diff === "number" ? reportEndMovement(params, measuredNumber - lock) : null;
            const inputCls = "mt-1 w-full min-w-0 rounded-md border border-amber-400 bg-white px-2 py-2 text-sm font-semibold focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
            const autoBox = (label: string, value: string | number, unit: string) => (
              <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-0.5 font-bold text-slate-800">{value} <span className="text-xs font-medium text-slate-500">{unit}</span></p>
              </div>
            );
            return (
              <section className="space-y-3 rounded-lg border border-slate-300 bg-white p-3 text-sm">
                <div>
                  <h3 className="font-bold text-slate-900">Báo cáo chuyển vị điểm M / điểm E</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Đoạn ray {cell.id}. Thông số tính toán lấy từ tab Giải tỏa; nhập thông tin quan trắc và chuyển vị thực tế.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="font-semibold text-slate-700">Ngày giờ đo</span>
                    <input type="datetime-local" aria-label="Ngày giờ đo" className={inputCls} value={report.measuredAt ?? ""} onChange={(e) => setReport((r) => ({ ...r, measuredAt: e.target.value }))} onBlur={() => commitReport(report)} />
                  </label>
                  <label className="block min-w-0">
                    <span className="font-semibold text-slate-700">Nhiệt độ không khí (°C)</span>
                    <input aria-label="Nhiệt độ không khí (°C)" inputMode="decimal" className={inputCls} value={report.airTemp ?? ""} onChange={(e) => setReport((r) => ({ ...r, airTemp: e.target.value }))} onBlur={() => commitReport(report)} placeholder="Nhập nhiệt độ không khí" />
                  </label>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhiệt độ</p>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {autoBox("Nhiệt độ khóa", lock, "°C")}
                    <label className="block min-w-0 rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2">
                      <span className="text-xs font-semibold text-amber-900">Nhiệt độ đo (°C)</span>
                      <input aria-label="Nhiệt độ đo (°C)" inputMode="decimal" className="mt-0.5 w-full min-w-0 bg-transparent font-bold text-slate-800 focus:outline-none" value={report.temp} onChange={(e) => setReport((r) => ({ ...r, temp: e.target.value }))} onBlur={() => commitReport(report)} placeholder="Nhập" />
                    </label>
                    {autoBox("Chênh nhiệt độ", diff, "°C")}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Khóa = (T ray trái + T ray phải) / 2 từ tab Giải tỏa; đo = nhiệt độ ray lúc đo điểm M / E (bạn nhập); chênh = đo − khóa.</p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="font-bold text-amber-900">Điểm M</p>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="text-slate-600">Thiết kế (mm)</span>
                      <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700">{REPORT_DESIGN_MM}</div>
                    </div>
                    <label className="block min-w-0">
                      <span className="font-semibold text-amber-900">Thực tế (mm)</span>
                      <input aria-label="Điểm M thực tế (mm)" inputMode="decimal" className={inputCls} value={report.mActual} onChange={(e) => setReport((r) => ({ ...r, mActual: e.target.value }))} onBlur={() => commitReport(report)} placeholder="Nhập số" />
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="font-bold text-amber-900">Điểm E</p>
                  <p className="mt-1 text-xs text-slate-600">Δ = (Pmax − Pj)² / (2EFr); Pmax = EFα × |T đo − T khóa|; Pj = 0. Thông số lấy từ Giải tỏa. Dấu âm thể hiện giảm nhiệt.</p>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="text-slate-600">Thiết kế (mm)</span>
                      <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700">{eDesign === null ? "Chờ thông số / nhiệt độ đo" : eDesign}</div>
                    </div>
                    <label className="block min-w-0">
                      <span className="font-semibold text-amber-900">Thực tế (mm)</span>
                      <input aria-label="Điểm E thực tế (mm)" inputMode="decimal" className={inputCls} value={report.eActual} onChange={(e) => setReport((r) => ({ ...r, eActual: e.target.value }))} onBlur={() => commitReport(report)} placeholder="Nhập số" />
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="font-semibold text-slate-700">Ghi chú</span>
                  <textarea aria-label="Ghi chú" rows={3} className="mt-1 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" value={report.note} onChange={(e) => setReport((r) => ({ ...r, note: e.target.value }))} onBlur={() => commitReport(report)} />
                </label>
              </section>
            );
          })()}
          {fieldError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{fieldError}</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
