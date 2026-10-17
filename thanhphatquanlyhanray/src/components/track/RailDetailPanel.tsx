"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { detailForCell } from "@/lib/track-data";
import { DEFAULT_STRESS_INPUT } from "@/lib/stress-release";
import type { RailCell } from "@/types/track";
import { StressReleaseCalculator } from "./StressReleaseCalculator";

function chainageMetres(value: string) {
  const [km, metres] = value.split("+").map(Number);
  return km * 1000 + metres;
}

export function RailDetailPanel({ cell, onClose, onPrev, onNext }: {
  cell: RailCell;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const length = chainageMetres(cell.to) - chainageMetres(cell.from);
  const detail = detailForCell(cell);

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [cell.id]);

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
          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-3 text-sm">
            <div><dt className="text-slate-500">Lý trình đầu</dt><dd className="font-semibold">Km {cell.from}</dd></div>
            <div><dt className="text-slate-500">Lý trình cuối</dt><dd className="font-semibold">Km {cell.to}</dd></div>
            <div><dt className="text-slate-500">Chiều dài đoạn</dt><dd className="font-semibold">{length} m</dd></div>
            <div><dt className="text-slate-500">Nhiệt độ khóa trên sơ đồ</dt><dd className="font-semibold">{cell.temp} °C</dd></div>
          </dl>
          <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">Chiều dài và nhiệt độ khóa lấy từ đoạn {cell.id}. Thông số khác dùng mẫu 60R2 (hai neo 20°C); mở Thông số đầu vào để nhập số đo thực tế. Thay đổi sẽ đặt lại khi chuyển đoạn hoặc đóng bảng.</p>
          <StressReleaseCalculator compact key={cell.id} segmentId={cell.id} initialInput={{ ...DEFAULT_STRESS_INPUT, leftLength: length, rightLength: 0, neutralTemp: cell.temp }} />
        </div>
      </div>
    </aside>
  );
}
