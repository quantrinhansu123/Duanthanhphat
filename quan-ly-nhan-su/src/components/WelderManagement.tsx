"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { welders as seedWelders, type Welder } from "@/data/welders";
import type { Certificate } from "@/data/certificates";
import type { Machine } from "@/data/machines";
import { useCatalogOptions } from "@/hooks/useSystemCatalogs";
import {
  MagnifyingGlass,
  CaretDown,
  Users,
  SealCheck,
  Sparkle,
  X,
  Plus,
  PencilSimple,
  Trash,
} from "@/components/icons";
import {
  formatCertificateList,
  parseCertificateList,
} from "@/lib/weldingCertificates";
import {
  deletePersonnel,
  loadPersonnelCertificateRows,
  normalizeRailToken,
  parseTrainedMachineTokens,
  personTrainedOnMachine,
  resolveRailTokensToConfig,
  upsertPersonnel,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
import { loadMachineCatalog } from "@/lib/machineCatalogDb";
import WelderFormModal, { type WelderFormValues } from "@/components/WelderFormModal";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useLanguage } from "@/i18n/LanguageProvider";
import { loadWeldReportRows, type WeldReportRow } from "@/lib/weldReportData";
import {
  fetchDriveDocuments,
  uploadDocumentToDrive,
  replaceDocumentContentInDrive,
  updateDriveDocumentMeta,
  deleteDriveDocument,
  type DriveDocumentItem,
} from "@/lib/driveDocumentsClient";
import CertificateThumbnail from "@/components/CertificateThumbnail";
import {
  createPersonnelCertificates,
  deleteCertificateRecord,
  imageKeyForTitle,
  updateCertificateRecord,
} from "@/lib/certificatesDb";
import {
  fetchCertificateGroups,
  type CertificateGroupOption,
} from "@/lib/trainingDb";

const rankStyle: Record<string, string> = {
  "Hạng 1": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Hạng 2": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Hạng 3": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

type LiveCertRow = {
  id: string;
  ten_chung_chi: string;
  ngay_cap: string | null;
  ngay_het_han: string | null;
  trang_thai: string;
  don_vi_cap: string | null;
  so_chung_chi: string | null;
  secure_url: string | null;
  file_chung_chi: string | null;
};

function liveCertificateStatus(cert: Pick<LiveCertRow, "trang_thai" | "ngay_het_han">): Certificate["status"] {
  if (cert.trang_thai === "Thu hồi") return "Thu hồi";
  if (!cert.ngay_het_han) return "Chưa cập nhật";

  const expiry = new Date(`${cert.ngay_het_han.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isFinite(expiry.getTime())) return "Chưa cập nhật";
  if (expiry.getTime() < today.getTime()) return "Hết hạn";

  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + 90);
  return expiry.getTime() <= warningDate.getTime() ? "Sắp hết hạn" : "Còn hiệu lực";
}

function liveCertificateStatusClass(status: Certificate["status"]) {
  if (status === "Còn hiệu lực") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "Sắp hết hạn") return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-rose-50 text-rose-700 border border-rose-200";
}

const LIVE_CERT_SELECT =
  "id, ten_chung_chi, ngay_cap, ngay_het_han, trang_thai, don_vi_cap, so_chung_chi, secure_url, file_chung_chi";

function extractDriveFileId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes("/") && !trimmed.includes(":")) {
    return trimmed;
  }
  const proxy = trimmed.match(/\/api\/documents\/([^/?#]+)/);
  if (proxy?.[1]) return decodeURIComponent(proxy[1]);
  if (trimmed.startsWith("drive:")) return trimmed.slice(6).trim() || null;
  return null;
}
function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Một số giá trị đơn vị/chức vụ được lưu song ngữ dạng "Tiếng Việt (English)".
 * Hiển thị đúng theo ngôn ngữ đang chọn thay vì luôn kèm phần tiếng Anh.
 */
function localizeBilingual(value: string, isEn: boolean): string {
  const match = value.match(/^\s*(.+?)\s*\(([^()]+)\)\s*$/);
  if (!match) return value;
  return (isEn ? match[2] : match[1]).trim();
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function personnelRowToWelder(row: PersonnelCertificateRow): Welder {
  const codeSuffix = row.ma_nhan_su?.match(/\d+$/)?.[0];
  const seed = seedWelders.find(
    (item) =>
      normalizeName(item.name) === normalizeName(row.ho_ten) ||
      (codeSuffix && item.weldingId.endsWith(codeSuffix)),
  );

  return {
    id: row.employee_id,
    weldingId: row.ma_nhan_su?.trim() || seed?.weldingId || "Chưa có mã",
    name: row.ho_ten,
    email: seed?.email || "Chưa cập nhật",
    department: row.don_vi?.trim() || seed?.department || "Chưa cập nhật",
    position: row.chuc_vu?.trim() || seed?.position || "Thợ hàn",
    weldingTeam: row.to_han?.trim() || seed?.weldingTeam || "Chưa phân tổ",
    certificates: formatCertificateList(row.chung_chi),
    rank: row.cap_bac?.trim() || seed?.rank || "Chưa phân hạng",
    railTypes: row.loai_ray?.trim() || seed?.railTypes || "Chưa cập nhật",
    trainedMachines: row.loai_may?.trim() || seed?.trainedMachines || "Chưa cập nhật",
    experience: row.kinh_nghiem?.trim() || seed?.experience || "Chưa cập nhật",
    status: row.trang_thai
      ? row.trang_thai === "Khóa"
        ? "Khóa"
        : "Hoạt động"
      : seed?.status || "Hoạt động",
    photo: row.hinh_anh?.trim() || seed?.photo || "https://randomuser.me/api/portraits/lego/1.jpg",
  };
}

function MultiSelectCombobox({
  title,
  options,
  selected,
  onChange,
  minWidth = "min-w-[140px]",
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  minWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const count = selected.length;
  let displayLabel = title;
  if (count === 1) {
    displayLabel = selected[0];
  } else if (count > 1) {
    displayLabel = `${title} (${count})`;
  }

  return (
    <div ref={dropdownRef} className={`relative ${minWidth}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-10 w-full rounded-lg border px-3 text-xs sm:text-sm font-medium shadow-2xs outline-hidden hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer flex items-center justify-between gap-1.5 whitespace-nowrap ${
          count > 0
            ? "border-[#0047AB]/50 bg-blue-50/50 text-[#0047AB] font-semibold"
            : "border-slate-300 bg-white text-slate-700"
        } ${open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : ""}`}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="flex items-center gap-1 shrink-0">
          {count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#0047AB] px-1.5 py-0.2 text-[11px] font-bold text-white font-mono">
              {count}
            </span>
          )}
          <CaretDown
            size={13}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-64 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
            <span className="truncate">{title}</span>
            {count > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-[#0047AB] hover:underline font-semibold cursor-pointer lowercase shrink-0 ml-1"
              >
                Bỏ chọn
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            {options.map((opt) => {
              const isChecked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      onChange(
                        isChecked ? selected.filter((s) => s !== opt) : [...selected, opt],
                      );
                    }}
                    className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WelderManagement() {
  const configuredRailOptions = useCatalogOptions("Loại ray");
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [list, setList] = useState<Welder[]>(seedWelders);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedWelder, setSelectedWelder] = useState<Welder | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [ranksSel, setRanksSel] = useState<string[]>([]);
  const [teamsSel, setTeamsSel] = useState<string[]>([]);
  const [railsSel, setRailsSel] = useState<string[]>([]);
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [statusesSel, setStatusesSel] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingWelder, setEditingWelder] = useState<Welder | null>(null);
  const [savingWelder, setSavingWelder] = useState(false);

  // All welding journal rows for performance metrics
  const [allWeldRows, setAllWeldRows] = useState<WeldReportRow[]>([]);
  // Google Drive documents
  const [driveDocs, setDriveDocs] = useState<DriveDocumentItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [driveConfigured, setDriveConfigured] = useState(true);
  // Live certificates from Supabase
  const [liveCerts, setLiveCerts] = useState<LiveCertRow[]>([]);

  // Thêm chứng chỉ từ danh mục
  const [showAddCert, setShowAddCert] = useState(false);
  const [certGroups, setCertGroups] = useState<CertificateGroupOption[]>([]);
  const [certGroupsLoading, setCertGroupsLoading] = useState(false);
  const [selectedCertGroupIds, setSelectedCertGroupIds] = useState<string[]>([]);
  const [savingCerts, setSavingCerts] = useState(false);

  // Sửa / tải file chứng chỉ cá nhân
  const [editingLiveCert, setEditingLiveCert] = useState<LiveCertRow | null>(null);
  const [editCertForm, setEditCertForm] = useState({
    title: "",
    number: "",
    issuedAt: "",
    expiresAt: "",
    status: "Còn hiệu lực" as Certificate["status"],
    organization: "",
  });
  const [savingEditCert, setSavingEditCert] = useState(false);
  const [uploadingCertId, setUploadingCertId] = useState<string | null>(null);
  const [certUploadProgress, setCertUploadProgress] = useState<number | null>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const certUploadTargetRef = useRef<LiveCertRow | null>(null);  // Preview Modal state
  const [pdfPreviewItem, setPdfPreviewItem] = useState<DriveDocumentItem | null>(null);
  const [certThumbnailItem, setCertThumbnailItem] = useState<Certificate | null>(null);

  // Drive upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>("certificate");
  const [uploadTitle, setUploadTitle] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drive edit meta / replace state
  const [editingDoc, setEditingDoc] = useState<DriveDocumentItem | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  }

  // Load welders from Supabase
  async function reloadWelders() {
    try {
      const rows = await loadPersonnelCertificateRows();
      if (rows.length === 0) return;
      const welderRows = rows.filter((row) => {
        const position = row.chuc_vu?.toLocaleLowerCase("vi") ?? "";
        const team = row.to_han?.trim() ?? "";
        return position.includes("hàn") || (team !== "" && team !== "Chưa phân tổ");
      });
      if (welderRows.length === 0) return;
      const mapped = welderRows.map(personnelRowToWelder);
      setList(mapped);
      setSelectedWelder((prev) => {
        if (!prev) return null;
        return mapped.find((item) => item.id === prev.id) ?? null;
      });
      setSelected((prev) => prev.filter((id) => mapped.some((item) => item.id === id)));
    } catch {
      // giữ danh sách hiện tại nếu tải lỗi
    }
  }

  useEffect(() => {
    void reloadWelders();
  }, []);

  useEffect(() => {
    if (list.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const employeeId = params.get("employeeId");
    if (!employeeId) return;
    const found = list.find((item) => item.id === employeeId);
    if (!found) return;
    setSelectedWelder(found);
    setProfileOpen(true);
  }, [list]);

  const [machineCatalog, setMachineCatalog] = useState<Machine[]>([]);

  useEffect(() => {
    let active = true;
    loadMachineCatalog()
      .then((result) => {
        if (!active) return;
        setMachineCatalog(result.machines);
      })
      .catch(() => {
        if (active) setMachineCatalog([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const linkedTrainedMachines = useMemo(() => {
    if (!selectedWelder) return [] as { token: string; machine?: Machine }[];
    const tokens = parseTrainedMachineTokens(
      selectedWelder.trainedMachines === "Chưa cập nhật" ? "" : selectedWelder.trainedMachines,
    );
    return tokens.map((token) => {
      const machine = machineCatalog.find((m) =>
        personTrainedOnMachine(token, { code: m.code, model: m.model }),
      );
      return { token, machine };
    });
  }, [selectedWelder, machineCatalog]);

  useEffect(() => {
    if (!profileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  function openWelderProfile(welder: Welder) {
    setSelectedWelder(welder);
    setProfileOpen(true);
  }

  function closeWelderProfile() {
    setProfileOpen(false);
    setShowUploadForm(false);
    setShowAddCert(false);
    setSelectedCertGroupIds([]);
    setEditingLiveCert(null);
    setUploadingCertId(null);
    setCertUploadProgress(null);
    certUploadTargetRef.current = null;
  }

  function openCreateWelder() {
    setEditingWelder(null);
    setFormOpen(true);
  }

  function openEditWelder(welder: Welder) {
    setEditingWelder(welder);
    setFormOpen(true);
  }

  async function handleSaveWelder(values: WelderFormValues) {
    setSavingWelder(true);
    try {
      const row = await upsertPersonnel({
        employeeId: values.id,
        maNhanSu: values.weldingId,
        hoTen: values.name,
        chucVu: values.position || "Thợ hàn",
        donVi: values.department,
        toHan: values.weldingTeam,
        capBac: values.rank,
        loaiRay: values.railTypes,
        loaiMay: values.trainedMachines,
        kinhNghiem: values.experience,
        hinhAnh: values.photo,
        trangThai: values.status,
      });
      const saved = { ...personnelRowToWelder(row), status: values.status };
      setList((prev) => {
        const without = prev.filter((item) => item.id !== saved.id);
        return [...without, saved].sort((a, b) => a.name.localeCompare(b.name, "vi"));
      });
      setSelectedWelder((prev) => (prev?.id === saved.id ? saved : prev));
      setFormOpen(false);
      setEditingWelder(null);
      showToast(values.id ? (isEn ? "Welder updated." : "Đã cập nhật thợ hàn.") : (isEn ? "Welder added." : "Đã thêm thợ hàn."));
      void reloadWelders();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (isEn ? "Failed to save welder" : "Không lưu được thợ hàn"));
    } finally {
      setSavingWelder(false);
    }
  }

  async function handleDeleteWelder(welder: Welder) {
    const ok = window.confirm(
      isEn
        ? `Delete welder "${welder.name}" (${welder.weldingId})? This cannot be undone.`
        : `Xóa thợ hàn "${welder.name}" (${welder.weldingId})? Thao tác không thể hoàn tác.`,
    );
    if (!ok) return;
    try {
      await deletePersonnel(welder.id);
      setList((prev) => prev.filter((item) => item.id !== welder.id));
      setSelected((prev) => prev.filter((id) => id !== welder.id));
      if (selectedWelder?.id === welder.id) {
        setSelectedWelder(null);
        setProfileOpen(false);
      }
      showToast(isEn ? "Welder deleted." : "Đã xóa thợ hàn.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (isEn ? "Failed to delete welder" : "Không xóa được thợ hàn"));
    }
  }

  // Load all weld rows for metrics
  useEffect(() => {
    loadWeldReportRows()
      .then((rows) => setAllWeldRows(rows))
      .catch(() => {});
  }, []);

  // Load Google Drive documents
  const reloadDriveDocs = async () => {
    setLoadingDrive(true);
    setDriveError("");
    try {
      const res = await fetchDriveDocuments();
      setDriveConfigured(res.configured !== false);
      setDriveDocs(res.items || []);
      if (res.error) setDriveError(res.error);
      else if (res.message && res.configured === false) setDriveError(res.message);
    } catch (err: unknown) {
      setDriveDocs([]);
      setDriveError(err instanceof Error ? err.message : "Không tải được tài liệu Google Drive");
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    void reloadDriveDocs();
  }, []);

  // Load Supabase certificates for selected welder
  async function reloadLiveCerts(welderId: string) {
    if (!isSupabaseConfigured()) {
      setLiveCerts([]);
      return;
    }
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("chung_chi")
        .select(LIVE_CERT_SELECT)
        .eq("employee_id", welderId)
        .order("created_at", { ascending: false });
      if (!error && data) setLiveCerts(data as LiveCertRow[]);
      else setLiveCerts([]);
    } catch {
      setLiveCerts([]);
    }
  }

  useEffect(() => {
    if (!selectedWelder) {
      setLiveCerts([]);
      setShowAddCert(false);
      setSelectedCertGroupIds([]);
      setEditingLiveCert(null);
      return;
    }
    const welderId = selectedWelder.id;
    let active = true;
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (active) setLiveCerts([]);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("chung_chi")
          .select(LIVE_CERT_SELECT)
          .eq("employee_id", welderId)
          .order("created_at", { ascending: false });
        if (!active) return;
        setLiveCerts(!error && data ? (data as LiveCertRow[]) : []);
      } catch {
        if (active) setLiveCerts([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedWelder]);

  async function openAddCertPanel() {
    setShowAddCert(true);
    setSelectedCertGroupIds([]);
    setCertGroupsLoading(true);
    try {
      const groups = await fetchCertificateGroups();
      setCertGroups(groups);
    } catch {
      setCertGroups([]);
    } finally {
      setCertGroupsLoading(false);
    }
  }

  function toggleCertGroup(id: string) {
    setSelectedCertGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleAddSelectedCertificates() {
    if (!selectedWelder || selectedCertGroupIds.length === 0) return;
    setSavingCerts(true);
    try {
      const owned = new Set(
        [
          ...liveCerts.map((c) => c.ten_chung_chi),
          ...parseCertificateList(selectedWelder.certificates),
        ].map((t) => t.toLocaleLowerCase("vi").trim()),
      );
      const toAdd = certGroups.filter(
        (g) =>
          selectedCertGroupIds.includes(g.id) &&
          !owned.has(g.name.toLocaleLowerCase("vi").trim()),
      );
      if (toAdd.length === 0) {
        showToast(isEn ? "Selected certificates already assigned." : "Các chứng chỉ đã chọn đã có trên hồ sơ.");
        setShowAddCert(false);
        setSelectedCertGroupIds([]);
        return;
      }
      for (const group of toAdd) {
        await createPersonnelCertificates({
          title: group.name,
          employeeIds: [selectedWelder.id],
          issuedAt: group.issueDate || "",
          expiresAt: group.expiryDate || "",
          status: "Còn hiệu lực",
          organization: group.issuer,
          machine: group.machine,
          certificateNumber: group.code,
        });
      }
      await reloadLiveCerts(selectedWelder.id);
      await reloadWelders();
      setShowAddCert(false);
      setSelectedCertGroupIds([]);
      showToast(
        isEn
          ? `Added ${toAdd.length} certificate(s).`
          : `Đã thêm ${toAdd.length} chứng chỉ.`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to add certificates"
            : "Không thêm được chứng chỉ",
      );
    } finally {
      setSavingCerts(false);
    }
  }

  function findDriveFileForCert(cert: LiveCertRow): DriveDocumentItem | null {
    const fromField = extractDriveFileId(cert.file_chung_chi);
    if (fromField) {
      const byId = driveDocs.find((d) => d.id === fromField);
      if (byId) return byId;
      return {
        id: fromField,
        name: `${cert.ten_chung_chi}.pdf`,
        description: cert.ten_chung_chi,
        size: 0,
        mimeType: "application/pdf",
        createdTime: new Date().toISOString(),
      };
    }
    return (
      driveDocs.find((d) => {
        const props = d.appProperties || {};
        return props.certificateId === cert.id || props.source === cert.id;
      }) ?? null
    );
  }

  function openEditLiveCert(cert: LiveCertRow) {
    setEditingLiveCert(cert);
    setEditCertForm({
      title: cert.ten_chung_chi,
      number: cert.so_chung_chi || "",
      issuedAt: cert.ngay_cap?.slice(0, 10) || "",
      expiresAt: cert.ngay_het_han?.slice(0, 10) || "",
      status: liveCertificateStatus(cert),
      organization: cert.don_vi_cap || "",
    });
  }

  function viewLiveCert(cert: LiveCertRow) {
    const driveFile = findDriveFileForCert(cert);
    if (driveFile) {
      setPdfPreviewItem(driveFile);
      return;
    }
    if (!selectedWelder) return;
    setCertThumbnailItem({
      id: cert.id,
      title: cert.ten_chung_chi,
      holder: selectedWelder.name,
      certificateNumber: cert.so_chung_chi || "Chưa cập nhật",
      issuedAt: cert.ngay_cap ? formatDate(cert.ngay_cap) : "Chưa cập nhật",
      expiresAt: cert.ngay_het_han ? formatDate(cert.ngay_het_han) : "Chưa cập nhật",
      status: liveCertificateStatus(cert),
      imageKey: imageKeyForTitle(cert.ten_chung_chi),
      imageUrl: cert.secure_url || undefined,
      machine: selectedWelder.trainedMachines,
    });
  }

  async function handleSaveEditLiveCert() {
    if (!editingLiveCert || !selectedWelder) return;
    if (!editCertForm.title.trim()) {
      window.alert(isEn ? "Please enter certificate title." : "Vui lòng nhập tên chứng chỉ.");
      return;
    }
    setSavingEditCert(true);
    try {
      await updateCertificateRecord({
        id: editingLiveCert.id,
        title: editCertForm.title.trim(),
        issuedAt: editCertForm.issuedAt,
        expiresAt: editCertForm.expiresAt,
        status: editCertForm.status,
        organization: editCertForm.organization.trim(),
        certificateNumber: editCertForm.number.trim(),
      });
      await reloadLiveCerts(selectedWelder.id);
      await reloadWelders();
      setEditingLiveCert(null);
      showToast(isEn ? "Certificate updated." : "Đã cập nhật chứng chỉ.");
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to update certificate"
            : "Không cập nhật được chứng chỉ",
      );
    } finally {
      setSavingEditCert(false);
    }
  }

  async function handleDeleteLiveCert(cert: LiveCertRow) {
    if (!selectedWelder) return;
    const ok = window.confirm(
      isEn
        ? `Delete certificate "${cert.ten_chung_chi}"?`
        : `Xóa chứng chỉ "${cert.ten_chung_chi}" khỏi hồ sơ này?`,
    );
    if (!ok) return;
    try {
      const driveFile = findDriveFileForCert(cert);
      await deleteCertificateRecord(cert.id);
      if (driveFile?.id) {
        await deleteDriveDocument(driveFile.id);
        setDriveDocs((prev) => prev.filter((d) => d.id !== driveFile.id));
      }
      await reloadLiveCerts(selectedWelder.id);
      await reloadWelders();
      if (editingLiveCert?.id === cert.id) setEditingLiveCert(null);
      showToast(isEn ? "Certificate deleted." : "Đã xóa chứng chỉ.");
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to delete certificate"
            : "Không xóa được chứng chỉ",
      );
    }
  }

  function triggerCertFileUpload(cert: LiveCertRow) {
    certUploadTargetRef.current = cert;
    if (certFileInputRef.current) {
      certFileInputRef.current.value = "";
      certFileInputRef.current.click();
    }
  }

  async function handleCertFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const cert = certUploadTargetRef.current;
    if (!file || !cert || !selectedWelder) return;

    setUploadingCertId(cert.id);
    setCertUploadProgress(0);
    let newlyUploadedFileId: string | undefined;

    try {
      const existing = findDriveFileForCert(cert);
      if (existing?.id) {
        const replaced = await replaceDocumentContentInDrive(
          existing.id,
          file,
          `${cert.ten_chung_chi}.pdf`,
          `Chứng chỉ ${cert.ten_chung_chi} · ${selectedWelder.name}`,
          setCertUploadProgress,
        );
        if (!replaced.success) throw new Error(replaced.error || "Không thay thế được file trên Drive.");
        await updateCertificateRecord({
          id: cert.id,
          title: cert.ten_chung_chi,
          issuedAt: cert.ngay_cap || "",
          expiresAt: cert.ngay_het_han || "",
          status: (cert.trang_thai as Certificate["status"]) || "Còn hiệu lực",
          imageUrl: `/api/documents/${existing.id}`,
          organization: cert.don_vi_cap || undefined,
          certificateNumber: cert.so_chung_chi || undefined,
        });
        showToast(isEn ? "Certificate PDF replaced on Drive." : "Đã thay file PDF trên Google Drive.");
      } else {
        const upload = await uploadDocumentToDrive(
          file,
          `${selectedWelder.weldingId}_${cert.ten_chung_chi}.pdf`,
          `Chứng chỉ cá nhân · ${selectedWelder.name} (${selectedWelder.weldingId}) · ${cert.ten_chung_chi}`,
          setCertUploadProgress,
          {
            entityType: "personnel_certificate",
            documentType: "certificate",
            certificateId: cert.id,
            employeeId: selectedWelder.id,
            weldingId: selectedWelder.weldingId,
            source: cert.id,
          },
        );
        if (!upload.success) throw new Error(upload.error || "Không tải được PDF lên Google Drive.");
        const uploaded = upload.item;
        if (!uploaded?.id) throw new Error("Drive chưa trả về mã tệp để liên kết.");
        newlyUploadedFileId = uploaded.id;
        await updateCertificateRecord({
          id: cert.id,
          title: cert.ten_chung_chi,
          issuedAt: cert.ngay_cap || "",
          expiresAt: cert.ngay_het_han || "",
          status: (cert.trang_thai as Certificate["status"]) || "Còn hiệu lực",
          imageUrl: `/api/documents/${uploaded.id}`,
          organization: cert.don_vi_cap || undefined,
          certificateNumber: cert.so_chung_chi || undefined,
        });
        setDriveDocs((prev) => [uploaded, ...prev.filter((d) => d.id !== uploaded.id)]);
        showToast(isEn ? "Certificate PDF uploaded to Drive." : "Đã tải PDF chứng chỉ lên Google Drive.");
      }
      await reloadLiveCerts(selectedWelder.id);
      void reloadDriveDocs();
    } catch (error) {
      if (newlyUploadedFileId) await deleteDriveDocument(newlyUploadedFileId);
      window.alert(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to upload certificate file"
            : "Không tải được file chứng chỉ",
      );
    } finally {
      setUploadingCertId(null);
      setCertUploadProgress(null);
      certUploadTargetRef.current = null;
      if (certFileInputRef.current) certFileInputRef.current.value = "";
    }
  }

  const ownedCertNames = useMemo(() => {    const names = new Set<string>();
    for (const c of liveCerts) names.add(c.ten_chung_chi.toLocaleLowerCase("vi").trim());
    if (selectedWelder) {
      for (const t of parseCertificateList(selectedWelder.certificates)) {
        names.add(t.toLocaleLowerCase("vi").trim());
      }
    }
    return names;
  }, [liveCerts, selectedWelder]);

  const availableCertGroups = useMemo(
    () => certGroups.filter((g) => !ownedCertNames.has(g.name.toLocaleLowerCase("vi").trim())),
    [certGroups, ownedCertNames],
  );

  const rankOptions = useMemo(() => Array.from(new Set(list.map((w) => w.rank))).sort(), [list]);  const teamOptions = useMemo(() => Array.from(new Set(list.map((w) => w.weldingTeam))).sort(), [list]);
  const railOptions = configuredRailOptions;
  const machineOptions = useMemo(() => {
    return Array.from(new Set(machineCatalog.map((machine) => machine.code.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "vi"));
  }, [machineCatalog]);
  const statusOptions = ["Hoạt động", "Khóa"];

  // Loại ray của thợ hàn (loai_ray là text tự do) được đối chiếu với danh mục
  // cấu hình: token khớp -> dùng nhãn chuẩn trong cấu hình; token lệch chuẩn
  // vẫn giữ lại để không mất dữ liệu và hiển thị được trong bộ chọn.
  const railResolution = useMemo(() => {
    if (!selectedWelder) return { matched: [] as string[], unmatched: [] as string[] };
    return resolveRailTokensToConfig(
      selectedWelder.railTypes === "Chưa cập nhật" ? "" : selectedWelder.railTypes,
      railOptions,
    );
  }, [selectedWelder, railOptions]);
  const selectedRailTypes = useMemo(
    () => [...railResolution.matched, ...railResolution.unmatched],
    [railResolution],
  );
  const railComboOptions = useMemo(
    () => Array.from(new Set([...railOptions, ...railResolution.unmatched])),
    [railOptions, railResolution.unmatched],
  );

  async function handleUpdateRailTypes(next: string[]) {
    if (!selectedWelder) return;
    const railTypes = next.join(", ");
    try {
      const row = await upsertPersonnel({
        employeeId: selectedWelder.id,
        maNhanSu: selectedWelder.weldingId === "Chưa có mã" ? "" : selectedWelder.weldingId,
        hoTen: selectedWelder.name,
        chucVu: selectedWelder.position,
        donVi: selectedWelder.department === "Chưa cập nhật" ? "" : selectedWelder.department,
        toHan: selectedWelder.weldingTeam === "Chưa phân tổ" ? "" : selectedWelder.weldingTeam,
        capBac: selectedWelder.rank === "Chưa phân hạng" ? "" : selectedWelder.rank,
        loaiRay: railTypes,
        loaiMay: selectedWelder.trainedMachines === "Chưa cập nhật" ? "" : selectedWelder.trainedMachines,
        kinhNghiem: selectedWelder.experience === "Chưa cập nhật" ? "" : selectedWelder.experience,
        hinhAnh: selectedWelder.photo?.startsWith("http") ? selectedWelder.photo : "",
        trangThai: selectedWelder.status,
      });
      const saved = { ...personnelRowToWelder(row), status: selectedWelder.status };
      setList((prev) => {
        const without = prev.filter((item) => item.id !== saved.id);
        return [...without, saved].sort((a, b) => a.name.localeCompare(b.name, "vi"));
      });
      setSelectedWelder(saved);
      showToast(isEn ? "Rail types updated." : "Đã cập nhật loại ray.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (isEn ? "Failed to update rail types" : "Không cập nhật được loại ray"));
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = list.filter((w) => {
      const matchQ =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.weldingId.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        w.weldingTeam.toLowerCase().includes(q) ||
        w.certificates.toLowerCase().includes(q) ||
        w.railTypes.toLowerCase().includes(q) ||
        w.trainedMachines.toLowerCase().includes(q);
      const matchRank = ranksSel.length === 0 || ranksSel.includes(w.rank);
      const matchTeam = teamsSel.length === 0 || teamsSel.includes(w.weldingTeam);
      const railTokenSet = new Set(
        parseTrainedMachineTokens(w.railTypes).map((t) => normalizeRailToken(t)),
      );
      const matchRail =
        railsSel.length === 0 || railsSel.some((r) => railTokenSet.has(normalizeRailToken(r)));
      const matchMachine = machinesSel.length === 0 || machinesSel.some((code) => {
        const machine = machineCatalog.find((item) => item.code === code);
        return personTrainedOnMachine(w.trainedMachines, {
          code,
          model: machine?.model,
        });
      });
      const matchStatus = statusesSel.length === 0 || statusesSel.includes(w.status);
      return matchQ && matchRank && matchTeam && matchRail && matchMachine && matchStatus;
    });
    const teamOrder = (team: string) => {
      const m = team.match(/\d+/);
      return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
    };
    return [...rows].sort(
      (a, b) =>
        teamOrder(a.weldingTeam) - teamOrder(b.weldingTeam) ||
        a.weldingTeam.localeCompare(b.weldingTeam, "vi") ||
        a.name.localeCompare(b.name, "vi"),
    );
  }, [list, query, ranksSel, teamsSel, railsSel, machinesSel, statusesSel, machineCatalog]);

  const stats = useMemo(() => {
    const total = list.length;
    const active = list.filter((w) => w.status === "Hoạt động").length;
    const locked = list.filter((w) => w.status === "Khóa").length;
    const rank1 = list.filter((w) => w.rank === "Hạng 1").length;
    const otherRank = total - rank1;
    return { total, active, locked, rank1, otherRank };
  }, [list]);

  // Performance metrics for selected welder
  const welderPerformance = useMemo(() => {
    if (!selectedWelder) {
      return { total: 0, passed: 0, failed: 0, passRate: 100, defects: [], recentWelds: [] };
    }
    const norm = normalizeName(selectedWelder.name);
    const rows = allWeldRows.filter(
      (r) =>
        r.tho_han_id === selectedWelder.id ||
        normalizeName(r.ten_tho_han) === norm ||
        r.ma_nhan_su === selectedWelder.weldingId,
    );

    let passed = 0;
    let failed = 0;
    const defectsMap = new Map<string, number>();

    for (const r of rows) {
      if (r.so_luong_loi === 0) {
        passed += 1;
      } else {
        failed += 1;
        if (r.ma_khuyet_tat && r.ma_khuyet_tat.length > 0) {
          for (const d of r.ma_khuyet_tat) {
            defectsMap.set(d, (defectsMap.get(d) ?? 0) + 1);
          }
        } else if (r.nguyen_nhan_loi) {
          defectsMap.set(r.nguyen_nhan_loi, (defectsMap.get(r.nguyen_nhan_loi) ?? 0) + 1);
        }
      }
    }

    const total = rows.length;
    const passRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;
    const defects = Array.from(defectsMap.entries()).map(([code, count]) => ({ code, count }));
    const recentWelds = [...rows]
      .sort((a, b) =>
        (b.ngay_thuc_hien || "").localeCompare(a.ngay_thuc_hien || "") ||
        b.nam_thuc_hien - a.nam_thuc_hien ||
        b.ma_lich_su.localeCompare(a.ma_lich_su),
      )
      .slice(0, 8);

    return { total, passed, failed, passRate, defects, recentWelds };
  }, [selectedWelder, allWeldRows]);

  // Drive documents filtered for selected welder
  const welderDriveDocs = useMemo(() => {
    if (!selectedWelder) return [];
    const norm = normalizeName(selectedWelder.name);
    const idPrefix = selectedWelder.weldingId.toLowerCase();

    const matched = driveDocs.filter((doc) => {
      const props = doc.appProperties || {};
      if (props.employeeId && props.employeeId === selectedWelder.id) return true;
      if (props.weldingId && props.weldingId === selectedWelder.weldingId) return true;
      const nameNorm = normalizeName(doc.name);
      return nameNorm.includes(norm) || doc.name.toLowerCase().includes(idPrefix);
    });

    return matched;
  }, [selectedWelder, driveDocs]);

  // Handle PDF upload to Drive with appProperties
  async function handleUploadDriveDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWelder) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      window.alert("Vui lòng chọn file PDF để tải lên.");
      return;
    }

    setUploadingDoc(true);
    setUploadProgress(0);

    const title = uploadTitle.trim() || file.name;
    const appProps = {
      entityType: "welder_profile",
      employeeId: selectedWelder.id,
      weldingId: selectedWelder.weldingId,
      documentType: uploadDocType,
    };

    const res = await uploadDocumentToDrive(
      file,
      title,
      `Tài liệu hồ sơ thợ hàn ${selectedWelder.name} (${selectedWelder.weldingId})`,
      (percent) => setUploadProgress(percent),
      appProps,
    );

    setUploadingDoc(false);
    setUploadProgress(null);

    if (res.success) {
      showToast("Đã tải tài liệu PDF lên Google Drive hồ sơ thợ hàn thành công");
      setUploadTitle("");
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (res.item) {
        setDriveDocs((prev) => [res.item!, ...prev.filter((d) => d.id !== res.item!.id)]);
      }
      void reloadDriveDocs();
    } else {
      window.alert(res.error || "Tải lên thất bại");
      setDriveError(res.error || "Tải lên thất bại");
    }
  }

  // Handle replace document in Drive
  async function handleReplaceDriveDoc(fileId: string, file: File) {
    setUploadingDoc(true);
    const res = await replaceDocumentContentInDrive(fileId, file);
    setUploadingDoc(false);
    setReplacingDocId(null);
    if (res.success) {
      showToast("Đã thay thế tệp tài liệu thành công");
      void reloadDriveDocs();
    } else {
      window.alert(res.error || "Không thể thay thế tệp");
    }
  }

  // Handle delete document from Drive
  async function handleDeleteDriveDoc(fileId: string) {
    if (!window.confirm("Bạn có chắc chắn muốn chuyển tài liệu này vào thùng rác Google Drive?")) {
      return;
    }
    const res = await deleteDriveDocument(fileId);
    if (res.success) {
      showToast("Đã xóa tài liệu khỏi Google Drive");
      void reloadDriveDocs();
    } else {
      window.alert(res.error || "Không thể xóa tài liệu");
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold shadow-xl animate-in fade-in slide-in-from-bottom-5">
          {toast}
        </div>
      )}

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Total Welders" : "Tổng thợ hàn"}
            </div>
            <div className="mt-1 text-3xl font-bold font-mono text-slate-900">
              {stats.total}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {isEn ? "All profiles in system" : "Toàn bộ hồ sơ trong hệ thống"}
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400">
            <Users size={24} weight="bold" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Status" : "Trạng thái"}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-emerald-700">
                {stats.active}
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {isEn ? "active" : "hoạt động"}
              </span>
            </div>
            <div className="mt-1 text-xs text-rose-500 font-medium">
              {stats.locked} {isEn ? "locked" : "đang khóa"}
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
            <SealCheck size={24} weight="bold" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Classification" : "Phân hạng"}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-[#0047AB]">
                {stats.rank1}
              </span>
              <span className="text-xs font-semibold text-[#0047AB]">
                {isEn ? "Grade 1" : "hạng 1"}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {stats.otherRank} {isEn ? "other grades" : "hạng khác"}
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 border border-amber-100 text-amber-500">
            <Sparkle size={24} weight="bold" />
          </div>
        </div>
      </div>

      {/* Search & Filters Bar - Image 16 / 17 exact */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="flex flex-1 w-full sm:w-auto gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isEn ? "Search name, Welding ID, rail type, machine..." : "Tìm theo tên, Welding ID, loại ray, máy..."}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
            />
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>

          <MultiSelectCombobox title={isEn ? "Grade" : "Hạng"} options={rankOptions} selected={ranksSel} onChange={setRanksSel} />
          <MultiSelectCombobox title={isEn ? "Team" : "Tổ hàn"} options={teamOptions} selected={teamsSel} onChange={setTeamsSel} />
          <MultiSelectCombobox title={isEn ? "Rail Type" : "Loại ray"} options={railOptions} selected={railsSel} onChange={setRailsSel} />
          <MultiSelectCombobox title={isEn ? "Trained Machine" : "Máy đã đào tạo"} options={machineOptions} selected={machinesSel} onChange={setMachinesSel} />
          <MultiSelectCombobox title={isEn ? "Status" : "Trạng thái"} options={statusOptions} selected={statusesSel} onChange={setStatusesSel} />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs sm:text-sm text-slate-500 font-medium whitespace-nowrap">
            <strong className="text-slate-900 font-mono">{filtered.length}</strong> {isEn ? "results" : "kết quả"}
          </span>
          <button
            type="button"
            onClick={openCreateWelder}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            {isEn ? "Add New" : "Thêm mới"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="p-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={() => {
                      if (selected.length === filtered.length) setSelected([]);
                      else setSelected(filtered.map((w) => w.id));
                    }}
                    className="h-4 w-4 accent-[#0047AB] rounded"
                  />
                </th>
                <th className="p-3 min-w-[200px]">{isEn ? "Welder Name & Title" : "Thợ hàn"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Team" : "Tổ hàn"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Grade" : "Phân hạng"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Status" : "Trạng thái"}</th>
                <th className="p-3 text-right whitespace-nowrap">{isEn ? "Action" : "Thao tác"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => {
                const isCurrent = profileOpen && selectedWelder?.id === w.id;
                return (
                  <tr
                    key={w.id}
                    onClick={() => openWelderProfile(w)}
                    className={`transition-colors cursor-pointer ${
                      isCurrent
                        ? "bg-blue-50/70 border-l-4 border-l-[#0047AB]"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(w.id)}
                        onChange={() => {
                          setSelected((prev) =>
                            prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id],
                          );
                        }}
                        className="h-4 w-4 accent-[#0047AB] rounded"
                      />
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                          <Image src={w.photo} alt={w.name} fill className="object-cover" sizes="36px" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                            {w.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {localizeBilingual(w.position, isEn)} · {localizeBilingual(w.department, isEn)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB]">
                        {w.weldingTeam}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rankStyle[w.rank] || "bg-slate-100 text-slate-700"}`}>
                        {w.rank}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {w.status === "Hoạt động" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {w.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-700 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          {w.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openWelderProfile(w)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            isCurrent
                              ? "bg-[#0047AB] text-white"
                              : "bg-white border border-slate-300 text-slate-700 hover:border-[#0047AB] hover:text-[#0047AB]"
                          }`}
                        >
                          {isEn ? "View" : "Xem"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditWelder(w)}
                          className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-500 hover:border-[#0047AB] hover:text-[#0047AB] cursor-pointer"
                          title={isEn ? "Edit" : "Sửa"}
                        >
                          <PencilSimple size={15} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteWelder(w)}
                          className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-500 hover:bg-rose-50 cursor-pointer"
                          title={isEn ? "Delete" : "Xóa"}
                        >
                          <Trash size={15} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-slate-500">
                    Không tìm thấy thợ hàn nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right drawer: welder profile */}
      {profileOpen && selectedWelder && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            aria-label={isEn ? "Close" : "Đóng"}
            onClick={closeWelderProfile}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="welder-profile-title"
            className="relative z-10 flex h-full w-full max-w-[1120px] xl:max-w-[1280px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="relative h-14 w-14 flex-none overflow-hidden rounded-2xl bg-slate-100 ring-2 ring-[#0047AB]/25 shadow-sm">
                  <Image src={selectedWelder.photo} alt={selectedWelder.name} fill className="object-cover" sizes="56px" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">
                    {isEn ? "Welder profile" : "Hồ sơ thợ hàn"}
                  </div>
                  <h2 id="welder-profile-title" className="truncate text-lg font-bold text-slate-900">
                    {selectedWelder.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#0047AB] bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5">
                      {selectedWelder.weldingId}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${selectedWelder.status === "Hoạt động" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedWelder.status === "Hoạt động" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {selectedWelder.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditWelder(selectedWelder)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#0047AB] cursor-pointer"
                  aria-label={isEn ? "Edit" : "Sửa"}
                  title={isEn ? "Edit" : "Sửa"}
                >
                  <PencilSimple size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteWelder(selectedWelder)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                  aria-label={isEn ? "Delete" : "Xóa"}
                  title={isEn ? "Delete" : "Xóa"}
                >
                  <Trash size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={closeWelderProfile}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  aria-label={isEn ? "Close" : "Đóng"}
                >
                  <X size={18} weight="bold" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
              <div className="text-xs sm:text-sm text-slate-500">
                {localizeBilingual(selectedWelder.position, isEn)} · {localizeBilingual(selectedWelder.department, isEn)} · {selectedWelder.email}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    2. Tổ hàn & Phân hạng
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-[#0047AB]">
                      {selectedWelder.weldingTeam}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rankStyle[selectedWelder.rank] || "bg-slate-100 text-slate-700"}`}>
                      {selectedWelder.rank}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    3. Loại ray được phép hàn
                  </div>
                  <MultiSelectCombobox
                    title={isEn ? "Rail type" : "Loại ray"}
                    options={railComboOptions}
                    selected={selectedRailTypes}
                    onChange={(next) => void handleUpdateRailTypes(next)}
                    minWidth="min-w-0 w-full"
                  />
                  {railResolution.unmatched.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-600">
                      {isEn
                        ? "Not in system config: "
                        : "Chưa khớp cấu hình hệ thống: "}
                      {railResolution.unmatched.join(", ")}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    4. Máy đã đào tạo
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Liên kết với mục{" "}
                    <Link
                      href="/danh-sach-may"
                      className="font-semibold text-[#0047AB] underline underline-offset-2 hover:text-blue-800"
                    >
                      Nhân sự đã đào tạo
                    </Link>{" "}
                    trong Danh sách máy
                  </p>
                  <div className="mt-2.5">
                    {linkedTrainedMachines.length === 0 ? (
                      <div className="font-mono font-bold text-slate-500 text-sm">Chưa cập nhật</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {linkedTrainedMachines.map(({ token, machine }) =>
                          machine ? (
                            <Link
                              key={`${machine.id}-${token}`}
                              href={`/danh-sach-may?may=${encodeURIComponent(machine.code)}&tab=personnel`}
                              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-1.5 pr-2.5 text-left hover:bg-blue-100 hover:border-[#0047AB] transition-colors"
                              title={`${machine.name} · mở tab Nhân sự đã đào tạo`}
                            >
                              <span className="relative h-9 w-14 flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <Image
                                  src={machine.weldingUnit?.coverImage || machine.image || "/may-han/kcm007.jpg"}
                                  alt={machine.name}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-bold text-slate-900 leading-snug">
                                  {machine.name}
                                </span>
                                <span className="block truncate font-mono text-[11px] font-semibold text-[#0047AB]">
                                  {machine.code}
                                </span>
                              </span>
                            </Link>
                          ) : (
                            <span
                              key={token}
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold font-mono text-slate-700"
                              title="Chưa khớp mã máy trong danh sách máy"
                            >
                              {token}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    5. Kinh nghiệm
                  </div>
                  <div className="mt-2 font-bold text-slate-800 text-sm">
                    {selectedWelder.experience}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">
                    6. Chứng chỉ cá nhân
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (showAddCert) {
                        setShowAddCert(false);
                        setSelectedCertGroupIds([]);
                      } else {
                        void openAddCertPanel();
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    <Plus size={12} weight="bold" />
                    {showAddCert ? (isEn ? "Close" : "Đóng") : isEn ? "Add" : "Thêm"}
                  </button>
                </div>

                {showAddCert && (
                  <div className="mb-3 rounded-xl border border-blue-200 bg-white p-3 shadow-2xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? "Select from certificate catalog" : "Chọn từ danh sách Chứng chỉ"}
                    </div>
                    {certGroupsLoading ? (
                      <div className="py-4 text-center text-xs text-slate-500">
                        {isEn ? "Loading…" : "Đang tải danh mục…"}
                      </div>
                    ) : availableCertGroups.length === 0 ? (
                      <div className="py-3 text-xs text-slate-500">
                        {certGroups.length === 0 ? (
                          <>
                            {isEn ? "No certificates in catalog. Add at " : "Chưa có chứng chỉ trong danh mục. Thêm tại "}
                            <Link href="/chung-chi" className="font-semibold text-[#0047AB] hover:underline">
                              {isEn ? "Certificate management" : "Quản lý chứng chỉ"}
                            </Link>
                            .
                          </>
                        ) : (
                          isEn ? "All catalog certificates are already assigned." : "Tất cả chứng chỉ trong danh mục đã được gán."
                        )}
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {availableCertGroups.map((cg) => {
                          const checked = selectedCertGroupIds.includes(cg.id);
                          return (
                            <label
                              key={cg.id}
                              className={`flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 ${
                                checked ? "bg-blue-50/70" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCertGroup(cg.id)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#0047AB]"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs sm:text-sm font-semibold text-slate-900">
                                  {cg.name}
                                </span>
                                {(cg.issuer || cg.code || cg.machine) && (
                                  <span className="mt-0.5 block text-[11px] text-slate-500">
                                    {[cg.code, cg.issuer, cg.machine].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {selectedCertGroupIds.length > 0 && (
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {isEn
                            ? `${selectedCertGroupIds.length} selected`
                            : `Đã chọn ${selectedCertGroupIds.length}`}
                        </span>
                        <button
                          type="button"
                          disabled={savingCerts}
                          onClick={() => void handleAddSelectedCertificates()}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
                        >
                          {savingCerts
                            ? isEn
                              ? "Saving…"
                              : "Đang lưu…"
                            : isEn
                              ? "Confirm add"
                              : "Xác nhận thêm"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {liveCerts.length > 0 ? (
                  <div className="space-y-2.5">
                    {liveCerts.map((cert) => {
                      const driveFile = findDriveFileForCert(cert);
                      const hasFile = Boolean(driveFile);
                      const isUploading = uploadingCertId === cert.id;
                      const computedStatus = liveCertificateStatus(cert);
                      return (
                      <div key={cert.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                            {cert.ten_chung_chi}
                          </h4>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${liveCertificateStatusClass(computedStatus)}`}>
                            {computedStatus}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 font-mono">
                          <div>Số: <strong className="text-slate-800">{cert.so_chung_chi || "—"}</strong></div>
                          <div>Hạn: {cert.ngay_het_han ? formatDate(cert.ngay_het_han) : "—"}</div>
                          {hasFile && (
                            <div className="text-emerald-700 font-semibold">PDF trên Google Drive</div>
                          )}
                        </div>

                        {editingLiveCert?.id === cert.id ? (
                          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                            <input
                              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                              value={editCertForm.title}
                              onChange={(e) => setEditCertForm((f) => ({ ...f, title: e.target.value }))}
                              placeholder={isEn ? "Certificate title" : "Tên chứng chỉ"}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 outline-hidden focus:border-[#0047AB]"
                                value={editCertForm.number}
                                onChange={(e) => setEditCertForm((f) => ({ ...f, number: e.target.value }))}
                                placeholder={isEn ? "Number" : "Số chứng chỉ"}
                              />
                              <input
                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                                value={editCertForm.organization}
                                onChange={(e) => setEditCertForm((f) => ({ ...f, organization: e.target.value }))}
                                placeholder={isEn ? "Issuer" : "Đơn vị cấp"}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[10px] font-semibold text-slate-500">
                                {isEn ? "Issued" : "Ngày cấp"}
                                <input
                                  type="date"
                                  className="mt-0.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                                  value={editCertForm.issuedAt}
                                  onChange={(e) => setEditCertForm((f) => ({ ...f, issuedAt: e.target.value }))}
                                />
                              </label>
                              <label className="text-[10px] font-semibold text-slate-500">
                                {isEn ? "Expires" : "Hết hạn"}
                                <input
                                  type="date"
                                  className="mt-0.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                                  value={editCertForm.expiresAt}
                                  onChange={(e) => setEditCertForm((f) => ({ ...f, expiresAt: e.target.value }))}
                                />
                              </label>
                            </div>
                            <select
                              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                              value={editCertForm.status}
                              onChange={(e) =>
                                setEditCertForm((f) => ({
                                  ...f,
                                  status: e.target.value as Certificate["status"],
                                }))
                              }
                            >
                              <option value="Còn hiệu lực">Còn hiệu lực</option>
                              <option value="Sắp hết hạn">Sắp hết hạn</option>
                              <option value="Hết hạn">Hết hạn</option>
                              <option value="Thu hồi">Thu hồi</option>
                            </select>
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={savingEditCert}
                                onClick={() => setEditingLiveCert(null)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer"
                              >
                                {isEn ? "Cancel" : "Hủy"}
                              </button>
                              <button
                                type="button"
                                disabled={savingEditCert}
                                onClick={() => void handleSaveEditLiveCert()}
                                className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
                              >
                                {savingEditCert ? (isEn ? "Saving…" : "Đang lưu…") : isEn ? "Save" : "Lưu"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => viewLiveCert(cert)}
                              className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                            >
                              {isEn ? "View" : "Xem"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditLiveCert(cert)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              {isEn ? "Edit" : "Sửa"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteLiveCert(cert)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                            >
                              {isEn ? "Delete" : "Xóa"}
                            </button>
                            <button
                              type="button"
                              disabled={isUploading || !driveConfigured}
                              onClick={() => triggerCertFileUpload(cert)}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                            >
                              {isUploading
                                ? `${isEn ? "Uploading" : "Đang tải"} ${certUploadProgress ?? 0}%`
                                : hasFile
                                  ? isEn
                                    ? "Replace file"
                                    : "Đổi file"
                                  : isEn
                                    ? "Upload file"
                                    : "Tải file"}
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : parseCertificateList(selectedWelder.certificates).length > 0 ? (
                  <div className="space-y-2.5">
                    {parseCertificateList(selectedWelder.certificates).map((certTitle, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{certTitle}</h4>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {isEn
                            ? "Legacy entry — use Add to create an editable certificate record."
                            : "Bản ghi cũ — dùng Thêm để tạo hồ sơ chứng chỉ có thể sửa / tải file."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCertThumbnailItem({
                              id: `cert-gen-${idx}`,
                              title: certTitle,
                              holder: selectedWelder.name,
                              certificateNumber: "Chưa cập nhật",
                              issuedAt: "Chưa cập nhật",
                              expiresAt: "Chưa cập nhật",
                              status: "Chưa cập nhật",
                              imageKey: imageKeyForTitle(certTitle),
                              machine: selectedWelder.trainedMachines,
                            });
                          }}
                          className="mt-2 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                        >
                          {isEn ? "View" : "Xem"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Chưa có chứng chỉ.</div>
                )}
              </div>              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-3">
                  9. Thống kê mối hàn
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <div className="text-[10px] font-semibold text-slate-500">Tổng</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                      {welderPerformance.total.toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                    <div className="text-[10px] font-semibold text-emerald-800">Đạt</div>
                    <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
                      {welderPerformance.passed.toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-50/60 p-2.5 border border-rose-100">
                    <div className="text-[10px] font-semibold text-rose-800">Lỗi</div>
                    <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">
                      {welderPerformance.failed.toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Tỷ lệ đạt</span>
                    <span className="text-[#0047AB] font-mono">{welderPerformance.passRate}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${welderPerformance.passRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                  8. Mối hàn gần đây
                </div>
                {welderPerformance.recentWelds.length > 0 ? (
                  <div className="space-y-2">
                    {welderPerformance.recentWelds.map((rw) => (
                      <div key={rw.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold text-[#0047AB] truncate">{rw.ma_lich_su}</div>
                          <div className="text-[11px] text-slate-500 truncate">{rw.du_an}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-[11px] text-slate-400">
                            {rw.ngay_thuc_hien?.slice(0, 10) || rw.nam_thuc_hien}
                          </div>
                          {rw.so_luong_loi === 0 ? (
                            <span className="text-[11px] font-bold text-emerald-700">Đạt</span>
                          ) : (
                            <span className="text-[11px] font-bold text-rose-700">Lỗi</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Chưa có bản ghi mối hàn.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">10. Tài liệu hồ sơ</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Google Drive PDF</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => reloadDriveDocs()}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Làm mới
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadForm((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2.5 py-1.5 text-[11px] font-bold text-white cursor-pointer"
                    >
                      <Plus size={12} weight="bold" />
                      {showUploadForm ? "Đóng" : "Thêm mới"}
                    </button>
                  </div>
                </div>

                {showUploadForm ? (
                  <form
                    onSubmit={handleUploadDriveDoc}
                    className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-blue-200 bg-white p-2"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      required
                      className="min-w-[160px] flex-1 text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0047AB] hover:file:bg-blue-100 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Tên hiển thị"
                      className="h-8 w-40 shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                    />
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      className="h-8 w-32 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-hidden focus:border-[#0047AB]"
                    >
                      <option value="certificate">Chứng chỉ</option>
                      <option value="training">Đào tạo</option>
                      <option value="welding_record">Hồ sơ hàn</option>
                      <option value="permit">Giấy phép hàn</option>
                      <option value="other">Khác</option>
                    </select>
                    <button
                      type="submit"
                      disabled={uploadingDoc || !driveConfigured}
                      className="h-8 shrink-0 rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-50 px-3 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                    >
                      {uploadingDoc ? `Đang tải… ${uploadProgress ?? 0}%` : "Tải lên"}
                    </button>
                  </form>
                ) : null}

                {driveError ? (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {driveError}
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  {loadingDrive ? (
                    <div className="text-xs text-slate-500 py-4 text-center">Đang tải tài liệu…</div>
                  ) : welderDriveDocs.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">Chưa có tài liệu PDF.</div>
                  ) : (
                    welderDriveDocs.map((doc) => {
                      const viewUrl = `/api/documents/${doc.id}`;
                      const downloadUrl = `/api/documents/${doc.id}?download=1`;
                      return (
                        <div
                          key={doc.id}
                          className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <div className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900" title={doc.name}>
                            {doc.name}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-slate-500">
                            {doc.appProperties?.documentType || "certificate"}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">
                            {formatDate(doc.createdTime)}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">
                            {formatFileSize(doc.size)}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPdfPreviewItem(doc)}
                              className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2 py-1 text-[11px] font-bold text-white cursor-pointer"
                            >
                              Xem
                            </button>
                            <a
                              href={downloadUrl}
                              className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700"
                            >
                              Tải về
                            </a>
                            <a
                              href={doc.webViewLink || viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                            >
                              Drive
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDriveDoc(doc.id)}
                              className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Hidden file input for Replace action */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replacingDocId) {
            void handleReplaceDriveDoc(replacingDocId, file);
          }
        }}
      />

      {/* Hidden file input — tải PDF chứng chỉ cá nhân lên Drive */}
      <input
        ref={certFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleCertFileSelected(e)}
      />

      {/* PDF Viewer Modal — full màn hình, xem qua proxy /api/documents/:id */}
      {pdfPreviewItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in duration-150">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50">
            <div className="flex items-center gap-2 truncate pr-4 min-w-0">
              <span className="text-lg shrink-0">📄</span>
              <span className="font-bold text-slate-900 truncate text-sm sm:text-base">{pdfPreviewItem.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/api/documents/${pdfPreviewItem.id}?download=1`}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              >
                Tải về
              </a>
              <a
                href={pdfPreviewItem.webViewLink || `/api/documents/${pdfPreviewItem.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Mở tab mới ↗
              </a>
              <button
                type="button"
                onClick={() => setPdfPreviewItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-slate-100">
            <iframe
              src={`/api/documents/${pdfPreviewItem.id}`}
              className="h-full w-full border-0"
              title={pdfPreviewItem.name}
            />
          </div>
        </div>
      )}

      {/* Certificate Thumbnail Preview Modal */}
      {certThumbnailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  MẪU CHỨNG CHỈ HỒ SƠ THỢ HÀN
                </div>
                <h3 className="text-base font-bold text-slate-900">{certThumbnailItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCertThumbnailItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-slate-50 border border-slate-200 shadow-inner">
              <CertificateThumbnail cert={certThumbnailItem} />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setCertThumbnailItem(null)}
                className="rounded-lg bg-[#0047AB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drive Document Meta Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Sửa thông tin tài liệu</h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editDocName.trim()) return;
                const res = await updateDriveDocumentMeta(
                  editingDoc.id,
                  editDocName.trim(),
                  editingDoc.description || "",
                );
                if (res.success) {
                  showToast("Đã cập nhật thông tin tài liệu");
                  setEditingDoc(null);
                  void reloadDriveDocs();
                } else {
                  window.alert(res.error || "Không thể cập nhật tài liệu");
                }
              }}
              className="space-y-3 text-xs sm:text-sm"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên tài liệu
                </label>
                <input
                  type="text"
                  required
                  value={editDocName}
                  onChange={(e) => setEditDocName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0047AB] px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <WelderFormModal
        open={formOpen}
        initial={editingWelder}
        saving={savingWelder}
        isEn={isEn}
        railOptions={railOptions}
        onClose={() => {
          if (savingWelder) return;
          setFormOpen(false);
          setEditingWelder(null);
        }}
        onSubmit={handleSaveWelder}
      />
    </div>
  );
}
