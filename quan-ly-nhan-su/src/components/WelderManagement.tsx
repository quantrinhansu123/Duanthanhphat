"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { welders as seedWelders, type Welder } from "@/data/welders";
import type { Certificate } from "@/data/certificates";
import {
  MagnifyingGlass,
  CaretDown,
  Users,
  SealCheck,
  Sparkle,
  X,
  Plus,
} from "@/components/icons";
import {
  formatCertificateList,
  parseCertificateList,
} from "@/lib/weldingCertificates";
import {
  loadPersonnelCertificateRows,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
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
  const [selectedWelder, setSelectedWelder] = useState<Welder | null>(seedWelders[0] || null);

  const [query, setQuery] = useState("");
  const [ranksSel, setRanksSel] = useState<string[]>([]);
  const [teamsSel, setTeamsSel] = useState<string[]>([]);
  const [railsSel, setRailsSel] = useState<string[]>([]);
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [statusesSel, setStatusesSel] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  // All welding journal rows for performance metrics
  const [allWeldRows, setAllWeldRows] = useState<WeldReportRow[]>([]);
  // Google Drive documents
  const [driveDocs, setDriveDocs] = useState<DriveDocumentItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
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
  useEffect(() => {
    let active = true;
    loadPersonnelCertificateRows()
      .then((rows) => {
        if (!active || rows.length === 0) return;
        const welderRows = rows.filter((row) => {
          const position = row.chuc_vu?.toLocaleLowerCase("vi") ?? "";
          const team = row.to_han?.trim() ?? "";
          return position.includes("hàn") || (team !== "" && team !== "Chưa phân tổ");
        });
        if (welderRows.length === 0) return;
        const mapped = welderRows.map(personnelRowToWelder);
        setList(mapped);
        setSelectedWelder((prev) => prev ?? mapped[0]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load all weld rows for metrics
  useEffect(() => {
    loadWeldReportRows()
      .then((rows) => setAllWeldRows(rows))
      .catch(() => {});
  }, []);

  // Load Google Drive documents
  const reloadDriveDocs = async () => {
    setLoadingDrive(true);
    try {
      const res = await fetchDriveDocuments();
      setDriveDocs(res.items || []);
    } catch {
      setDriveDocs([]);
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
      void reloadDriveDocs();
    } else {
      window.alert(res.error || "Tải lên thất bại");
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
    <div className="mx-auto max-w-[1568px] px-4 sm:px-6 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold shadow-xl animate-in fade-in slide-in-from-bottom-5">
          {toast}
        </div>
      )}

      {/* Header - Image 16 / 17 exact */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
          {isEn ? "WELDER MANAGEMENT" : "QUẢN LÝ THỢ HÀN"}
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
          {isEn ? "Welder Profiles & Qualifications" : "Hồ sơ thợ hàn"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-4xl">
          {isEn
            ? "Welding ID, team, qualification grade, permissible rail types, trained machinery, and field experience."
            : "Welding ID, tổ hàn, hạng, loại ray được phép hàn, máy đã đào tạo, kinh nghiệm"}
        </p>
      </div>

      {/* 3 KPI Cards - Image 16 / 17 exact */}
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
            onClick={() => showToast(isEn ? "Add welder feature" : "Mở form thêm thợ hàn")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            {isEn ? "Add New" : "Thêm mới"}
          </button>
        </div>
      </div>

      {/* Main Table of Welders */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs mb-10">
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
                <th className="p-3 whitespace-nowrap">Welding ID</th>
                <th className="p-3 min-w-[200px]">{isEn ? "Welder Name & Title" : "Thợ hàn"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Team" : "Tổ hàn"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Grade" : "Phân hạng"}</th>
                <th className="p-3 whitespace-nowrap">{isEn ? "Status" : "Trạng thái"}</th>
                <th className="p-3 text-right whitespace-nowrap">{isEn ? "Action" : "Thao tác"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => {
                const isCurrent = selectedWelder?.id === w.id;
                return (
                  <tr
                    key={w.id}
                    onClick={() => setSelectedWelder(w)}
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

                    <td className="p-3 font-mono font-bold text-[#0047AB] text-xs sm:text-sm">
                      {w.weldingId}
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
                      <button
                        type="button"
                        onClick={() => setSelectedWelder(w)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-[#0047AB] text-white"
                            : "bg-white border border-slate-300 text-slate-700 hover:border-[#0047AB] hover:text-[#0047AB]"
                        }`}
                      >
                        {isCurrent ? "Đang chọn" : "Xem hồ sơ"}
                      </button>
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

      {/* ========================================================================= */}
      {/* 11-POINT COMPREHENSIVE WELDER PROFILE PANEL (Image 16 & 17)              */}
      {/* ========================================================================= */}
      {selectedWelder && (
        <div id="welder-profile-panel" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex-none overflow-hidden rounded-2xl bg-slate-100 ring-2 ring-[#0047AB]/30 shadow-md">
                <Image src={selectedWelder.photo} alt={selectedWelder.name} fill className="object-cover" sizes="80px" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {selectedWelder.name}
                  </h2>
                  <span className="font-mono text-sm font-bold text-[#0047AB] bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-0.5">
                    {selectedWelder.weldingId}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${selectedWelder.status === "Hoạt động" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selectedWelder.status === "Hoạt động" ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {selectedWelder.status}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">
                  {selectedWelder.position} · {selectedWelder.department} · {selectedWelder.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-slate-400 font-medium">Hồ sơ thợ hàn số hóa</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">Chuẩn TCVN 13965-1/2:2024</div>
              </div>
            </div>
          </div>

          {/* Grid of Sections 1 to 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
            {/* 2. Tổ hàn & Hạng thợ */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Tổ hàn & Phân hạng
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-[#0047AB]">
                  {selectedWelder.weldingTeam}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rankStyle[selectedWelder.rank] || "bg-slate-100 text-slate-700"}`}>
                  {selectedWelder.rank}
                </span>
              </div>
            </div>

            {/* 3. Loại ray được phép hàn */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Loại ray được phép hàn
              </div>
              <div className="mt-2 font-mono font-bold text-[#0047AB] text-sm">
                {selectedWelder.railTypes}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Ray tiêu chuẩn đường sắt</div>
            </div>

            {/* 4. Máy đã đào tạo */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                4. Máy đã đào tạo & Vận hành
              </div>
              <div className="mt-2 font-mono font-bold text-slate-800 text-sm">
                {selectedWelder.trainedMachines}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Tổ hợp máy hàn ray di động</div>
            </div>

            {/* 5. Kinh nghiệm */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                5. Kinh nghiệm làm việc
              </div>
              <div className="mt-2 font-bold text-slate-800 text-sm">
                {selectedWelder.experience}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Thi công đường sắt đô thị & quốc gia</div>
            </div>
          </div>

          {/* Section 6: Các chứng chỉ cá nhân (Personal Certificates) */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  6. Danh sách chứng chỉ cá nhân của thợ hàn
                </span>
                <span className="ml-2 text-xs text-slate-500 font-medium">
                  (Thuộc hồ sơ thợ hàn, không thuộc QLCL công ty)
                </span>
              </div>
            </div>

            {liveCerts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {liveCerts.map((cert) => (
                  <div key={cert.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2">
                          {cert.ten_chung_chi}
                        </h4>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${cert.trang_thai === "Còn hiệu lực" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                          {cert.trang_thai}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600 space-y-0.5 font-mono">
                        <div>Số: <strong className="text-slate-800">{cert.so_chung_chi || "—"}</strong></div>
                        <div>Đơn vị: <span className="text-slate-700">{cert.don_vi_cap || "—"}</span></div>
                        <div>Hạn: <span className="text-slate-700">{cert.ngay_het_han ? formatDate(cert.ngay_het_han) : "—"}</span></div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
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
                        className="text-xs font-bold text-[#0047AB] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        🔍 Xem mẫu chứng nhận
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {parseCertificateList(selectedWelder.certificates).map((certTitle, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                          {certTitle}
                        </h4>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Chưa cập nhật
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600 space-y-0.5 font-mono">
                        <div>Số: <strong className="text-slate-800">—</strong></div>
                        <div>Đơn vị: <span className="text-slate-700">—</span></div>
                        <div>Hạn: <span className="text-slate-700">—</span></div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
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
                        className="text-xs font-bold text-[#0047AB] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        🔍 Xem mẫu chứng nhận
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 7, 8, 9, 10: Năng lực hàn, Mối hàn, Tỷ lệ đạt & Khuyết tật */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 7 & 8: Hồ sơ đào tạo & Các mối hàn đã thực hiện */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  7. Hồ sơ đào tạo và nâng cao năng lực
                </div>
                {parseCertificateList(selectedWelder.certificates).length > 0 ? (
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {parseCertificateList(selectedWelder.certificates).map((title) => (
                      <li key={title} className="flex items-start gap-2">
                        <span className="text-[#0047AB] mt-0.5">•</span>
                        <span>{title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 italic">Chưa có hồ sơ đào tạo được liên kết.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  8. Hồ sơ các mối hàn gần đây
                </div>
                {welderPerformance.recentWelds.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                          <th className="pb-1.5">Mã mối</th>
                          <th className="pb-1.5">Dự án</th>
                          <th className="pb-1.5">Ngày</th>
                          <th className="pb-1.5 text-right">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {welderPerformance.recentWelds.map((rw) => (
                          <tr key={rw.id}>
                            <td className="py-2 font-mono font-bold text-[#0047AB]">{rw.ma_lich_su}</td>
                            <td className="py-2 text-slate-600 truncate max-w-[120px]">{rw.du_an}</td>
                            <td className="py-2 text-slate-500 font-mono">{rw.ngay_thuc_hien?.slice(0, 10) || rw.nam_thuc_hien}</td>
                            <td className="py-2 text-right">
                              {rw.so_luong_loi === 0 ? (
                                <span className="text-emerald-700 font-bold">Đạt</span>
                              ) : (
                                <span className="text-rose-700 font-bold">Lỗi</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Chưa có bản ghi mối hàn trong kỳ.</div>
                )}
              </div>
            </div>

            {/* 9 & 10: Số mối hàn đạt/không đạt & Các khuyết tật đã ghi nhận */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                  9. Thống kê số lượng mối hàn đạt / không đạt
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500">Tổng thực hiện</div>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                      {welderPerformance.total.toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-emerald-800">Đạt chuẩn</div>
                    <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                      {welderPerformance.passed.toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-50/60 p-3 border border-rose-100">
                    <div className="text-[11px] font-semibold text-rose-800">Không đạt</div>
                    <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
                      {welderPerformance.failed.toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Tỷ lệ đạt chuẩn:</span>
                    <span className="text-[#0047AB] font-mono">{welderPerformance.passRate}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${welderPerformance.passRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 10: Khuyết tật ghi nhận */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  10. Khuyết tật mối hàn ghi nhận (NDT & Lỗi sử dụng)
                </div>
                {welderPerformance.defects.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {welderPerformance.defects.map((df, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800"
                      >
                        <span className="font-mono font-bold">{df.code}</span>
                        <span className="text-[11px] font-normal text-rose-600">({df.count} lần)</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    ✓ Không ghi nhận lỗi khuyết tật nào trong quá trình kiểm tra NDT.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Section 11: Danh sách tài liệu hồ sơ (Google Drive PDF)                   */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-slate-300 bg-slate-50/50 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  11. Danh sách tài liệu hồ sơ thợ hàn (Google Drive PDF)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tài liệu PDF được lưu trữ bảo mật trên Google Drive, phân loại theo đúng hồ sơ nhân sự của {selectedWelder.name}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reloadDriveDocs()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  🔄 {isEn ? "Refresh Drive" : "Làm mới"}
                </button>
              </div>
            </div>

            {/* Upload PDF to Drive Form */}
            <form onSubmit={handleUploadDriveDoc} className="rounded-xl border border-blue-200 bg-white p-4 mb-5 shadow-2xs space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                + Tải tài liệu PDF mới vào hồ sơ thợ hàn
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Chọn tệp PDF *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    required
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0047AB] hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tên hiển thị tài liệu
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="VD: Chứng chỉ hàn nhiệt nhôm L2..."
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Loại tài liệu
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  >
                    <option value="certificate">Chứng chỉ (Certificate)</option>
                    <option value="training">Đào tạo & Nâng cao năng lực (Training)</option>
                    <option value="welding_record">Hồ sơ hàn & Nhật ký (Welding Record)</option>
                    <option value="permit">Giấy phép hàn (Permit)</option>
                    <option value="other">Khác (Other)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {uploadProgress !== null ? (
                  <div className="flex items-center gap-2 text-xs text-[#0047AB] font-semibold">
                    <span>Đang tải lên Drive... {uploadProgress}%</span>
                    <div className="w-24 h-2 rounded-full bg-blue-100 overflow-hidden">
                      <div className="h-full bg-[#0047AB]" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    Tệp được tự động gắn nhãn employeeId: {selectedWelder.id.slice(0, 8)}...
                  </span>
                )}

                <button
                  type="submit"
                  disabled={uploadingDoc}
                  className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  {uploadingDoc ? "Đang tải lên…" : "Tải lên Drive"}
                </button>
              </div>
            </form>

            {/* Table of PDF Documents */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <th className="p-3">{isEn ? "Document Name" : "Tên tài liệu"}</th>
                    <th className="p-3 whitespace-nowrap">{isEn ? "Type" : "Loại tài liệu"}</th>
                    <th className="p-3 whitespace-nowrap">{isEn ? "Upload Date" : "Ngày tải"}</th>
                    <th className="p-3 whitespace-nowrap">{isEn ? "Size" : "Dung lượng"}</th>
                    <th className="p-3 text-right whitespace-nowrap">{isEn ? "Action" : "Thao tác"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {welderDriveDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📄</span>
                          <span className="font-bold text-slate-900 line-clamp-1">{doc.name}</span>
                        </div>
                        {doc.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 pl-6">
                            {doc.description}
                          </div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 font-mono">
                          {doc.appProperties?.documentType || "certificate"}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono text-xs text-slate-500">
                        {formatDate(doc.createdTime)}
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono text-xs text-slate-600">
                        {formatFileSize(doc.size)}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setPdfPreviewItem(doc)}
                          className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-[#0047AB] hover:bg-blue-100 cursor-pointer shadow-2xs"
                        >
                          👁️ {isEn ? "Preview" : "Xem trước"}
                        </button>

                        <a
                          href={doc.webContentLink || doc.webViewLink || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer shadow-2xs"
                        >
                          ⬇️ {isEn ? "Download" : "Tải về"}
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setReplacingDocId(doc.id);
                            replaceInputRef.current?.click();
                          }}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 cursor-pointer shadow-2xs"
                        >
                          🔄 {isEn ? "Replace" : "Thay tệp"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingDoc(doc);
                            setEditDocName(doc.name);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                          ✏️ {isEn ? "Edit" : "Sửa"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDriveDoc(doc.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer shadow-2xs"
                        >
                          🗑️ {isEn ? "Trash" : "Xóa"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {loadingDrive ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {isEn ? "Loading documents from Google Drive..." : "Đang tải tài liệu từ Google Drive..."}
                      </td>
                    </tr>
                  ) : welderDriveDocs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {isEn
                          ? "No PDF documents found in Google Drive for this welder."
                          : "Chưa có tài liệu PDF nào trong Google Drive của thợ hàn này."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
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

      {/* PDF Viewer Modal via Iframe preview (webViewLink.replace('/view', '/preview')) */}
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
                  href={pdfPreviewItem.webContentLink || pdfPreviewItem.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Mở trên Google Drive ↗
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
              {pdfPreviewItem.webViewLink ? (
                <iframe
                  src={pdfPreviewItem.webViewLink.replace("/view", "/preview")}
                  className="h-full w-full border-0"
                  title={pdfPreviewItem.name}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                  Không có liên kết xem trước từ Google Drive.
                </div>
              )}
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
    </div>
  );
}
