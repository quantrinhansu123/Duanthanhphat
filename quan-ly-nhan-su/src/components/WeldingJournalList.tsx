"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { googleOpenPoint } from "@/data/mapPoints";
import type { MachineOption } from "@/data/machineAssignments";
import { useWeldLogGpsPoints } from "@/hooks/useWeldLogGpsPoints";
import { loadMachineOptions } from "@/lib/machineRunSchedulesDb";
import { loadPersonnelCertificateOptions } from "@/lib/personnelCertificatesDb";
import {
  fetchFailedWeldsInDateRange,
  formatJournalDateIso,
  insertWeldJournalEntry,
  invalidateWeldReportCache,
  loadJournalProjectOptions,
  loadWeldCodesWithPrefix,
  loadWeldJournalPage,
  syncAllWeldCodes,
  type CertifiedWelderOption,
  type WeldReportRow,
} from "@/lib/weldReportData";
import { buildWeldCodePrefix, suggestWeldCode, WELD_CODE_SITE_PREFIX } from "@/lib/weldCode";
import {
  describeCertificateRequirement,
  eligibleCertificatesForWeld,
  hasCertificate,
} from "@/lib/weldingCertificates";

const PAGE_SIZE = 50;

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
  const machine = machines[0];
  const context = {
    railType: "UIC60",
    method: "FBW" as const,
    machineCode: machine?.code,
    machineName: machine?.name,
  };
  const welder = welders.find(
    (item) => eligibleCertificatesForWeld(item.certificates, context).length > 0,
  );
  return {
    ma_lich_su: "",
    performedAt: defaultPerformedAt(),
    du_an_id: projects[0]?.id ?? "",
    tho_han_id: welder?.id ?? "",
    may_id: machine?.id ?? "",
    loai_ray: "UIC60",
    cong_nghe_han: "FBW",
    loai_moi_han: "Sản xuất",
    result: "Đạt",
    nguyen_nhan_loi: "",
    moi_han_lien_ket: "",
    chung_chi_su_dung: welder
      ? eligibleCertificatesForWeld(welder.certificates, context)[0] ?? ""
      : "",
    ghi_chu: "",
  };
}

function JournalFormModal({
  open,
  projects,
  welders,
  machines,
  existingCodes,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  projects: { id: string; label: string }[];
  welders: CertifiedWelderOption[];
  machines: MachineOption[];
  existingCodes: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: JournalFormValues) => void;
}) {
  const [form, setForm] = useState(() => emptyJournalForm(projects, welders, machines));
  const [linkDateFrom, setLinkDateFrom] = useState(() => defaultLinkDateRange().from);
  const [linkDateTo, setLinkDateTo] = useState(() => defaultLinkDateRange().to);
  const [failedWeldOptions, setFailedWeldOptions] = useState<
    { value: string; label: string; isoDate: string }[]
  >([]);
  const [prefixCodes, setPrefixCodes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetchFailedWeldsInDateRange(linkDateFrom, linkDateTo)
      .then((options) => {
        if (active) setFailedWeldOptions(options);
      })
      .catch(() => {
        if (active) setFailedWeldOptions([]);
      });
    return () => {
      active = false;
    };
  }, [linkDateFrom, linkDateTo]);

  const selectedMachine = machines.find((machine) => machine.id === form.may_id);
  const qualificationContext = useMemo(
    () => ({
      railType: form.loai_ray,
      method: form.cong_nghe_han,
      machineCode: selectedMachine?.code,
      machineName: selectedMachine?.name,
    }),
    [form.loai_ray, form.cong_nghe_han, selectedMachine?.code, selectedMachine?.name],
  );
  const qualifiedWelders = useMemo(
    () => welders.filter(
      (welder) => eligibleCertificatesForWeld(welder.certificates, qualificationContext).length > 0,
    ),
    [welders, qualificationContext],
  );
  const selectedWelder = welders.find((welder) => welder.id === form.tho_han_id);
  const selectedEligibleCertificates = selectedWelder
    ? eligibleCertificatesForWeld(selectedWelder.certificates, qualificationContext)
    : [];

  useEffect(() => {
    if (open) {
      setForm(emptyJournalForm(projects, welders, machines));
      const range = defaultLinkDateRange();
      setLinkDateFrom(range.from);
      setLinkDateTo(range.to);
    }
  }, [open, projects, welders, machines]);

  useEffect(() => {
    if (!open) return;
    const prefix = buildWeldCodePrefix(form.cong_nghe_han, form.performedAt);
    if (!prefix) {
      setPrefixCodes([]);
      return;
    }
    let active = true;
    loadWeldCodesWithPrefix(prefix)
      .then((codes) => {
        if (active) setPrefixCodes(codes);
      })
      .catch(() => {
        if (active) setPrefixCodes([]);
      });
    return () => {
      active = false;
    };
  }, [open, form.cong_nghe_han, form.performedAt]);

  useEffect(() => {
    if (!open) return;
    const codes = Array.from(new Set([...existingCodes, ...prefixCodes]));
    const nextCode = suggestWeldCode(form.cong_nghe_han, form.performedAt, codes);
    if (!nextCode || form.ma_lich_su === nextCode) return;
    setForm((prev) => ({ ...prev, ma_lich_su: nextCode }));
  }, [open, form.cong_nghe_han, form.performedAt, form.ma_lich_su, existingCodes, prefixCodes]);

  useEffect(() => {
    const selectedIsQualified = qualifiedWelders.some((welder) => welder.id === form.tho_han_id);
    const nextWelderId = selectedIsQualified ? form.tho_han_id : qualifiedWelders[0]?.id ?? "";
    const nextWelder = welders.find((welder) => welder.id === nextWelderId);
    const eligibleCertificates = nextWelder
      ? eligibleCertificatesForWeld(nextWelder.certificates, qualificationContext)
      : [];
    const nextCertificate = eligibleCertificates.includes(form.chung_chi_su_dung)
      ? form.chung_chi_su_dung
      : eligibleCertificates[0] ?? "";
    if (form.chung_chi_su_dung === nextCertificate && form.tho_han_id === nextWelderId) return;
    setForm((prev) => ({
      ...prev,
      tho_han_id: nextWelderId,
      chung_chi_su_dung: nextCertificate,
    }));
  }, [form.chung_chi_su_dung, form.tho_han_id, qualifiedWelders, qualificationContext, welders]);

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
      window.alert("Chưa tạo được mã mối hàn. Kiểm tra ngày thực hiện.");
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
    if (!selectedWelder || selectedEligibleCertificates.length === 0) {
      window.alert(`Nhân sự được chọn chưa có ${describeCertificateRequirement(qualificationContext)}.`);
      return;
    }
    if (!form.chung_chi_su_dung || !selectedEligibleCertificates.includes(form.chung_chi_su_dung)) {
      window.alert("Vui lòng chọn đúng chứng chỉ của nhân sự được sử dụng cho mối hàn.");
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
              Mã mối hàn
              <input
                readOnly
                value={form.ma_lich_su}
                placeholder={`${WELD_CODE_SITE_PREFIX}FBW1208260001`}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden font-mono"
              />
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                Tự tạo: {WELD_CODE_SITE_PREFIX} + công nghệ + ngày/tháng/năm + số TT (VD: {WELD_CODE_SITE_PREFIX}FBW1208260001)
              </span>
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
                  <option key={w.id} value={w.id} disabled={!qualifiedWelders.some((item) => item.id === w.id)}>
                    {w.label}{qualifiedWelders.some((item) => item.id === w.id) ? " · Đủ chứng chỉ" : " · Thiếu chứng chỉ"}
                  </option>
                ))
              )}
            </select>
            <span className={`mt-1.5 block rounded-lg border px-2.5 py-2 text-[11px] font-medium ${qualifiedWelders.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              Yêu cầu: {describeCertificateRequirement(qualificationContext)} · {qualifiedWelders.length} nhân sự phù hợp
            </span>
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Chứng chỉ sử dụng
            <select
              value={form.chung_chi_su_dung}
              onChange={(e) => setForm({ ...form, chung_chi_su_dung: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
            >
              {selectedEligibleCertificates.length === 0 ? (
                <option value="">Chưa có chứng chỉ phù hợp</option>
              ) : (
                selectedEligibleCertificates.map((certificate) => (
                  <option key={certificate} value={certificate}>{certificate}</option>
                ))
              )}
            </select>
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
  const { points: gpsPoints, loading: gpsLoading, error: gpsError } = useWeldLogGpsPoints(500);

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [project, setProject] = useState("Tất cả dự án");
  const [resultFilter, setResultFilter] = useState("Tất cả");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WeldReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingCodes, setSyncingCodes] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [toast, setToast] = useState("");
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);
  const [machineError, setMachineError] = useState("");
  const [personnelWelderOptions, setPersonnelWelderOptions] = useState<CertifiedWelderOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

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

  useEffect(() => {
    let active = true;
    loadPersonnelCertificateOptions()
      .then((options) => {
        if (active) setPersonnelWelderOptions(options);
      })
      .catch(() => {
        if (active) setPersonnelWelderOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadJournalProjectOptions()
      .then((options) => {
        if (active) setProjectOptions(options);
      })
      .catch(() => {
        if (active) setProjectOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadWeldJournalPage({
      page,
      pageSize: PAGE_SIZE,
      query: appliedQuery,
      project,
      resultFilter,
    })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setPassCount(result.passCount);
        setFailCount(result.failCount);
      })
      .catch((loadError) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setPassCount(0);
        setFailCount(0);
        setError(loadError instanceof Error ? loadError.message : "Không tải được nhật ký hàn");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, appliedQuery, project, resultFilter, reloadToken]);

  const welderOptions = personnelWelderOptions;
  const projects = useMemo(
    () => ["Tất cả dự án", ...projectOptions.map((item) => item.label)],
    [projectOptions],
  );

  const pageRows = useMemo(() => {
    const gpsByWeldCode = new Map(
      gpsPoints.map((point) => [point.code.trim().toLocaleLowerCase("vi"), point]),
    );
    return rows.map((row) => {
      const gpsPoint = gpsByWeldCode.get(row.ma_lich_su.trim().toLocaleLowerCase("vi")) ?? null;
      const isoDate = row.ngay_thuc_hien?.slice(0, 10) ?? "";
      const performedDate = isoDate ? formatJournalDateIso(isoDate) : `Chỉ có năm ${row.nam_thuc_hien}`;
      const pass = row.so_luong_loi === 0;
      const certificate = row.chung_chi_su_dung?.trim() || "Chưa ghi chứng chỉ sử dụng";
      const certificateLinked = row.chung_chi_su_dung
        ? hasCertificate(row.chung_chi_nhan_su, row.chung_chi_su_dung)
        : false;
      return {
        id: row.id,
        performedDate,
        operator: row.ten_tho_han?.trim() || "—",
        certificate,
        certificateLinked,
        machine: row.ma_may
          ? `${row.ma_may}${row.ten_may ? ` · ${row.ten_may}` : ""}`
          : "Chưa gán máy",
        weldName: row.ma_lich_su,
        linkedWeld: row.moi_han_lien_ket?.trim() || "—",
        project: row.du_an,
        location: gpsPoint
          ? `${gpsPoint.chainage} · ${gpsPoint.latitude.toFixed(6)}, ${gpsPoint.longitude.toFixed(6)}`
          : "Chưa liên kết GPS",
        mapUrl: gpsPoint ? googleOpenPoint(gpsPoint.latitude, gpsPoint.longitude) : "",
        failureReason: pass
          ? "—"
          : row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân",
        resultType: pass ? ("pass" as const) : ("fail" as const),
      };
    });
  }, [rows, gpsPoints]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(currentPage * PAGE_SIZE, total);

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, project, resultFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const refetch = useCallback(() => {
    invalidateWeldReportCache();
    setReloadToken((token) => token + 1);
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  async function handleSyncAllCodes() {
    if (syncingCodes || saving) return;
    const ok = window.confirm(
      "Đồng bộ toàn bộ mã mối hàn theo chuẩn PHQ + công nghệ + ngày/tháng/năm + số TT?\nThao tác này sẽ ghi đè mã hiện tại trong database.",
    );
    if (!ok) return;
    setSyncingCodes(true);
    setSyncProgress("Bắt đầu đồng bộ…");
    try {
      const result = await syncAllWeldCodes((message) => setSyncProgress(message));
      refetch();
      showToast(
        result.updated === 0
          ? `Không cần đổi mã · ${result.total.toLocaleString("vi-VN")} bản ghi đã đúng chuẩn`
          : `Đã đồng bộ ${result.updated.toLocaleString("vi-VN")}/${result.total.toLocaleString("vi-VN")} mã mối hàn`,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể đồng bộ mã mối hàn");
    } finally {
      setSyncingCodes(false);
      setSyncProgress("");
    }
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
        ngay_thuc_hien: values.performedAt.slice(0, 10),
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
            ? "Đang tải trang nhật ký…"
            : `Supabase · trang ${currentPage}/${totalPages} · ${PAGE_SIZE} dòng/trang · tổng ${total.toLocaleString("vi-VN")} bản ghi`}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{total.toLocaleString("vi-VN")}</strong> bản ghi
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{passCount.toLocaleString("vi-VN")}</strong> đạt ·{" "}
          <strong className="font-semibold text-rose-700 font-mono tabular-nums">{failCount.toLocaleString("vi-VN")}</strong> không đạt
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
          onClick={handleSyncAllCodes}
          disabled={syncingCodes || saving || loading}
          title={syncProgress || "Đồng bộ toàn bộ mã mối hàn theo chuẩn PHQ…"}
          className="inline-flex h-10 max-w-[280px] shrink-0 items-center justify-center gap-1.5 truncate rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 transition-all duration-150 cursor-pointer"
        >
          {syncingCodes ? (syncProgress || "Đang đồng bộ…") : "Đồng bộ mã mối hàn"}
        </button>
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
            {gpsLoading
              ? "Đang ghép GPS…"
              : `${pageFrom}–${pageTo} / ${total.toLocaleString("vi-VN")} · ${PAGE_SIZE}/trang`}
          </span>
        </div>

        <div className="table-scroll overflow-x-auto mt-3.5 -mx-1 px-1">
          <table className="w-full min-w-[1480px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="p-2.5 font-semibold">ID</th>
                <th className="p-2.5 font-semibold">Ngày thực hiện</th>
                <th className="p-2.5 font-semibold">Nhân sự phụ trách</th>
                <th className="min-w-[260px] p-2.5 font-semibold">Chứng chỉ</th>
                <th className="p-2.5 font-semibold">Máy</th>
                <th className="p-2.5 font-semibold">Mã mối hàn</th>
                <th className="p-2.5 font-semibold">Mối hàn liên kết</th>
                <th className="p-2.5 font-semibold">Dự án</th>
                <th className="p-2.5 font-semibold">Vị trí</th>
                <th className="p-2.5 font-semibold">Lý do không đạt</th>
                <th className="p-2.5 font-semibold">Tình trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((w) => (
                <tr key={w.id} className="text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 transition-colors">
                  <td className="p-2.5 truncate font-mono text-xs text-slate-500 max-w-[90px]" title={w.id}>
                    {w.id.slice(0, 8)}
                  </td>
                  <td className="p-2.5 whitespace-nowrap font-mono text-xs text-slate-500">{w.performedDate}</td>
                  <td className="p-2.5 font-semibold text-slate-900">{w.operator}</td>
                  <td className="p-2.5">
                    <span className={`line-clamp-2 text-xs leading-relaxed ${w.certificateLinked ? "text-emerald-700" : "text-amber-700"}`} title={w.certificate}>
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
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-500">
                    Không có nhật ký hàn phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-500">
            Trang <strong className="font-mono text-slate-800">{currentPage}</strong> /{" "}
            <strong className="font-mono text-slate-800">{totalPages}</strong>
            {" · "}
            Hiển thị <strong className="font-mono text-slate-800">{pageFrom}–{pageTo}</strong> trên{" "}
            <strong className="font-mono text-slate-800">{total.toLocaleString("vi-VN")}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>

        <div className="pt-3 text-xs text-slate-500">
          {gpsError
            ? `GPS dự phòng: ${gpsError}`
            : "Mã mối hàn, ngày và nhân sự lấy trực tiếp từ Supabase; GPS chỉ hiện khi mã điểm trùng chính xác mã mối hàn."}
        </div>
      </div>

      <JournalFormModal
        open={formOpen}
        projects={projectOptions}
        welders={welderOptions}
        machines={machineOptions}
        existingCodes={rows.map((row) => row.ma_lich_su)}
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
