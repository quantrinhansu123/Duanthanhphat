"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { welders as seedWelders, type Welder } from "@/data/welders";
import type { Certificate } from "@/data/certificates";
import type { Machine } from "@/data/machines";
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
  parseTrainedMachineTokens,
  personTrainedOnMachine,
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
import { imageKeyForTitle } from "@/lib/certificatesDb";

const rankStyle: Record<string, string> = {
  "Hạng 1": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Hạng 2": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Hạng 3": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

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
    status: seed?.status || "Hoạt động",
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
  const [liveCerts, setLiveCerts] = useState<
    Array<{
      id: string;
      ten_chung_chi: string;
      ngay_cap: string | null;
      ngay_het_han: string | null;
      trang_thai: string;
      don_vi_cap: string | null;
      so_chung_chi: string | null;
      secure_url: string | null;
    }>
  >([]);

  // Preview Modal state
  const [pdfPreviewItem, setPdfPreviewItem] = useState<DriveDocumentItem | null>(null);
  const [certThumbnailItem, setCertThumbnailItem] = useState<Certificate | null>(null);

  // Drive upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>("certificate");
  const [uploadTitle, setUploadTitle] = useState("");
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
  useEffect(() => {
    if (!selectedWelder) {
      setLiveCerts([]);
      return;
    }

    const welderId = selectedWelder.id;
    let active = true;
    async function loadCerts() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("chung_chi")
          .select("id, ten_chung_chi, ngay_cap, ngay_het_han, trang_thai, don_vi_cap, so_chung_chi, secure_url")
          .eq("employee_id", welderId)
          .order("created_at", { ascending: false });

        if (active && !error && data) {
          setLiveCerts(data);
        }
      } catch {
        if (active) setLiveCerts([]);
      }
    }

    void loadCerts();
    return () => {
      active = false;
    };
  }, [selectedWelder]);

  const rankOptions = useMemo(() => Array.from(new Set(list.map((w) => w.rank))).sort(), [list]);
  const teamOptions = useMemo(() => Array.from(new Set(list.map((w) => w.weldingTeam))).sort(), [list]);
  const railOptions = useMemo(() => {
    const all = list.flatMap((w) => w.railTypes.split(",").map((s) => s.trim()).filter(Boolean));
    return Array.from(new Set(all)).sort();
  }, [list]);
  const machineOptions = useMemo(() => {
    const all = list.flatMap((w) => w.trainedMachines.split(",").map((s) => s.trim()).filter(Boolean));
    return Array.from(new Set(all)).sort();
  }, [list]);
  const statusOptions = ["Hoạt động", "Khóa"];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((w) => {
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
      const matchRail =
        railsSel.length === 0 || railsSel.some((r) => w.railTypes.split(",").map((s) => s.trim()).includes(r));
      const matchMachine =
        machinesSel.length === 0 || machinesSel.some((m) => w.trainedMachines.split(",").map((s) => s.trim()).includes(m));
      const matchStatus = statusesSel.length === 0 || statusesSel.includes(w.status);
      return matchQ && matchRank && matchTeam && matchRail && matchMachine && matchStatus;
    });
  }, [list, query, ranksSel, teamsSel, railsSel, machinesSel, statusesSel]);

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
                            {w.position} · {w.department}
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
            className="relative z-10 flex h-full w-full max-w-[560px] xl:max-w-[640px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200"
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
                {selectedWelder.position} · {selectedWelder.department} · {selectedWelder.email}
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
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    3. Loại ray được phép hàn
                  </div>
                  <div className="mt-2 font-mono font-bold text-[#0047AB] text-sm">
                    {selectedWelder.railTypes}
                  </div>
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
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">
                  6. Chứng chỉ cá nhân
                </div>
                {liveCerts.length > 0 ? (
                  <div className="space-y-2.5">
                    {liveCerts.map((cert) => (
                      <div key={cert.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                            {cert.ten_chung_chi}
                          </h4>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${cert.trang_thai === "Còn hiệu lực" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                            {cert.trang_thai}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 font-mono">
                          <div>Số: <strong className="text-slate-800">{cert.so_chung_chi || "—"}</strong></div>
                          <div>Hạn: {cert.ngay_het_han ? formatDate(cert.ngay_het_han) : "—"}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCertThumbnailItem({
                              id: cert.id,
                              title: cert.ten_chung_chi,
                              holder: selectedWelder.name,
                              certificateNumber: cert.so_chung_chi || "Chưa cập nhật",
                              issuedAt: cert.ngay_cap ? formatDate(cert.ngay_cap) : "Chưa cập nhật",
                              expiresAt: cert.ngay_het_han ? formatDate(cert.ngay_het_han) : "Chưa cập nhật",
                              status: (cert.trang_thai as Certificate["status"]) || "Chưa cập nhật",
                              imageKey: imageKeyForTitle(cert.ten_chung_chi),
                              imageUrl: cert.secure_url || undefined,
                              machine: selectedWelder.trainedMachines,
                            });
                          }}
                          className="mt-2 text-xs font-bold text-[#0047AB] hover:underline cursor-pointer"
                        >
                          Xem mẫu chứng nhận
                        </button>
                      </div>
                    ))}
                  </div>
                ) : parseCertificateList(selectedWelder.certificates).length > 0 ? (
                  <div className="space-y-2.5">
                    {parseCertificateList(selectedWelder.certificates).map((certTitle, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{certTitle}</h4>
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
                          className="mt-2 text-xs font-bold text-[#0047AB] hover:underline cursor-pointer"
                        >
                          Xem mẫu chứng nhận
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Chưa có chứng chỉ.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
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

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                  10. Khuyết tật ghi nhận
                </div>
                {welderPerformance.defects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {welderPerformance.defects.map((df, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800"
                      >
                        <span className="font-mono font-bold">{df.code}</span>
                        <span className="text-[11px] font-normal text-rose-600">({df.count})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    Không ghi nhận lỗi khuyết tật.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">11. Tài liệu hồ sơ</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Google Drive PDF</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => reloadDriveDocs()}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Làm mới
                  </button>
                </div>

                <form onSubmit={handleUploadDriveDoc} className="rounded-xl border border-blue-200 bg-white p-3 mb-3 space-y-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    required
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0047AB] hover:file:bg-blue-100 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Tên hiển thị tài liệu"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                  />
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-hidden focus:border-[#0047AB]"
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
                    className="w-full rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-50 px-3 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    {uploadingDoc ? `Đang tải… ${uploadProgress ?? 0}%` : "Tải lên Drive"}
                  </button>
                </form>

                {driveError ? (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {driveError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  {loadingDrive ? (
                    <div className="text-xs text-slate-500 py-4 text-center">Đang tải tài liệu…</div>
                  ) : welderDriveDocs.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">Chưa có tài liệu PDF.</div>
                  ) : (
                    welderDriveDocs.map((doc) => {
                      const viewUrl = `/api/documents/${doc.id}`;
                      const downloadUrl = `/api/documents/${doc.id}?download=1`;
                      return (
                      <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="font-bold text-slate-900 text-xs line-clamp-2">{doc.name}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500 font-mono">
                          <span>{doc.appProperties?.documentType || "certificate"}</span>
                          <span>{formatDate(doc.createdTime)}</span>
                          <span>{formatFileSize(doc.size)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPdfPreviewItem(doc)}
                            className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                          >
                            Xem
                          </button>
                          <a
                            href={downloadUrl}
                            className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
                          >
                            Tải về
                          </a>
                          <a
                            href={doc.webViewLink || viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                          >
                            Mở Drive
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteDriveDoc(doc.id)}
                            className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700 cursor-pointer"
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

      {/* PDF Viewer Modal — xem qua proxy /api/documents/:id */}
      {pdfPreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative z-10 flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50">
              <div className="flex items-center gap-2 truncate pr-4">
                <span className="text-lg">📄</span>
                <span className="font-bold text-slate-900 truncate text-sm sm:text-base">{pdfPreviewItem.name}</span>
              </div>
              <div className="flex items-center gap-2">
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

            <div className="flex-1 bg-slate-100">
              <iframe
                src={`/api/documents/${pdfPreviewItem.id}`}
                className="h-full w-full border-0"
                title={pdfPreviewItem.name}
              />
            </div>
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
