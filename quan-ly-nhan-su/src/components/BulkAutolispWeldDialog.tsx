"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MachineOption } from "@/data/machineAssignments";
import { WELD_TYPE_OPTIONS } from "@/data/weldTypes";
import {
  AUTOLISP_BULK_MAX,
  COORDINATE_RAIL_PREFIXES,
  autolispPrefixLabel,
  buildAutolispBulkPreview,
  commitAutolispBulkWelds,
  filterAutolispPointsForBulk,
  parseAutolispChainageMetres,
  resequenceAutolispBulkPreview,
  validateAutolispBulkContext,
  type AutolispBulkContext,
  type AutolispBulkPreviewRow,
} from "@/lib/bulkCreateWeldsFromAutolisp";
import { fetchUnlinkedGpsPoints, fetchMapPointsFromDb } from "@/lib/mapPointsDb";
import {
  loadMachineFieldCodesForSuggestion,
  loadWeldCodesWithPrefix,
  type CertifiedWelderOption,
  type WeldReportRow,
} from "@/lib/weldReportData";
import {
  buildWeldCodePrefix,
  machineWeldCodeHint,
  normalizeWeldSitePrefix,
  type CoordinateRailPrefix,
} from "@/lib/weldCode";

type ProjectOption = { id: string; label: string; ma_du_an: string };

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function BulkAutolispWeldDialog({
  open,
  onClose,
  projects,
  welders,
  machines,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  welders: CertifiedWelderOption[];
  machines: MachineOption[];
  onDone: (message: string) => void;
}) {
  const [duAnId, setDuAnId] = useState(projects[0]?.id ?? "");
  const [performedAt, setPerformedAt] = useState(todayIso());
  const [thoHanId, setThoHanId] = useState(welders[0]?.id ?? "");
  const [mayId, setMayId] = useState(machines[0]?.id ?? "");
  const [chungChi, setChungChi] = useState(welders[0]?.certificates[0] ?? "");
  const [loaiRay, setLoaiRay] = useState("P50");
  const [congNghe, setCongNghe] = useState<WeldReportRow["cong_nghe_han"]>("FBW");
  const [loaiMoiHan, setLoaiMoiHan] = useState<WeldReportRow["loai_moi_han"]>("Sản xuất");
  const [prefixes, setPrefixes] = useState<CoordinateRailPrefix[]>([...COORDINATE_RAIL_PREFIXES]);
  const [kmFrom, setKmFrom] = useState("");
  const [kmTo, setKmTo] = useState("");
  /** Mặc định gồm điểm đã gắn để ghi đè nhật ký cũ. */
  const [includeLinked, setIncludeLinked] = useState(true);

  const [loadingPoints, setLoadingPoints] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AutolispBulkPreviewRow[]>([]);
  const [existingSystem, setExistingSystem] = useState<string[]>([]);
  const [existingMachine, setExistingMachine] = useState<string[]>([]);
  const [pointCount, setPointCount] = useState(0);

  const project = projects.find((item) => item.id === duAnId);
  const welder = welders.find((item) => item.id === thoHanId);
  const machine = machines.find((item) => item.id === mayId);
  const sitePrefix = normalizeWeldSitePrefix(project?.ma_du_an);

  useEffect(() => {
    if (!open) return;
    setDuAnId((prev) => prev || projects[0]?.id || "");
    setThoHanId((prev) => prev || welders[0]?.id || "");
    setMayId((prev) => prev || machines[0]?.id || "");
  }, [open, projects, welders, machines]);

  useEffect(() => {
    if (!welder) return;
    if (!welder.certificates.includes(chungChi)) {
      setChungChi(welder.certificates[0] ?? "");
    }
  }, [welder, chungChi]);

  const context: AutolispBulkContext = useMemo(
    () => ({
      performedAt,
      du_an_id: duAnId,
      sitePrefix,
      tho_han_id: thoHanId,
      may_id: mayId,
      machine,
      loai_ray: loaiRay,
      cong_nghe_han: congNghe,
      loai_moi_han: loaiMoiHan,
      chung_chi_su_dung: chungChi,
      ca_han: "Ca 1",
      tinh_trang_thi_nghiem: "Chờ thí nghiệm",
    }),
    [performedAt, duAnId, sitePrefix, thoHanId, mayId, machine, loaiRay, congNghe, loaiMoiHan, chungChi],
  );

  const selectedCount = rows.filter((row) => row.selected && !row.skipReason).length;
  const overwriteCount = rows.filter((row) => row.selected && !row.skipReason && row.mode === "overwrite").length;
  const createCount = rows.filter((row) => row.selected && !row.skipReason && row.mode === "create").length;

  const togglePrefix = (prefix: CoordinateRailPrefix) => {
    setPrefixes((prev) =>
      prev.includes(prefix) ? prev.filter((item) => item !== prefix) : [...prev, prefix],
    );
  };

  const buildPreview = useCallback(async () => {
    const validation = validateAutolispBulkContext(context);
    if (validation) {
      setError(validation);
      return;
    }
    if (!prefixes.length) {
      setError("Chọn ít nhất một dải Autolisp (HT/HP/TT/TP).");
      return;
    }
    setPreviewing(true);
    setError("");
    setProgress("");
    try {
      const fromM = kmFrom.trim() ? parseAutolispChainageMetres(kmFrom) : null;
      const toM = kmTo.trim() ? parseAutolispChainageMetres(kmTo) : null;
      if (kmFrom.trim() && fromM === null) {
        setError("Lý trình đầu không hợp lệ (vd 0+000).");
        return;
      }
      if (kmTo.trim() && toM === null) {
        setError("Lý trình cuối không hợp lệ (vd 1+500).");
        return;
      }

      setLoadingPoints(true);
      const source = includeLinked
        ? await fetchMapPointsFromDb({ force: true })
        : { points: await fetchUnlinkedGpsPoints() };
      const sourcePoints = source.points;
      setPointCount(sourcePoints.length);

      const filtered = filterAutolispPointsForBulk(sourcePoints, {
        prefixes,
        chainageFromM: fromM,
        chainageToM: toM,
        projectId: duAnId || null,
        onlyUnlinked: !includeLinked,
      });

      const prefix = buildWeldCodePrefix(congNghe, `${performedAt.slice(0, 10)}T08:00`, sitePrefix, loaiMoiHan);
      const [systemCodes, machineCodes] = await Promise.all([
        loadWeldCodesWithPrefix(prefix),
        loadMachineFieldCodesForSuggestion(performedAt.slice(0, 10), machine),
      ]);
      setExistingSystem(systemCodes);
      setExistingMachine(machineCodes);

      const preview = buildAutolispBulkPreview(filtered, context, systemCodes, machineCodes);
      setRows(preview);
      if (!preview.length) {
        setError("Không có điểm Autolisp khớp bộ lọc. Kiểm tra import Excel / dải / Km.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được điểm Autolisp.");
      setRows([]);
    } finally {
      setLoadingPoints(false);
      setPreviewing(false);
    }
  }, [context, prefixes, kmFrom, kmTo, includeLinked, duAnId, congNghe, performedAt, sitePrefix, loaiMoiHan, machine]);

  function setRowSelected(pointId: string, selected: boolean) {
    setRows((prev) => {
      const next = prev.map((row) =>
        row.pointId === pointId && !row.skipReason ? { ...row, selected } : row,
      );
      return resequenceAutolispBulkPreview(next, context, existingSystem, existingMachine, {
        regenerateMachine: true,
      });
    });
  }

  function setAllSelected(selected: boolean) {
    setRows((prev) => {
      const next = prev.map((row) =>
        row.skipReason ? row : { ...row, selected },
      );
      return resequenceAutolispBulkPreview(next, context, existingSystem, existingMachine, {
        regenerateMachine: true,
      });
    });
  }

  function setMachineCode(pointId: string, value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.pointId === pointId ? { ...row, ten_moi_han_theo_may: value.trim().toUpperCase() } : row,
      ),
    );
  }

  async function handleCommit() {
    if (selectedCount < 1) {
      setError("Chọn ít nhất một điểm để tạo nhật ký.");
      return;
    }
    if (selectedCount > AUTOLISP_BULK_MAX) {
      setError(`Chỉ tạo tối đa ${AUTOLISP_BULK_MAX} mối mỗi lần.`);
      return;
    }
    const validation = validateAutolispBulkContext(context);
    if (validation) {
      setError(validation);
      return;
    }
    const confirmed = window.confirm(
      `Xử lý ${selectedCount.toLocaleString("vi-VN")} điểm Autolisp (dự án “${project?.label ?? ""}”, ngày ${performedAt})?\n` +
        `Tạo mới: ${createCount.toLocaleString("vi-VN")} · Ghi đè: ${overwriteCount.toLocaleString("vi-VN")}.\nTiếp tục?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      const result = await commitAutolispBulkWelds(rows, context, (done, total) => {
        setProgress(`Đang xử lý ${done}/${total}…`);
      });
      const parts = [
        result.created ? `tạo ${result.created.toLocaleString("vi-VN")}` : "",
        result.updated ? `ghi đè ${result.updated.toLocaleString("vi-VN")}` : "",
        result.skipped ? `bỏ qua ${result.skipped}` : "",
        result.errors.length ? `lỗi ${result.errors.length}` : "",
      ].filter(Boolean);
      const summary = parts.length ? `Đã ${parts.join(" · ")}` : "Không có thay đổi.";
      if (result.errors.length) {
        window.alert(`${summary}\n\n${result.errors.slice(0, 12).join("\n")}`);
      }
      if (result.created > 0 || result.updated > 0) {
        onDone(summary);
        onClose();
      } else if (!result.errors.length) {
        setError("Không tạo/ghi đè được bản ghi nào.");
      } else {
        setError(result.errors[0] ?? "Có lỗi khi đồng bộ nhật ký.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được nhật ký hàng loạt.");
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Nhập hàng loạt từ Autolisp"
    >
      <div className="my-4 w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nhập hàng loạt từ Autolisp</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Điểm chưa gắn → tạo mới; điểm đã gắn → ghi đè nhật ký cũ (giữ mã hệ thống).
              {pointCount > 0 ? ` · Đã tải ${pointCount.toLocaleString("vi-VN")} điểm GPS` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-100 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
          <label className="text-xs font-semibold text-slate-700">
            Dự án
            <select className={inputClass} value={duAnId} onChange={(e) => setDuAnId(e.target.value)}>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Ngày hàn
            <input
              type="date"
              className={inputClass}
              value={performedAt.slice(0, 10)}
              onChange={(e) => setPerformedAt(e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Máy hàn
            <select className={inputClass} value={mayId} onChange={(e) => setMayId(e.target.value)}>
              {machines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-slate-500">{machineWeldCodeHint(machine)}</span>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Thợ hàn
            <select className={inputClass} value={thoHanId} onChange={(e) => setThoHanId(e.target.value)}>
              {welders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Chứng chỉ sử dụng
            <select className={inputClass} value={chungChi} onChange={(e) => setChungChi(e.target.value)}>
              <option value="">— Không chọn —</option>
              {(welder?.certificates ?? []).map((cert) => (
                <option key={cert} value={cert}>
                  {cert}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Loại ray
            <input className={inputClass} value={loaiRay} onChange={(e) => setLoaiRay(e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Công nghệ
            <select
              className={inputClass}
              value={congNghe}
              onChange={(e) => setCongNghe(e.target.value as WeldReportRow["cong_nghe_han"])}
            >
              <option value="FBW">FBW</option>
              <option value="ATW">ATW</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Loại mối hàn
            <select
              className={inputClass}
              value={loaiMoiHan}
              onChange={(e) => setLoaiMoiHan(e.target.value as WeldReportRow["loai_moi_han"])}
            >
              {WELD_TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-1">
            Dải Autolisp
            <div className="mt-1 flex flex-wrap gap-2">
              {COORDINATE_RAIL_PREFIXES.map((prefix) => (
                <label key={prefix} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={prefixes.includes(prefix)}
                    onChange={() => togglePrefix(prefix)}
                  />
                  {autolispPrefixLabel(prefix)}
                </label>
              ))}
            </div>
          </div>
          <label className="text-xs font-semibold text-slate-700">
            Lý trình từ
            <input
              className={inputClass}
              value={kmFrom}
              onChange={(e) => setKmFrom(e.target.value)}
              placeholder="0+000"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Lý trình đến
            <input
              className={inputClass}
              value={kmTo}
              onChange={(e) => setKmTo(e.target.value)}
              placeholder="1+500"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={includeLinked}
              onChange={(e) => setIncludeLinked(e.target.checked)}
            />
            Gồm điểm đã gắn (ghi đè nhật ký)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => void buildPreview()}
            disabled={previewing || loadingPoints || saving}
            className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white hover:bg-[#00388A] disabled:opacity-60"
          >
            {previewing || loadingPoints ? "Đang tải…" : "Xem trước khớp mã"}
          </button>
          {rows.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setAllSelected(true)}
                disabled={saving}
                className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => setAllSelected(false)}
                disabled={saving}
                className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Bỏ chọn
              </button>
              <span className="text-xs text-slate-600">
                Chọn <strong className="font-mono">{selectedCount}</strong> / {rows.length}
                {" · "}tạo {createCount} · ghi đè {overwriteCount} · tối đa {AUTOLISP_BULK_MAX}/lần
              </span>
            </>
          ) : null}
          {progress ? <span className="text-xs font-medium text-amber-700">{progress}</span> : null}
        </div>

        {error ? (
          <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 sm:mx-5">
            {error}
          </div>
        ) : null}

        <div className="max-h-[min(52vh,480px)] overflow-auto px-4 py-3 sm:px-5">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Chọn điều kiện rồi bấm <b>Xem trước khớp mã</b>.
            </p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b px-2 py-2">Chọn</th>
                  <th className="border-b px-2 py-2">Autolisp</th>
                  <th className="border-b px-2 py-2">Km</th>
                  <th className="border-b px-2 py-2">Mã hệ thống</th>
                  <th className="border-b px-2 py-2">Mã sơn</th>
                  <th className="border-b px-2 py-2">Mã máy</th>
                  <th className="border-b px-2 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.pointId}
                    className={
                      row.skipReason
                        ? "bg-slate-50 text-slate-400"
                        : row.mode === "overwrite"
                          ? "bg-amber-50/60"
                          : ""
                    }
                  >
                    <td className="border-b border-slate-100 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={row.selected && !row.skipReason}
                        disabled={Boolean(row.skipReason) || saving}
                        onChange={(e) => setRowSelected(row.pointId, e.target.checked)}
                      />
                    </td>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-mono font-semibold text-slate-800">
                      {row.maDiem}
                    </td>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-mono">{row.lyTrinh || "—"}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-mono">{row.ma_lich_su || "—"}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-mono">{row.ma_hien_truong || "—"}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">
                      {row.skipReason ? (
                        "—"
                      ) : (
                        <input
                          className="h-8 w-36 rounded border border-slate-300 px-2 font-mono text-[11px]"
                          value={row.ten_moi_han_theo_may}
                          disabled={saving || !row.selected}
                          onChange={(e) => setMachineCode(row.pointId, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-2 py-1.5">
                      {row.skipReason
                        ?? (row.selected
                          ? row.mode === "overwrite"
                            ? "Ghi đè"
                            : "Tạo mới"
                          : "Bỏ qua")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleCommit()}
            disabled={saving || selectedCount < 1}
            className="h-10 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? progress || "Đang xử lý…" : `Xử lý ${selectedCount} điểm`}
          </button>
        </div>
      </div>
    </div>
  );
}
