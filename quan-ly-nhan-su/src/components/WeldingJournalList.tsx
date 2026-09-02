"use client";

import { useEffect, useMemo, useState } from "react";
import { googleOpenPoint } from "@/data/mapPoints";
import type { MachineOption } from "@/data/machineAssignments";
import { useWeldLogGpsPoints } from "@/hooks/useWeldLogGpsPoints";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import { loadMachineOptions } from "@/lib/machineRunSchedulesDb";
import {
  filterWeldReportRows,
  formatJournalDateIso,
  getJournalRowDateIso,
  insertWeldJournalEntry,
  listFailedWeldsInDateRange,
  summarizeJournalRows,
  uniqueProjectOptions,
  uniqueReportValues,
  uniqueWelderOptions,
  type CertifiedWelderOption,
  type WeldReportRow,
} from "@/lib/weldReportData";
import {
  hasCertificate,
  requiredCertificateForWeld,
} from "@/lib/weldingCertificates";

const REPORT_PERIOD_START = "2017-01-01";
const REPORT_PERIOD_END = "2026-12-31";

const SYNTHETIC_FAILURE_REASONS = [
  "Rỗ khí trong vùng hàn",
  "Lệch tim ray vượt dung sai",
  "Nứt bề mặt sau khi nguội",
  "Không đạt kiểm tra siêu âm",
];

type JournalFormValues = {
  ma_lich_su: string;
  performedAt: string;
  du_an_id: string;
  tho_han_id: string;
  may_id: string;
  loai_ray: string;
  cong_nghe_han: WeldReportRow["cong_nghe_han"];
  loai_moi_han: WeldReportRow["loai_moi_han"];
  result: "Đạt" | "Không đạt";
  nguyen_nhan_loi: string;
  moi_han_lien_ket: string;
  chung_chi_su_dung: string;
  ghi_chu: string;
};

function defaultLinkDateRange() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { from, to };
}

function defaultPerformedAt() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function emptyJournalForm(
  projects: { id: string; label: string }[],
  welders: CertifiedWelderOption[],
  machines: MachineOption[],
): JournalFormValues {
  const certificate = requiredCertificateForWeld("UIC60", "FBW");
  return {
    ma_lich_su: "",
    performedAt: defaultPerformedAt(),
    du_an_id: projects[0]?.id ?? "",
    tho_han_id: welders.find((welder) => hasCertificate(welder.certificates, certificate))?.id ?? "",
    may_id: machines[0]?.id ?? "",
    loai_ray: "UIC60",
    cong_nghe_han: "FBW",
    loai_moi_han: "Sản xuất",
    result: "Đạt",
    nguyen_nhan_loi: "",
    moi_han_lien_ket: "",
    chung_chi_su_dung: certificate,
    ghi_chu: "",
  };
}

function JournalFormModal({
  open,
  projects,
  welders,
  machines,
  rows,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  projects: { id: string; label: string }[];
  welders: CertifiedWelderOption[];
  machines: MachineOption[];
  rows: WeldReportRow[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: JournalFormValues) => void;
}) {
  const [form, setForm] = useState(() => emptyJournalForm(projects, welders, machines));
  const [linkDateFrom, setLinkDateFrom] = useState(() => defaultLinkDateRange().from);
  const [linkDateTo, setLinkDateTo] = useState(() => defaultLinkDateRange().to);

  const failedWeldOptions = useMemo(
    () => listFailedWeldsInDateRange(rows, linkDateFrom, linkDateTo),
    [rows, linkDateFrom, linkDateTo],
  );
  const requiredCertificate = useMemo(
    () => requiredCertificateForWeld(form.loai_ray, form.cong_nghe_han),
    [form.loai_ray, form.cong_nghe_han],
  );
  const qualifiedWelders = useMemo(
    () => welders.filter((welder) => hasCertificate(welder.certificates, requiredCertificate)),
    [welders, requiredCertificate],
  );
  const selectedWelder = welders.find((welder) => welder.id === form.tho_han_id);

  useEffect(() => {
    if (open) {
      setForm(emptyJournalForm(projects, welders, machines));
      const range = defaultLinkDateRange();
      setLinkDateFrom(range.from);
      setLinkDateTo(range.to);
    }
  }, [open, projects, welders, machines]);

  useEffect(() => {
    const selectedIsQualified = welders.some(
      (welder) => welder.id === form.tho_han_id && hasCertificate(welder.certificates, requiredCertificate),
    );
    const nextWelderId = selectedIsQualified ? form.tho_han_id : qualifiedWelders[0]?.id ?? "";
    if (form.chung_chi_su_dung === requiredCertificate && form.tho_han_id === nextWelderId) return;
    setForm((prev) => ({
      ...prev,
      tho_han_id: nextWelderId,
      chung_chi_su_dung: requiredCertificate,
    }));
  }, [form.chung_chi_su_dung, form.tho_han_id, qualifiedWelders, requiredCertificate, welders]);

  useEffect(() => {
    if (!form.moi_han_lien_ket) return;
    if (!failedWeldOptions.some((opt) => opt.value === form.moi_han_lien_ket)) {
      setForm((prev) => ({ ...prev, moi_han_lien_ket: "" }));
    }
  }, [failedWeldOptions, form.moi_han_lien_ket]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit() {
    if (!form.ma_lich_su.trim()) {
      window.alert("Vui lòng nhập mã / tên mối hàn.");
      return;
    }
    if (!form.du_an_id) {
      window.alert("Vui lòng chọn dự án.");
      return;
    }
    if (!form.tho_han_id) {
      window.alert("Không có nhân sự sở hữu chứng chỉ phù hợp với mối hàn này.");
      return;
    }
    if (!selectedWelder || !hasCertificate(selectedWelder.certificates, requiredCertificate)) {
      window.alert(`Nhân sự được chọn chưa có chứng chỉ: ${requiredCertificate}`);
      return;
    }
    if (!form.may_id) {
      window.alert("Vui lòng chọn máy thực hiện mối hàn.");
      return;
    }
    if (form.result === "Không đạt" && !form.nguyen_nhan_loi.trim()) {
      window.alert("Vui lòng nhập lý do không đạt.");
      return;
    }
    onSubmit(form);
  }

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
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Thêm nhật ký hàn</div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">Bản ghi mới</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 sm:col-span-2">
              Mã / tên mối hàn
              <input
                value={form.ma_lich_su}
                onChange={(e) => setForm({ ...form, ma_lich_su: e.target.value })}
                placeholder="VD: MH-HN-2026-0401"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày giờ
              <input
                type="datetime-local"
                value={form.performedAt}
                onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Kết quả
              <select
                value={form.result}
                onChange={(e) => setForm({ ...form, result: e.target.value as JournalFormValues["result"] })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
              >
                <option>Đạt</option>
                <option>Không đạt</option>
              </select>
            </label>
          </div>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Nhân sự phụ trách
            <select
              value={form.tho_han_id}
              onChange={(e) => setForm({ ...form, tho_han_id: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
            >
              {qualifiedWelders.length === 0 && (
                <option value="">Chưa có nhân sự đủ chứng chỉ</option>
              )}
              {welders.length === 0 ? (
                <option value="">Chưa có dữ liệu thợ hàn</option>
              ) : (
                welders.map((w) => (
                  <option key={w.id} value={w.id} disabled={!hasCertificate(w.certificates, requiredCertificate)}>
                    {w.label}{hasCertificate(w.certificates, requiredCertificate) ? " · Đủ chứng chỉ" : " · Thiếu chứng chỉ"}
                  </option>
                ))
              )}
            </select>
            <span className={`mt-1.5 block rounded-lg border px-2.5 py-2 text-[11px] font-medium ${qualifiedWelders.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              Chứng chỉ yêu cầu: {requiredCertificate} · {qualifiedWelders.length} nhân sự phù hợp
            </span>
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Dự án
            <select
              value={form.du_an_id}
              onChange={(e) => setForm({ ...form, du_an_id: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
            >
              {projects.length === 0 ? (
                <option value="">Chưa có dữ liệu dự án</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Máy thực hiện
            <select
              value={form.may_id}
              onChange={(e) => setForm({ ...form, may_id: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
            >
              {machines.length === 0 ? (
                <option value="">Chưa có danh mục máy</option>
              ) : (
                machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.code} · {machine.name}
                  </option>
                ))
              )}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              Báo cáo máy sẽ tự cộng mối hàn theo lựa chọn này.
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại ray
              <input
                value={form.loai_ray}
                onChange={(e) => setForm({ ...form, loai_ray: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Công nghệ
              <select
                value={form.cong_nghe_han}
                onChange={(e) =>
                  setForm({ ...form, cong_nghe_han: e.target.value as JournalFormValues["cong_nghe_han"] })
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
              >
                <option>FBW</option>
                <option>ATW</option>
              </select>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại mối
              <select
                value={form.loai_moi_han}
                onChange={(e) =>
                  setForm({ ...form, loai_moi_han: e.target.value as JournalFormValues["loai_moi_han"] })
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
              >
                <option>Sản xuất</option>
                <option>Thử nghiệm</option>
                <option>Đào tạo</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
            <div className="text-xs sm:text-[13px] font-semibold text-slate-700">Mối hàn liên kết</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">
                Từ ngày
                <input
                  type="date"
                  value={linkDateFrom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLinkDateFrom(val);
                    if (linkDateTo && val > linkDateTo) setLinkDateTo(val);
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Đến ngày
                <input
                  type="date"
                  value={linkDateTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLinkDateTo(val);
                    if (linkDateFrom && val < linkDateFrom) setLinkDateFrom(val);
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Chọn mối hàn lỗi trong khoảng ngày
              <select
                value={form.moi_han_lien_ket}
                onChange={(e) => setForm({ ...form, moi_han_lien_ket: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
              >
                <option value="">— Không liên kết —</option>
                {failedWeldOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-slate-500">
              {failedWeldOptions.length > 0
                ? `${failedWeldOptions.length} mối hàn lỗi từ ${formatJournalDateIso(linkDateFrom)} đến ${formatJournalDateIso(linkDateTo)}`
                : "Không có mối hàn lỗi trong khoảng ngày đã chọn."}
            </p>
          </div>

          {form.result === "Không đạt" && (
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Lý do không đạt
              <textarea
                value={form.nguyen_nhan_loi}
                onChange={(e) => setForm({ ...form, nguyen_nhan_loi: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 resize-y"
              />
            </label>
          )}

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Ghi chú
            <textarea
              value={form.ghi_chu}
              onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 resize-y"
            />
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || projects.length === 0 || welders.length === 0 || machines.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs disabled:opacity-60 transition-all duration-150 cursor-pointer"
          >
            {saving ? "Đang lưu…" : "Thêm nhật ký"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WeldingJournalList() {
  const { rows, loading, error, refetch } = useWeldReportData();
  const { points: gpsPoints, loading: gpsLoading, error: gpsError } = useWeldLogGpsPoints(30);

  const [query, setQuery] = useState("");
  const [project, setProject] = useState("Tất cả dự án");
  const [resultFilter, setResultFilter] = useState("Tất cả");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);
  const [machineError, setMachineError] = useState("");

  useEffect(() => {
    let active = true;
    loadMachineOptions()
      .then((options) => {
        if (active) setMachineOptions(options);
      })
      .catch((loadError) => {
        if (active) setMachineError(loadError instanceof Error ? loadError.message : "Không tải được danh mục máy");
      });
    return () => {
      active = false;
    };
  }, []);

  const projectOptions = useMemo(() => uniqueProjectOptions(rows), [rows]);
  const welderOptions = useMemo(() => uniqueWelderOptions(rows), [rows]);

  const projects = useMemo(
    () => ["Tất cả dự án", ...uniqueReportValues(rows, "du_an")],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const base = filterWeldReportRows(rows, {
      dateFrom: REPORT_PERIOD_START,
      dateTo: REPORT_PERIOD_END,
      projects: [],
      personnel: [],
      machines: [],
      methods: [],
      weldTypes: [],
    });

    const q = query.trim().toLowerCase();
    return base.filter((row) => {
      const pass = row.so_luong_loi === 0;
      const matchProject = project === "Tất cả dự án" || row.du_an === project;
      const matchResult =
        resultFilter === "Tất cả" ||
        (resultFilter === "Đạt" && pass) ||
        (resultFilter === "Không đạt" && !pass);
      const matchQuery =
        !q ||
        row.ten_tho_han.toLowerCase().includes(q) ||
        row.du_an.toLowerCase().includes(q) ||
        row.ma_lich_su.toLowerCase().includes(q) ||
        (row.chung_chi_su_dung?.toLowerCase().includes(q) ?? false) ||
        (row.ma_may?.toLowerCase().includes(q) ?? false) ||
        row.id.toLowerCase().includes(q);
      return matchProject && matchResult && matchQuery;
    });
  }, [rows, query, project, resultFilter]);

  const journalRows = useMemo(() => {
    return filteredRows.map((row, index) => {
      const sequence = Number(row.ma_lich_su.match(/(\d+)$/)?.[1] ?? 0);
      const gpsPoint = gpsPoints.length
        ? gpsPoints[(Math.max(sequence, index + 1) - 1) % gpsPoints.length]
        : null;
      const isoDate = getJournalRowDateIso(row, index);
      const dateTime = `${formatJournalDateIso(isoDate)} ${String(7 + (sequence % 10)).padStart(2, "0")}:${String((sequence * 13) % 60).padStart(2, "0")}`;
      const pass = row.so_luong_loi === 0;
      return {
        id: row.id,
        dateTime,
        operator: row.ten_tho_han,
        certificate: row.chung_chi_su_dung?.trim() || requiredCertificateForWeld(row.loai_ray, row.cong_nghe_han),
        machine: row.ma_may
          ? `${row.ma_may}${row.ten_may ? ` · ${row.ten_may}` : ""}`
          : "Chưa gán máy",
        weldName: gpsPoint?.code ?? row.ma_lich_su,
        linkedWeld: row.moi_han_lien_ket?.trim() || "—",
        project: row.du_an,
        location: gpsPoint
          ? `${gpsPoint.chainage} · ${gpsPoint.latitude.toFixed(6)}, ${gpsPoint.longitude.toFixed(6)}`
          : "Chưa có GPS",
        mapUrl: gpsPoint ? googleOpenPoint(gpsPoint.latitude, gpsPoint.longitude) : "",
        failureReason: pass
          ? "—"
          : row.nguyen_nhan_loi?.trim() || SYNTHETIC_FAILURE_REASONS[sequence % SYNTHETIC_FAILURE_REASONS.length],
        resultType: pass ? ("pass" as const) : ("fail" as const),
      };
    });
  }, [filteredRows, gpsPoints]);

  const passCount = useMemo(() => summarizeJournalRows(filteredRows).passed, [filteredRows]);
  const failCount = useMemo(() => summarizeJournalRows(filteredRows).errors, [filteredRows]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  async function handleCreate(values: JournalFormValues) {
    setSaving(true);
    try {
      const year = Number(values.performedAt.slice(0, 4)) || new Date().getFullYear();
      await insertWeldJournalEntry({
        ma_lich_su: values.ma_lich_su,
        du_an_id: values.du_an_id,
        tho_han_id: values.tho_han_id,
        nam_thuc_hien: year,
        loai_ray: values.loai_ray,
        loai_moi_han: values.loai_moi_han,
        cong_nghe_han: values.cong_nghe_han,
        so_luong_loi: values.result === "Không đạt" ? 1 : 0,
        nguyen_nhan_loi: values.result === "Không đạt" ? values.nguyen_nhan_loi : null,
        ghi_chu: values.ghi_chu || null,
        moi_han_lien_ket: values.moi_han_lien_ket || null,
        may_id: values.may_id,
        chung_chi_su_dung: values.chung_chi_su_dung,
      });
      setFormOpen(false);
      refetch();
      showToast("Đã thêm nhật ký hàn");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể lưu nhật ký hàn");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1568px] px-4 sm:px-6 pb-8">
      <div className={`mb-4 rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải dữ liệu Supabase…"
            : `Supabase · ${rows.length} dòng lịch sử · ${journalRows.length} bản ghi nhật ký`}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{journalRows.length}</strong> bản ghi
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{passCount}</strong> đạt ·{" "}
          <strong className="font-semibold text-rose-700 font-mono tabular-nums">{failCount}</strong> không đạt
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-2.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm ID, thợ hàn, máy, dự án…"
          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
        />
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
        >
          <option>Tất cả</option>
          <option>Đạt</option>
          <option>Không đạt</option>
        </select>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm nhật ký
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">NHẬT KÝ HÀN</div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#0047AB]">
            {gpsLoading ? "Đang ghép GPS…" : `${journalRows.length} bản ghi`}
          </span>
        </div>

        <div className="table-scroll overflow-x-auto mt-3.5 -mx-1 px-1">
          <table className="w-full min-w-[1480px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="p-2.5 font-semibold">ID</th>
                <th className="p-2.5 font-semibold">Ngày giờ</th>
                <th className="p-2.5 font-semibold">Nhân sự phụ trách</th>
                <th className="min-w-[260px] p-2.5 font-semibold">Chứng chỉ</th>
                <th className="p-2.5 font-semibold">Máy</th>
                <th className="p-2.5 font-semibold">Tên mối hàn</th>
                <th className="p-2.5 font-semibold">Mối hàn liên kết</th>
                <th className="p-2.5 font-semibold">Dự án</th>
                <th className="p-2.5 font-semibold">Vị trí</th>
                <th className="p-2.5 font-semibold">Lý do không đạt</th>
                <th className="p-2.5 font-semibold">Tình trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journalRows.map((w) => (
                <tr key={w.id} className="text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 transition-colors">
                  <td className="p-2.5 truncate font-mono text-xs text-slate-500 max-w-[90px]" title={w.id}>
                    {w.id.slice(0, 8)}
                  </td>
                  <td className="p-2.5 whitespace-nowrap font-mono text-xs text-slate-500">{w.dateTime}</td>
                  <td className="p-2.5 font-semibold text-slate-900">{w.operator}</td>
                  <td className="p-2.5">
                    <span className="line-clamp-2 text-xs leading-relaxed text-slate-700" title={w.certificate}>
                      {w.certificate}
                    </span>
                  </td>
                  <td className="p-2.5 max-w-[190px]">
                    <span className={`line-clamp-2 text-xs font-semibold ${w.machine === "Chưa gán máy" ? "text-amber-700" : "text-[#0047AB]"}`} title={w.machine}>
                      {w.machine}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono font-semibold text-[#0047AB]">{w.weldName}</td>
                  <td className="p-2.5 font-mono text-xs text-slate-700 max-w-[160px]">
                    <span className="line-clamp-2" title={w.linkedWeld}>
                      {w.linkedWeld}
                    </span>
                  </td>
                  <td className="p-2.5 max-w-[220px]">
                    <span className="line-clamp-2" title={w.project}>
                      {w.project}
                    </span>
                  </td>
                  <td className="p-2.5 max-w-[180px]">
                    {w.mapUrl ? (
                      <a
                        href={w.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={w.location}
                        className="line-clamp-2 text-xs font-medium text-[#0047AB] hover:underline"
                      >
                        {w.location}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">{w.location}</span>
                    )}
                  </td>
                  <td
                    className={`p-2.5 max-w-[180px] ${w.resultType === "fail" ? "line-clamp-2 text-xs font-medium text-rose-700" : "text-slate-400"}`}
                  >
                    {w.failureReason}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {w.resultType === "pass" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Đạt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-700 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Không đạt
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {journalRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-500">
                    Không có nhật ký hàn phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-3 text-xs text-slate-500">
          {gpsError
            ? `GPS dự phòng: ${gpsError}`
            : "Tên mối hàn và vị trí lấy từ GPS theo thứ tự điểm; ngày giờ được mô phỏng từ năm thực hiện."}
        </div>
      </div>

      <JournalFormModal
        open={formOpen}
        projects={projectOptions}
        welders={welderOptions}
        machines={machineOptions}
        rows={rows}
        saving={saving}
        onClose={() => !saving && setFormOpen(false)}
        onSubmit={handleCreate}
      />

      {machineError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Chưa tải được danh mục máy: {machineError}. Hãy chạy supabase/lich_chay_may.sql.
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl border border-white/10 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </main>
  );
}
