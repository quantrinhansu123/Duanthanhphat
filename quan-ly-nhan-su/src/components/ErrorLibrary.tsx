"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  machineFaultSections,
  NDT_DEFECTS,
  type MachineFault,
  type MachineFaultSection,
  type NdtDefect,
  type ErrorCategory,
} from "@/data/error-library";
import { MagnifyingGlass, Plus, X } from "@/components/icons";
import { createMachineFault, loadMachineFaultLibrary } from "@/lib/machineFaultsDb";
import {
  displayWeldCode,
  formatJournalDateIso,
  getJournalRowDateIso,
  loadJournalHistoryForDefectCode,
  loadJournalHistoryForFaultText,
  NDT_DEFECT_MAP,
  resolveWeldTestStatus,
  type WeldReportRow,
} from "@/lib/weldReportData";

export type ErrorLibraryProps = {
  categories?: ErrorCategory[];
  mode?: "machine" | "ndt" | "combined";
};

type TabKey = "Tất cả" | MachineFaultSection | "NDT";
type DetailTab = "chi-tiet" | "lich-su";

type DetailTarget =
  | { kind: "machine"; item: MachineFault }
  | { kind: "ndt"; item: NdtDefect };

export default function ErrorLibrary({ categories, mode }: ErrorLibraryProps) {
  const showNdt =
    mode === "ndt" ||
    mode === "combined" ||
    (categories?.length === 1 && categories[0] === "Mối hàn");
  const showMachine = mode === "machine" || mode === "combined" || !showNdt || mode === undefined;

  // Khi chỉ NDT (legacy) — giữ bảng mã khuyết tật
  const ndtOnly = showNdt && !showMachine;

  const [query, setQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<TabKey>(ndtOnly ? "NDT" : "Tất cả");
  const [faults, setFaults] = useState<MachineFault[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [newFault, setNewFault] = useState({
    section: "Tổng thể" as MachineFaultSection,
    symptom: "",
    probableCause: "",
    remedy: "",
    sourceReference: "Bổ sung vận hành",
  });
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("chi-tiet");

  useEffect(() => {
    if (ndtOnly) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadMachineFaultLibrary()
      .then((result) => {
        if (!active) return;
        setFaults(result.items);
        setSourceLabel(result.source === "supabase" ? "Supabase" : "Seed cục bộ");
        setLoadError(result.error ?? "");
      })
      .catch((error) => {
        if (!active) return;
        setFaults([]);
        setLoadError(error instanceof Error ? error.message : "Không tải được thư viện lỗi");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ndtOnly, reloadToken]);

  async function handleCreateFault() {
    setSaving(true);
    setSaveError("");
    try {
      await createMachineFault(newFault);
      setAddOpen(false);
      setNewFault({
        section: "Tổng thể",
        symptom: "",
        probableCause: "",
        remedy: "",
        sourceReference: "Bổ sung vận hành",
      });
      setReloadToken((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không thêm được lỗi thiết bị");
    } finally {
      setSaving(false);
    }
  }

  const sectionCounts = useMemo(() => {
    const counts: Record<MachineFaultSection, number> = {
      "Tổng thể": 0,
      "Cẩu": 0,
      "Bơm": 0,
      "Máy hàn": 0,
    };
    for (const item of faults) counts[item.section] += 1;
    return counts;
  }, [faults]);

  const filteredFaults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faults
      .filter((item) => {
        if (selectedTab !== "Tất cả" && selectedTab !== "NDT" && item.section !== selectedTab) {
          return false;
        }
        if (selectedTab === "NDT") return false;
        if (!q) return true;
        return (
          item.symptom.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q) ||
          item.sourceReference.toLowerCase().includes(q) ||
          item.cases.some(
            (c) =>
              c.probableCause.toLowerCase().includes(q) ||
              c.remedy.toLowerCase().includes(q),
          )
        );
      })
      .sort(
        (a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id),
      );
  }, [faults, query, selectedTab]);

  const filteredNdt = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NDT_DEFECTS;
    return NDT_DEFECTS.filter(
      (d) => d.code.toLowerCase().includes(q) || d.nameEn.toLowerCase().includes(q),
    );
  }, [query]);

  const groupedBySource = useMemo(() => {
    const map = new Map<string, MachineFault[]>();
    for (const item of filteredFaults) {
      const key = item.sourceReference;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [filteredFaults]);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    ...(showMachine
      ? [
          { key: "Tất cả" as const, label: "Tất cả", count: faults.length },
          ...machineFaultSections.map((sec) => ({
            key: sec as TabKey,
            label: sec,
            count: sectionCounts[sec],
          })),
        ]
      : []),
    ...(showNdt ? [{ key: "NDT" as const, label: "Mã NDT", count: NDT_DEFECTS.length }] : []),
  ];

  function openMachineDetail(item: MachineFault) {
    setDetail({ kind: "machine", item });
    setDetailTab("chi-tiet");
  }

  function openNdtDetail(item: NdtDefect) {
    setDetail({ kind: "ndt", item });
    setDetailTab("chi-tiet");
  }

  // ---------------------------------------------------------------------------
  // NDT only (legacy)
  // ---------------------------------------------------------------------------
  if (ndtOnly) {
    return (
      <main className="w-full px-4 sm:px-6 pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Mã khuyết tật mối hàn NDT</h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Danh mục đúng theo tài liệu được cung cấp, dùng cho nhật ký hàn và báo cáo. Click một mã để xem chi tiết và lịch sử.
            </p>
          </div>
        </div>
        <NdtTable items={filteredNdt} query={query} onQueryChange={setQuery} onSelect={openNdtDetail} />
        {detail && (
          <ErrorDetailModal
            detail={detail}
            detailTab={detailTab}
            onTabChange={setDetailTab}
            onClose={() => setDetail(null)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Thư viện xử lý sự cố thiết bị</h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Theo tài liệu II. Các loại hỏng hóc — Click một dòng để xem chi tiết và lịch sử nhật ký hàn liên quan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              loadError ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-[#0047AB]"
            }`}
          >
            {loading
              ? "Đang tải…"
              : loadError
                ? `Dùng seed · ${loadError}`
                : `${sourceLabel} · ${faults.length} mục`}
          </div>
          <button
            type="button"
            onClick={() => {
              setSaveError("");
              setAddOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#00388A]"
          >
            <Plus size={15} weight="bold" aria-hidden /> Thêm lỗi
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm triệu chứng, nguyên nhân, cách khắc phục…"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedTab(tab.key)}
              className={`h-10 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer sm:text-sm ${
                selectedTab === tab.key
                  ? "bg-[#0047AB] text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {selectedTab === "NDT" ? (
        <NdtTable items={filteredNdt} query={query} onQueryChange={setQuery} hideSearch onSelect={openNdtDetail} />
      ) : loading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Đang tải thư viện lỗi…
        </div>
      ) : groupedBySource.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Không tìm thấy mục phù hợp.
        </div>
      ) : (
        <div className="space-y-5">
          {groupedBySource.map(([source, rows]) => (
            <section key={source} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                <h3 className="text-sm font-bold text-slate-900">{rows[0]?.section}</h3>
                <span className="text-xs font-semibold text-[#0047AB]">{source}</span>
              </div>
              <div className="table-scroll overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <th className="w-14 whitespace-nowrap px-3.5 py-3">TT</th>
                      <th className="min-w-[240px] px-3.5 py-3">
                        Tên gọi trục trặc, triệu chứng bên ngoài và các dấu hiệu bổ sung
                      </th>
                      <th className="min-w-[260px] px-3.5 py-3">Nguyên nhân dự đoán</th>
                      <th className="min-w-[260px] px-3.5 py-3">Khắc phục</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((item) => (
                      <tr
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openMachineDetail(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openMachineDetail(item);
                          }
                        }}
                        className="align-top cursor-pointer hover:bg-blue-50/60 focus-visible:bg-blue-50/60 focus-visible:outline-hidden"
                      >
                        <td className="px-3.5 py-3 font-mono font-bold text-[#0047AB]">{item.order}</td>
                        <td className="px-3.5 py-3 font-semibold text-slate-900 leading-relaxed">
                          {item.symptom}
                        </td>
                        <td className="px-3.5 py-3 text-slate-700 leading-relaxed">
                          {item.cases.length <= 1 ? (
                            item.cases[0]?.probableCause || "—"
                          ) : (
                            <ol className="list-decimal space-y-1.5 pl-4">
                              {item.cases.map((c, idx) => (
                                <li key={idx}>{c.probableCause}</li>
                              ))}
                            </ol>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-slate-700 leading-relaxed">
                          {item.cases.length <= 1 ? (
                            item.cases[0]?.remedy || "—"
                          ) : (
                            <ol className="list-decimal space-y-1.5 pl-4">
                              {item.cases.map((c, idx) => (
                                <li key={idx}>{c.remedy}</li>
                              ))}
                            </ol>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <button type="button" aria-label="Đóng" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => !saving && setAddOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Thư viện lỗi máy</div>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">Thêm lỗi thiết bị</h3>
              </div>
              <button type="button" onClick={() => !saving && setAddOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Đóng">
                <X size={18} weight="bold" aria-hidden />
              </button>
            </div>
            <div className="max-h-[72dvh] space-y-3.5 overflow-y-auto px-5 py-5">
              {saveError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</div>}
              <label className="block text-xs font-semibold text-slate-700">
                Nhóm lỗi
                <select value={newFault.section} onChange={(event) => setNewFault((value) => ({ ...value, section: event.target.value as MachineFaultSection }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  {machineFaultSections.map((section) => <option key={section}>{section}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Triệu chứng / dấu hiệu
                <textarea value={newFault.symptom} onChange={(event) => setNewFault((value) => ({ ...value, symptom: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Nguyên nhân dự đoán
                <textarea value={newFault.probableCause} onChange={(event) => setNewFault((value) => ({ ...value, probableCause: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Khắc phục
                <textarea value={newFault.remedy} onChange={(event) => setNewFault((value) => ({ ...value, remedy: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Nguồn / ghi chú
                <input value={newFault.sourceReference} onChange={(event) => setNewFault((value) => ({ ...value, sourceReference: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5">
              <button type="button" disabled={saving} onClick={() => setAddOpen(false)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700">Hủy</button>
              <button type="button" disabled={saving} onClick={() => void handleCreateFault()} className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Đang lưu…" : "Thêm lỗi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <ErrorDetailModal
          detail={detail}
          detailTab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setDetail(null)}
        />
      )}
    </main>
  );
}

function NdtTable({
  items,
  query,
  onQueryChange,
  hideSearch,
  onSelect,
}: {
  items: NdtDefect[];
  query: string;
  onQueryChange: (value: string) => void;
  hideSearch?: boolean;
  onSelect: (item: NdtDefect) => void;
}) {
  return (
    <>
      {!hideSearch && (
        <div className="mb-4">
          <div className="relative min-w-[240px] max-w-xl">
            <MagnifyingGlass
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Tìm mã khuyết tật (LOF, LOP, C, S, Po, La)…"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
            />
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="w-28 whitespace-nowrap px-4 py-3">Mã lỗi</th>
                <th className="min-w-[300px] px-3.5 py-3">Tên tiếng Anh (Standard)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.code}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(item);
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-blue-50/60 focus-visible:bg-blue-50/60 focus-visible:outline-hidden"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-base font-bold text-[#0047AB]">
                    <span className="inline-block rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1">
                      {item.code}
                    </span>
                  </td>
                  <td className="px-3.5 py-3.5 font-mono font-semibold text-slate-900">{item.nameEn}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-12 text-center text-slate-500">
                    Không tìm thấy mã khuyết tật phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ErrorDetailModal({
  detail,
  detailTab,
  onTabChange,
  onClose,
}: {
  detail: DetailTarget;
  detailTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
}) {
  const [historyRows, setHistoryRows] = useState<WeldReportRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const detailKey =
    detail.kind === "ndt" ? `ndt:${detail.item.code}` : `machine:${detail.item.id}`;

  const title =
    detail.kind === "ndt"
      ? `${detail.item.code} · ${detail.item.nameEn}`
      : detail.item.symptom;
  const subtitle =
    detail.kind === "ndt"
      ? "Khuyết tật mối hàn NDT"
      : `${detail.item.section} · ${detail.item.sourceReference}`;

  useEffect(() => {
    setHistoryRows([]);
    setHistoryError("");
    setHistoryLoaded(false);
    setHistoryLoading(false);
  }, [detailKey]);

  useEffect(() => {
    if (detailTab !== "lich-su" || historyLoaded) return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");

    const request =
      detail.kind === "ndt"
        ? loadJournalHistoryForDefectCode(detail.item.code)
        : loadJournalHistoryForFaultText([
            detail.item.symptom,
            ...detail.item.cases.map((item) => item.probableCause),
            ...detail.item.cases.map((item) => item.remedy),
          ]);

    request
      .then((rows) => {
        if (!active) return;
        setHistoryRows(rows);
        setHistoryLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        setHistoryError(error instanceof Error ? error.message : "Không tải được lịch sử nhật ký hàn");
        setHistoryLoaded(true);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [detail, detailTab, historyLoaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <button type="button" aria-label="Đóng" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">{subtitle}</div>
            <h3 className="mt-0.5 text-base font-bold text-slate-900 sm:text-lg leading-snug">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-5 pt-2">
          {(
            [
              { key: "chi-tiet" as const, label: "Chi tiết" },
              { key: "lich-su" as const, label: "Lịch sử" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                detailTab === tab.key
                  ? "border-[#0047AB] text-[#0047AB]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {tab.key === "lich-su" && historyLoaded ? ` (${historyRows.length})` : ""}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {detailTab === "chi-tiet" ? (
            detail.kind === "ndt" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField label="Mã khuyết tật">
                    <span className="inline-block rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono font-bold text-[#0047AB]">
                      {detail.item.code}
                    </span>
                  </DetailField>
                  <DetailField label="Tên chuẩn (EN)">{detail.item.nameEn}</DetailField>
                </div>
                <DetailField label="Mô tả">
                  {NDT_DEFECT_MAP[detail.item.code] || `${detail.item.nameEn} (${detail.item.code})`}
                </DetailField>
                <p className="text-xs text-slate-500">
                  Mã này được gắn trên nhật ký hàn khi kết quả thí nghiệm là &quot;Không đạt&quot;. Tab Lịch sử liệt kê toàn bộ mối hàn có mã này.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailField label="Nhóm">{detail.item.section}</DetailField>
                  <DetailField label="TT">
                    <span className="font-mono font-bold text-[#0047AB]">{detail.item.order}</span>
                  </DetailField>
                  <DetailField label="Nguồn">{detail.item.sourceReference}</DetailField>
                </div>
                <DetailField label="Triệu chứng / dấu hiệu">{detail.item.symptom}</DetailField>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nguyên nhân & khắc phục
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                          <th className="w-10 px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">Nguyên nhân dự đoán</th>
                          <th className="px-3 py-2.5">Khắc phục</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.item.cases.map((item, index) => (
                          <tr key={index} className="align-top">
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{index + 1}</td>
                            <td className="px-3 py-2.5 text-slate-800">{item.probableCause}</td>
                            <td className="px-3 py-2.5 text-slate-800">{item.remedy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : historyLoading ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Đang tải lịch sử từ nhật ký hàn…
            </div>
          ) : historyError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {historyError}
            </div>
          ) : historyRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Chưa có bản ghi nhật ký hàn liên quan tới lỗi này.
            </div>
          ) : (
            <JournalHistoryTable rows={historyRows} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900 leading-relaxed">{children}</div>
    </div>
  );
}

function JournalHistoryTable({ rows }: { rows: WeldReportRow[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {rows.length.toLocaleString("vi-VN")} bản ghi nhật ký hàn liên quan (mới nhất trước).
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <th className="whitespace-nowrap px-3 py-2.5">Ngày</th>
                <th className="whitespace-nowrap px-3 py-2.5">Mã mối hàn</th>
                <th className="min-w-[140px] px-3 py-2.5">Dự án</th>
                <th className="whitespace-nowrap px-3 py-2.5">Thợ hàn</th>
                <th className="whitespace-nowrap px-3 py-2.5">Máy</th>
                <th className="whitespace-nowrap px-3 py-2.5">CN</th>
                <th className="whitespace-nowrap px-3 py-2.5">Loại</th>
                <th className="whitespace-nowrap px-3 py-2.5">Kết quả TN</th>
                <th className="min-w-[100px] px-3 py-2.5">Mã KT</th>
                <th className="min-w-[160px] px-3 py-2.5">Nguyên nhân / ghi chú</th>
                <th className="whitespace-nowrap px-3 py-2.5">CC sử dụng</th>
                <th className="whitespace-nowrap px-3 py-2.5">MH liên kết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const iso = getJournalRowDateIso(row, index);
                const testStatus = resolveWeldTestStatus(row);
                const statusClass =
                  testStatus === "Đạt"
                    ? "text-emerald-700"
                    : testStatus === "Không đạt"
                      ? "text-rose-700"
                      : testStatus === "Chờ thí nghiệm"
                        ? "text-amber-700"
                        : "text-slate-600";
                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-600">
                      {iso ? formatJournalDateIso(iso) : `Năm ${row.nam_thuc_hien}`}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-[#0047AB]">
                      {displayWeldCode(row.ma_lich_su)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">{row.du_an}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-800">
                      {row.ten_tho_han || "—"}
                      {row.ma_nhan_su ? (
                        <div className="font-mono text-[11px] text-slate-400">{row.ma_nhan_su}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {row.ma_may ? (
                        <>
                          {row.ma_may}
                          {row.ten_may ? (
                            <div className="text-[11px] text-slate-400">{row.ten_may}</div>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-700">{row.cong_nghe_han}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{row.loai_moi_han}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${statusClass}`}>{testStatus}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#0047AB]">
                      {row.ma_khuyet_tat?.length ? row.ma_khuyet_tat.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 leading-relaxed">
                      {row.nguyen_nhan_loi?.trim() || "—"}
                      {row.ghi_chu?.trim() ? (
                        <div className="mt-0.5 text-[11px] text-slate-400">{row.ghi_chu}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {row.chung_chi_su_dung?.trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-600">
                      {row.moi_han_lien_ket?.trim() || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
