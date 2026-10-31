"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { Camera, CaretRight, DownloadSimple, MapPin, PencilSimple, TrashSimple, UploadSimple, Warning, X } from "@/components/icons";
import DateField from "@/components/DateField";
import SelectMenu from "@/components/SelectMenu";
import MultiSelectMenu from "@/components/MultiSelectMenu";
import { googleOpenPoint, type MapPoint } from "@/data/mapPoints";
import type { MachineOption } from "@/data/machineAssignments";
import { useWeldLogGpsPoints } from "@/hooks/useWeldLogGpsPoints";
import { useCatalogOptions } from "@/hooks/useSystemCatalogs";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinaryClient";
import { loadMachineOptions } from "@/lib/machineRunSchedulesDb";
import { deleteMapPoint, linkGpsPointToWeld, setWeldPointCode, unlinkGpsPointsFromWeld } from "@/lib/mapPointsDb";
import { createClient } from "@/lib/supabase/client";
import {
  loadPersonnelCertificateOptions,
  loadPersonnelCertificateRows,
} from "@/lib/personnelCertificatesDb";
import {
  downloadWeldJournalExcelTemplate,
  parseWeldJournalExcel,
} from "@/lib/parseWeldJournalExcel";
import {
  addHoursToWeldTime,
  DEFAULT_WELD_WORK_HOURS,
  fetchFailedWeldsInDateRange,
  exportFilteredWeldJournal,
  deleteWeldJournalEntry,
  displayWeldCode,
  formatJournalDateIso,
  formatWeldWorkHours,
  weldWorkHours,
  insertWeldJournalEntry,
  invalidateWeldReportCache,
  isWeldCodeTaken,
  loadJournalProjectOptions,
  loadLatestProjectWeld,
  loadMachineFieldCodesForSuggestion,
  loadWeldLunchBreak,
  loadWeldCodesWithPrefix,
  loadWeldJournalPage,
  normalizeWeldTime,
  spreadWeldSlotTime,
  parseWeldLinkedImageAssets,
  resolveWeldTestStatus,
  updateWeldJournalEntry,
  type CertifiedWelderOption,
  type WeldLinkedImageAsset,
  type WeldReportRow,
  type WeldShift,
  type WeldTestStatus,
  WELD_SHIFTS,
  resolveWeldShift,
} from "@/lib/weldReportData";
import { compareNewestDate } from "@/lib/dateOrder";
import {
  buildWeldCodePrefix,
  COORDINATE_RAIL_LABELS,
  COORDINATE_RAIL_PREFIXES,
  detectMachineWeldNumbering,
  fieldCodeFromSystemCode,
  hasOwnWeldSitePrefix,
  machineWeldCodeHint,
  machineWeldCodePlaceholder,
  normalizeWeldSitePrefix,
  parseCoordinateCode,
  suggestCoordinateCode,
  suggestMachineWeldCodeForMachine,
  suggestWeldCode,
} from "@/lib/weldCode";
import { WELD_TYPE_OPTIONS } from "@/data/weldTypes";
import { BulkAutolispWeldDialog } from "@/components/BulkAutolispWeldDialog";
import {
  certificateEquipmentFamily,
  describeCertificateRequirement,
  eligibleCertificatesForWeld,
  hasCertificate,
  isCertificateCompatibleWithMachine,
  machineEquipmentFamily,
  parseCertificateList,
  weldMethodForFamily,
} from "@/lib/weldingCertificates";
import { NDT_DEFECTS, ndtDefectLabel } from "@/data/error-library";
import { useLanguage } from "@/i18n/LanguageProvider";
import WeldQualityBadge from "@/components/WeldQualityBadge";
import { WELD_QUALITY_STATUSES, type WeldQualitySelection } from "@/lib/weldQuality";
import { loadQualityJournal, exportQualityJournal, selectFilteredQuality, qualityRequest, notifyWeldQualityChanged } from "@/lib/weldQualityClient";
import { parseWeldQualityExcel, qualityExcelColumns } from "@/lib/weldQualityExcel";

// Keep lazy dialogs from suspending the journal and resetting its selection effects.
const WeldQualityDialog = dynamic(() => import("@/components/WeldQualityDialog"), {
  loading: () => <p role="status">Đang mở kiểm tra chất lượng…</p>,
});
const WeldQualityBulkDialog = dynamic(() => import("@/components/WeldQualityBulkDialog"), {
  loading: () => <p role="status">Đang mở kiểm tra hàng loạt…</p>,
});

const PAGE_SIZE = 50;
const SHOW_WELD_GPS = true;
const DEFAULT_WELD_TEST_STATUS: WeldTestStatus = "Chờ thí nghiệm";

type JournalStage = "all" | "han-xong" | "mai-xong" | "sua-chua" | "ky-bb" | "dat";
/** Giai đoạn theo trình tự chất lượng mới (một cột tình trạng; bỏ cột Kết quả NDT trên UI). */
const JOURNAL_STAGES: { id: JournalStage; label: string; hint: string; statuses?: string[] }[] = [
  { id: "all", label: "Tất cả", hint: "Toàn bộ nhật ký hàn" },
  { id: "han-xong", label: "Chờ mài", hint: "Đã hàn, đang chờ mài", statuses: ["Chờ mài"] },
  { id: "mai-xong", label: "Chờ siêu âm & NT", hint: "Đã mài đạt, chờ siêu âm và nghiệm thu", statuses: ["Chờ siêu âm và nghiệm thu"] },
  { id: "sua-chua", label: "Sửa chữa", hint: "Trực quan/độ lệch không đạt — đang khắc phục", statuses: ["Sửa chữa/khắc phục"] },
  { id: "ky-bb", label: "Chờ ký BB", hint: "Đủ điều kiện — chờ ký biên bản", statuses: ["Chờ ký biên bản"] },
  { id: "dat", label: "Đạt", hint: "Đã ký / nghiệm thu đạt", statuses: ["Đạt"] },
];

type JournalProjectOption = { id: string; label: string; ma_du_an: string };

type JournalFormValues = {
  ma_lich_su: string;
  performedAt: string;
  ca_han: WeldShift;
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
  anh_moi_han_lien_ket: WeldLinkedImageAsset[];
  chung_chi_su_dung: string;
  ghi_chu: string;
  toa_do_id: string;
  /** Mã tọa độ gõ tay (HT/HP/TT/TP + số) khi không chọn điểm Autolisp có sẵn. */
  ma_toa_do: string;
  ly_trinh: string;
  kinh_do: string;
  vi_do: string;
  ten_moi_han_theo_may: string;
  ma_hien_truong: string;
  gio_bat_dau: string;
  gio_ket_thuc: string;
  /** Giờ nghỉ trưa nhập tay ("" = không đổi/không có) — chỉ trừ khỏi giờ chạy máy. */
  gio_nghi_trua: string;
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

function formatWeldWorkRange(fromValue: string | null | undefined, toValue: string | null | undefined) {
  const from = normalizeWeldTime(fromValue);
  const to = normalizeWeldTime(toValue);
  if (!from && !to) return "—";
  const hours = formatWeldWorkHours(weldWorkHours(from, to));
  return `${from ?? "?"} – ${to ?? "?"}${hours ? ` (${hours})` : ""}`;
}

function emptyJournalForm(
  projects: JournalProjectOption[],
  welders: CertifiedWelderOption[],
  machines: MachineOption[],
): JournalFormValues {
  const machine = machines[0];
  const project = projects[0];
  const isInternalTraining = isInternalTrainingProject(project?.label ?? "");
  // Việc kiểm tra chứng chỉ đang được tạm ẩn khi tạo mối hàn mới.
  const welder = welders[0];
  return {
    ma_lich_su: "",
    performedAt: defaultPerformedAt(),
    ca_han: "Ca 1",
    du_an_id: project?.id ?? "",
    tho_han_id: welder?.id ?? "",
    may_id: machine?.id ?? "",
    loai_ray: "P50",
    cong_nghe_han: "FBW",
    loai_moi_han: isInternalTraining ? "Đào tạo" : "Sản xuất",
    result: DEFAULT_WELD_TEST_STATUS,
    ma_khuyet_tat: [],
    nguyen_nhan_loi: "",
    moi_han_lien_ket: "",
    anh_moi_han_lien_ket: [],
    chung_chi_su_dung: "",
    ghi_chu: "",
    toa_do_id: "",
    ma_toa_do: "",
    ly_trinh: "",
    kinh_do: "",
    vi_do: "",
    ten_moi_han_theo_may: "",
    ma_hien_truong: "",
    gio_bat_dau: "",
    gio_ket_thuc: "",
    gio_nghi_trua: "",
  };
}

const LAST_ENTRY_STORAGE_KEY = "weldJournal.lastEntry";

type JournalSuggestion = Partial<
  Pick<
    JournalFormValues,
    | "du_an_id"
    | "tho_han_id"
    | "may_id"
    | "chung_chi_su_dung"
    | "loai_ray"
    | "cong_nghe_han"
    | "loai_moi_han"
    | "ca_han"
    | "gio_bat_dau"
    | "gio_ket_thuc"
  >
>;

type EntryMode = "manual" | "quick" | "linked";

/** Giờ nghỉ trưa nhập tay: "" → undefined (không ghi), "0" → 0 (xóa), "1,5" → 1.5. */
function parseLunchHours(value: string): number | undefined {
  const text = value.trim().replace(",", ".");
  if (!text) return undefined;
  const hours = Number(text);
  return Number.isFinite(hours) && hours >= 0 ? Math.min(8, hours) : undefined;
}

/** Số tiếng làm thực = (giờ kết thúc − bắt đầu) − nghỉ trưa. */
function netWeldHours(from: string, to: string, lunch: string): number | null {
  const gross = weldWorkHours(from, to);
  if (gross == null) return null;
  return Math.max(0, Math.round((gross - (parseLunchHours(lunch) ?? 0)) * 100) / 100);
}

function pickJournalSuggestion(values: JournalSuggestion): JournalSuggestion {
  return {
    du_an_id: values.du_an_id,
    tho_han_id: values.tho_han_id,
    may_id: values.may_id,
    chung_chi_su_dung: values.chung_chi_su_dung,
    loai_ray: values.loai_ray,
    cong_nghe_han: values.cong_nghe_han,
    loai_moi_han: values.loai_moi_han,
    ca_han: values.ca_han,
    gio_bat_dau: values.gio_bat_dau,
    gio_ket_thuc: values.gio_ket_thuc,
  };
}

function rememberJournalEntry(values: JournalSuggestion) {
  try {
    window.localStorage.setItem(LAST_ENTRY_STORAGE_KEY, JSON.stringify(pickJournalSuggestion(values)));
  } catch {
    /* localStorage bị chặn — bỏ qua */
  }
}

function readRememberedJournalEntry(): JournalSuggestion {
  try {
    const raw = window.localStorage.getItem(LAST_ENTRY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JournalSuggestion) : {};
  } catch {
    return {};
  }
}

function weldRowToSuggestion(row: WeldReportRow): JournalSuggestion {
  return {
    du_an_id: row.du_an_id,
    tho_han_id: row.tho_han_id,
    may_id: row.may_id ?? undefined,
    chung_chi_su_dung: row.chung_chi_su_dung ?? undefined,
    loai_ray: row.loai_ray,
    cong_nghe_han: row.cong_nghe_han,
    loai_moi_han: row.loai_moi_han,
    ca_han: resolveWeldShift(row),
    gio_bat_dau: normalizeWeldTime(row.gio_bat_dau) ?? undefined,
    gio_ket_thuc: normalizeWeldTime(row.gio_ket_thuc) ?? undefined,
    // Không lấy mã hiện trường / trong máy từ mối cũ — form tự sinh theo ngày + nhật ký.
  };
}

/** Áp gợi ý vào form, chỉ nhận giá trị còn tồn tại trong danh mục hiện tại. */
function applyJournalSuggestion(
  form: JournalFormValues,
  suggestion: JournalSuggestion,
  projects: JournalProjectOption[],
  welders: CertifiedWelderOption[],
  machines: MachineOption[],
): JournalFormValues {
  const next = { ...form };
  if (suggestion.du_an_id && projects.some((item) => item.id === suggestion.du_an_id)) {
    next.du_an_id = suggestion.du_an_id;
  }
  const welder = welders.find((item) => item.id === suggestion.tho_han_id);
  if (welder) {
    next.tho_han_id = welder.id;
    if (suggestion.chung_chi_su_dung && welder.certificates.includes(suggestion.chung_chi_su_dung)) {
      next.chung_chi_su_dung = suggestion.chung_chi_su_dung;
    }
  }
  if (suggestion.may_id && machines.some((item) => item.id === suggestion.may_id)) {
    next.may_id = suggestion.may_id;
  }
  if (suggestion.loai_ray?.trim()) next.loai_ray = suggestion.loai_ray;
  if (suggestion.cong_nghe_han === "FBW" || suggestion.cong_nghe_han === "ATW") {
    next.cong_nghe_han = suggestion.cong_nghe_han;
  }
  if (suggestion.loai_moi_han && WELD_TYPE_OPTIONS.includes(suggestion.loai_moi_han)) {
    next.loai_moi_han = suggestion.loai_moi_han;
  }
  if (suggestion.ca_han && WELD_SHIFTS.includes(suggestion.ca_han)) next.ca_han = suggestion.ca_han;
  if (suggestion.gio_bat_dau) next.gio_bat_dau = suggestion.gio_bat_dau;
  if (suggestion.gio_ket_thuc) next.gio_ket_thuc = suggestion.gio_ket_thuc;
  return next;
}

function journalRowToForm(
  row: WeldReportRow,
  gpsPoint: MapPoint | null,
): JournalFormValues {
  return {
    ma_lich_su: row.ma_lich_su,
    performedAt: `${(row.ngay_thuc_hien?.slice(0, 10) || `${row.nam_thuc_hien}-01-01`)}T${normalizeWeldTime(row.gio_han) ?? "08:00"}`,
    ca_han: resolveWeldShift(row),
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
    anh_moi_han_lien_ket: parseWeldLinkedImageAssets(row.anh_moi_han_lien_ket),
    chung_chi_su_dung: row.chung_chi_su_dung ?? "",
    ghi_chu: row.ghi_chu ?? "",
    toa_do_id: gpsPoint?.id ?? "",
    ma_toa_do: "",
    ly_trinh: gpsPoint?.chainage ?? "",
    kinh_do: gpsPoint ? String(gpsPoint.longitude) : "",
    vi_do: gpsPoint ? String(gpsPoint.latitude) : "",
    ten_moi_han_theo_may: row.ten_moi_han_theo_may ?? "",
    ma_hien_truong: row.ma_hien_truong ?? "",
    gio_bat_dau: normalizeWeldTime(row.gio_bat_dau) ?? "",
    gio_ket_thuc: normalizeWeldTime(row.gio_ket_thuc) ?? "",
    gio_nghi_trua: "",
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
  recordId,
  qualityRecorded = false,
  saving,
  bulkProgress = "",
  unlinkedGpsPoints = [],
  allGpsPoints = [],
  onClose,
  onSubmit,
  onBulkSubmit,
}: {
  open: boolean;
  mode?: "create" | "edit";
  initial?: JournalFormValues | null;
  projects: JournalProjectOption[];
  welders: CertifiedWelderOption[];
  machines: MachineOption[];
  existingCodes: string[];
  /** Id bản ghi đang sửa — bỏ qua khi kiểm tra trùng mã. */
  recordId?: string;
  qualityRecorded?: boolean;
  saving: boolean;
  bulkProgress?: string;
  unlinkedGpsPoints?: MapPoint[];
  /** Mọi điểm GPS (cả đã gắn) — để gợi ý số mã tọa độ theo tuyến. */
  allGpsPoints?: MapPoint[];
  onClose: () => void;
  onSubmit: (values: JournalFormValues) => void | Promise<void>;
  onBulkSubmit?: (values: BulkFillValues) => void | Promise<boolean | void>;
}) {
  const shouldCheckCertificate = mode === "edit";
  const { lang } = useLanguage();
  const [form, setForm] = useState(() => emptyJournalForm(projects, welders, machines));
  const [linkDateFrom, setLinkDateFrom] = useState(() => defaultLinkDateRange().from);
  const [linkDateTo, setLinkDateTo] = useState(() => defaultLinkDateRange().to);
  const [failedWeldOptions, setFailedWeldOptions] = useState<
    { value: string; label: string; isoDate: string }[]
  >([]);
  const [prefixCodes, setPrefixCodes] = useState<string[]>([]);
  const [machineFieldCodes, setMachineFieldCodes] = useState<string[]>([]);
  const [siteCodeEdited, setSiteCodeEdited] = useState(false);
  const [gpsRailFilter, setGpsRailFilter] = useState("");
  const [machineCodeEdited, setMachineCodeEdited] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("manual");
  const [bulkDateFrom, setBulkDateFrom] = useState(() => defaultPerformedAt().slice(0, 10));
  const [bulkDateTo, setBulkDateTo] = useState(() => defaultPerformedAt().slice(0, 10));
  const [bulkCount, setBulkCount] = useState(1);
  const [projectSuggestion, setProjectSuggestion] = useState<{ code: string; date: string } | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const initialImageIds = useRef(new Set<string>());
  const removedImages = useRef<WeldLinkedImageAsset[]>([]);
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
  const selectedProject = projects.find((project) => project.id === form.du_an_id);
  const sitePrefix = normalizeWeldSitePrefix(selectedProject?.ma_du_an);
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
    () => shouldCheckCertificate
      ? welders.filter(
          (welder) => eligibleCertificatesForWeld(welder.certificates, qualificationContext).length > 0,
        )
      : welders,
    [shouldCheckCertificate, welders, qualificationContext],
  );
  const selectedWelder = welders.find((welder) => welder.id === form.tho_han_id);
  const selectedEligibleCertificates = selectedWelder
    ? shouldCheckCertificate
      ? eligibleCertificatesForWeld(selectedWelder.certificates, qualificationContext)
      : selectedWelder.certificates
    : [];

  const initializedForm = useRef<JournalFormValues | null | undefined>(undefined);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && (!wasOpen.current || initializedForm.current !== initial)) {
      const next = initial ?? applyJournalSuggestion(
        emptyJournalForm(projects, welders, machines),
        readRememberedJournalEntry(),
        projects,
        welders,
        machines,
      );
      setForm(next);
      setProjectSuggestion(null);
      initialImageIds.current = new Set(next.anh_moi_han_lien_ket.map((asset) => asset.publicId));
      removedImages.current = [];
      setImageError("");
      const range = defaultLinkDateRange();
      setLinkDateFrom(range.from);
      setLinkDateTo(range.to);
      setSiteCodeEdited(mode === "edit" && Boolean(next.ma_hien_truong));
      setMachineCodeEdited(mode === "edit" && Boolean(next.ten_moi_han_theo_may));
      const today = defaultPerformedAt().slice(0, 10);
      setEntryMode("manual");
      setBulkDateFrom(today);
      setBulkDateTo(today);
      setBulkCount(1);
      initializedForm.current = initial;
    }
    wasOpen.current = open;
  }, [open, initial, projects, welders, machines, mode]);

  const suggestionOptions = useRef({ projects, welders, machines });
  useEffect(() => {
    suggestionOptions.current = { projects, welders, machines };
  }, [projects, welders, machines]);

  useEffect(() => {
    if (!open || mode !== "create" || !form.du_an_id) return;
    const projectId = form.du_an_id;
    let active = true;
    loadLatestProjectWeld(projectId, defaultPerformedAt().slice(0, 10))
      .then((row) => {
        if (!active) return;
        if (!row) {
          setProjectSuggestion(null);
          return;
        }
        const options = suggestionOptions.current;
        setForm((current) =>
          current.du_an_id === projectId
            ? applyJournalSuggestion(current, weldRowToSuggestion(row), options.projects, options.welders, options.machines)
            : current,
        );
        setProjectSuggestion({ code: displayWeldCode(row.ma_lich_su), date: row.ngay_thuc_hien?.slice(0, 10) ?? "" });
      })
      .catch(() => {
        if (active) setProjectSuggestion(null);
      });
    return () => {
      active = false;
    };
  }, [open, mode, form.du_an_id]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit") return;
    const prefix = buildWeldCodePrefix(form.cong_nghe_han, form.performedAt, sitePrefix, form.loai_moi_han);
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
  }, [mode, open, form.cong_nghe_han, form.performedAt, form.loai_moi_han, sitePrefix]);

  const suggestedCode = useMemo(() => {
    if (mode === "edit") return form.ma_lich_su;
    const codes = Array.from(new Set([...existingCodes, ...prefixCodes]));
    return suggestWeldCode(form.cong_nghe_han, form.performedAt, codes, sitePrefix, form.loai_moi_han);
  }, [mode, form.ma_lich_su, existingCodes, prefixCodes, form.cong_nghe_han, form.performedAt, sitePrefix, form.loai_moi_han]);

  useEffect(() => {
    if (!open || mode === "edit") return;
    if (!suggestedCode || form.ma_lich_su === suggestedCode) return;
    setForm((prev) => ({ ...prev, ma_lich_su: suggestedCode }));
  }, [open, mode, suggestedCode, form.ma_lich_su]);

  useEffect(() => {
    if (!open || mode === "edit") return;
    setSiteCodeEdited(false);
  }, [open, mode, form.du_an_id, form.cong_nghe_han, form.performedAt]);

  useEffect(() => {
    if (!open || !form.performedAt) {
      setMachineFieldCodes([]);
      return;
    }
    if (mode === "create") setMachineCodeEdited(false);
    const machine = machines.find((item) => item.id === form.may_id);
    let active = true;
    loadMachineFieldCodesForSuggestion(form.performedAt, machine)
      .then((codes) => {
        if (active) setMachineFieldCodes(codes);
      })
      .catch(() => {
        if (active) setMachineFieldCodes([]);
      });
    return () => {
      active = false;
    };
  }, [open, mode, form.performedAt, form.may_id, machines]);

  const suggestedSiteCode = useMemo(() => {
    if (mode === "edit") return form.ma_hien_truong;
    return fieldCodeFromSystemCode(suggestedCode) || form.ma_hien_truong;
  }, [mode, form.ma_hien_truong, suggestedCode]);

  const suggestedMachineCode = useMemo(() => {
    if (mode === "edit") return form.ten_moi_han_theo_may;
    return suggestMachineWeldCodeForMachine(form.performedAt, machineFieldCodes, selectedMachine);
  }, [mode, form.ten_moi_han_theo_may, form.performedAt, machineFieldCodes, selectedMachine]);

  useEffect(() => {
    if (!open || mode === "edit" || siteCodeEdited) return;
    if (!suggestedSiteCode) return;
    setForm((prev) =>
      prev.ma_hien_truong === suggestedSiteCode ? prev : { ...prev, ma_hien_truong: suggestedSiteCode },
    );
  }, [open, mode, siteCodeEdited, suggestedSiteCode]);

  useEffect(() => {
    if (!open || mode === "edit" || machineCodeEdited) return;
    if (!suggestedMachineCode) return;
    setForm((prev) =>
      prev.ten_moi_han_theo_may === suggestedMachineCode
        ? prev
        : { ...prev, ten_moi_han_theo_may: suggestedMachineCode },
    );
  }, [open, mode, machineCodeEdited, suggestedMachineCode]);

  const projectMissingCode = Boolean(selectedProject) && !hasOwnWeldSitePrefix(selectedProject?.ma_du_an);
  const quickActive = mode === "create" && entryMode === "quick";
  const linkedActive = entryMode === "linked";
  const linkedTabBadge =
    (form.moi_han_lien_ket ? 1 : 0) + form.anh_moi_han_lien_ket.length;
  const bulkDates = listIsoDates(bulkDateFrom, bulkDateTo);
  const bulkCountSafe = Math.min(100, Math.max(0, Math.round(Number(bulkCount) || 0)));
  const bulkSpanTooLong = Boolean(bulkDateFrom && bulkDateTo && bulkDateFrom <= bulkDateTo && bulkDates.length > 31);
  const bulkTotal = bulkDates.length * Math.max(0, bulkCountSafe);
  const selectedCertificateFamily = form.chung_chi_su_dung
    ? certificateEquipmentFamily(form.chung_chi_su_dung)
    : null;

  function pickCertificate(certificate: string) {
    setForm((current) => {
      const currentMachine = machines.find((machine) => machine.id === current.may_id);
      const nextMachine = isCertificateCompatibleWithMachine(certificate, currentMachine)
        ? currentMachine
        : machines.find((machine) => isCertificateCompatibleWithMachine(certificate, machine)) ?? currentMachine;
      const method = weldMethodForFamily(
        certificateEquipmentFamily(certificate) ?? machineEquipmentFamily(nextMachine),
      );
      return {
        ...current,
        chung_chi_su_dung: certificate,
        may_id: nextMachine?.id ?? current.may_id,
        cong_nghe_han: method ?? current.cong_nghe_han,
      };
    });
  }

  function pickMachine(machineId: string) {
    const machine = machines.find((item) => item.id === machineId);
    if (mode === "create") setMachineCodeEdited(false);
    setForm((current) => {
      const welderCertificates = welders.find((welder) => welder.id === current.tho_han_id)?.certificates ?? [];
      const nextCertificate =
        !current.chung_chi_su_dung || isCertificateCompatibleWithMachine(current.chung_chi_su_dung, machine)
          ? current.chung_chi_su_dung
          : welderCertificates.find((certificate) => isCertificateCompatibleWithMachine(certificate, machine))
            ?? current.chung_chi_su_dung;
      const method = weldMethodForFamily(machineEquipmentFamily(machine));
      return {
        ...current,
        may_id: machineId,
        chung_chi_su_dung: nextCertificate,
        cong_nghe_han: method ?? current.cong_nghe_han,
      };
    });
  }

  useEffect(() => {
    const selectedIsQualified = qualifiedWelders.some((welder) => welder.id === form.tho_han_id);
    const nextWelderId = selectedIsQualified ? form.tho_han_id : qualifiedWelders[0]?.id ?? "";
    const nextWelder = welders.find((welder) => welder.id === nextWelderId);
    const eligibleCertificates = nextWelder
      ? shouldCheckCertificate
        ? eligibleCertificatesForWeld(nextWelder.certificates, qualificationContext)
        : nextWelder.certificates
      : [];
    const nextCertificate = eligibleCertificates.includes(form.chung_chi_su_dung)
      ? form.chung_chi_su_dung
      : eligibleCertificates.find((certificate) => isCertificateCompatibleWithMachine(certificate, selectedMachine))
        ?? eligibleCertificates[0]
        ?? "";
    if (form.chung_chi_su_dung === nextCertificate && form.tho_han_id === nextWelderId) return;
    setForm((prev) => ({
      ...prev,
      tho_han_id: nextWelderId,
      chung_chi_su_dung: nextCertificate,
    }));
  }, [form.chung_chi_su_dung, form.tho_han_id, qualifiedWelders, qualificationContext, selectedMachine, shouldCheckCertificate, welders]);

  useEffect(() => {
    if (!form.moi_han_lien_ket) return;
    if (!failedWeldOptions.some((opt) => opt.value === form.moi_han_lien_ket)) {
      setForm((prev) => ({ ...prev, moi_han_lien_ket: "" }));
    }
  }, [failedWeldOptions, form.moi_han_lien_ket]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !uploadingImages && !saving) {
        void (async () => {
          const newAssets = form.anh_moi_han_lien_ket.filter(
            (asset) => !initialImageIds.current.has(asset.publicId),
          );
          await Promise.allSettled(newAssets.map((asset) => deleteCloudinaryAsset(asset.publicId)));
          onClose();
        })();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, uploadingImages, saving, form.anh_moi_han_lien_ket]);

  if (!open) return null;

  async function uploadLinkedImages(files: FileList | null) {
    if (!files?.length) return;
    setUploadingImages(true);
    setImageError("");
    const uploaded: WeldLinkedImageAsset[] = [];
    for (const file of Array.from(files)) {
      const { result, error: uploadError } = await uploadToCloudinary(
        file,
        "thanhphat/weld-journal/linked",
      );
      if (!result) {
        setImageError(uploadError || `Không thể tải ảnh ${file.name}.`);
        break;
      }
      uploaded.push({
        publicId: result.public_id,
        secureUrl: result.secure_url,
        name: result.original_filename || file.name,
        bytes: result.bytes,
      });
    }
    if (uploaded.length) {
      setForm((current) => ({
        ...current,
        anh_moi_han_lien_ket: [...current.anh_moi_han_lien_ket, ...uploaded],
      }));
    }
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setUploadingImages(false);
  }

  function removeLinkedImage(asset: WeldLinkedImageAsset) {
    if (initialImageIds.current.has(asset.publicId)) removedImages.current.push(asset);
    else void deleteCloudinaryAsset(asset.publicId);
    setForm((current) => ({
      ...current,
      anh_moi_han_lien_ket: current.anh_moi_han_lien_ket.filter((item) => item.publicId !== asset.publicId),
    }));
  }

  async function closeAndCleanUp() {
    if (uploadingImages || saving) return;
    const newAssets = form.anh_moi_han_lien_ket.filter(
      (asset) => !initialImageIds.current.has(asset.publicId),
    );
    await Promise.allSettled(newAssets.map((asset) => deleteCloudinaryAsset(asset.publicId)));
    onClose();
  }

  async function handleBulkFromForm() {
    if (projectMissingCode) {
      window.alert("Dự án chưa có mã dự án. Vào Quản lý dự án để khai báo mã (VD: PHQ) trước khi ghi nhật ký hàn.");
      return;
    }
    if (!form.du_an_id) {
      window.alert("Vui lòng chọn dự án.");
      return;
    }
    if (!form.tho_han_id) {
      window.alert("Vui lòng chọn người trực tiếp hàn.");
      return;
    }
    if (!selectedWelder || selectedEligibleCertificates.length === 0) {
      window.alert("Người trực tiếp hàn chưa có chứng chỉ còn hiệu lực trong hồ sơ. Không thể ghi nhật ký.");
      return;
    }
    if (!form.chung_chi_su_dung || !selectedEligibleCertificates.includes(form.chung_chi_su_dung)) {
      window.alert("Vui lòng chọn chứng chỉ sử dụng cho mối hàn.");
      return;
    }
    if (!form.may_id) {
      window.alert("Vui lòng chọn máy thực hiện mối hàn.");
      return;
    }
    const today = defaultPerformedAt().slice(0, 10);
    if (bulkDateTo > today) {
      window.alert("Ngày thực hiện không được lớn hơn ngày hiện tại.");
      return;
    }
    if (bulkDates.length === 0 || bulkSpanTooLong || bulkCountSafe < 1) {
      window.alert("Chọn khoảng ngày tối đa 31 ngày và số mối mỗi ngày từ 1 đến 100.");
      return;
    }
    try {
      const created = await onBulkSubmit?.({
        du_an_id: form.du_an_id,
        dateFrom: bulkDateFrom,
        dateTo: bulkDateTo,
        count: bulkCountSafe,
        tho_han_id: form.tho_han_id,
        may_id: form.may_id,
        loai_ray: form.loai_ray,
        cong_nghe_han: form.cong_nghe_han,
        loai_moi_han: form.loai_moi_han,
        result: form.result,
        ca_han: form.ca_han,
        gio_bat_dau: form.gio_bat_dau,
        gio_ket_thuc: form.gio_ket_thuc,
        chung_chi_su_dung: form.chung_chi_su_dung,
        ma_hien_truong: form.ma_hien_truong,
        ten_moi_han_theo_may: form.ten_moi_han_theo_may,
      });
      if (created === false) return;
      const newAssets = form.anh_moi_han_lien_ket.filter(
        (asset) => !initialImageIds.current.has(asset.publicId),
      );
      await Promise.allSettled(newAssets.map((asset) => deleteCloudinaryAsset(asset.publicId)));
    } catch {
      /* parent đã alert */
    }
  }

  async function handleSubmit() {
    if (quickActive) {
      await handleBulkFromForm();
      return;
    }
    if (mode === "create" && projectMissingCode) {
      window.alert("Dự án chưa có mã dự án. Vào Quản lý dự án để khai báo mã (VD: PHQ) trước khi ghi nhật ký hàn.");
      return;
    }
    if (!form.ma_lich_su.trim()) {
      window.alert("Chưa có mã hệ thống. Chọn dự án, công nghệ và loại mối để hệ thống tạo mã.");
      return;
    }
    try {
      if (await isWeldCodeTaken(form.ma_lich_su, recordId)) {
        window.alert(`Mã hệ thống “${form.ma_lich_su.trim()}” đã tồn tại. Thử lại sau khi đổi công nghệ/loại mối.`);
        return;
      }
    } catch (checkError) {
      window.alert(checkError instanceof Error ? checkError.message : "Không kiểm tra được trùng mã hệ thống.");
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
      window.alert("Vui lòng chọn người trực tiếp hàn.");
      return;
    }
    if (!selectedWelder || selectedEligibleCertificates.length === 0) {
      window.alert(
        shouldCheckCertificate
          ? `Nhân sự được chọn chưa có ${describeCertificateRequirement(qualificationContext)}.`
          : "Người trực tiếp hàn chưa có chứng chỉ còn hiệu lực trong hồ sơ. Không thể ghi nhật ký.",
      );
      return;
    }
    if (!form.chung_chi_su_dung || !selectedEligibleCertificates.includes(form.chung_chi_su_dung)) {
      window.alert("Vui lòng chọn chứng chỉ sử dụng cho mối hàn.");
      return;
    }
    if (!form.may_id) {
      window.alert("Vui lòng chọn máy thực hiện mối hàn.");
      return;
    }
    if (form.result === "Không đạt" && form.ma_khuyet_tat.length === 0 && !form.ghi_chu.trim()) {
      window.alert("Vui lòng chọn ít nhất một mã khuyết tật hoặc nhập ghi chú.");
      return;
    }
    if (uploadingImages) {
      window.alert("Ảnh đang được tải lên Cloudinary, vui lòng đợi hoàn tất.");
      return;
    }
    try {
      await onSubmit(form);
      await Promise.allSettled(
        removedImages.current.map((asset) => deleteCloudinaryAsset(asset.publicId)),
      );
      removedImages.current = [];
    } catch {
      /* parent đã alert */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={() => void closeAndCleanUp()}
        disabled={uploadingImages || saving}
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
            onClick={() => void closeAndCleanUp()}
            disabled={uploadingImages || saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer disabled:opacity-50"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Tên dự án
            <SelectMenu
              value={form.du_an_id}
              onChange={(projectId) => {
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
              options={projects.map((p) => ({
                value: p.id,
                label: p.label,
                hint: hasOwnWeldSitePrefix(p.ma_du_an) ? p.ma_du_an : "Chưa có mã dự án",
              }))}
              searchable={projects.length > 5}
              placeholder={projects.length === 0 ? "Chưa có dữ liệu dự án" : "Chọn dự án"}
              searchPlaceholder="Gõ để tìm dự án..."
              className="mt-1.5"
              buttonClassName="h-10 shadow-2xs"
            />
            {mode === "create" && projectSuggestion && (
              <span className="mt-1.5 block rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800">
                Đã gợi ý thợ hàn, máy, công nghệ theo mối gần nhất của dự án
                {projectSuggestion.date ? ` · ${formatJournalDateIso(projectSuggestion.date)}` : ""}. Mã hệ thống / hiện trường / trong máy tự sinh theo ngày.
              </span>
            )}
            {mode === "create" && !form.du_an_id && (
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                Chọn dự án trước — hệ thống sẽ tự điền thông số theo mối gần nhất của dự án đó.
              </span>
            )}
          </label>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEntryMode("manual")}
                className={`relative min-w-0 flex-1 border-b-2 px-3 py-2.5 text-center text-xs font-semibold transition-colors cursor-pointer sm:text-[13px] disabled:opacity-60 ${
                  entryMode === "manual"
                    ? "border-[#0047AB] bg-white text-[#0047AB]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {mode === "create" ? "Thủ công" : "Thông tin"}
              </button>
              {mode === "create" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEntryMode("quick")}
                  className={`relative min-w-0 flex-1 border-b-2 px-3 py-2.5 text-center text-xs font-semibold transition-colors cursor-pointer sm:text-[13px] disabled:opacity-60 ${
                    entryMode === "quick"
                      ? "border-[#0047AB] bg-white text-[#0047AB]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Nhập nhanh
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => setEntryMode("linked")}
                className={`relative min-w-0 flex-1 border-b-2 px-3 py-2.5 text-center text-xs font-semibold transition-colors cursor-pointer sm:text-[13px] disabled:opacity-60 ${
                  entryMode === "linked"
                    ? "border-[#0047AB] bg-white text-[#0047AB]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Mối hàn liên kết
                {linkedTabBadge > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-[#0047AB]">
                    {linkedTabBadge}
                  </span>
                )}
              </button>
            </div>
            {quickActive && (
              <div className="space-y-2 bg-blue-50/40 p-3.5">
                <p className="text-[11px] font-medium leading-relaxed text-slate-600">
                  Tạo nhiều mối cùng ca, thợ hàn, công nghệ. Mã hệ thống / hiện trường / trong máy tăng lần lượt.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Từ ngày
                    <DateField
                      value={bulkDateFrom}
                      onChange={(dateFrom) => {
                        setBulkDateFrom(dateFrom);
                        if (bulkDateTo && dateFrom > bulkDateTo) setBulkDateTo(dateFrom);
                      }}
                      className="mt-1.5"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Đến ngày
                    <DateField
                      value={bulkDateTo}
                      onChange={(dateTo) => {
                        setBulkDateTo(dateTo);
                        if (bulkDateFrom && dateTo < bulkDateFrom) setBulkDateFrom(dateTo);
                      }}
                      className="mt-1.5"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Số mối mỗi ngày
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={bulkCount}
                      onChange={(event) => setBulkCount(Number(event.target.value))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono text-slate-900 shadow-2xs outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
                <p className="text-xs font-medium text-[#0047AB]">
                  {bulkSpanTooLong
                    ? "Chỉ điền tối đa 31 ngày mỗi lần."
                    : bulkDates.length > 0 && bulkCountSafe > 0
                      ? `${bulkDates.length.toLocaleString("vi-VN")} ngày × ${bulkCountSafe.toLocaleString("vi-VN")} mối = ${bulkTotal.toLocaleString("vi-VN")} bản ghi · Dự án: ${selectedProject?.ma_du_an ? `${selectedProject.ma_du_an} · ` : ""}${selectedProject?.label ?? "chưa chọn"}.`
                      : "Chọn khoảng ngày hợp lệ và số mối lớn hơn 0."}
                </p>
              </div>
            )}
            {linkedActive && (
              <div className="space-y-3 bg-slate-50/40 p-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Từ ngày
                    <DateField
                      value={linkDateFrom}
                      onChange={(val) => {
                        setLinkDateFrom(val);
                        if (linkDateTo && val > linkDateTo) setLinkDateTo(val);
                      }}
                      className="mt-1"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Đến ngày
                    <DateField
                      value={linkDateTo}
                      onChange={(val) => {
                        setLinkDateTo(val);
                        if (linkDateFrom && val < linkDateFrom) setLinkDateFrom(val);
                      }}
                      className="mt-1"
                    />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">
                  Chọn mối hàn lỗi trong khoảng ngày
                  <SelectMenu
                    value={form.moi_han_lien_ket}
                    onChange={(moi_han_lien_ket) => setForm({ ...form, moi_han_lien_ket })}
                    options={[{ value: "", label: "— Không liên kết —" }, ...failedWeldOptions]}
                    searchable={failedWeldOptions.length > 5}
                    searchPlaceholder="Tìm mã mối hàn..."
                    className="mt-1"
                    buttonClassName="h-10 shadow-2xs"
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  {failedWeldOptions.length > 0
                    ? `${failedWeldOptions.length} mối hàn lỗi từ ${formatJournalDateIso(linkDateFrom)} đến ${formatJournalDateIso(linkDateTo)}`
                    : "Không có mối hàn lỗi trong khoảng ngày đã chọn."}
                </p>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">
                      Ảnh mối hàn liên kết{" "}
                      <span className="font-normal text-slate-400">(chụp / chọn nhiều ảnh)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploadingImages || saving}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                      >
                        <Camera size={16} aria-hidden />
                        Chụp ảnh
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploadingImages || saving}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-[#0047AB] hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
                      >
                        <UploadSimple size={16} aria-hidden />
                        {uploadingImages ? "Đang tải..." : "Thêm ảnh"}
                      </button>
                    </div>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => void uploadLinkedImages(event.target.files)}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => void uploadLinkedImages(event.target.files)}
                    />
                  </div>
                  {imageError && (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">
                      {imageError}
                    </div>
                  )}
                  {form.anh_moi_han_lien_ket.length > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {form.anh_moi_han_lien_ket.map((asset) => (
                        <div
                          key={asset.publicId}
                          className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                        >
                          <div className="relative h-24">
                            <Image
                              src={asset.secureUrl}
                              alt={asset.name}
                              fill
                              className="object-cover"
                              sizes="180px"
                            />
                          </div>
                          <div className="truncate px-2 py-1.5 pr-9 text-[11px] text-slate-600" title={asset.name}>
                            {asset.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLinkedImage(asset)}
                            disabled={uploadingImages || saving}
                            className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-rose-600 shadow-sm hover:bg-rose-50 cursor-pointer"
                            aria-label={`Xóa ${asset.name}`}
                          >
                            <TrashSimple size={15} aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-xs text-slate-400">
                      Chưa có ảnh. Chụp hoặc chọn nhiều ảnh để lưu lên Cloudinary.
                    </div>
                  )}
                </div>

                {SHOW_WELD_GPS && (
                  <div className="space-y-3 border-t border-slate-200 pt-3">
                    <p className="text-[11px] text-slate-500">Tùy chọn — gán điểm GPS có sẵn hoặc nhập tọa độ mới.</p>
                    {unlinkedGpsPoints && unlinkedGpsPoints.length > 0 && (
                      <label className="block text-xs font-semibold text-slate-600">
                        Gán điểm GPS có sẵn (chưa liên kết)
                        <SelectMenu
                          value={form.toa_do_id}
                          onChange={(id) => {
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
                          options={[
                            { value: "", label: "— Nhập mới hoặc không gán điểm có sẵn —" },
                            ...unlinkedGpsPoints.map((pt) => ({
                              value: pt.id,
                              label: `${pt.code} (${pt.chainage}) — ${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`,
                            })),
                          ]}
                          searchable={unlinkedGpsPoints.length > 5}
                          searchPlaceholder="Tìm mã hoặc lý trình..."
                          className="mt-1"
                          buttonClassName="h-10 shadow-2xs"
                        />
                      </label>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                )}
              </div>
            )}
          </div>

          {!linkedActive && (
          <>
          {!quickActive && (
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Điểm Autolisp / Mã vị trí (HT/HP/TT/TP)
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {["", ...COORDINATE_RAIL_PREFIXES].map((prefix) => (
                  <button
                    key={prefix || "all"}
                    type="button"
                    title={prefix ? COORDINATE_RAIL_LABELS[prefix as keyof typeof COORDINATE_RAIL_LABELS] : "Tất cả"}
                    onClick={() => {
                      setGpsRailFilter(prefix);
                      if (!prefix || form.toa_do_id) return;
                      const routeCodes = allGpsPoints
                        .filter((pt) => (pt.projectId ?? "") === form.du_an_id)
                        .map((pt) => pt.code);
                      setForm((prev) => ({ ...prev, ma_toa_do: suggestCoordinateCode(prefix, routeCodes) }));
                    }}
                    className={`h-7 cursor-pointer rounded-md border px-2.5 text-[11px] font-semibold ${
                      gpsRailFilter === prefix
                        ? "border-[#0047AB] bg-[#0047AB] text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {prefix || "Tất cả"}
                  </button>
                ))}
              </span>
              <SelectMenu
                value={form.toa_do_id}
                onChange={(id) => {
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
                options={[
                  { value: "", label: "— Chưa gán điểm Autolisp —" },
                  ...unlinkedGpsPoints
                    .filter((pt) => !gpsRailFilter || pt.id === form.toa_do_id || pt.code.toUpperCase().startsWith(gpsRailFilter))
                    .map((pt) => ({
                    value: pt.id,
                    label: `${pt.code}${pt.chainage ? ` · ${pt.chainage}` : ""}`,
                    hint: `${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`,
                  })),
                ]}
                searchable={unlinkedGpsPoints.length > 5}
                searchPlaceholder="Tìm HT/HP/TT/TP hoặc lý trình..."
                className="mt-1.5"
                buttonClassName="h-10 shadow-2xs font-mono"
              />
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                {unlinkedGpsPoints.length > 0
                  ? "Chọn điểm thiết kế → tự điền Km/GPS. Sau khi lưu, mã vị trí hiện trên bảng nhật ký."
                  : "Chưa có điểm Autolisp trống. Import/thêm điểm ở Bản đồ rồi mở lại form, hoặc giữ điểm đang gắn (khi sửa)."}
              </span>
            </label>
          )}
          {!quickActive && !form.toa_do_id && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Hoặc nhập mã tọa độ
                <input
                  value={form.ma_toa_do}
                  onChange={(event) => setForm({ ...form, ma_toa_do: event.target.value.toUpperCase() })}
                  placeholder="HT0001 · chọn HT/HP/TT/TP ở trên"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden font-mono focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </label>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Kinh độ (lon)
                <input
                  value={form.kinh_do}
                  onChange={(event) => setForm({ ...form, kinh_do: event.target.value })}
                  placeholder="105.8427"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden font-mono focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </label>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Vĩ độ (lat)
                <input
                  value={form.vi_do}
                  onChange={(event) => setForm({ ...form, vi_do: event.target.value })}
                  placeholder="21.0160"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden font-mono focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </label>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              <label htmlFor="journal-weld-code">Mã hệ thống</label>
              <input
                id="journal-weld-code"
                value={form.ma_lich_su}
                readOnly
                placeholder={`${sitePrefix}-FBW-25-10-26-0001`}
                className="mt-1.5 h-10 w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-800 shadow-2xs outline-hidden font-mono"
              />
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                {sitePrefix}-CN-DD-MM-YY-xxxx · TT 1→n theo dự án. Không chỉnh tay.
              </span>
            </div>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Mã hiện trường (sơn bụng ray)
              <input
                value={form.ma_hien_truong}
                readOnly
                placeholder="FBW-25-10-26-0001"
                className="mt-1.5 h-10 w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-800 shadow-2xs outline-hidden font-mono"
              />
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                CN-DD-MM-YY-xxxx · TT 1→n theo nhật ký · tự sinh, không chỉnh tay.
              </span>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Mã trong máy
              <input
                value={form.ten_moi_han_theo_may}
                onChange={(event) => {
                  setMachineCodeEdited(true);
                  const raw = event.target.value;
                  const scheme = detectMachineWeldNumbering(selectedMachine);
                  setForm({
                    ...form,
                    ten_moi_han_theo_may: scheme === "k922" ? raw.replace(/[^\d]/g, "") : raw.toUpperCase(),
                  });
                }}
                placeholder={machineWeldCodePlaceholder(form.performedAt, selectedMachine)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden font-mono focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                {machineWeldCodeHint(selectedMachine)}
              </span>
            </label>
          </div>

          <div className={`grid grid-cols-1 gap-3.5 ${quickActive ? "" : "sm:grid-cols-2"}`}>
            {!quickActive && (
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày giờ
              <DateField
                withTime
                value={form.performedAt}
                onChange={(performedAt) => setForm({ ...form, performedAt })}
                className="mt-1.5"
              />
            </label>
            )}
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Tình trạng thí nghiệm
              <SelectMenu
                disabled={qualityRecorded}
                value={form.result}
                onChange={(result) => setForm({ ...form, result: result as JournalFormValues["result"] })}
                options={["Chờ thí nghiệm", "Đạt", "Không đạt", "Không thí nghiệm"].map((value) => ({ value, label: value }))}
                className="mt-1.5"
                buttonClassName="h-10 shadow-2xs"
              />
              {qualityRecorded && <span className="mt-1 block text-xs font-normal text-slate-500">Kết quả đã ghi nhận; cập nhật trong Kiểm tra chất lượng.</span>}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ca hàn
              <SelectMenu
                value={form.ca_han}
                onChange={(ca_han) => setForm({ ...form, ca_han: ca_han as WeldShift })}
                options={WELD_SHIFTS.map((value) => ({ value, label: value }))}
                className="mt-1.5"
                buttonClassName="h-10 shadow-2xs"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Từ giờ
              <input
                type="time"
                value={form.gio_bat_dau}
                onChange={(event) => {
                  const gio_bat_dau = event.target.value;
                  setForm((current) => ({
                    ...current,
                    gio_bat_dau,
                    gio_ket_thuc: gio_bat_dau
                      ? addHoursToWeldTime(gio_bat_dau, DEFAULT_WELD_WORK_HOURS)
                      : current.gio_ket_thuc,
                  }));
                }}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Đến giờ
              <input
                type="time"
                value={form.gio_ket_thuc}
                onChange={(event) => setForm({ ...form, gio_ket_thuc: event.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Nghỉ trưa (giờ)
              <input
                inputMode="decimal"
                value={form.gio_nghi_trua}
                onChange={(event) => setForm({ ...form, gio_nghi_trua: event.target.value.replace(/[^0-9.,]/g, "") })}
                placeholder="VD: 1 hoặc 1.5"
                title="Chỉ dùng tính giờ chạy máy, không in ra báo cáo"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </label>
            <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Số tiếng
              <div className="mt-1.5 flex h-10 min-w-[84px] items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs sm:text-sm font-bold text-[#0047AB]">
                {formatWeldWorkHours(netWeldHours(form.gio_bat_dau, form.gio_ket_thuc, form.gio_nghi_trua)) || "—"}
              </div>
            </div>
          </div>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Người trực tiếp hàn
            <SelectMenu
              value={form.tho_han_id}
              onChange={(tho_han_id) => setForm({ ...form, tho_han_id })}
              options={welders.map((w) => {
                const qualified = qualifiedWelders.some((item) => item.id === w.id);
                return {
                  value: w.id,
                  label: w.label,
                  hint: shouldCheckCertificate
                    ? qualified
                      ? "Đủ chứng chỉ"
                      : "Thiếu chứng chỉ"
                    : `${w.certificates.length} chứng chỉ`,
                };
              })}
              searchable
              placeholder={welders.length === 0 ? "Chưa có dữ liệu thợ hàn" : "Chọn người trực tiếp hàn"}
              searchPlaceholder="Gõ tên để tìm thợ hàn..."
              className="mt-1.5"
              buttonClassName="h-10 shadow-2xs"
            />
            {shouldCheckCertificate && (
              <span className={`mt-1.5 block rounded-lg border px-2.5 py-2 text-[11px] font-medium ${qualifiedWelders.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                Yêu cầu: {describeCertificateRequirement(qualificationContext)} · {qualifiedWelders.length} nhân sự phù hợp
              </span>
            )}
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Chứng chỉ sử dụng
            <SelectMenu
              value={form.chung_chi_su_dung}
              onChange={pickCertificate}
              options={[...selectedEligibleCertificates]
                .sort(
                  (a, b) =>
                    Number(isCertificateCompatibleWithMachine(b, selectedMachine)) -
                    Number(isCertificateCompatibleWithMachine(a, selectedMachine)),
                )
                .map((certificate) => ({
                  value: certificate,
                  label: certificate,
                  hint: selectedMachine
                    ? isCertificateCompatibleWithMachine(certificate, selectedMachine)
                      ? "Khớp máy đang chọn"
                      : "Khác loại máy — chọn sẽ đổi máy"
                    : undefined,
                }))}
              searchable={selectedEligibleCertificates.length > 5}
              placeholder={
                selectedEligibleCertificates.length === 0
                  ? "Nhân sự chưa có chứng chỉ trong hồ sơ"
                  : "Chọn chứng chỉ"
              }
              searchPlaceholder="Tìm chứng chỉ..."
              emptyLabel="Nhân sự chưa có chứng chỉ trong hồ sơ"
              className="mt-1.5"
              buttonClassName="h-10 shadow-2xs"
            />
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Máy thực hiện
            <SelectMenu
              value={form.may_id}
              onChange={pickMachine}
              options={[
                ...(form.may_id && !machines.some((machine) => machine.id === form.may_id)
                  ? [{ value: form.may_id, label: "Máy đã gắn không có trong danh mục hiện tại" }]
                  : []),
                ...[...machines]
                  .sort(
                    (a, b) =>
                      Number(isCertificateCompatibleWithMachine(form.chung_chi_su_dung, b)) -
                      Number(isCertificateCompatibleWithMachine(form.chung_chi_su_dung, a)),
                  )
                  .map((machine) => ({
                    value: machine.id,
                    label: machine.name.trim() || machine.code,
                    hint: selectedCertificateFamily
                      ? isCertificateCompatibleWithMachine(form.chung_chi_su_dung, machine)
                        ? "Khớp chứng chỉ"
                        : "Khác loại chứng chỉ"
                      : undefined,
                  })),
              ]}
              searchable={machines.length > 5}
              placeholder={machines.length === 0 ? "Chưa có danh mục máy" : "— Chọn máy thực hiện —"}
              searchPlaceholder="Tìm máy theo tên..."
              className="mt-1.5"
              buttonClassName="h-10 shadow-2xs"
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              Chọn chứng chỉ sẽ tự chuyển sang máy cùng loại và ngược lại. Báo cáo máy tự cộng mối hàn theo lựa chọn này.
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại ray
              <SelectMenu
                value={form.loai_ray}
                onChange={(loai_ray) => setForm({ ...form, loai_ray })}
                options={railOptions.map((rail) => ({ value: rail, label: rail }))}
                className="mt-1.5"
                buttonClassName="h-10 shadow-2xs"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Công nghệ
              <SelectMenu
                value={form.cong_nghe_han}
                onChange={(cong_nghe_han) => setForm({ ...form, cong_nghe_han: cong_nghe_han as JournalFormValues["cong_nghe_han"] })}
                options={["FBW", "ATW"].map((value) => ({ value, label: value }))}
                className="mt-1.5"
                buttonClassName="h-10 shadow-2xs"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại mối
              <SelectMenu
                value={form.loai_moi_han}
                onChange={(loai_moi_han) => setForm({ ...form, loai_moi_han: loai_moi_han as JournalFormValues["loai_moi_han"] })}
                options={WELD_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
                className="mt-1.5"
                buttonClassName="h-10 shadow-2xs"
              />
            </label>
          </div>

          {!quickActive && form.result === "Không đạt" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-800">
                  Mã khuyết tật mối hàn (NDT)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NDT_DEFECTS.map((defect) => {
                    const isSelected = form.ma_khuyet_tat.includes(defect.code);
                    const label = ndtDefectLabel(defect.code, lang);
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
                        title={`${defect.code} — ${label}`}
                        data-no-i18n="true"
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!quickActive && (
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Ghi chú
            <textarea
              value={form.ghi_chu}
              onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 resize-y"
            />
          </label>
          )}
          </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={() => void closeAndCleanUp()}
            disabled={uploadingImages || saving}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || uploadingImages || projects.length === 0 || welders.length === 0 || machines.length === 0 || (quickActive && (bulkSpanTooLong || bulkTotal < 1))}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs disabled:opacity-60 transition-all duration-150 cursor-pointer"
          >
            {saving
              ? (quickActive ? (bulkProgress || "Đang điền…") : "Đang lưu…")
              : uploadingImages
                ? "Đang tải ảnh…"
                : mode === "edit"
                  ? "Lưu thay đổi"
                  : quickActive
                    ? "Nhập nhanh"
                    : "Thêm nhật ký"}
          </button>
        </div>
      </div>
    </div>
  );
}

function listIsoDates(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
    if (dates.length > 31) break;
  }
  return dates;
}

type BulkFillValues = {
  du_an_id: string;
  dateFrom: string;
  dateTo: string;
  count: number;
  tho_han_id: string;
  may_id: string;
  loai_ray: string;
  cong_nghe_han: WeldReportRow["cong_nghe_han"];
  loai_moi_han: WeldReportRow["loai_moi_han"];
  result: WeldTestStatus;
  ca_han: WeldShift;
  gio_bat_dau?: string;
  gio_ket_thuc?: string;
  chung_chi_su_dung: string;
  ma_hien_truong?: string;
  ten_moi_han_theo_may?: string;
};

export default function WeldingJournalList({
  lockedResultFilter,
  heading = "NHẬT KÝ HÀN",
}: {
  lockedResultFilter?: WeldTestStatus;
  heading?: string;
} = {}) {
  const failedWeldMode = lockedResultFilter === "Không đạt";
  const { lang, t } = useLanguage();
  const router = useRouter();
  const { points: gpsPoints, loading: gpsLoading, error: gpsError, refetch: refetchGpsPoints } = useWeldLogGpsPoints();

  const [searchDraft, setSearchDraft] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState(lockedResultFilter ?? "Tất cả");
  const [qualityStatusSelect, setQualityStatusSelect] = useState("Tất cả");
  // Ba nhật ký theo giai đoạn của mối hàn; chọn giai đoạn thì thay cho ô lọc "Tình trạng chất lượng".
  const [stage, setStage] = useState<JournalStage>("all");
  const qualityStatusFilter = JOURNAL_STAGES.find((s) => s.id === stage)?.statuses?.join(",") ?? qualityStatusSelect;
  const [qualityReady, setQualityReady] = useState(false);
  const [qualityError, setQualityError] = useState("");
  const [qualityRow, setQualityRow] = useState<WeldReportRow | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<Map<string, WeldQualitySelection>>(new Map());
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkQualityEntries, setBulkQualityEntries] = useState<WeldQualitySelection[] | null>(null);
  const selectionToken = useRef(0);
  const qualityExcelInputRef = useRef<HTMLInputElement>(null);
  const [qualityImporting, setQualityImporting] = useState(false);
  const [qualityImportReport, setQualityImportReport] = useState("");
  const [linkedWeldFilter, setLinkedWeldFilter] = useState("Tất cả");
  const [weldTypeFilter, setWeldTypeFilter] = useState("Tất cả");
  const [weldMethodFilter, setWeldMethodFilter] = useState("Tất cả");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WeldReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [untestedCount, setUntestedCount] = useState(0);
  const testedCount = passCount + failCount;
  const errorRate = testedCount > 0
    ? `${((failCount / testedCount) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`
    : "—";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [autolispBulkOpen, setAutolispBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkFillSaving, setBulkFillSaving] = useState(false);
  const [bulkFillProgress, setBulkFillProgress] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");
  const [editingRow, setEditingRow] = useState<WeldReportRow | null>(null);
  const [editingForm, setEditingForm] = useState<JournalFormValues | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);
  const [machineError, setMachineError] = useState("");
  const [personnelWelderOptions, setPersonnelWelderOptions] = useState<CertifiedWelderOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<JournalProjectOption[]>([]);

  useEffect(() => {
    if (lockedResultFilter) setResultFilter(lockedResultFilter);
  }, [lockedResultFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("query")?.trim() || params.get("q")?.trim() || "";
    const from = params.get("from")?.trim() || "";
    const to = params.get("to")?.trim() || from;
    if (initialQuery) {
      setSearchDraft(initialQuery);
      setAppliedQuery(initialQuery);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) setDateFrom(from);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) setDateTo(to);
  }, []);

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
    const filters = {
      page,
      pageSize: PAGE_SIZE,
      query: appliedQuery,
      projects: projectFilter,
      resultFilter,
      linkedWeldFilter,
      weldTypeFilter,
      weldMethodFilter,
      dateFrom,
      dateTo,
      qualityStatusFilter,
    };
    setQualityReady(false);
    const loadPage = async () => {
      try {
        const result = await loadQualityJournal(filters);
        if (active) { setQualityReady(true); setQualityError(""); }
        return result;
      } catch (qualityLoadError) {
        if (active) setQualityError(qualityLoadError instanceof Error ? qualityLoadError.message : "Không tải được chất lượng.");
        if (qualityStatusFilter !== "Tất cả") throw qualityLoadError;
        return loadWeldJournalPage(filters);
      }
    };
    loadPage()
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setPassCount(result.passCount);
        setFailCount(result.failCount);
        setPendingCount(result.pendingCount);
        setUntestedCount(result.untestedCount);
      })
      .catch((loadError) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setPassCount(0);
        setFailCount(0);
        setPendingCount(0);
        setUntestedCount(0);
        setError(loadError instanceof Error ? loadError.message : "Không tải được nhật ký hàn");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, appliedQuery, projectFilter, resultFilter, linkedWeldFilter, weldTypeFilter, weldMethodFilter, dateFrom, dateTo, qualityStatusFilter, reloadToken]);

  useEffect(() => {
    selectionToken.current += 1;
    setSelectedQuality(new Map());
    setSelectingAll(false);
  }, [appliedQuery, projectFilter, resultFilter, linkedWeldFilter, weldTypeFilter, weldMethodFilter, dateFrom, dateTo, qualityStatusFilter]);

  const welderOptions = personnelWelderOptions;
  const projects = useMemo(
    () => projectOptions.map((item) => item.label),
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
    // Ngày mới trước; trong ngày sắp theo mã hệ thống tăng dần (0001 → n).
    const orderedRows = [...rows].sort(
      (a, b) =>
        compareNewestDate(a.ngay_thuc_hien, b.ngay_thuc_hien) ||
        a.ma_lich_su.localeCompare(b.ma_lich_su, "vi") ||
        (a.gio_han || "").localeCompare(b.gio_han || "") ||
        a.id.localeCompare(b.id),
    );
    return orderedRows.map((row) => {
      const codeKey = row.ma_lich_su.trim().toLocaleLowerCase("vi");
      const gpsPoint =
        gpsByWeldId.get(row.id) ??
        gpsByWeldCode.get(codeKey) ??
        gpsByPointCode.get(codeKey) ??
        null;
      const isoDate = row.ngay_thuc_hien?.slice(0, 10) ?? "";
      // Chỉ hiện ngày — giờ chia đều tự điền, không cần trên danh sách.
      const performedDate = isoDate
        ? formatJournalDateIso(isoDate)
        : `Chỉ có năm ${row.nam_thuc_hien}`;
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
        machine: row.ten_may?.trim() || row.ma_may?.trim() || "Chưa gán máy",
        weldName: displayWeldCode(row.ma_lich_su),
        machineCode: row.ten_moi_han_theo_may?.trim() || "—",
        siteCode: row.ma_hien_truong?.trim() || "—",
        lispCode: row.ma_diem?.trim() || gpsPoint?.code?.trim() || "—",
        workTime: formatWeldWorkRange(row.gio_bat_dau, row.gio_ket_thuc),
        workHours: formatWeldWorkHours(weldWorkHours(row.gio_bat_dau, row.gio_ket_thuc)) || "—",
        linkedWeld: row.moi_han_lien_ket?.trim() || "—",
        project: row.du_an,
        weldType: row.loai_moi_han,
        weldMethod: row.cong_nghe_han,
        location: gpsPoint
          ? `${gpsPoint.chainage} · ${gpsPoint.latitude.toFixed(6)}, ${gpsPoint.longitude.toFixed(6)}`
          : "Chưa liên kết GPS",
        mapUrl: gpsPoint ? googleOpenPoint(gpsPoint.latitude, gpsPoint.longitude) : "",
        failureReason: pass
          ? "—"
          : (row.ma_khuyet_tat && row.ma_khuyet_tat.length > 0)
            ? row.ma_khuyet_tat.map((code) => ndtDefectLabel(code, lang)).join(", ")
            : (row.nguyen_nhan_loi?.trim() || row.ghi_chu?.trim() || "Chưa ghi nguyên nhân"),
        resultType: pass ? ("pass" as const) : ("fail" as const),
        testStatus,
        qualityStatus: row.tinh_trang_chat_luong,
        qualityVersion: row.phien_ban_chat_luong ?? 0,
        shift: resolveWeldShift(row),
      };
    });
  }, [lang, rows, gpsPoints]);

  const gpsPointForRow = useCallback(
    (raw: WeldReportRow) =>
      gpsPoints.find((point) => point.weldId === raw.id) ??
      gpsPoints.find(
        (point) =>
          point.weldCode?.trim().toLocaleLowerCase("vi") ===
          raw.ma_lich_su.trim().toLocaleLowerCase("vi"),
      ) ??
      null,
    [gpsPoints],
  );

  const openEditById = useCallback(
    (id: string) => {
      const raw = rows.find((row) => row.id === id);
      if (!raw) return;
      setEditingRow(raw);
      setEditingForm(journalRowToForm(raw, gpsPointForRow(raw)));
      setFormOpen(true);
      void loadWeldLunchBreak(raw.id).then((hours) => {
        if (hours > 0) {
          setEditingForm((current) => (current ? { ...current, gio_nghi_trua: String(hours) } : current));
        }
      });
    },
    [rows, gpsPointForRow],
  );

  const detailRaw = detailId ? rows.find((row) => row.id === detailId) ?? null : null;
  const detailView = detailId ? pageRows.find((w) => w.id === detailId) ?? null : null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(currentPage * PAGE_SIZE, total);

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, projectFilter, resultFilter, linkedWeldFilter, weldTypeFilter, weldMethodFilter, dateFrom, dateTo, qualityStatusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const refetch = useCallback(() => {
    invalidateWeldReportCache();
    setReloadToken((token) => token + 1);
    void refetchGpsPoints();
  }, [refetchGpsPoints]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function qualityFilters() {
    return { page: 1, query: appliedQuery, projects: projectFilter, resultFilter, linkedWeldFilter, weldTypeFilter, weldMethodFilter, dateFrom, dateTo, qualityStatusFilter };
  }

  function toggleQualityRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || !qualityReady) return;
    setSelectedQuality((current) => {
      const next = new Map(current);
      if (next.has(id)) next.delete(id);
      else next.set(id, { id, ma_lich_su: row.ma_lich_su, phien_ban: row.phien_ban_chat_luong ?? 0 });
      return next;
    });
  }

  const pageSelected = rows.length > 0 && rows.every((r) => selectedQuality.has(r.id));
  function toggleQualityPage() {
    setSelectedQuality((current) => {
      const next = new Map(current);
      for (const row of rows) {
        if (pageSelected) next.delete(row.id);
        else next.set(row.id, { id: row.id, ma_lich_su: row.ma_lich_su, phien_ban: row.phien_ban_chat_luong ?? 0 });
      }
      return next;
    });
  }

  async function selectAllQuality() {
    const token = ++selectionToken.current;
    setSelectingAll(true);
    try {
      const { entries } = await selectFilteredQuality(qualityFilters());
      if (token === selectionToken.current) setSelectedQuality(new Map(entries.map((e) => [e.id, e])));
    } catch (err) { if (token === selectionToken.current) setQualityError(err instanceof Error ? err.message : "Không chọn được danh sách."); }
    finally { if (token === selectionToken.current) setSelectingAll(false); }
  }

  async function handleQualityExcel(file: File) {
    setQualityImporting(true); setQualityImportReport("");
    let saved = 0;
    let cancelled = false;
    const failures: string[] = [];
    try {
      const entries = await parseWeldQualityExcel(file);
      if (!window.confirm(`Nhập kiểm tra cho ${entries.length} mối? Ô trống giữ dữ liệu hiện tại. Mối có phiên bản đã thay đổi sẽ bị từ chối.`)) { cancelled = true; return; }
      for (let offset = 0; offset < entries.length; offset += 100) {
        setQualityImportReport(`Đang nhập ${offset}/${entries.length} kiểm tra…`);
        const { results } = await qualityRequest<{ results: { id: string; error?: string }[] }>({ action: "import", entries: entries.slice(offset, offset + 100) });
        for (const result of results) {
          if (result.error) failures.push(`${result.id}: ${result.error}`);
          else saved += 1;
        }
      }
    } catch (err) { failures.push(err instanceof Error ? err.message : "Không nhập được file kiểm tra."); }
    finally {
      setQualityImporting(false);
      if (!cancelled) {
        setSelectedQuality(new Map()); refetch();
        setQualityImportReport(`Đã lưu ${saved} kiểm tra.${failures.length ? `\n${failures.join("\n")}` : ""}`);
        notifyWeldQualityChanged();
      }
    }
  }

  async function confirmDeleteJournal() {
    if (!pendingDeleteId || deleting) return;
    setDeleting(true);
    try {
      await deleteWeldJournalEntry(pendingDeleteId);
      if (detailId === pendingDeleteId) setDetailId(null);
      setPendingDeleteId(null);
      refetch();
      showToast("Đã xóa nhật ký hàn");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể xóa nhật ký hàn");
    } finally {
      setDeleting(false);
    }
  }

  /** Xuất biên bản Appendix 5 (FBW) theo bộ lọc: mỗi ngày × 20 mối hàn một file. */
  async function handleExportAppendix5() {
    if (exporting) return;
    setExporting(true);
    try {
      const { fillAppendix5Fbw, APPENDIX5_MAX_ROWS } = await import("@/lib/fillAppendix5Fbw");
      const exportRows = (
        await exportFilteredWeldJournal({
          query: appliedQuery,
          projects: projectFilter,
          resultFilter,
          linkedWeldFilter,
          weldTypeFilter,
          weldMethodFilter: "FBW",
          dateFrom,
          dateTo,
        })
      )
        .filter((row) => row.cong_nghe_han === "FBW" && row.ngay_thuc_hien)
        .sort(
          (a, b) =>
            (a.ngay_thuc_hien ?? "").localeCompare(b.ngay_thuc_hien ?? "") ||
            a.ma_lich_su.localeCompare(b.ma_lich_su, "vi"),
        );
      if (!exportRows.length) {
        setToast("Không có mối hàn FBW nào trong bộ lọc để xuất biên bản.");
        return;
      }
      const byDate = new Map<string, WeldReportRow[]>();
      for (const row of exportRows) {
        const key = row.ngay_thuc_hien!.slice(0, 10);
        byDate.set(key, [...(byDate.get(key) ?? []), row]);
      }
      let files = 0;
      for (const [iso, dayRows] of byDate) {
        for (let start = 0; start < dayRows.length; start += APPENDIX5_MAX_ROWS) {
          const chunk = dayRows.slice(start, start + APPENDIX5_MAX_ROWS);
          const blob = await fillAppendix5Fbw(
            chunk.map((row) => ({ row, chainage: gpsPointForRow(row)?.chainage })),
            { date: formatJournalDateIso(iso), location: chunk[0].du_an },
          );
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `Appendix5-FBW-${iso}${dayRows.length > APPENDIX5_MAX_ROWS ? `-${start / APPENDIX5_MAX_ROWS + 1}` : ""}.xlsx`;
          link.click();
          URL.revokeObjectURL(url);
          files++;
        }
      }
      setToast(`Đã xuất ${files} biên bản Appendix 5 (${exportRows.length} mối hàn FBW).`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không xuất được biên bản Appendix 5.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const exportFilters = {
        query: appliedQuery,
        projects: projectFilter,
        resultFilter,
        linkedWeldFilter,
        weldTypeFilter,
        weldMethodFilter,
        dateFrom,
        dateTo,
      };
      const exportRows = qualityReady || qualityStatusFilter !== "Tất cả"
        ? (await exportQualityJournal({ ...exportFilters, page: 1, qualityStatusFilter })).rows
        : await exportFilteredWeldJournal(exportFilters);

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
          "Giờ hàn": normalizeWeldTime(row.gio_han) ?? "",
          "Mã bản ghi": row.id,
          "Mã hệ thống": row.ma_lich_su,
          "Mã vị trí": row.ma_diem?.trim() || gpsPoint?.code?.trim() || "",
          "Mã trong máy": row.ten_moi_han_theo_may?.trim() || "",
          "Mã hiện trường": row.ma_hien_truong?.trim() || "",
          "Mối hàn liên kết": row.moi_han_lien_ket?.trim() || "",
          "Welding ID": row.ma_nhan_su,
          "Người trực tiếp hàn": row.ten_tho_han,
          "Tổ hàn": row.to_han?.trim() || "",
          "Chứng chỉ sử dụng": row.chung_chi_su_dung?.trim() || "",
          "Mã máy": row.ma_may?.trim() || "",
          "Tên máy": row.ten_may?.trim() || "",
          "Mã dự án": row.ma_du_an,
          "Dự án": row.du_an,
          "Ca hàn": resolveWeldShift(row),
          "Từ giờ": normalizeWeldTime(row.gio_bat_dau) ?? "",
          "Đến giờ": normalizeWeldTime(row.gio_ket_thuc) ?? "",
          "Số giờ": weldWorkHours(row.gio_bat_dau, row.gio_ket_thuc) ?? "",
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
          ...(qualityReady ? qualityExcelColumns(row) : {}),
        };
      });

      // Xuất file theo ngôn ngữ đang chọn: EN dịch tiêu đề cột và các giá trị cố định (ca, kết quả...).
      const exportData = lang === "en"
        ? data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [t(key), typeof value === "string" ? t(value) : value])))
        : data;
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet["!cols"] = [
        { wch: 7 }, { wch: 17 }, { wch: 10 }, { wch: 38 }, { wch: 25 },
        { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 24 },
        { wch: 15 }, { wch: 45 }, { wch: 18 }, { wch: 30 }, { wch: 16 },
        { wch: 48 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
        { wch: 14 }, { wch: 20 }, { wch: 36 }, { wch: 20 }, { wch: 36 },
      ];
      if (worksheet["!ref"]) worksheet["!autofilter"] = { ref: worksheet["!ref"] };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, t("Nhật ký hàn"));
      XLSX.writeFile(
        workbook,
        `${lang === "en" ? "Weld_journal" : "Nhat_ky_moi_han"}_${defaultPerformedAt().slice(0, 10)}.xlsx`,
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
          const sitePrefix = normalizeWeldSitePrefix(project.ma_du_an);
          const prefix = buildWeldCodePrefix(
            row.cong_nghe_han,
            `${row.ngay_thuc_hien}T08:00`,
            sitePrefix,
            row.loai_moi_han,
          );
          const existing = await loadWeldCodesWithPrefix(prefix);
          const allExisting = [...existing, ...usedCodes];
          maLichSu = suggestWeldCode(
            row.cong_nghe_han,
            `${row.ngay_thuc_hien}T08:00`,
            allExisting,
            sitePrefix,
            row.loai_moi_han,
          );
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
            ca_han: row.ca_han,
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

  async function handleBulkFill(values: BulkFillValues) {
    const dates = listIsoDates(values.dateFrom, values.dateTo);
    const count = Math.round(values.count);
    if (!values.du_an_id || !values.tho_han_id || !values.may_id || !values.chung_chi_su_dung) {
      window.alert("Chọn đủ dự án, thợ hàn, chứng chỉ và máy.");
      return false;
    }
    if (dates.length === 0 || dates.length > 31 || count < 1 || count > 100) {
      window.alert("Chọn khoảng ngày tối đa 31 ngày và số mối mỗi ngày từ 1 đến 100.");
      return false;
    }
    const total = dates.length * count;
    const project = projectOptions.find((item) => item.id === values.du_an_id);
    const confirmed = window.confirm(
      `KIỂM TRA DỰ ÁN: «${(project?.label ?? "").toUpperCase()}» — đúng dự án chưa?

Tạo ${count.toLocaleString("vi-VN")} mối mỗi ngày cho dự án "${project?.label ?? ""}", từ ${formatJournalDateIso(values.dateFrom)} đến ${formatJournalDateIso(values.dateTo)}.\nTổng ${total.toLocaleString("vi-VN")} bản ghi. Tiếp tục?`,
    );
    if (!confirmed) return false;

    setBulkFillSaving(true);
    setBulkFillProgress("");
    try {
      const sitePrefix = normalizeWeldSitePrefix(project?.ma_du_an);
      const prefix = buildWeldCodePrefix(
        values.cong_nghe_han,
        `${values.dateFrom}T08:00`,
        sitePrefix,
        values.loai_moi_han,
      );
      const machine = machineOptions.find((item) => item.id === values.may_id);
      const scheme = detectMachineWeldNumbering(machine);
      const [prefixCodes, machineCodesDay0] = await Promise.all([
        loadWeldCodesWithPrefix(prefix),
        loadMachineFieldCodesForSuggestion(values.dateFrom, machine),
      ]);
      const usedCodes = new Set(prefixCodes);
      const usedMachineCodes = new Set(machineCodesDay0);
      let done = 0;
      let prevDate = "";
      for (const date of dates) {
        if (date !== prevDate && scheme !== "k922") {
          const dayCodes =
            date === values.dateFrom
              ? machineCodesDay0
              : await loadMachineFieldCodesForSuggestion(date, machine);
          for (const code of dayCodes) usedMachineCodes.add(code);
          prevDate = date;
        } else if (date !== prevDate) {
          prevDate = date;
        }
        for (let index = 0; index < count; index += 1) {
          // TT tăng dần 0001→n; mã hiện trường / trong máy khớp cùng số.
          const maLichSu = suggestWeldCode(
            values.cong_nghe_han,
            `${date}T08:00`,
            [...usedCodes],
            sitePrefix,
            values.loai_moi_han,
          );
          usedCodes.add(maLichSu);
          const nextSiteCode = fieldCodeFromSystemCode(maLichSu);
          const nextMachineCode = suggestMachineWeldCodeForMachine(date, [...usedMachineCodes], machine);
          if (nextMachineCode) usedMachineCodes.add(nextMachineCode);
          const gioHan = spreadWeldSlotTime(values.gio_bat_dau, values.gio_ket_thuc, index, count);
          await insertWeldJournalEntry({
            ma_lich_su: maLichSu,
            du_an_id: values.du_an_id,
            tho_han_id: values.tho_han_id,
            nam_thuc_hien: Number(date.slice(0, 4)),
            ngay_thuc_hien: date,
            loai_ray: values.loai_ray,
            loai_moi_han: values.loai_moi_han,
            cong_nghe_han: values.cong_nghe_han,
            so_luong_loi: values.result === "Không đạt" ? 1 : 0,
            ma_khuyet_tat: [],
            tinh_trang_thi_nghiem: values.result,
            nguyen_nhan_loi: null,
            ghi_chu: null,
            moi_han_lien_ket: null,
            may_id: values.may_id,
            chung_chi_su_dung: values.chung_chi_su_dung,
            hach_toan: "HT-SX01",
            toa_do_id: null,
            kinh_do: null,
            vi_do: null,
            ly_trinh: null,
            ca_han: values.ca_han,
            gio_han: gioHan,
            gio_bat_dau: values.gio_bat_dau,
            gio_ket_thuc: values.gio_ket_thuc,
            ma_hien_truong: nextSiteCode || null,
            ten_moi_han_theo_may: nextMachineCode || null,
          });
          done += 1;
          setBulkFillProgress(`Đang điền ${done.toLocaleString("vi-VN")}/${total.toLocaleString("vi-VN")}`);
        }
      }
      setFormOpen(false);
      setEditingRow(null);
      setEditingForm(null);
      rememberJournalEntry(values);
      refetch();
      showToast(`Đã điền ${done.toLocaleString("vi-VN")} mối hàn`);
      return true;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không điền được mối hàn");
      return false;
    } finally {
      setBulkFillSaving(false);
      setBulkFillProgress("");
    }
  }

  /** Mã tọa độ gõ tay: cần HT/HP/TT/TP + số và kinh/vĩ độ hợp lệ. */
  function manualCoordinateError(values: JournalFormValues) {
    if (values.toa_do_id || !values.ma_toa_do.trim()) return "";
    if (!parseCoordinateCode(values.ma_toa_do)) return "Mã tọa độ phải là HT/HP/TT/TP + số (vd HT0001).";
    const lon = Number(values.kinh_do.replace(",", "."));
    const lat = Number(values.vi_do.replace(",", "."));
    if (!values.kinh_do.trim() || !values.vi_do.trim() || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      return "Nhập kinh độ và vĩ độ cho mã tọa độ.";
    }
    return "";
  }

  async function saveManualCoordinate(values: JournalFormValues, weldId: string) {
    const res = await setWeldPointCode({
      code: values.ma_toa_do,
      longitude: Number(values.kinh_do.replace(",", ".")),
      latitude: Number(values.vi_do.replace(",", ".")),
      chainage: values.ly_trinh || undefined,
      weldId,
      weldCode: values.ma_lich_su,
      projectId: values.du_an_id || null,
    });
    if (res.error) throw new Error(res.error);
  }

  async function handleCreate(values: JournalFormValues) {
    setSaving(true);
    try {
      // Chỉ nhập kinh/vĩ độ: RPC tự tạo điểm mã TT toàn cục → đặt lại mã 1→n theo tuyến (dự án).
      if (!values.toa_do_id && !values.ma_toa_do.trim() && values.kinh_do.trim() && values.vi_do.trim()) {
        const routeCodes = gpsPoints
          .filter((point) => (point.projectId ?? "") === values.du_an_id)
          .map((point) => point.code);
        values = { ...values, ma_toa_do: suggestCoordinateCode("TT", routeCodes) };
      }
      const coordError = manualCoordinateError(values);
      if (coordError) throw new Error(coordError);
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
          ? (values.ma_khuyet_tat.join(", ") || values.ghi_chu.trim() || null)
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
        anh_moi_han_lien_ket: values.anh_moi_han_lien_ket,
        ca_han: values.ca_han,
        gio_han: values.performedAt.slice(11, 16),
        ten_moi_han_theo_may: values.ten_moi_han_theo_may,
        ma_hien_truong: values.ma_hien_truong,
        gio_bat_dau: values.gio_bat_dau,
        gio_ket_thuc: values.gio_ket_thuc,
        gio_nghi_trua: parseLunchHours(values.gio_nghi_trua),
      });
      // RPC thường đã gắn toa_do; gọi lại để chắc mã vị trí hiện trên bảng.
      if (values.toa_do_id) {
        const supabase = createClient();
        const { data: created } = await supabase
          .from("lich_su_moi_han")
          .select("id")
          .eq("ma_lich_su", values.ma_lich_su.trim())
          .maybeSingle();
        if (created?.id) {
          await linkGpsPointToWeld(values.toa_do_id, created.id);
        }
      } else if (values.ma_toa_do.trim()) {
        const supabase = createClient();
        const { data: created } = await supabase
          .from("lich_su_moi_han")
          .select("id")
          .eq("ma_lich_su", values.ma_lich_su.trim())
          .maybeSingle();
        if (created?.id) await saveManualCoordinate(values, created.id);
      }
      setFormOpen(false);
      setEditingRow(null);
      setEditingForm(null);
      rememberJournalEntry(values);
      refetch();
      showToast("Đã thêm nhật ký hàn");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể lưu nhật ký hàn");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(values: JournalFormValues) {
    if (!editingRow) return;
    setSaving(true);
    try {
      const coordError = manualCoordinateError(values);
      if (coordError) throw new Error(coordError);
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
          ? (values.ma_khuyet_tat.join(", ") || values.ghi_chu.trim() || null)
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
        anh_moi_han_lien_ket: values.anh_moi_han_lien_ket,
        ca_han: values.ca_han,
        gio_han: values.performedAt.slice(11, 16),
        ten_moi_han_theo_may: values.ten_moi_han_theo_may,
        ma_hien_truong: values.ma_hien_truong,
        gio_bat_dau: values.gio_bat_dau,
        gio_ket_thuc: values.gio_ket_thuc,
        gio_nghi_trua: parseLunchHours(values.gio_nghi_trua),
      });

      if (values.toa_do_id) {
        await linkGpsPointToWeld(values.toa_do_id, editingRow.id);
      } else if (values.ma_toa_do.trim()) {
        if (currentPoint) {
          await deleteMapPoint(currentPoint.id);
        }
        await saveManualCoordinate(values, editingRow.id);
      } else {
        await unlinkGpsPointsFromWeld(editingRow.id);
      }

      setFormOpen(false);
      setEditingRow(null);
      setEditingForm(null);
      refetch();
      showToast("Đã cập nhật nhật ký hàn");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể cập nhật nhật ký hàn");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          Không tải được Supabase: {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{total.toLocaleString("vi-VN")}</strong> bản ghi
        </span>
        {!failedWeldMode ? (
          <>
            <span className="text-slate-300">|</span>
            <span>
              <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{passCount.toLocaleString("vi-VN")}</strong> đạt ·{" "}
              <strong className="font-semibold text-rose-700 font-mono tabular-nums">{failCount.toLocaleString("vi-VN")}</strong> không đạt
            </span>
            <span className="text-slate-300">|</span>
            <span><strong className="font-semibold text-amber-700 font-mono tabular-nums">{pendingCount.toLocaleString("vi-VN")}</strong> chờ thí nghiệm</span>
            <span><strong className="font-semibold text-slate-700 font-mono tabular-nums">{untestedCount.toLocaleString("vi-VN")}</strong> không thí nghiệm</span>
            <span className="text-slate-300">|</span>
            <span>
              {testedCount.toLocaleString("vi-VN")} mối đã thí nghiệm
              {" · "}Tỷ lệ lỗi: <strong className="text-rose-700 font-mono tabular-nums">{errorRate}</strong>
            </span>
          </>
        ) : null}
      </div>

      {!failedWeldMode && (
        <div role="tablist" aria-label="Nhật ký theo giai đoạn" className="mb-3 flex flex-wrap gap-1.5">
          {JOURNAL_STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={stage === s.id}
              title={s.hint}
              onClick={() => { setStage(s.id); setPage(1); }}
              className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors cursor-pointer ${
                stage === s.id ? "bg-[#0047AB] text-white shadow-xs" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 space-y-2.5">
       <form
         className="flex flex-col gap-2 sm:flex-row sm:items-end"
         onSubmit={(event) => {
           event.preventDefault();
           setAppliedQuery(searchDraft.trim());
           setPage(1);
         }}
       >
         <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">
           Tìm theo mã (hệ thống / hiện trường / trong máy)
           <input
             value={searchDraft}
             onChange={(event) => setSearchDraft(event.target.value)}
             placeholder="VD: PQ-FBW-… · FBW-25-10-26-0001 · 25-10-26-0001"
             className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
           />
         </label>
         <div className="flex gap-2">
           <button
             type="submit"
             className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white hover:bg-[#00388A] cursor-pointer sm:text-sm"
           >
             Tìm
           </button>
           {(searchDraft || appliedQuery) && (
             <button
               type="button"
               onClick={() => {
                 setSearchDraft("");
                 setAppliedQuery("");
                 setPage(1);
               }}
               className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer sm:text-sm"
             >
               Xóa
             </button>
           )}
         </div>
       </form>
       <div className="grid grid-cols-2 gap-2.5 items-end">
        <div className="col-span-2 min-w-0 text-xs font-semibold text-slate-700">
          Dự án
          <MultiSelectMenu
            values={projectFilter}
            onChange={setProjectFilter}
            options={projects.map((p) => ({ value: p, label: p }))}
            allLabel="Tất cả dự án"
            searchPlaceholder="Gõ tên dự án…"
            className="mt-1"
            buttonClassName="h-10 shadow-2xs"
          />
        </div>
        {failedWeldMode ? (
          <div className="min-w-0 text-xs font-semibold text-slate-700">
            Kết quả NDT (lịch sử)
            <SelectMenu
              value={resultFilter}
              onChange={setResultFilter}
              options={["Tất cả", "Chờ thí nghiệm", "Đạt", "Không đạt", "Không thí nghiệm"].map((v) => ({ value: v, label: v }))}
              disabled={Boolean(lockedResultFilter)}
              className="mt-1"
              buttonClassName="h-10 shadow-2xs"
            />
          </div>
        ) : null}
        <div className="min-w-0 text-xs font-semibold text-slate-700">
          Tình trạng chất lượng
          <SelectMenu value={stage === "all" ? qualityStatusSelect : "Tất cả"} onChange={setQualityStatusSelect} disabled={stage !== "all"} options={["Tất cả", ...WELD_QUALITY_STATUSES].map((value) => ({ value, label: value }))} className="mt-1" buttonClassName="h-10 shadow-2xs" />
        </div>
        <div className="min-w-0 text-xs font-semibold text-slate-700">
          Mối liên kết
          <SelectMenu
            value={linkedWeldFilter}
            onChange={setLinkedWeldFilter}
            options={["Tất cả", "Có liên kết", "Chưa liên kết"].map((v) => ({ value: v, label: v }))}
            className="mt-1"
            buttonClassName="h-10 shadow-2xs"
          />
        </div>
        <div className="min-w-0 text-xs font-semibold text-slate-700">
          Loại mối hàn
          <SelectMenu
            value={weldTypeFilter}
            onChange={setWeldTypeFilter}
            options={["Tất cả", ...WELD_TYPE_OPTIONS].map((v) => ({ value: v, label: v }))}
            className="mt-1"
            buttonClassName="h-10 shadow-2xs"
          />
        </div>
        <div className="min-w-0 text-xs font-semibold text-slate-700">
          Công nghệ hàn
          <SelectMenu
            value={weldMethodFilter}
            onChange={setWeldMethodFilter}
            options={["Tất cả", "FBW", "ATW"].map((v) => ({ value: v, label: v }))}
            className="mt-1"
            buttonClassName="h-10 shadow-2xs"
          />
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-700">
          Từ ngày
          <DateField
            value={dateFrom}
            onChange={(value) => setDateFrom(dateTo && value > dateTo ? dateTo : value)}
            className="w-full"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-700">
          Đến ngày
          <DateField
            value={dateTo}
            onChange={(value) => setDateTo(dateFrom && value < dateFrom ? dateFrom : value)}
            className="w-full"
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="col-span-2 lg:col-span-1 inline-flex h-10 w-full items-center justify-center self-end rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 cursor-pointer sm:text-sm"
          >
            Xóa ngày
          </button>
        )}
       </div>

       <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => downloadWeldJournalExcelTemplate()}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition-all duration-150 cursor-pointer sm:w-auto sm:shrink-0 sm:text-sm"
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
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[#0047AB] bg-white px-4 text-xs font-semibold text-[#0047AB] shadow-2xs hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150 cursor-pointer sm:w-auto sm:shrink-0 sm:text-sm"
        >
          {importing ? "Đang nhập…" : "Tải Excel lên"}
        </button>
        <button
          type="button"
          onClick={() => void handleExportExcel()}
          disabled={exporting || loading}
          title="Xuất toàn bộ nhật ký theo bộ lọc hiện tại"
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150 cursor-pointer sm:w-auto sm:shrink-0 sm:text-sm"
        >
          <DownloadSimple size={16} weight="bold" aria-hidden />
          {exporting ? "Đang tạo Excel…" : "Xuất Excel"}
        </button>
        <button
          type="button"
          onClick={() => void handleExportAppendix5()}
          disabled={exporting || loading}
          title="Điền biên bản nghiệm thu Appendix 5 (FBW) từ nhật ký hàn theo bộ lọc hiện tại"
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150 cursor-pointer sm:w-auto sm:shrink-0 sm:text-sm"
        >
          Xuất Appendix 5
        </button>
        {!failedWeldMode ? (
          <>
            <button
              type="button"
              onClick={() => setAutolispBulkOpen(true)}
              disabled={saving || bulkFillSaving || importing}
              title="Tạo nhật ký hàng loạt từ điểm Autolisp HT/HP/TT/TP đã import"
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150 cursor-pointer sm:w-auto sm:shrink-0 sm:text-sm"
            >
              Autolisp → nhật ký
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRow(null);
                setEditingForm(null);
                setFormOpen(true);
              }}
              className="col-span-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white shadow-xs transition-all duration-150 hover:bg-[#00388A] active:bg-[#002D6E] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer sm:w-auto sm:shrink-0 sm:text-sm"
            >
              <span className="text-base leading-none">+</span> Thêm nhật ký
            </button>
          </>
        ) : null}
       </div>
      </div>

      {qualityError && <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Kiểm tra chất lượng: {qualityError} {qualityStatusFilter === "Tất cả" && "Nhật ký và kết quả NDT hiện có vẫn được hiển thị."}<button type="button" className="ml-2 min-h-9 font-semibold underline" onClick={() => setReloadToken((n) => n + 1)}>Thử lại</button></div>}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/40 p-3 text-sm">
        <span className="mr-auto font-semibold text-slate-800">Đã chọn {selectedQuality.size.toLocaleString("vi-VN")} mối</span>
        <button type="button" disabled={!qualityReady || loading || !rows.length} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 disabled:opacity-50" onClick={toggleQualityPage}>{pageSelected ? "Bỏ chọn trang này" : "Chọn trang này"}</button>
        <button type="button" disabled={!qualityReady || loading || selectingAll || !total} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 disabled:opacity-50" onClick={() => void selectAllQuality()}>{selectingAll ? "Đang lấy danh sách…" : `Chọn toàn bộ ${total.toLocaleString("vi-VN")} kết quả lọc`}</button>
        <button type="button" disabled={!selectedQuality.size} className="min-h-11 rounded-lg px-3 text-slate-600 disabled:opacity-50" onClick={() => { selectionToken.current += 1; setSelectingAll(false); setSelectedQuality(new Map()); }}>Bỏ chọn tất cả</button>
        <button type="button" disabled={!qualityReady || !selectedQuality.size || loading} className="min-h-11 rounded-lg bg-blue-700 px-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50" onClick={() => setBulkQualityEntries([...selectedQuality.values()])}>Đạt tất trực quan / NDT</button>
        <button type="button" disabled={!qualityReady || qualityImporting} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 disabled:opacity-50" onClick={() => qualityExcelInputRef.current?.click()}>{qualityImporting ? "Đang nhập kiểm tra…" : "Nhập kiểm tra Excel"}</button>
        <input ref={qualityExcelInputRef} type="file" accept=".xlsx,.xls" className="hidden" aria-label="File kiểm tra chất lượng" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void handleQualityExcel(file); }} />
      </div>
      {qualityImportReport && <div role="status" className="mb-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 p-3 text-sm">{qualityImportReport}</div>}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">{heading}</div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#0047AB]">
            {gpsLoading
              ? "Đang ghép GPS…"
              : `${pageFrom}–${pageTo} / ${total.toLocaleString("vi-VN")} · ${PAGE_SIZE}/trang`}
          </span>
        </div>

        {/* Danh sách dạng thẻ — mobile & tablet */}
        <div className="mt-3.5 space-y-2.5 lg:hidden">
          {pageRows.map((w) => (
            <div key={w.id} className="flex items-start gap-1">
            <label className="flex h-11 w-11 shrink-0 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-blue-700" disabled={!qualityReady || loading} checked={selectedQuality.has(w.id)} onChange={() => toggleQualityRow(w.id)} aria-label={`Chọn mối ${w.weldName}`} /></label>
            <button
              type="button"
              onClick={() => setDetailId(w.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xs transition-colors hover:border-[#0047AB]/40 hover:bg-blue-50/40 cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="block min-w-0 font-mono text-sm font-bold text-[#0047AB] truncate">{w.weldName}</span>
                  <WeldQualityBadge status={w.qualityStatus} />
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 truncate">{w.operator}</div>
                <div className="mt-0.5 text-xs text-slate-500 font-mono">{w.performedDate} · {w.shift}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-slate-600">
                  <span className="truncate" title="Mã vị trí">VT · {w.lispCode}</span>
                  <span className="truncate" title="Mã hiện trường">HT · {w.siteCode}</span>
                  <span className="truncate" title="Mã trong máy">Máy · {w.machineCode}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="truncate">🏗️ {w.project}</span>
                  <span className="whitespace-nowrap">{w.weldType}</span>
                  <span className={`truncate ${w.machine === "Chưa gán máy" ? "text-amber-700" : "text-[#0047AB]"}`}>⚙️ {w.machine}</span>
                </div>
                {w.resultType === "fail" && (
                  <div className="mt-1 line-clamp-2 text-[11px] font-medium text-rose-700">⚠ {w.failureReason}</div>
                )}
              </div>
              <span className="shrink-0 self-center text-slate-300">
                <CaretRight size={16} weight="bold" aria-hidden />
              </span>
            </button>
            </div>
          ))}
          {pageRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
              {lockedResultFilter === "Không đạt"
                ? "Không có mối hàn lỗi phù hợp với bộ lọc."
                : "Không có nhật ký hàn phù hợp với bộ lọc."}
            </div>
          )}
        </div>

        <div className="table-scroll hidden lg:block overflow-x-auto mt-3.5 -mx-1 px-1">
          <table className={`w-full border-collapse text-left ${failedWeldMode ? "min-w-[1360px]" : "min-w-[1520px]"}`}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="p-1"><label className="flex h-11 w-11 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-blue-700" disabled={!qualityReady || loading} checked={pageSelected} onChange={toggleQualityPage} aria-label="Chọn tất cả mối trên trang này" /></label></th>
                <th className="p-2.5 font-semibold">Ngày thực hiện</th>
                <th className="p-2.5 font-semibold">Ca hàn</th>
                <th className="p-2.5 font-semibold">Người trực tiếp hàn</th>
                <th className="p-2.5 font-semibold">Máy</th>
                <th className="p-2.5 font-semibold">Mã vị trí</th>
                <th className="p-2.5 font-semibold">Mã hệ thống</th>
                <th className="p-2.5 font-semibold">Mã hiện trường</th>
                <th className="p-2.5 font-semibold">Mã trong máy</th>
                <th className="p-2.5 font-semibold">Dự án</th>
                <th className="whitespace-nowrap p-2.5 font-semibold">Loại mối hàn</th>
                {failedWeldMode ? (
                  <th className="p-2.5 font-semibold">Công nghệ</th>
                ) : null}
                <th className="p-2.5 font-semibold">Lý do không đạt</th>
                {failedWeldMode ? (
                  <th className="min-w-[9rem] whitespace-nowrap p-2.5 font-semibold">Kết quả NDT</th>
                ) : null}
                <th className="min-w-[12rem] whitespace-nowrap p-2.5 font-semibold">Tình trạng chất lượng</th>
                <th className="p-2.5 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => setDetailId(w.id)}
                  className="cursor-pointer text-xs sm:text-sm text-slate-700 hover:bg-blue-50/50 transition-colors"
                >
                  <td className="p-1" onClick={(e) => e.stopPropagation()}><label className="flex h-11 w-11 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-blue-700" disabled={!qualityReady || loading} checked={selectedQuality.has(w.id)} onChange={() => toggleQualityRow(w.id)} aria-label={`Chọn mối ${w.weldName}`} /></label></td>
                  <td className="p-2.5 whitespace-nowrap font-mono text-xs text-slate-500">{w.performedDate}</td>
                  <td className="p-2.5 whitespace-nowrap font-semibold text-slate-800">{w.shift}</td>
                  <td className="p-2.5 font-semibold text-slate-900">{w.operator}</td>
                  <td className="p-2.5 max-w-[190px]">
                    <span className={`line-clamp-2 text-xs font-semibold ${w.machine === "Chưa gán máy" ? "text-amber-700" : "text-[#0047AB]"}`} title={w.machine}>
                      {w.machine}
                    </span>
                  </td>
                  <td className={`p-2.5 font-mono text-xs font-semibold ${w.lispCode === "—" ? "text-slate-400" : "text-slate-800"}`}>{w.lispCode}</td>
                  <td className="p-2.5 font-mono font-semibold text-[#0047AB]">{w.weldName}</td>
                  <td className={`p-2.5 font-mono text-xs font-semibold ${w.siteCode === "—" ? "text-slate-400" : "text-emerald-800"}`}>{w.siteCode}</td>
                  <td className="p-2.5 font-mono text-xs font-semibold text-slate-800">{w.machineCode}</td>
                  <td className="p-2.5 max-w-[220px]">
                    <span className="line-clamp-2" title={w.project}>
                      {w.project}
                    </span>
                  </td>
                  <td className="p-2.5 whitespace-nowrap text-xs text-slate-700">{w.weldType}</td>
                  {failedWeldMode ? (
                    <td className="p-2.5 whitespace-nowrap font-mono text-xs font-semibold text-slate-800">{w.weldMethod}</td>
                  ) : null}
                  <td
                    className={`p-2.5 max-w-[180px] ${w.resultType === "fail" ? "line-clamp-2 text-xs font-medium text-rose-700" : "text-slate-400"}`}
                  >
                    {w.failureReason}
                  </td>
                  {failedWeldMode ? (
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
                  ) : null}
                  <td className="whitespace-nowrap p-2.5"><WeldQualityBadge status={w.qualityStatus} /></td>
                  <td className="p-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button type="button" className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); const raw = rows.find((r) => r.id === w.id); if (raw) setQualityRow(raw); }}>Kiểm tra</button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditById(w.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0047AB] hover:bg-blue-50 hover:text-[#0047AB] cursor-pointer"
                        title="Sửa nhật ký hàn"
                      >
                        <PencilSimple size={14} weight="bold" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(w.id);
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Xóa nhật ký hàn"
                        aria-label="Xóa nhật ký hàn"
                      >
                        <TrashSimple size={14} weight="bold" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-3 py-10 text-center text-sm text-slate-500">
                    {lockedResultFilter === "Không đạt"
                      ? "Không có mối hàn lỗi phù hợp với bộ lọc."
                      : "Không có nhật ký hàn phù hợp với bộ lọc."}
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

      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setPendingDeleteId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Warning size={22} weight="bold" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">Xóa nhật ký hàn?</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Bản ghi{" "}
                  <strong className="font-mono font-semibold text-slate-900">
                    {rows.find((r) => r.id === pendingDeleteId)?.ma_lich_su ?? ""}
                  </strong>{" "}
                  sẽ bị xóa vĩnh viễn. Điểm GPS liên kết sẽ được gỡ khỏi mối hàn. Thao tác này không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteJournal()}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
              >
                <TrashSimple size={15} weight="bold" />
                {deleting ? "Đang xóa..." : "Xóa nhật ký"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weld-journal-detail-title"
          onClick={() => setDetailId(null)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">
                  Chi tiết nhật ký hàn
                </div>
                <h3
                  id="weld-journal-detail-title"
                  className="mt-0.5 font-mono text-base font-bold text-slate-900 truncate"
                >
                  {detailView.weldName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                aria-label="Đóng"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} weight="bold" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    detailView.testStatus === "Đạt"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : detailView.testStatus === "Không đạt"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : detailView.testStatus === "Không thí nghiệm"
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {detailView.testStatus}
                </span>
                {detailRaw && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {detailRaw.loai_moi_han}
                  </span>
                )}
              </div>

              <div className="mt-3"><WeldQualityBadge status={detailRaw?.tinh_trang_chat_luong} /></div>
              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {[
                  ["Ngày thực hiện", detailView.performedDate],
                  ["Ca hàn", detailView.shift],
                  ["Giờ làm", detailView.workTime],
                  ["Người trực tiếp hàn", detailView.operator],
                  ["Mã nhân sự", detailRaw?.ma_nhan_su || "—"],
                  ["Tổ hàn", detailRaw?.to_han || "—"],
                  ["Dự án", detailView.project],
                  ["Mã vị trí", detailView.lispCode],
                  ["Mã hiện trường", detailView.siteCode],
                  ["Mã trong máy", detailView.machineCode],
                  ["Máy", detailView.machine],
                  ["Loại ray", detailRaw?.loai_ray || "—"],
                  ["Công nghệ hàn", detailRaw?.cong_nghe_han || "—"],
                  ["Số lượng thực hiện", detailRaw?.so_luong_thuc_hien ?? "—"],
                  ["Số lượng lỗi", detailRaw?.so_luong_loi ?? "—"],
                  ["Mối hàn liên kết", detailView.linkedWeld],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
                    <dd className="mt-0.5 text-sm text-slate-800 break-words">{value}</dd>
                  </div>
                ))}
              </dl>

              {parseWeldLinkedImageAssets(detailRaw?.anh_moi_han_lien_ket).length > 0 && (
                <div className="mt-3.5 border-t border-slate-100 pt-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Ảnh mối hàn liên kết
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {parseWeldLinkedImageAssets(detailRaw?.anh_moi_han_lien_ket).map((asset) => (
                      <a
                        key={asset.publicId}
                        href={asset.secureUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        <div className="relative h-28">
                          <Image
                            src={asset.secureUrl}
                            alt={asset.name}
                            fill
                            className="object-cover transition-transform group-hover:scale-[1.02]"
                            sizes="200px"
                          />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3.5 border-t border-slate-100 pt-3.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chứng chỉ sử dụng</div>
                <div className={`mt-0.5 text-sm ${detailView.certificateLinked ? "text-emerald-700" : "text-amber-700"}`}>
                  {detailView.certificate}
                </div>
              </div>

              {detailView.resultType === "fail" && (
                <div className="mt-3.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Lý do không đạt</div>
                  <div className="mt-0.5 text-sm font-medium text-rose-700">{detailView.failureReason}</div>
                </div>
              )}

              {detailRaw?.ghi_chu?.trim() && (
                <div className="mt-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ghi chú</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{detailRaw.ghi_chu}</div>
                </div>
              )}

              {SHOW_WELD_GPS && (
              <div className="mt-3.5 border-t border-slate-100 pt-3.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vị trí GPS</div>
                <div className="mt-0.5 text-sm text-slate-800">{detailView.location}</div>
                {detailView.mapUrl && (
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    <a
                      href={detailView.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0047AB] hover:underline"
                    >
                      <MapPin size={13} weight="bold" /> Mở Google Maps
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailId(null);
                        router.push(`/ban-do?weldId=${encodeURIComponent(detailView.id)}&from=nhat-ky-han`);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      📍 Xem trên bản đồ
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setPendingDeleteId(detailView.id)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <TrashSimple size={14} weight="bold" /> Xóa
              </button>
              <button type="button" className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800" onClick={() => { if (detailRaw) setQualityRow(detailRaw); setDetailId(null); }}>Kiểm tra chất lượng</button>
              <button
                type="button"
                onClick={() => {
                  const id = detailView.id;
                  setDetailId(null);
                  openEditById(id);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047AB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00388A] cursor-pointer"
              >
                <PencilSimple size={14} weight="bold" /> Sửa nhật ký
              </button>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <JournalFormModal
        open={formOpen}
        mode={editingRow ? "edit" : "create"}
        initial={editingForm}
        projects={projectOptions}
        welders={welderOptions}
        machines={machineOptions}
        existingCodes={rows.map((row) => row.ma_lich_su)}
        recordId={editingRow?.id}
        qualityRecorded={Boolean(editingRow?.kiem_tra_chat_luong?.nguoi_ghi_nhan)}
        saving={saving || bulkFillSaving}
        bulkProgress={bulkFillProgress}
        allGpsPoints={gpsPoints}
        unlinkedGpsPoints={
          editingRow
            ? gpsPoints.filter((p) => !p.isLinked || p.weldId === editingRow.id)
            : gpsPoints.filter((p) => !p.isLinked && !p.weldId)
        }
        onClose={() => {
          if (saving || bulkFillSaving) return;
          setFormOpen(false);
          setEditingRow(null);
          setEditingForm(null);
        }}
        onSubmit={editingRow ? handleEdit : handleCreate}
        onBulkSubmit={handleBulkFill}
      />

      <BulkAutolispWeldDialog
        open={autolispBulkOpen}
        onClose={() => setAutolispBulkOpen(false)}
        projects={projectOptions}
        welders={welderOptions}
        machines={machineOptions}
        onDone={(message) => {
          showToast(message);
          refetch();
          setReloadToken((token) => token + 1);
        }}
      />

      {qualityRow && <WeldQualityDialog key={qualityRow.id} row={qualityRow} onClose={() => setQualityRow(null)} onSaved={() => {
        setSelectedQuality((current) => { const next = new Map(current); next.delete(qualityRow.id); return next; }); refetch();
      }} />}
      {bulkQualityEntries && <WeldQualityBulkDialog entries={bulkQualityEntries} onClose={() => setBulkQualityEntries(null)} onDone={(ids) => {
        setSelectedQuality((current) => { const next = new Map(current); for (const id of ids) next.delete(id); return next; }); refetch();
      }} />}
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
