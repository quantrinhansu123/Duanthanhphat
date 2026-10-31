"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WeldQualitySelection } from "@/lib/weldQuality";
import { markQualityPass, type WeldQualityBulkEntry } from "@/lib/weldQualityClient";

type BulkResult = "Đạt" | "Không đạt";

type RowDecision = {
  id: string;
  phien_ban: number;
  ma_lich_su: string;
  ket_qua: BulkResult;
  ly_do: string;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WeldQualityBulkDialog({
  entries,
  onClose,
  onDone,
}: {
  entries: WeldQualitySelection[];
  onClose: () => void;
  onDone: (savedIds: string[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const stop = useRef(false);
  const [kind, setKind] = useState<"visual" | "ndt">("ndt");
  const [date, setDate] = useState(todayIso);
  const [method, setMethod] = useState("Siêu âm");
  const [rows, setRows] = useState<RowDecision[]>(() =>
    entries.map((e) => ({
      id: e.id,
      phien_ban: e.phien_ban,
      ma_lich_su: e.ma_lich_su,
      ket_qua: "Đạt",
      ly_do: "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const summary = useMemo(() => {
    let pass = 0;
    let fail = 0;
    for (const row of rows) {
      if (row.ket_qua === "Đạt") pass += 1;
      else fail += 1;
    }
    return { pass, fail, total: rows.length };
  }, [rows]);

  const missingFailReason = rows.some((row) => row.ket_qua === "Không đạt" && !row.ly_do.trim());

  function patchRow(id: string, patch: Partial<Pick<RowDecision, "ket_qua" | "ly_do">>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function markAllPass() {
    setRows((current) => current.map((row) => ({ ...row, ket_qua: "Đạt", ly_do: "" })));
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="bulk-quality-title"
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      className="m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
    >
      <h2 id="bulk-quality-title" className="text-lg font-bold">
        Thao tác hàng loạt · {entries.length.toLocaleString("vi-VN")} mối đã chọn
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Mặc định <b>Siêu âm đạt</b>. Chỉ chỉnh tay mối <b>Không đạt</b>. Sai số / số đo hình học nhập riêng từng mối hoặc qua Excel — không tự điền ở đây.
      </p>

      <form
        className="mt-4 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (missingFailReason) return;
          stop.current = false;
          setBusy(true);
          setErrors([]);
          setProcessed(0);
          const saved: string[] = [];
          const failures: string[] = [];
          try {
            for (let offset = 0; offset < rows.length && !stop.current; offset += 100) {
              const batch = rows.slice(offset, offset + 100);
              const payload: WeldQualityBulkEntry[] = batch.map((row) => ({
                id: row.id,
                phien_ban: row.phien_ban,
                ma_lich_su: row.ma_lich_su,
                ket_qua: row.ket_qua,
                ghi_chu: row.ket_qua === "Không đạt" ? row.ly_do.trim() || null : undefined,
              }));
              const { results } = await markQualityPass(payload, kind, date, method);
              for (const result of results) {
                if (result.error) {
                  failures.push(
                    `${batch.find((r) => r.id === result.id)?.ma_lich_su ?? result.id}: ${result.error}`,
                  );
                } else {
                  saved.push(result.id);
                }
              }
              setProcessed(offset + batch.length);
            }
          } catch (err) {
            failures.push(
              err instanceof Error
                ? err.message
                : "Mất kết nối. Hãy tải lại danh sách trước khi thử tiếp.",
            );
          } finally {
            setSuccessCount(saved.length);
            setErrors(failures);
            setBusy(false);
            onDone(saved);
          }
        }}
      >
        <fieldset disabled={busy || successCount !== null} className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold sm:col-span-1">
            Tiêu chí
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="ndt">Siêu âm / NDT</option>
              <option value="visual">Trực quan sau mài</option>
            </select>
          </label>
          <label className="block text-sm font-semibold sm:col-span-1">
            {kind === "visual" ? "Ngày mài / trực quan" : "Ngày thí nghiệm"}
            <input
              type="date"
              required
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {kind === "ndt" ? (
            <label className="block text-sm font-semibold sm:col-span-1">
              Phương pháp NDT
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="Siêu âm">Siêu âm</option>
                <option value="Từ tính">Từ tính</option>
                <option value="Thẩm thấu">Thẩm thấu</option>
              </select>
            </label>
          ) : (
            <div className="hidden sm:block" />
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-800">
            Tổng {summary.total} · Đạt {summary.pass} · Không đạt {summary.fail}
          </span>
          <button
            type="button"
            disabled={busy || successCount !== null}
            onClick={markAllPass}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Đặt lại tất cả Đạt
          </button>
        </div>

        <div className="max-h-[42vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2.5 font-semibold">Mã mối</th>
                <th className="p-2.5 font-semibold">Kết quả</th>
                <th className="p-2.5 font-semibold">Lý do nếu không đạt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-2.5 font-mono text-[#0047AB]">{row.ma_lich_su}</td>
                  <td className="p-2.5">
                    <select
                      disabled={busy || successCount !== null}
                      className="min-h-10 w-full min-w-[8.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 disabled:opacity-50"
                      value={row.ket_qua}
                      onChange={(e) =>
                        patchRow(row.id, {
                          ket_qua: e.target.value as BulkResult,
                          ...(e.target.value === "Đạt" ? { ly_do: "" } : {}),
                        })
                      }
                    >
                      <option value="Đạt">Đạt</option>
                      <option value="Không đạt">Không đạt</option>
                    </select>
                  </td>
                  <td className="p-2.5">
                    <input
                      disabled={busy || successCount !== null || row.ket_qua === "Đạt"}
                      className="min-h-10 w-full rounded-lg border border-slate-300 px-2 py-1.5 disabled:bg-slate-50 disabled:opacity-60"
                      placeholder={row.ket_qua === "Đạt" ? "—" : "Nhập lý do"}
                      value={row.ly_do}
                      onChange={(e) => patchRow(row.id, { ly_do: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {missingFailReason && successCount === null && (
          <p className="text-xs text-amber-700">Nhập lý do cho mọi mối đánh dấu Không đạt.</p>
        )}

        <div role="status" className="text-sm text-slate-700">
          {busy
            ? `Đang xử lý ${processed}/${rows.length} mối…`
            : successCount !== null
              ? `Đã lưu ${successCount} mối. ${rows.length - processed} mối chưa xử lý. Các mối lỗi vẫn giữ trong tập chọn.`
              : kind === "ndt"
                ? "Sẽ ghi ngày + phương pháp NDT theo từng dòng; sai số không đổi."
                : "Sẽ ghi ngày mài + trực quan theo từng dòng; sai số không đổi."}
        </div>

        {errors.length > 0 && (
          <div role="alert" className="max-h-52 overflow-y-auto rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            <ul className="space-y-2">
              {errors.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {successCount === null && (
            <button
              disabled={busy || missingFailReason}
              className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy
                ? "Đang lưu…"
                : `Lưu ${summary.pass} đạt${summary.fail ? ` · ${summary.fail} không đạt` : ""}`}
            </button>
          )}
          {busy ? (
            <button
              type="button"
              onClick={() => {
                stop.current = true;
              }}
              className="min-h-11 rounded-lg border px-4 text-sm"
            >
              Dừng sau lượt hiện tại
            </button>
          ) : (
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-4 text-sm">
              Đóng
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
