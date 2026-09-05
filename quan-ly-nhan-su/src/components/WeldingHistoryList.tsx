"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  ClockCounterClockwise,
  DotsThree,
  DownloadSimple,
  Export,
  MagnifyingGlass,
  PencilSimple,
  WarningCircle,
  X,
} from "@/components/icons";
import {
  DEFAULT_ACCOUNTING_CODES,
  formatWeldingDate,
  type WeldingHistoryRecord,
} from "@/data/weldingHistory";
import {
  deleteWeldingHistoryRecord,
  exportAllFilteredWeldingHistory,
  loadWeldingHistoryPage,
  quickUpdateAccountingCode,
  saveWeldingHistoryRecord,
  type WeldingHistoryFilterParams,
  type WeldingHistoryStats,
} from "@/lib/weldingHistoryDb";
import { createClient } from "@/lib/supabase/client";

const resultStyle: Record<WeldingHistoryRecord["result"], string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Không đạt": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Sửa chữa": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const resultOptions: WeldingHistoryRecord["result"][] = ["Đạt", "Không đạt", "Sửa chữa"];
const shiftOptions: WeldingHistoryRecord["shift"][] = ["Ca 1", "Ca 2", "Ca 3"];
const defaultMachines = ["KCM007-01", "UN5-150ZC2-01", "KCM007-02", "UN5-150ZC2-02"];
const defaultRails = ["UIC60", "50N", "60kg/m", "P50", "P43"];

function emptyRecord(): WeldingHistoryRecord {
  return {
    id: `temp-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    weldingId: `WH${String(Math.floor(Math.random() * 900) + 100)}`,
    welderName: "Lê Thị Kim Anh",
    rank: "Hạng 1",
    weldJoint: `MH-HN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-01`,
    machine: "KCM007-01",
    railType: "UIC60",
    project: "Dự án đường sắt Bắc Nam",
    shift: "Ca 1",
    accountingCode: "HT-SX01",
    result: "Đạt",
  };
}

function HistoryModal({
  record,
  mode,
  onClose,
  onSave,
}: {
  record: WeldingHistoryRecord;
  mode: "view" | "edit" | "create";
  onClose: () => void;
  onSave?: (updated: WeldingHistoryRecord) => void;
}) {
  const [form, setForm] = useState(record);
  const readOnly = mode === "view";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setForm(record);
  }, [record]);

  const title =
    mode === "view" ? "Chi tiết lịch sử hàn" : mode === "edit" ? "Sửa lịch sử hàn" : "Thêm mối hàn mới";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">{title}</div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {mode === "create" ? "Bản ghi mối hàn mới" : form.weldJoint || form.weldingId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày hàn
              <input
                readOnly={readOnly}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Welding ID
              <input
                readOnly={readOnly}
                value={form.weldingId}
                onChange={(e) => setForm({ ...form, weldingId: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Thợ hàn
              <input
                readOnly={readOnly}
                value={form.welderName}
                onChange={(e) => setForm({ ...form, welderName: e.target.value })}
                placeholder="Họ tên thợ hàn"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Hạng thợ
              <input
                readOnly={readOnly}
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              />
            </label>
          </div>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Ký hiệu mối hàn
            <input
              readOnly={readOnly}
              value={form.weldJoint}
              onChange={(e) => setForm({ ...form, weldJoint: e.target.value })}
              placeholder="Ví dụ: MH-HN-2026-0312-01"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono font-bold"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Máy hàn
              {readOnly ? (
                <div className="mt-2 text-xs sm:text-sm font-medium font-mono text-slate-900">{form.machine}</div>
              ) : (
                <select
                  value={form.machine}
                  onChange={(e) => setForm({ ...form, machine: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer font-mono"
                >
                  {defaultMachines.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại ray
              {readOnly ? (
                <div className="mt-2 text-xs sm:text-sm font-medium font-mono text-slate-900">{form.railType}</div>
              ) : (
                <select
                  value={form.railType}
                  onChange={(e) => setForm({ ...form, railType: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer font-mono"
                >
                  {defaultRails.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </label>
          </div>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Dự án
            <input
              readOnly={readOnly}
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ca làm việc
              {readOnly ? (
                <div className="mt-2 text-xs sm:text-sm font-medium text-slate-900">{form.shift}</div>
              ) : (
                <select
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value as WeldingHistoryRecord["shift"] })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
                >
                  {shiftOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </label>

            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Kết quả hàn
              {readOnly ? (
                <div className="mt-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[form.result]}`}>
                    {form.result}
                  </span>
                </div>
              ) : (
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value as WeldingHistoryRecord["result"] })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
                >
                  {resultOptions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </label>
          </div>

          {/* Trường Hạch toán được bổ sung */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5">
            <label className="block text-xs sm:text-[13px] font-bold text-[#0047AB]">
              Mã hạch toán chi phí / Hạng mục
            </label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <select
                disabled={readOnly}
                value={
                  DEFAULT_ACCOUNTING_CODES.some((o) => o.code === form.accountingCode)
                    ? form.accountingCode
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    setForm({ ...form, accountingCode: e.target.value });
                  }
                }}
                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-800 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer disabled:bg-slate-100"
              >
                <option value="">-- Chọn danh mục gợi ý --</option>
                {DEFAULT_ACCOUNTING_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} · {item.label}
                  </option>
                ))}
                <option value="custom">Nhập mã tùy chỉnh...</option>
              </select>

              <input
                readOnly={readOnly}
                value={form.accountingCode}
                onChange={(e) => setForm({ ...form, accountingCode: e.target.value.toUpperCase() })}
                placeholder="Mã hạch toán"
                className="h-10 w-full sm:w-36 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-bold text-[#0047AB] shadow-2xs outline-hidden read-only:bg-slate-100 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 uppercase"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Gợi ý: HT-SX01 (Chính tuyến), HT-SX02 (Đường nhánh), HT-TN01 (Thử nghiệm), HT-SC01 (Sửa chữa), HT-M01 (Metro).
            </p>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            {readOnly ? "Đóng" : "Hủy"}
          </button>
          {!readOnly && onSave && (
            <button
              type="button"
              onClick={() => onSave(form)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              {mode === "create" ? "Thêm mới" : "Lưu thay đổi"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function FilterGroup({
  title,
  options,
  selected,
  onChange,
  onClear,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClear?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{title}</span>
        <div className="flex items-center gap-1.5">
          {selected.length > 0 && (
            <>
              <span className="rounded-full bg-[#0047AB] px-1.5 py-0.2 text-[10px] font-bold text-white font-mono">
                {selected.length}
              </span>
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11px] text-slate-400 hover:text-[#0047AB] cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleValue(selected, opt))}
                className="h-3.5 w-3.5 rounded border-slate-300 text-[#0047AB] focus:ring-blue-500 cursor-pointer"
              />
              <span className={checked ? "font-semibold text-[#0047AB]" : ""}>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function WeldingHistoryList() {
  const [list, setList] = useState<WeldingHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<WeldingHistoryStats>({
    total: 0,
    pass: 0,
    fail: 0,
    rework: 0,
    accountingCounts: [],
  });

  const [query, setQuery] = useState("");
  const [welder, setWelder] = useState("Tất cả thợ hàn");
  const [result, setResult] = useState("Tất cả kết quả");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [railsSel, setRailsSel] = useState<string[]>([]);
  const [projectsSel, setProjectsSel] = useState<string[]>([]);
  const [shiftsSel, setShiftsSel] = useState<string[]>([]);
  const [accountingSel, setAccountingSel] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    record: WeldingHistoryRecord;
    mode: "view" | "edit" | "create";
  } | null>(null);

  const [allWelders, setAllWelders] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<string[]>([]);

  // Tải danh mục thợ hàn & dự án từ DB
  useEffect(() => {
    async function loadMaster() {
      try {
        const supabase = createClient();
        const { data: ns } = await supabase.from("nhan_su").select("ho_ten").order("ho_ten");
        if (ns) setAllWelders(Array.from(new Set(ns.map((n: { ho_ten?: string }) => n.ho_ten).filter((x): x is string => Boolean(x)))));
        const { data: da } = await supabase.from("du_an").select("du_an").order("du_an");
        if (da) setAllProjects(Array.from(new Set(da.map((d: { du_an?: string }) => d.du_an).filter((x): x is string => Boolean(x)))));
      } catch {
        /* ignore */
      }
    }
    loadMaster();
  }, []);

  // Tải dữ liệu trang từ server
  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true);
    const filterParams: WeldingHistoryFilterParams = {
      page: p,
      pageSize: ps,
      query,
      welder,
      result,
      dateFrom,
      dateTo,
      machines: machinesSel,
      rails: railsSel,
      projects: projectsSel,
      shifts: shiftsSel,
      accountingCodes: accountingSel,
    };
    const res = await loadWeldingHistoryPage(filterParams);
    setList(res.records);
    setTotalCount(res.totalCount);
    setStats(res.stats);
    if (res.error) {
      setLoadError(res.error);
    } else {
      setLoadError(null);
    }
    setLoading(false);
  }, [page, pageSize, query, welder, result, dateFrom, dateTo, machinesSel, railsSel, projectsSel, shiftsSel, accountingSel]);

  useEffect(() => {
    fetchData(page, pageSize);
  }, [fetchData, page, pageSize]);

  // Khi bộ lọc thay đổi, quay về trang 1
  useEffect(() => {
    setPage(1);
  }, [query, welder, result, dateFrom, dateTo, machinesSel, railsSel, projectsSel, shiftsSel, accountingSel, pageSize]);

  const welderOptions = useMemo(
    () => ["Tất cả thợ hàn", ...Array.from(new Set([...allWelders, ...list.map((r) => r.welderName)])).filter(Boolean).sort()],
    [allWelders, list],
  );
  const machineOptions = useMemo(
    () => Array.from(new Set([...defaultMachines, ...list.map((r) => r.machine)])).filter(Boolean).sort(),
    [list],
  );
  const railOptions = useMemo(
    () => Array.from(new Set([...defaultRails, ...list.map((r) => r.railType)])).filter(Boolean).sort(),
    [list],
  );
  const projectOptions = useMemo(
    () => Array.from(new Set([...allProjects, ...list.map((r) => r.project)])).filter(Boolean).sort(),
    [allProjects, list],
  );
  const shiftOptionsFilter = useMemo(
    () => Array.from(new Set([...shiftOptions, ...list.map((r) => r.shift)])).filter(Boolean).sort(),
    [list],
  );
  const accountingOptions = useMemo(() => {
    const fromSeeds = DEFAULT_ACCOUNTING_CODES.map((o) => o.code);
    const fromStats = stats.accountingCounts.map(([code]) => code);
    const fromList = list.map((r) => r.accountingCode).filter(Boolean);
    return Array.from(new Set([...fromSeeds, ...fromStats, ...fromList])).sort();
  }, [list, stats.accountingCounts]);

  async function handleDelete(record: WeldingHistoryRecord) {
    if (!window.confirm(`Xóa bản ghi "${record.weldJoint}"?`)) return;
    const res = await deleteWeldingHistoryRecord(record.id, list);
    if (res.error) {
      window.alert(`Không thể xóa trên cơ sở dữ liệu Supabase:\n${res.error}\n\nThao tác xóa đã bị hủy để tránh sai lệch dữ liệu.`);
      setMenuOpen(null);
      return;
    }
    await fetchData(page, pageSize);
    setMenuOpen(null);
  }

  async function handleSave(updated: WeldingHistoryRecord) {
    const isNew = modal?.mode === "create";
    const res = await saveWeldingHistoryRecord(updated, list, isNew);
    if (res.error) {
      window.alert(`Không thể lưu vào cơ sở dữ liệu Supabase:\n${res.error}\n\nDữ liệu chưa được lưu. Vui lòng kiểm tra lại thông tin.`);
      return;
    }
    await fetchData(page, pageSize);
    setModal(null);
  }

  async function handleInlineUpdate(id: string, newCode: string) {
    const res = await quickUpdateAccountingCode(id, newCode, list);
    if (res.error) {
      window.alert(`Không thể lưu mã hạch toán lên Supabase:\n${res.error}`);
      setInlineEditId(null);
      return;
    }
    await fetchData(page, pageSize);
    setInlineEditId(null);
  }

  // Xuất toàn bộ dữ liệu đã lọc ra Excel
  async function exportExcel() {
    try {
      setExporting(true);
      const allRows = await exportAllFilteredWeldingHistory({
        query,
        welder,
        result,
        dateFrom,
        dateTo,
        machines: machinesSel,
        rails: railsSel,
        projects: projectsSel,
        shifts: shiftsSel,
        accountingCodes: accountingSel,
      });

      const data = allRows.map((r, idx) => ({
        STT: idx + 1,
        Ngày: formatWeldingDate(r.date),
        "Welding ID": r.weldingId,
        "Thợ hàn": r.welderName,
        Hạng: r.rank,
        "Mối hàn": r.weldJoint,
        "Máy hàn": r.machine,
        "Loại ray": r.railType,
        "Dự án": r.project,
        Ca: r.shift,
        "Hạch toán": r.accountingCode || "—",
        "Kết quả": r.result,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lịch sử hàn");
      XLSX.writeFile(wb, `Lich_su_han_theo_tho_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      window.alert("Lỗi xuất Excel: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  }

  // Xuất toàn bộ dữ liệu đã lọc ra CSV
  async function exportCsv() {
    try {
      setExporting(true);
      const allRows = await exportAllFilteredWeldingHistory({
        query,
        welder,
        result,
        dateFrom,
        dateTo,
        machines: machinesSel,
        rails: railsSel,
        projects: projectsSel,
        shifts: shiftsSel,
        accountingCodes: accountingSel,
      });

      const headers = [
        "STT",
        "Ngày",
        "Welding ID",
        "Thợ hàn",
        "Hạng",
        "Mối hàn",
        "Máy hàn",
        "Loại ray",
        "Dự án",
        "Ca",
        "Hạch toán",
        "Kết quả",
      ];
      const rows = allRows.map((r, idx) => [
        idx + 1,
        formatWeldingDate(r.date),
        r.weldingId,
        `"${r.welderName}"`,
        r.rank,
        r.weldJoint,
        `"${r.machine}"`,
        r.railType,
        `"${r.project}"`,
        r.shift,
        r.accountingCode || "",
        r.result,
      ]);
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lich_su_han_theo_tho_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert("Lỗi xuất CSV: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  }

  const hasFilter =
    query.trim() ||
    dateFrom ||
    dateTo ||
    welder !== "Tất cả thợ hàn" ||
    result !== "Tất cả kết quả" ||
    machinesSel.length > 0 ||
    railsSel.length > 0 ||
    projectsSel.length > 0 ||
    shiftsSel.length > 0 ||
    accountingSel.length > 0;

  const advancedFilterCount =
    machinesSel.length + railsSel.length + projectsSel.length + shiftsSel.length + accountingSel.length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 sm:text-sm flex items-center justify-between">
          <span>Lưu ý tải dữ liệu từ Supabase: {loadError}</span>
          <button type="button" onClick={() => setLoadError(null)} className="text-amber-700 hover:text-amber-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 4 thẻ KPI thống kê to rõ ràng nổi bật theo Ảnh 12 */}
      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng mối hàn</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0047AB]">Bộ lọc</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
            {stats.total.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">Khớp danh sách theo bộ lọc</div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Đạt chuẩn</span>
            <CheckCircle size={18} weight="fill" className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
            {stats.pass.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">
            {stats.total > 0 ? ((stats.pass / stats.total) * 100).toFixed(1) : "0"}% tổng sản lượng
          </div>
        </div>

        <div className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-white to-rose-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Không đạt</span>
            <WarningCircle size={18} weight="fill" className="text-rose-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono tabular-nums">
            {stats.fail.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs text-rose-600 font-medium">
            {stats.total > 0 ? ((stats.fail / stats.total) * 100).toFixed(1) : "0"}% tỷ lệ lỗi
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Sửa chữa / Gia công</span>
            <ClockCounterClockwise size={18} weight="bold" className="text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono tabular-nums">
            {stats.rework.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs text-amber-600 font-medium">
            {stats.total > 0 ? ((stats.rework / stats.total) * 100).toFixed(1) : "0"}% cần xử lý
          </div>
        </div>
      </div>

      {/* Thanh chip thống kê Hạch toán & Nguồn dữ liệu */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-[#0047AB] uppercase tracking-wide mr-1">
              Thống kê Hạch toán:
            </span>
            {stats.accountingCounts.map(([code, count]) => {
              const active = accountingSel.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setAccountingSel((prev) => toggleValue(prev, code))}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono transition-all cursor-pointer ${
                    active
                      ? "bg-[#0047AB] text-white font-bold ring-2 ring-[#0047AB]/20 shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium"
                  }`}
                  title={`Lọc theo mã ${code}`}
                >
                  <span>{code}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold tabular-nums ${
                      active ? "bg-white/30 text-white" : "bg-white text-slate-700 shadow-2xs"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {accountingSel.length > 0 && (
              <button
                type="button"
                onClick={() => setAccountingSel([])}
                className="ml-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Bỏ lọc ({accountingSel.length})
              </button>
            )}
          </div>

          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Nguồn dữ liệu: Supabase
          </span>
        </div>
      </div>

      {/* Thanh bộ lọc chính */}
      <div className="mb-3 flex flex-wrap items-end gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mối hàn, thợ hàn, máy, dự án, mã hạch toán..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Từ ngày
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1.5 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Đến ngày
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1.5 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <select
          value={welder}
          onChange={(e) => setWelder(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {welderOptions.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả kết quả", "Đạt", "Không đạt", "Sửa chữa"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDateFrom("");
              setDateTo("");
              setWelder("Tất cả thợ hàn");
              setResult("Tất cả kết quả");
              setMachinesSel([]);
              setRailsSel([]);
              setProjectsSel([]);
              setShiftsSel([]);
              setAccountingSel([]);
            }}
            className="mb-0.5 inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Xóa lọc
          </button>
        )}

        {/* Nút Xuất Excel & CSV */}
        <button
          type="button"
          onClick={exportExcel}
          disabled={exporting}
          className="mb-0.5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 px-3 text-xs sm:text-sm font-semibold shadow-2xs transition-all duration-150 cursor-pointer"
          title="Xuất toàn bộ bảng dữ liệu đã lọc ra file Excel"
        >
          <DownloadSimple size={16} weight="bold" />
          <span>{exporting ? "Đang xuất..." : "Xuất Excel"}</span>
        </button>

        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="mb-0.5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 px-3 text-xs sm:text-sm font-semibold shadow-2xs transition-all duration-150 cursor-pointer"
          title="Xuất toàn bộ bảng dữ liệu đã lọc ra file CSV"
        >
          <Export size={16} weight="bold" />
          <span>{exporting ? "Đang xuất..." : "CSV"}</span>
        </button>

        <button
          type="button"
          onClick={() => setModal({ record: emptyRecord(), mode: "create" })}
          className="mb-0.5 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      {/* Khối bộ lọc chi tiết (Collapsible) */}
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
          aria-expanded={filtersOpen}
        >
          <div className="flex items-center gap-2">
            <CaretDown
              size={16}
              weight="bold"
              aria-hidden
              className={`text-slate-500 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            />
            <span className="text-xs sm:text-sm font-bold text-slate-900">Bộ lọc chi tiết &amp; Hạch toán</span>
            <span className="text-xs text-slate-500">Máy · Loại ray · Dự án · Ca · Mã hạch toán</span>
            {advancedFilterCount > 0 && (
              <span className="inline-flex rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs font-mono tabular-nums">
                {advancedFilterCount} đang chọn
              </span>
            )}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[#0047AB]">
            {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc chi tiết"}
          </span>
        </button>

        {filtersOpen && (
          <div className="border-t border-slate-200 p-3.5 bg-slate-50/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <FilterGroup
                title="Hạch toán"
                options={accountingOptions}
                selected={accountingSel}
                onChange={setAccountingSel}
                onClear={() => setAccountingSel([])}
              />
              <FilterGroup
                title="Máy hàn"
                options={machineOptions}
                selected={machinesSel}
                onChange={setMachinesSel}
                onClear={() => setMachinesSel([])}
              />
              <FilterGroup
                title="Loại ray"
                options={railOptions}
                selected={railsSel}
                onChange={setRailsSel}
                onClear={() => setRailsSel([])}
              />
              <FilterGroup
                title="Dự án"
                options={projectOptions}
                selected={projectsSel}
                onChange={setProjectsSel}
                onClear={() => setProjectsSel([])}
              />
              <FilterGroup
                title="Ca"
                options={shiftOptionsFilter}
                selected={shiftsSel}
                onChange={setShiftsSel}
                onClear={() => setShiftsSel([])}
              />
            </div>
            {advancedFilterCount > 0 && (
              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMachinesSel([]);
                    setRailsSel([]);
                    setProjectsSel([]);
                    setShiftsSel([]);
                    setAccountingSel([]);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer transition-colors"
                >
                  Xóa toàn bộ lọc chi tiết
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bảng dữ liệu chuẩn 12 cột: Ngày | Welding ID | Thợ hàn | Hạng | Mối hàn | Máy | Loại ray | Dự án | Ca | Hạch toán | Kết quả | Thao tác */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1240px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Welding ID</th>
                <th className="px-3.5 py-3">Thợ hàn</th>
                <th className="px-3.5 py-3">Hạng</th>
                <th className="px-3.5 py-3">Mối hàn</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3">Loại ray</th>
                <th className="px-3.5 py-3">Dự án</th>
                <th className="px-3.5 py-3">Ca</th>
                <th className="px-3.5 py-3">
                  <div className="flex items-center gap-1 text-[#0047AB]">
                    <span>Hạch toán</span>
                    <span className="rounded bg-blue-100 px-1 text-[10px] font-bold">Mới</span>
                  </div>
                </th>
                <th className="px-3.5 py-3">Kết quả</th>
                <th className="w-12 px-2 py-3 text-center" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0047AB] border-t-transparent" />
                      Đang tải dữ liệu lịch sử mối hàn từ Supabase...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && list.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium font-mono text-slate-900">{formatWeldingDate(row.date)}</td>
                  <td className="px-3.5 py-3 font-mono text-xs text-slate-500">{row.weldingId}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{row.welderName}</td>
                  <td className="px-3.5 py-3 text-slate-700">{row.rank}</td>
                  <td className="px-3.5 py-3">
                    <span className="font-mono text-xs font-bold text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                      {row.weldJoint}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 font-mono text-xs font-bold text-slate-800">{row.machine}</td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono text-xs sm:text-sm">{row.railType}</td>
                  <td className="max-w-[200px] px-3.5 py-3 text-slate-700">
                    <div className="line-clamp-2">{row.project}</div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.shift}</td>

                  {/* Cột 10: HẠCH TOÁN với Chỉnh sửa nhanh (inline edit) */}
                  <td className="px-3.5 py-3">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setInlineEditId(inlineEditId === row.id ? null : row.id)}
                        className="group/btn inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/90 hover:bg-blue-100 px-2.5 py-1 text-xs font-bold font-mono text-[#0047AB] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                        title="Bấm để đổi nhanh mã hạch toán"
                      >
                        <span>{row.accountingCode || "—"}</span>
                        <PencilSimple
                          size={12}
                          weight="bold"
                          className="text-[#0047AB]/60 group-hover/btn:text-[#0047AB] transition-colors"
                        />
                      </button>

                      {/* Dropdown chỉnh sửa nhanh hạch toán tại dòng */}
                      {inlineEditId === row.id && (
                        <div className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              Đổi mã hạch toán
                            </span>
                            <button
                              type="button"
                              onClick={() => setInlineEditId(null)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                            {DEFAULT_ACCOUNTING_CODES.map((ac) => {
                              const isCurrent = row.accountingCode === ac.code;
                              return (
                                <button
                                  key={ac.code}
                                  type="button"
                                  onClick={() => handleInlineUpdate(row.id, ac.code)}
                                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                                    isCurrent
                                      ? "bg-[#0047AB] text-white font-bold"
                                      : "hover:bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  <span className="font-mono">{ac.code}</span>
                                  <span className={`text-[11px] ${isCurrent ? "text-blue-100" : "text-slate-400"}`}>
                                    {ac.group}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="text-[10px] text-slate-500 mb-1 font-semibold">Hoặc nhập mã tùy ý:</div>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                id={`input-ht-${row.id}`}
                                defaultValue={row.accountingCode}
                                placeholder="HT-..."
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                                    if (val) handleInlineUpdate(row.id, val);
                                  }
                                }}
                                className="h-8 flex-1 rounded border border-slate-300 px-2 text-xs font-mono font-bold uppercase text-slate-900 outline-hidden focus:border-[#0047AB]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(`input-ht-${row.id}`) as HTMLInputElement | null;
                                  const val = el?.value.trim().toUpperCase();
                                  if (val) handleInlineUpdate(row.id, val);
                                }}
                                className="rounded bg-[#0047AB] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#00388A] cursor-pointer"
                              >
                                Lưu
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[row.result]}`}
                    >
                      {row.result}
                    </span>
                  </td>

                  <td className="relative px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === row.id ? null : row.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
                    </button>
                    {menuOpen === row.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ record: row, mode: "view" });
                            setMenuOpen(null);
                          }}
                        >
                          Xem chi tiết
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ record: row, mode: "edit" });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          onClick={() => handleDelete(row)}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy lịch sử hàn</div>
                    <div className="mt-1 text-xs text-slate-400">Thử thay đổi từ khóa hoặc thiết lập lại bộ lọc.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang Server-side */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span>
            Hiển thị{" "}
            <strong className="font-semibold text-slate-900 font-mono tabular-nums">
              {totalCount > 0 ? (page - 1) * pageSize + 1 : 0} – {Math.min(page * pageSize, totalCount)}
            </strong>{" "}
            trong tổng số{" "}
            <strong className="font-semibold text-slate-900 font-mono tabular-nums">{totalCount}</strong> mối hàn
          </span>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-hidden focus:border-[#0047AB] cursor-pointer"
            >
              <option value={25}>25 dòng/trang</option>
              <option value={50}>50 dòng/trang</option>
              <option value={100}>100 dòng/trang</option>
            </select>
          </label>
        </div>

        {/* Nút chuyển trang */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <CaretLeft size={14} weight="bold" />
            <span>Trước</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {(() => {
              const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (page > 3) pages.push("...");
                const start = Math.max(2, page - 1);
                const end = Math.min(totalPages - 1, page + 1);
                for (let i = start; i <= end; i++) pages.push(i);
                if (page < totalPages - 2) pages.push("...");
                pages.push(totalPages);
              }

              return pages.map((p, idx) => {
                if (typeof p === "string") {
                  return (
                    <span key={`dots-${idx}`} className="px-1 text-slate-400">
                      ...
                    </span>
                  );
                }
                const isCurrent = p === page;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-mono font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[#0047AB] text-white shadow-xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              });
            })()}
          </div>

          <button
            type="button"
            disabled={page >= Math.ceil(totalCount / pageSize)}
            onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span>Sau</span>
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      {modal && (
        <HistoryModal
          record={modal.record}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={modal.mode !== "view" ? handleSave : undefined}
        />
      )}
    </main>
  );
}
