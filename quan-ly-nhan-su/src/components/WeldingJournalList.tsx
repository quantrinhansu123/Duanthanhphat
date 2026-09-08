"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { DownloadSimple, PencilSimple } from "@/components/icons";
import { googleOpenPoint, type MapPoint } from "@/data/mapPoints";
import type { MachineOption } from "@/data/machineAssignments";
import { useWeldLogGpsPoints } from "@/hooks/useWeldLogGpsPoints";
import { useCatalogOptions } from "@/hooks/useSystemCatalogs";
import { loadMachineOptions } from "@/lib/machineRunSchedulesDb";
import { deleteMapPoint, insertMapPoint, linkGpsPointToWeld } from "@/lib/mapPointsDb";
import {
  loadPersonnelCertificateOptions,
  loadPersonnelCertificateRows,
} from "@/lib/personnelCertificatesDb";
import {
  downloadWeldJournalExcelTemplate,
  parseWeldJournalExcel,
} from "@/lib/parseWeldJournalExcel";
import {
  fetchFailedWeldsInDateRange,
  exportFilteredWeldJournal,
  formatJournalDateIso,
  insertWeldJournalEntry,
  invalidateWeldReportCache,
  loadJournalProjectOptions,
  loadWeldCodesWithPrefix,
  loadWeldJournalPage,
  resolveWeldTestStatus,
  syncAllWeldCodes,
  updateWeldJournalEntry,
  type CertifiedWelderOption,
  type WeldReportRow,
  type WeldTestStatus,
} from "@/lib/weldReportData";
import { buildWeldCodePrefix, suggestWeldCode, WELD_CODE_SITE_PREFIX } from "@/lib/weldCode";
import {
  describeCertificateRequirement,
  eligibleCertificatesForWeld,
  hasCertificate,
  parseCertificateList,
} from "@/lib/weldingCertificates";
import { NDT_DEFECTS } from "@/data/error-library";
import { createClient } from "@/lib/supabase/client";

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
  result: WeldTestStatus;
  ma_khuyet_tat: string[];
  nguyen_nhan_loi: string;
  moi_han_lien_ket: string;
  chung_chi_su_dung: string;
  ghi_chu: string;
  toa_do_id: string;
  ly_trinh: string;
  kinh_do: string;
  vi_do: string;
};

function isInternalTrainingProject(label: string) {
  return label.trim().toLocaleLowerCase("vi") === "đào tạo nội bộ";
}

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
  const project = projects[0];
  const isInternalTraining = isInternalTrainingProject(project?.label ?? "");
  const context = {
    railType: "P50",
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
    du_an_id: project?.id ?? "",
    tho_han_id: welder?.id ?? "",
    may_id: machine?.id ?? "",
    loai_ray: "P50",
    cong_nghe_han: "FBW",
    loai_moi_han: isInternalTraining ? "Đào tạo" : "Sản xuất",
    result: isInternalTraining ? "Không thí nghiệm" : "Chờ thí nghiệm",
    ma_khuyet_tat: [],
    nguyen_nhan_loi: "",
    moi_han_lien_ket: "",
    chung_chi_su_dung: welder
      ? eligibleCertificatesForWeld(welder.certificates, context)[0] ?? ""
      : "",
    ghi_chu: "",
    toa_do_id: "",
    ly_trinh: "",
    kinh_do: "",
    vi_do: "",
  };
}

function journalRowToForm(
  row: WeldReportRow,
  gpsPoint: MapPoint | null,
): JournalFormValues {
  return {
    ma_lich_su: row.ma_lich_su,
    performedAt: `${(row.ngay_thuc_hien?.slice(0, 10) || `${row.nam_thuc_hien}-01-01`)}T08:00`,
    du_an_id: row.du_an_id,
    tho_han_id: row.tho_han_id,
    may_id: row.may_id || "",
    loai_ray: row.loai_ray,
    cong_nghe_han: row.cong_nghe_han,
    loai_moi_han: row.loai_moi_han,
    result: resolveWeldTestStatus(row),
    ma_khuyet_tat: row.ma_khuyet_tat ?? [],
    nguyen_nhan_loi: row.nguyen_nhan_loi ?? "",
    moi_han_lien_ket: row.moi_han_lien_ket ?? "",
    chung_chi_su_dung: row.chung_chi_su_dung ?? "",
    ghi_chu: row.ghi_chu ?? "",
    toa_do_id: gpsPoint?.id ?? "",
    ly_trinh: gpsPoint?.chainage ?? "",
    kinh_do: gpsPoint ? String(gpsPoint.longitude) : "",
    vi_do: gpsPoint ? String(gpsPoint.latitude) : "",
  };
}

function JournalFormModal({
  open,
  mode = "create",
  initial,
  projects,
  welders,
  machines,
  existingCodes,
  saving,
  unlinkedGpsPoints = [],
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode?: "create" | "edit";
  initial?: JournalFormValues | null;
  projects: { id: string; label: string }[];
  welders: CertifiedWelderOption[];
  machines: MachineOption[];
  existingCodes: string[];
  saving: boolean;
  unlinkedGpsPoints?: MapPoint[];
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
  const railOptions = useCatalogOptions("Loại ray");

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
      setForm(initial ?? emptyJournalForm(projects, welders, machines));
      const range = defaultLinkDateRange();
      setLinkDateFrom(range.from);
      setLinkDateTo(range.to);
    }
  }, [open, initial, projects, welders, machines]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit") return;
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
  }, [mode, open, form.cong_nghe_han, form.performedAt]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit") return;
    const codes = Array.from(new Set([...existingCodes, ...prefixCodes]));
    const nextCode = suggestWeldCode(form.cong_nghe_han, form.performedAt, codes);
    if (!nextCode || form.ma_lich_su === nextCode) return;
    setForm((prev) => ({ ...prev, ma_lich_su: nextCode }));
  }, [mode, open, form.cong_nghe_han, form.performedAt, form.ma_lich_su, existingCodes, prefixCodes]);

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
    if (form.performedAt.slice(0, 10) > defaultPerformedAt().slice(0, 10)) {
      window.alert("Ngày thực hiện không được lớn hơn ngày hiện tại.");
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
    if (form.result === "Không đạt" && form.ma_khuyet_tat.length === 0 && !form.nguyen_nhan_loi.trim()) {
      window.alert("Vui lòng chọn ít nhất một mã khuyết tật hoặc nhập lý do không đạt.");
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
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              {mode === "edit" ? "Sửa nhật ký hàn" : "Thêm nhật ký hàn"}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {mode === "edit" ? form.ma_lich_su || "Bản ghi nhật ký" : "Bản ghi mới"}
            </h2>
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
                max={defaultPerformedAt()}
                onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Tình trạng thí nghiệm
              <select
                value={form.result}
                onChange={(e) => setForm({ ...form, result: e.target.value as JournalFormValues["result"] })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 cursor-pointer"
              >
                <option>Chờ thí nghiệm</option>
                <option>Đạt</option>
                <option>Không đạt</option>
                <option>Không thí nghiệm</option>
              </select>
            </label>
          </div>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Người trực tiếp hàn
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
              onChange={(e) => {
                const projectId = e.target.value;
                const internalTraining = isInternalTrainingProject(
                  projects.find((project) => project.id === projectId)?.label ?? "",
                );
                setForm((current) => ({
                  ...current,
                  du_an_id: projectId,
                  loai_moi_han: internalTraining
                    ? "Đào tạo"
                    : current.loai_moi_han === "Đào tạo"
                      ? "Sản xuất"
                      : current.loai_moi_han,
                  result: internalTraining
                    ? "Không thí nghiệm"
                    : current.result === "Không thí nghiệm"
                      ? "Chờ thí nghiệm"
                      : current.result,
                }));
              }}
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
              <select
                value={form.loai_ray}
                onChange={(e) => setForm({ ...form, loai_ray: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              >
                {railOptions.map((rail) => <option key={rail}>{rail}</option>)}
              </select>
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
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-800">
                  Mã khuyết tật mối hàn (NDT) — Chọn một hoặc nhiều mã
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NDT_DEFECTS.map((defect) => {
                    const isSelected = form.ma_khuyet_tat.includes(defect.code);
                    return (
                      <button
                        key={defect.code}
                        type="button"
                        onClick={() => {
                          const next = isSelected
                            ? form.ma_khuyet_tat.filter((c) => c !== defect.code)
                            : [...form.ma_khuyet_tat, defect.code];
                          setForm({ ...form, ma_khuyet_tat: next });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-white text-slate-700 border border-slate-300 hover:border-rose-300 hover:bg-rose-50"
                        }`}
                      >
                        <span className="font-mono">{defect.code}</span>
                        <span className="font-normal opacity-90 text-[11px]">— {defect.nameEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Ghi chú nguyên nhân / lỗi bổ sung (tùy chọn)
                <textarea
                  value={form.nguyen_nhan_loi}
                  onChange={(e) => setForm({ ...form, nguyen_nhan_loi: e.target.value })}
                  rows={2}
                  placeholder="Ghi chú thêm về vị trí khuyết tật, nguyên nhân..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 resize-y"
                />
              </label>
            </div>
          )}

          {/* Tọa độ GPS */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              Vị trí & Tọa độ GPS (Tùy chọn)
            </div>
            {unlinkedGpsPoints && unlinkedGpsPoints.length > 0 && (
              <div className="mt-2.5">
                <label className="block text-xs font-semibold text-slate-600">
                  Gán điểm GPS có sẵn (chưa liên kết)
                  <select
                    value={form.toa_do_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const pt = unlinkedGpsPoints.find((p) => p.id === id);
                      if (pt) {
                        setForm((prev) => ({
                          ...prev,
                          toa_do_id: id,
                          ly_trinh: pt.chainage || prev.ly_trinh,
                          kinh_do: String(pt.longitude),
                          vi_do: String(pt.latitude),
                        }));
                      } else {
                        setForm((prev) => ({ ...prev, toa_do_id: "" }));
                      }
                    }}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  >
                    <option value="">— Nhập mới hoặc không gán điểm có sẵn —</option>
                    {unlinkedGpsPoints.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.code} ({pt.chainage}) — {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-600">
                Lý trình
                <input
                  value={form.ly_trinh}
                  onChange={(e) => setForm({ ...form, ly_trinh: e.target.value })}
                  placeholder="Km0+250.00"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Kinh độ (lon)
                <input
                  value={form.kinh_do}
                  onChange={(e) => setForm({ ...form, kinh_do: e.target.value })}
                  placeholder="105.8427"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 outline-hidden focus:border-[#0047AB]"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Vĩ độ (lat)
                <input
                  value={form.vi_do}
                  onChange={(e) => setForm({ ...form, vi_do: e.target.value })}
                  placeholder="21.0160"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 outline-hidden focus:border-[#0047AB]"
                />
              </label>
            </div>
          </div>

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
            {saving ? "Đang lưu…" : mode === "edit" ? "Lưu thay đổi" : "Thêm nhật ký"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WeldingJournalList() {
  const { points: gpsPoints, loading: gpsLoading, error: gpsError } = useWeldLogGpsPoints();

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
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");
  const [editingRow, setEditingRow] = useState<WeldReportRow | null>(null);
  const [editingForm, setEditingForm] = useState<JournalFormValues | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);
  const [machineError, setMachineError] = useState("");
  const [personnelWelderOptions, setPersonnelWelderOptions] = useState<CertifiedWelderOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("query")?.trim() || "";
    if (initialQuery) {
      setQuery(initialQuery);
      setAppliedQuery(initialQuery);
    }
  }, []);

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
    const gpsByWeldId = new Map(
      gpsPoints.filter((point) => point.weldId).map((point) => [point.weldId!, point]),
    );
    const gpsByWeldCode = new Map(
      gpsPoints.filter((point) => point.weldCode).map((point) => [point.weldCode!.trim().toLocaleLowerCase("vi"), point]),
    );
    const gpsByPointCode = new Map(
      gpsPoints.map((point) => [point.code.trim().toLocaleLowerCase("vi"), point]),
    );
    return rows.map((row) => {
      const codeKey = row.ma_lich_su.trim().toLocaleLowerCase("vi");
      const gpsPoint =
        gpsByWeldId.get(row.id) ??
        gpsByWeldCode.get(codeKey) ??
        gpsByPointCode.get(codeKey) ??
        null;
      const isoDate = row.ngay_thuc_hien?.slice(0, 10) ?? "";
      const performedDate = isoDate ? formatJournalDateIso(isoDate) : `Chỉ có năm ${row.nam_thuc_hien}`;
      const pass = row.so_luong_loi === 0;
      const testStatus = resolveWeldTestStatus(row);
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
          : (row.ma_khuyet_tat && row.ma_khuyet_tat.length > 0)
            ? `${row.ma_khuyet_tat.join(", ")}${row.nguyen_nhan_loi ? ` · ${row.nguyen_nhan_loi}` : ""}`
            : (row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân"),
        resultType: pass ? ("pass" as const) : ("fail" as const),
        testStatus,
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

  async function handleExportExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const exportRows = await exportFilteredWeldJournal({
        query: appliedQuery,
        project,
        resultFilter,
      });

      const gpsByWeldId = new Map(
        gpsPoints.filter((point) => point.weldId).map((point) => [point.weldId!, point]),
      );
      const gpsByWeldCode = new Map(
        gpsPoints
          .filter((point) => point.weldCode)
          .map((point) => [point.weldCode!.trim().toLocaleLowerCase("vi"), point]),
      );
      const gpsByPointCode = new Map(
        gpsPoints.map((point) => [point.code.trim().toLocaleLowerCase("vi"), point]),
      );

      const data = exportRows.map((row, index) => {
        const codeKey = row.ma_lich_su.trim().toLocaleLowerCase("vi");
        const gpsPoint =
          gpsByWeldId.get(row.id) ??
          gpsByWeldCode.get(codeKey) ??
          gpsByPointCode.get(codeKey) ??
          null;
        const isoDate = row.ngay_thuc_hien?.slice(0, 10) ?? "";

        return {
          STT: index + 1,
          "Ngày thực hiện": isoDate ? formatJournalDateIso(isoDate) : `Chỉ có năm ${row.nam_thuc_hien}`,
          "Mã bản ghi": row.id,
          "Mã mối hàn": row.ma_lich_su,
          "Mối hàn liên kết": row.moi_han_lien_ket?.trim() || "",
          "Welding ID": row.ma_nhan_su,
          "Người trực tiếp hàn": row.ten_tho_han,
          "Tổ hàn": row.to_han?.trim() || "",
          "Chứng chỉ sử dụng": row.chung_chi_su_dung?.trim() || "",
          "Mã máy": row.ma_may?.trim() || "",
          "Tên máy": row.ten_may?.trim() || "",
          "Mã dự án": row.ma_du_an,
          "Dự án": row.du_an,
          "Loại ray": row.loai_ray,
          "Công nghệ hàn": row.cong_nghe_han,
          "Loại mối hàn": row.loai_moi_han,
          "Lý trình": gpsPoint?.chainage || "",
          "Vĩ độ": gpsPoint?.latitude ?? "",
          "Kinh độ": gpsPoint?.longitude ?? "",
          "Mã khuyết tật": row.ma_khuyet_tat?.join(", ") || "",
          "Lý do không đạt": row.nguyen_nhan_loi?.trim() || "",
          "Tình trạng thí nghiệm": resolveWeldTestStatus(row),
          "Ghi chú": row.ghi_chu?.trim() || "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet["!cols"] = [
        { wch: 7 }, { wch: 17 }, { wch: 38 }, { wch: 25 }, { wch: 22 },
        { wch: 16 }, { wch: 24 }, { wch: 15 }, { wch: 45 }, { wch: 18 },
        { wch: 30 }, { wch: 16 }, { wch: 48 }, { wch: 13 }, { wch: 16 },
        { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
        { wch: 36 }, { wch: 14 }, { wch: 36 },
      ];
      if (worksheet["!ref"]) worksheet["!autofilter"] = { ref: worksheet["!ref"] };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Nhật ký hàn");
      XLSX.writeFile(
        workbook,
        `Nhat_ky_moi_han_${defaultPerformedAt().slice(0, 10)}.xlsx`,
      );
      showToast(`Đã xuất ${exportRows.length.toLocaleString("vi-VN")} bản ghi ra Excel`);
    } catch (exportError) {
      window.alert(
        `Không thể xuất Excel: ${exportError instanceof Error ? exportError.message : String(exportError)}`,
      );
    } finally {
      setExporting(false);
    }
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

  async function handleImportExcel(file: File | null) {
    if (!file || importing || saving) return;
    setImporting(true);
    try {
      const parsed = await parseWeldJournalExcel(file);
      if (!parsed.rows.length) {
        window.alert(
          parsed.errors.length
            ? parsed.errors.slice(0, 10).join("\n")
            : "File không có dòng dữ liệu hợp lệ.",
        );
        return;
      }

      const supabase = createClient();
      const [{ data: projectRows }, personnelRows] = await Promise.all([
        supabase.from("du_an").select("id,du_an,ma_du_an"),
        loadPersonnelCertificateRows(),
      ]);

      const projectsDb = (projectRows ?? []) as Array<{
        id: string;
        du_an: string;
        ma_du_an: string | null;
      }>;

      const usedCodes = new Set<string>();
      let inserted = 0;
      const rowErrors: string[] = [...parsed.errors];

      for (let index = 0; index < parsed.rows.length; index++) {
        const row = parsed.rows[index];
        const project =
          projectsDb.find(
            (p) =>
              (row.ma_du_an &&
                (p.ma_du_an || "").trim().toLocaleLowerCase("vi") ===
                  row.ma_du_an.trim().toLocaleLowerCase("vi")) ||
              (row.du_an &&
                p.du_an.trim().toLocaleLowerCase("vi") === row.du_an.trim().toLocaleLowerCase("vi")),
          ) ?? null;
        if (!project) {
          rowErrors.push(`Dòng dữ liệu ${index + 1}: không tìm thấy dự án`);
          continue;
        }

        const personnel =
          personnelRows.find(
            (p) =>
              (row.ma_nhan_su &&
                (p.ma_nhan_su || "").trim().toLocaleLowerCase("vi") ===
                  row.ma_nhan_su.trim().toLocaleLowerCase("vi")) ||
              (row.ten_tho_han &&
                p.ho_ten.trim().toLocaleLowerCase("vi") ===
                  row.ten_tho_han.trim().toLocaleLowerCase("vi")),
          ) ?? null;
        if (!personnel) {
          rowErrors.push(`Dòng dữ liệu ${index + 1}: không tìm thấy thợ hàn`);
          continue;
        }

        const machine =
          machineOptions.find(
            (m) => m.code.trim().toLocaleLowerCase("vi") === row.ma_may.trim().toLocaleLowerCase("vi"),
          ) ?? null;
        if (!machine) {
          rowErrors.push(`Dòng dữ liệu ${index + 1}: không tìm thấy máy ${row.ma_may}`);
          continue;
        }

        const welderCerts = parseCertificateList(personnel.chung_chi);
        const context = {
          railType: row.loai_ray,
          method: row.cong_nghe_han,
          machineCode: machine.code,
          machineName: machine.name,
        };
        const eligible = eligibleCertificatesForWeld(welderCerts, context);
        const certificate =
          (row.chung_chi_su_dung &&
          eligible.some(
            (c) => c.toLocaleLowerCase("vi") === row.chung_chi_su_dung.toLocaleLowerCase("vi"),
          )
            ? row.chung_chi_su_dung
            : eligible[0]) || "";

        if (!certificate) {
          rowErrors.push(
            `Dòng dữ liệu ${index + 1}: thợ hàn chưa có chứng chỉ phù hợp (${describeCertificateRequirement(context)})`,
          );
          continue;
        }

        let maLichSu = row.ma_moi_han.trim();
        if (!maLichSu) {
          const prefix = buildWeldCodePrefix(row.cong_nghe_han, `${row.ngay_thuc_hien}T08:00`);
          const existing = await loadWeldCodesWithPrefix(prefix);
          const allExisting = [...existing, ...usedCodes];
          maLichSu = suggestWeldCode(row.cong_nghe_han, `${row.ngay_thuc_hien}T08:00`, allExisting);
        }
        usedCodes.add(maLichSu);

        try {
          await insertWeldJournalEntry({
            ma_lich_su: maLichSu,
            du_an_id: project.id,
            tho_han_id: personnel.employee_id,
            nam_thuc_hien: Number(row.ngay_thuc_hien.slice(0, 4)),
            ngay_thuc_hien: row.ngay_thuc_hien,
            loai_ray: row.loai_ray,
            loai_moi_han: row.loai_moi_han,
            cong_nghe_han: row.cong_nghe_han,
            so_luong_loi: row.tinh_trang_thi_nghiem === "Không đạt" ? 1 : 0,
            ma_khuyet_tat: row.tinh_trang_thi_nghiem === "Không đạt" ? row.ma_khuyet_tat : [],
            tinh_trang_thi_nghiem: row.tinh_trang_thi_nghiem,
            nguyen_nhan_loi:
              row.tinh_trang_thi_nghiem === "Không đạt"
                ? row.nguyen_nhan_loi || row.ma_khuyet_tat.join(", ") || null
                : null,
            ghi_chu: row.ghi_chu || null,
            moi_han_lien_ket: row.moi_han_lien_ket || null,
            may_id: machine.id,
            chung_chi_su_dung: certificate,
            hach_toan: row.hach_toan || "HT-SX01",
            toa_do_id: null,
            kinh_do: row.kinh_do,
            vi_do: row.vi_do,
            ly_trinh: row.ly_trinh || null,
          });
          inserted += 1;
        } catch (insertError) {
          rowErrors.push(
            `Dòng dữ liệu ${index + 1}: ${
              insertError instanceof Error ? insertError.message : String(insertError)
            }`,
          );
        }
      }

      refetch();
      const parts = [`Đã nhập ${inserted}/${parsed.rows.length} dòng từ Excel (${file.name}).`];
      if (rowErrors.length) parts.push(rowErrors.slice(0, 8).join("\n"));
      if (inserted > 0) showToast(`Đã nhập ${inserted} nhật ký từ Excel`);
      window.alert(parts.join("\n"));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không đọc được file Excel");
    } finally {
      setImporting(false);
    }
  }

  async function handleCreate(values: JournalFormValues) {
    setSaving(true);
    try {
      const year = Number(values.performedAt.slice(0, 4)) || new Date().getFullYear();
      const kinhDoNum = values.kinh_do ? Number(values.kinh_do.replace(",", ".")) : null;
      const viDoNum = values.vi_do ? Number(values.vi_do.replace(",", ".")) : null;
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
        ma_khuyet_tat: values.result === "Không đạt" ? values.ma_khuyet_tat : [],
        tinh_trang_thi_nghiem: values.result,
        nguyen_nhan_loi: values.result === "Không đạt"
          ? (values.nguyen_nhan_loi.trim() || values.ma_khuyet_tat.join(", "))
          : null,
        ghi_chu: values.ghi_chu || null,
        moi_han_lien_ket: values.moi_han_lien_ket || null,
        may_id: values.may_id,
        chung_chi_su_dung: values.chung_chi_su_dung,
        hach_toan: "HT-SX01",
        toa_do_id: values.toa_do_id || null,
        kinh_do: isNaN(kinhDoNum as number) ? null : kinhDoNum,
        vi_do: isNaN(viDoNum as number) ? null : viDoNum,
        ly_trinh: values.ly_trinh || null,
      });
      setFormOpen(false);
      setEditingRow(null);
      setEditingForm(null);
      refetch();
      showToast("Đã thêm nhật ký hàn");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể lưu nhật ký hàn");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(values: JournalFormValues) {
    if (!editingRow) return;
    setSaving(true);
    try {
      const year = Number(values.performedAt.slice(0, 4)) || new Date().getFullYear();
      const kinhDoNum = values.kinh_do ? Number(values.kinh_do.replace(",", ".")) : null;
      const viDoNum = values.vi_do ? Number(values.vi_do.replace(",", ".")) : null;
      const currentPoint = gpsPoints.find((point) => point.weldId === editingRow.id) ?? null;

      await updateWeldJournalEntry({
        id: editingRow.id,
        previousWeldCode: editingRow.ma_lich_su,
        ma_lich_su: values.ma_lich_su,
        du_an_id: values.du_an_id,
        tho_han_id: values.tho_han_id,
        nam_thuc_hien: year,
        ngay_thuc_hien: values.performedAt.slice(0, 10),
        loai_ray: values.loai_ray,
        loai_moi_han: values.loai_moi_han,
        cong_nghe_han: values.cong_nghe_han,
        so_luong_loi: values.result === "Không đạt" ? 1 : 0,
        ma_khuyet_tat: values.result === "Không đạt" ? values.ma_khuyet_tat : [],
        tinh_trang_thi_nghiem: values.result,
        nguyen_nhan_loi: values.result === "Không đạt"
          ? (values.nguyen_nhan_loi.trim() || values.ma_khuyet_tat.join(", "))
          : null,
        ghi_chu: values.ghi_chu || null,
        moi_han_lien_ket: values.moi_han_lien_ket || null,
        may_id: values.may_id,
        chung_chi_su_dung: values.chung_chi_su_dung,
        hach_toan: "HT-SX01",
        toa_do_id: values.toa_do_id || null,
        kinh_do: isNaN(kinhDoNum as number) ? null : kinhDoNum,
        vi_do: isNaN(viDoNum as number) ? null : viDoNum,
        ly_trinh: values.ly_trinh || null,
      });

      if (values.toa_do_id) {
        await linkGpsPointToWeld(values.toa_do_id, editingRow.id);
      } else if (kinhDoNum != null && viDoNum != null && Number.isFinite(kinhDoNum) && Number.isFinite(viDoNum)) {
        if (currentPoint) {
          await deleteMapPoint(currentPoint.id);
        }
        await insertMapPoint({
          code: values.ma_lich_su,
          longitude: kinhDoNum,
          latitude: viDoNum,
          chainage: values.ly_trinh || undefined,
          weldId: editingRow.id,
          weldCode: values.ma_lich_su,
        });
      } else if (currentPoint) {
        await deleteMapPoint(currentPoint.id);
      }

      setFormOpen(false);
      setEditingRow(null);
      setEditingForm(null);
      refetch();
      showToast("Đã cập nhật nhật ký hàn");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể cập nhật nhật ký hàn");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
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
          <option>Chờ thí nghiệm</option>
          <option>Đạt</option>
          <option>Không đạt</option>
          <option>Không thí nghiệm</option>
        </select>
        <button
          type="button"
          onClick={() => downloadWeldJournalExcelTemplate()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition-all duration-150 cursor-pointer"
        >
          Tải mẫu Excel
        </button>
        <input
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(e) => {
            void handleImportExcel(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => excelInputRef.current?.click()}
          disabled={importing || saving || loading}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#0047AB] bg-white px-4 text-xs sm:text-sm font-semibold text-[#0047AB] shadow-2xs hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150 cursor-pointer"
        >
          {importing ? "Đang nhập…" : "Tải Excel lên"}
        </button>
        <button
          type="button"
          onClick={() => void handleExportExcel()}
          disabled={exporting || loading}
          title="Xuất toàn bộ nhật ký theo bộ lọc hiện tại"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs sm:text-sm font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150 cursor-pointer"
        >
          <DownloadSimple size={16} weight="bold" aria-hidden />
          {exporting ? "Đang tạo Excel…" : "Xuất Excel"}
        </button>
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
          onClick={() => {
            setEditingRow(null);
            setEditingForm(null);
            setFormOpen(true);
          }}
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
                <th className="p-2.5 font-semibold">Người trực tiếp hàn</th>
                <th className="min-w-[260px] p-2.5 font-semibold">Chứng chỉ</th>
                <th className="p-2.5 font-semibold">Máy</th>
                <th className="p-2.5 font-semibold">Mã mối hàn</th>
                <th className="p-2.5 font-semibold">Mối hàn liên kết</th>
                <th className="p-2.5 font-semibold">Dự án</th>
                <th className="p-2.5 font-semibold">Vị trí</th>
                <th className="p-2.5 font-semibold">Lý do không đạt</th>
                <th className="p-2.5 font-semibold">Tình trạng</th>
                <th className="p-2.5 font-semibold">Sửa</th>
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
                  <td className="p-2.5 max-w-[200px]">
                    {w.mapUrl ? (
                      <div className="flex flex-col gap-1">
                        <a
                          href={w.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={w.location}
                          className="line-clamp-1 text-xs font-medium text-[#0047AB] hover:underline"
                        >
                          {w.location}
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            window.history.pushState(null, "", `/ban-do?weldId=${w.id}`);
                            window.dispatchEvent(new PopStateEvent("popstate"));
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                        >
                          📍 Xem trên bản đồ
                        </button>
                      </div>
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
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-2xs ${
                      w.testStatus === "Đạt"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : w.testStatus === "Không đạt"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : w.testStatus === "Không thí nghiệm"
                            ? "border-slate-200 bg-slate-50 text-slate-600"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        w.testStatus === "Đạt"
                          ? "bg-emerald-500"
                          : w.testStatus === "Không đạt"
                            ? "bg-rose-500"
                            : w.testStatus === "Không thí nghiệm"
                              ? "bg-slate-400"
                              : "bg-amber-500"
                      }`} />
                      {w.testStatus}
                    </span>
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        const raw = rows.find((row) => row.id === w.id);
                        if (!raw) return;
                        const gpsPoint =
                          gpsPoints.find((point) => point.weldId === raw.id) ??
                          gpsPoints.find((point) => point.weldCode?.trim().toLocaleLowerCase("vi") === raw.ma_lich_su.trim().toLocaleLowerCase("vi")) ??
                          null;
                        setEditingRow(raw);
                        setEditingForm(journalRowToForm(raw, gpsPoint));
                        setFormOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0047AB] hover:bg-blue-50 hover:text-[#0047AB] cursor-pointer"
                      title="Sửa nhật ký hàn"
                    >
                      <PencilSimple size={14} weight="bold" />
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-sm text-slate-500">
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
            ? `GPS: ${gpsError}`
            : "Mã mối hàn, ngày, nhân sự và tọa độ GPS đồng bộ trực tiếp từ Supabase qua khóa ngoại và view bao_cao_moi_han_gps."}
        </div>
      </div>

      <JournalFormModal
        open={formOpen}
        mode={editingRow ? "edit" : "create"}
        initial={editingForm}
        projects={projectOptions}
        welders={welderOptions}
        machines={machineOptions}
        existingCodes={rows.map((row) => row.ma_lich_su)}
        saving={saving}
        unlinkedGpsPoints={
          editingRow
            ? gpsPoints.filter((p) => !p.isLinked || p.weldId === editingRow.id)
            : gpsPoints.filter((p) => !p.isLinked && !p.weldId)
        }
        onClose={() => {
          if (saving) return;
          setFormOpen(false);
          setEditingRow(null);
          setEditingForm(null);
        }}
        onSubmit={editingRow ? handleEdit : handleCreate}
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
