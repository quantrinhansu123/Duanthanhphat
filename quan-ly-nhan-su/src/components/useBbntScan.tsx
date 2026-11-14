"use client";

import { useRef } from "react";
import { bbntScanInfo, removeBbntScan, uploadBbntScan } from "@/lib/weldQualityClient";

export type BbntScanTarget = { id: string; kind: "rfi" | "tach"; so_phieu: string; thong_tin?: Record<string, unknown> | null };

/**
 * Lưu trữ biên bản nghiệm thu đã ký (bản scan PDF) vào kho tài liệu, gắn với phiếu.
 * `pick(target)` mở hộp chọn file; sau khi tải xong gọi `onDone(message)`; lỗi gọi `onError`.
 * `node` là ô chọn file ẩn — render một lần trong component dùng hook.
 */
export function useBbntScan({ onDone, onError }: { onDone: (message: string) => void | Promise<void>; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<BbntScanTarget | null>(null);

  const pick = (t: BbntScanTarget) => { target.current = t; input.current?.click(); };

  async function onFile(file: File | undefined) {
    const t = target.current;
    if (input.current) input.current.value = "";
    if (!file || !t) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { onError("Chỉ tải lên được file PDF (scan biên bản đã ký)."); return; }
    try {
      const result = await uploadBbntScan(file, t);
      await onDone(`Đã lưu biên bản đã ký của phiếu ${t.so_phieu}${result.appsheet ? " và đẩy sang AppSheet (bảng Lưu trữ)" : ""}.${result.warning ? ` Cảnh báo AppSheet: ${result.warning}` : ""}`);
    } catch (e) { onError(e instanceof Error ? e.message : "Không tải được biên bản lên."); }
  }

  async function remove(t: BbntScanTarget) {
    if (!window.confirm(`Gỡ biên bản đã ký của phiếu ${t.so_phieu}? File vẫn còn trong kho Tài liệu.`)) return;
    try { await removeBbntScan(t); await onDone(`Đã gỡ biên bản đã ký của phiếu ${t.so_phieu}.`); }
    catch (e) { onError(e instanceof Error ? e.message : "Không gỡ được biên bản."); }
  }

  /** Các mục menu thao tác cho một phiếu: tải lên / thay, xem, gỡ. */
  function actions(t: BbntScanTarget, disabled = false) {
    const scan = bbntScanInfo(t.thong_tin);
    return [
      { label: scan ? "Thay BBNT đã ký (PDF)" : "Tải lên BBNT đã ký (PDF)", disabled, onSelect: () => pick(t) },
      ...(scan ? [
        { label: "Xem BBNT đã ký", disabled, onSelect: () => { window.open(scan.url, "_blank", "noopener"); } },
        ...(scan.appsheet_url ? [{ label: "Mở bản trên AppSheet", disabled, onSelect: () => { window.open(scan.appsheet_url, "_blank", "noopener"); } }] : []),
        { label: "Gỡ BBNT đã ký", danger: true, disabled, onSelect: () => void remove(t) },
      ] : []),
    ];
  }

  const node = <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />;
  return { pick, actions, node };
}
