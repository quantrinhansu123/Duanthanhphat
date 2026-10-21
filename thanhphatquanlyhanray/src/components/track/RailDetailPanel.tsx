"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { detailForCell } from "@/lib/track-data";
import { DEFAULT_STRESS_INPUT } from "@/lib/stress-release";
import {
  parseChainage,
  railCellLengthMetres,
  type RailCellPatch,
} from "@/lib/track-editor";
import type { RailCell } from "@/types/track";
import { StressReleaseCalculator } from "./StressReleaseCalculator";

const inputClass =
  "mt-1 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

function sameChainage(draft: string, stored: string) {
  const parsed = parseChainage(draft);
  const current = parseChainage(stored);
  return parsed !== null && parsed === current;
}

export function RailDetailPanel({
  cell,
  onClose,
  onPrev,
  onNext,
  onChange,
}: {
  cell: RailCell;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChange: (patch: RailCellPatch) => boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const length = railCellLengthMetres(cell) ?? 0;
  const detail = detailForCell(cell);
  const [fromDraft, setFromDraft] = useState(cell.from);
  const [toDraft, setToDraft] = useState(cell.to);
  const [lengthDraft, setLengthDraft] = useState(String(length));
  const [tempDraft, setTempDraft] = useState(String(cell.temp));
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [cell.id]);

  useEffect(() => {
    setFromDraft(cell.from);
    setToDraft(cell.to);
    setLengthDraft(String(railCellLengthMetres(cell) ?? 0));
    setTempDraft(String(cell.temp));
    setFieldError(null);
  }, [cell.id, cell.from, cell.to, cell.temp]);

  function apply(patch: RailCellPatch) {
    const ok = onChange(patch);
    if (!ok) {
      setFromDraft(cell.from);
      setToDraft(cell.to);
      setLengthDraft(String(railCellLengthMetres(cell) ?? 0));
      setTempDraft(String(cell.temp));
      return;
    }
    setFieldError(null);
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

  function commitLength() {
    const next = Number(lengthDraft.trim().replace(",", "."));
    if (Number.isSafeInteger(next) && next === length) {
      setLengthDraft(String(length));
      return;
    }
    if (!Number.isSafeInteger(next) || next < 1) {
      setFieldError("Chiều dài đoạn phải là số mét nguyên dương.");
      setLengthDraft(String(length));
      return;
    }
    apply({ lengthMetres: next });
  }

  function commitTemp() {
    const next = Number(tempDraft.trim().replace(",", "."));
    if (Number.isFinite(next) && next === cell.temp) {
      setTempDraft(String(cell.temp));
      return;
    }
    if (!Number.isFinite(next)) {
      setFieldError("Nhiệt độ khóa phải là số hữu hạn.");
      setTempDraft(String(cell.temp));
      return;
    }
    apply({ temp: next });
  }

  return (
    <aside aria-labelledby="rail-detail-title" className="flex h-[calc(100dvh-100px)] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-900 xl:sticky xl:top-0">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 py-3">
          <div><h2 id="rail-detail-title" className="text-lg font-bold">Chi tiết đoạn ray {cell.id}</h2><p className="text-sm text-slate-500">{detail.title}</p></div>
          <div className="flex gap-2">
            <button type="button" onClick={onPrev} aria-label="Đoạn trước" className="rounded-lg border p-2"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={onNext} aria-label="Đoạn tiếp" className="rounded-lg border p-2"><ChevronRight className="size-5" /></button>
            <button type="button" onClick={onClose} aria-label="Đóng chi tiết" className="rounded-lg border p-2"><X className="size-5" /></button>
          </div>
        </header>
        <div ref={content} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-3 text-sm">
            <label className="block min-w-0">
              <span className="text-slate-500">Lý trình đầu</span>
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
              <span className="text-slate-500">Lý trình cuối</span>
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
            <label className="block min-w-0">
              <span className="text-slate-500">Chiều dài đoạn</span>
              <span className="flex items-center gap-1">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={lengthDraft}
                  aria-label="Chiều dài đoạn"
                  onChange={(event) => setLengthDraft(event.target.value)}
                  onBlur={commitLength}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitLength(); } }}
                />
                <span className="mt-1 shrink-0 font-semibold text-slate-500">m</span>
              </span>
            </label>
            <label className="block min-w-0">
              <span className="text-slate-500">Nhiệt độ khóa trên sơ đồ</span>
              <span className="flex items-center gap-1">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={tempDraft}
                  aria-label="Nhiệt độ khóa trên sơ đồ"
                  onChange={(event) => setTempDraft(event.target.value)}
                  onBlur={commitTemp}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitTemp(); } }}
                />
                <span className="mt-1 shrink-0 font-semibold text-slate-500">°C</span>
              </span>
            </label>
          </div>
          {fieldError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{fieldError}</p>
          ) : (
            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              Sửa lý trình, chiều dài hoặc nhiệt độ khóa trên ô này — sơ đồ và bảng tính sẽ cập nhật. Thanh phía sau giữ nguyên chiều dài và dồn theo lý trình mới. Thông số khác dùng mẫu 60R2 (hai neo 20°C).
            </p>
          )}
          <StressReleaseCalculator compact key={cell.id} segmentId={cell.id} initialInput={{ ...DEFAULT_STRESS_INPUT, leftLength: length, rightLength: 0, neutralTemp: cell.temp }} />
        </div>
      </div>
    </aside>
  );
}
