"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { acceptanceLog, type AcceptanceEntry, type AcceptanceResult } from "@/data/acceptanceLog";

const filterClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm";

const RESULT_LABEL: Record<AcceptanceResult, string> = {
  pass: "Đạt",
  fail: "Chưa đạt",
  pending: "Chờ nghiệm thu",
};

const RESULT_CLASS: Record<AcceptanceResult, string> = {
  pass: "bg-emerald-100 text-emerald-800",
  fail: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function ImageDialog({ entry, onClose }: { entry: AcceptanceEntry; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const images = entry.images;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh trước và sau: ${entry.item}`}
      onClick={onClose}
    >
      <div className="w-full max-w-5xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{entry.item}</h2>
            <p className="text-xs text-slate-500">{formatDate(entry.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
        {images ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <figure>
              <figcaption className="mb-1 text-xs font-bold uppercase tracking-wide text-red-700">
                Trước khi sửa
              </figcaption>
              {images.before ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={images.before} alt="Ảnh trước khi sửa" className="w-full border border-slate-300" />
              ) : (
                <div className="flex min-h-48 items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs italic text-slate-600">
                  {images.beforeNote ?? "Không có ảnh trước thật (chưa có baseline UI trước khi sửa, không dựng giả)."}
                </div>
              )}
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                Sau khi sửa (khoanh đỏ phần đã thay đổi)
              </figcaption>
              <div className="relative border border-slate-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images.after} alt="Ảnh sau khi sửa" className="block w-full" />
                {images.marks.map((m, i) => (
                  <span
                    key={m.label}
                    title={m.label}
                    className="pointer-events-none absolute rounded-md border-[3px] border-red-600"
                    style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
                  >
                    <span className="absolute -left-1 -top-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                ))}
              </div>
              <ol className="mt-2 list-inside list-decimal text-xs text-red-700">
                {images.marks.map((m) => (
                  <li key={m.label}>{m.label}</li>
                ))}
              </ol>
            </figure>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">Bản ghi này chưa có ảnh trước/sau.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function AcceptanceLog() {
  const router = useRouter();
  const [viewing, setViewing] = useState<AcceptanceEntry | null>(null);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [result, setResult] = useState<"" | AcceptanceResult>("");

  const dates = useMemo(
    () => Array.from(new Set(acceptanceLog.map((e) => e.date))).sort().reverse(),
    [],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return acceptanceLog
      .filter((e) => (!date || e.date === date) && (!result || e.result === result))
      .filter(
        (e) =>
          !q ||
          [e.item, e.requirement, e.solution, e.before, e.after]
            .join(" ")
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [query, date, result]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm hạng mục, yêu cầu..."
          className={filterClass}
        />
        <select value={date} onChange={(e) => setDate(e.target.value)} className={filterClass}>
          <option value="">Tất cả ngày</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value as "" | AcceptanceResult)}
          className={filterClass}
        >
          <option value="">Tất cả kết quả</option>
          {(Object.keys(RESULT_LABEL) as AcceptanceResult[]).map((r) => (
            <option key={r} value={r}>
              {RESULT_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[#0047AB] bg-slate-50 text-left text-xs uppercase tracking-wide text-[#0047AB]">
              {["Ngày", "Hạng mục", "Yêu cầu", "Phương án xử lý", "Trước khi sửa", "Sau khi sửa", "Kết quả", "Ảnh"].map((h) => (
                <th key={h} className="px-3 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <Fragment key={e.id}>
                <tr
                  onClick={() => router.push(e.href)}
                  className="cursor-pointer border-b border-slate-200 align-top transition-colors hover:bg-sky-50"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(e.date)}</td>
                  <td className="px-3 py-2.5 font-semibold">
                    <Link href={e.href} className="text-[#0047AB] hover:underline" onClick={(ev) => ev.stopPropagation()}>
                      {e.item}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{e.requirement}</td>
                  <td className="px-3 py-2.5">{e.solution}</td>
                  <td className="px-3 py-2.5 text-red-700">{e.before}</td>
                  <td className="px-3 py-2.5 text-emerald-700">{e.after}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${RESULT_CLASS[e.result]}`}>
                      {RESULT_LABEL[e.result]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setViewing(e);
                      }}
                      className="h-8 border border-[#0047AB] px-3 text-xs font-bold uppercase tracking-wide text-[#0047AB] hover:bg-[#0047AB] hover:text-white"
                    >
                      Xem
                    </button>
                  </td>
                </tr>
                {e.requirementRows && e.requirementRows.length > 0 && (
                  <tr className="border-b-2 border-slate-300 bg-slate-50/70">
                    <td colSpan={8} className="p-3 sm:p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[#0047AB]">
                          Bảng đối chiếu nghiệm thu chi tiết theo từng ID yêu cầu ({e.requirementRows.length} ID)
                        </h3>
                        <span className="text-xs text-slate-500">
                          Nguồn yêu cầu: <code>docs/yeu-cau-bao-cao-thi-cong-theo-anh.md</code> · Kế hoạch: <code>docs/ke-hoach-bao-cao-thi-cong-theo-anh.md</code>
                        </span>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 bg-white">
                        <table className="w-full min-w-[980px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100 text-left font-semibold uppercase tracking-wide text-slate-700">
                              <th className="w-16 px-2.5 py-2">ID</th>
                              <th className="w-64 px-2.5 py-2">Yêu cầu / Tiêu chí</th>
                              <th className="w-28 px-2.5 py-2">Kết quả</th>
                              <th className="w-44 px-2.5 py-2">Ảnh trước</th>
                              <th className="w-44 px-2.5 py-2">Ảnh sau</th>
                              <th className="w-56 px-2.5 py-2">Đường dẫn code</th>
                              <th className="px-2.5 py-2">Ghi chú &amp; Tồn đọng</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {e.requirementRows.map((r) => (
                              <tr key={r.id} className="align-top hover:bg-slate-50">
                                <td className="whitespace-nowrap px-2.5 py-2 font-mono font-bold text-[#0047AB]">
                                  {r.id}
                                </td>
                                <td className="px-2.5 py-2 text-slate-800">{r.requirement}</td>
                                <td className="px-2.5 py-2">
                                  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_CLASS[r.status]}`}>
                                    {RESULT_LABEL[r.status]}
                                  </span>
                                  {r.statusDetail && (
                                    <div className="mt-1 text-[11px] font-medium text-slate-600">
                                      {r.statusDetail}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2.5 py-2">
                                  {r.beforeImage ? (
                                    <a
                                      href={r.beforeImage}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-[11px] font-semibold text-red-700 hover:underline"
                                    >
                                      {r.beforeImage.split("/").pop()} ↗
                                    </a>
                                  ) : (
                                    <span className="text-[11px] italic text-slate-500">
                                      {r.beforeImageNote ?? "Không có ảnh trước thật"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2.5 py-2">
                                  <a
                                    href={r.afterImage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-[11px] font-semibold text-emerald-700 hover:underline"
                                  >
                                    {r.afterImageLabel ?? r.afterImage.split("/").pop()} ↗
                                  </a>
                                </td>
                                <td className="px-2.5 py-2 font-mono text-[11px] text-slate-700">
                                  {r.codePath}
                                </td>
                                <td className="px-2.5 py-2 text-slate-700">{r.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Không có bản ghi phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {viewing && <ImageDialog entry={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
