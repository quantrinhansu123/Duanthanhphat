"use client";

import { useRef } from "react";
import { bbntScans, removeBbntScan, uploadBbntScan } from "@/lib/weldQualityClient";

export type BbntScanTarget = { id: string; kind: "rfi" | "tach"; so_phieu: string; thong_tin?: Record<string, unknown> | null };

/**
 * Lưu trữ biên bản nghiệm thu đã ký (bản scan PDF, được chọn NHIỀU file một lần) gắn với phiếu.
 * `pick(target)` mở hộp chọn file; sau khi tải xong gọi `onDone(message)`; lỗi gọi `onError`.
 * `node` là ô chọn file ẩn — render một lần trong component dùng hook.
 */
export function useBbntScan({ onDone, onError }: { onDone: (message: string) => void | Promise<void>; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<BbntScanTarget | null>(null);

  const pick = (t: BbntScanTarget) => { target.current = t; input.current?.click(); };

  async function onFiles(list: FileList | null) {
    const t = target.current;
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!files.length || !t) return;
    const notPdf = files.filter((file) => !/\.pdf$/i.test(file.name) && file.type !== "application/pdf");
    if (notPdf.length) { onError(`Chỉ tải lên được file PDF (scan biên bản đã ký). File không hợp lệ: ${notPdf.map((f) => f.name).join(", ")}`); return; }
    let done = 0;
    let warning = "";
    try {
      // Tải lần lượt từng file để mỗi file được ghi vào phiếu đúng thứ tự.
      for (const file of files) {
        const result = await uploadBbntScan(file, t);
        done += 1;
        if (result.warning) warning = result.warning;
      }
      await onDone(`Đã lưu ${done} file biên bản đã ký của phiếu ${t.so_phieu}.${warning ? ` Cảnh báo AppSheet: ${warning}` : ""}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không tải được biên bản lên.";
      onError(done ? `Đã lưu ${done}/${files.length} file, dừng ở file ${done + 1}: ${message}` : message);
      if (done) await onDone("");
    }
  }

  async function remove(t: BbntScanTarget, key: string | undefined, label: string) {
    if (!window.confirm(`Gỡ ${label} của phiếu ${t.so_phieu}? File vẫn còn trong kho lưu trữ.`)) return;
    try { await removeBbntScan(t, key); await onDone(`Đã gỡ ${label} của phiếu ${t.so_phieu}.`); }
    catch (e) { onError(e instanceof Error ? e.message : "Không gỡ được biên bản."); }
  }

  /** Các mục menu thao tác: tải lên thêm file, xem / gỡ từng file đã lưu. */
  function actions(t: BbntScanTarget, disabled = false) {
    const scans = bbntScans(t.thong_tin);
    const many = scans.length > 1;
    return [
      { label: scans.length ? "Tải thêm BBNT đã ký (PDF, chọn nhiều file)" : "Tải lên BBNT đã ký (PDF, chọn nhiều file)", disabled, onSelect: () => pick(t) },
      ...scans.map((scan, i) => ({ label: many ? `Xem file ${i + 1}: ${scan.ten ?? "BBNT"}` : "Xem BBNT đã ký", disabled, onSelect: () => { window.open(scan.url, "_blank", "noopener"); } })),
      ...scans.flatMap((scan, i) => scan.appsheet_url ? [{ label: many ? `Mở file ${i + 1} trên AppSheet` : "Mở bản trên AppSheet", disabled, onSelect: () => { window.open(scan.appsheet_url, "_blank", "noopener"); } }] : []),
      ...scans.map((scan, i) => ({ label: many ? `Gỡ file ${i + 1}: ${scan.ten ?? "BBNT"}` : "Gỡ BBNT đã ký", danger: true, disabled, onSelect: () => void remove(t, String(scan.doc_id || scan.url), many ? `file ${i + 1}` : "biên bản đã ký") })),
    ];
  }

  const node = <input ref={input} type="file" multiple accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onFiles(e.target.files)} />;
  return { pick, actions, node };
}
