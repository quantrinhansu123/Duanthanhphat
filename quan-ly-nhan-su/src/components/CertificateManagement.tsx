"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CaretDown, MagnifyingGlass, PencilSimple, Plus, TrashSimple, Users, X } from "@/components/icons";
import {
  createCertificateType,
  deleteCertificateType,
  updateCertificateType,
} from "@/lib/certificatesDb";
import {
  loadPersonnelCertificateRows,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
import {
  fetchCertificateGroups,
  type CertificateGroupOption,
} from "@/lib/trainingDb";
import { parseCertificateList } from "@/lib/weldingCertificates";
import { loadMachineCatalog } from "@/lib/machineCatalogDb";
import MachineSelect, { type MachineSelectOption } from "@/components/MachineSelect";

type CertHolder = {
  id: string;
  createdAt: string;
  name: string;
  code: string;
  team: string;
  position: string;
};

type CertificateTypeRow = {
  key: string;
  createdAt: string;
  title: string;
  holders: CertHolder[];
  fromCatalog: boolean;
  group?: CertificateGroupOption;
};

function normalizeCertTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

function isWelderRow(row: PersonnelCertificateRow) {
  const position = row.chuc_vu?.toLocaleLowerCase("vi") ?? "";
  const team = row.to_han?.trim() ?? "";
  return position.includes("hàn") || (team !== "" && team !== "Chưa phân tổ");
}

const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

export default function CertificateManagement() {
  const [personnelRows, setPersonnelRows] = useState<PersonnelCertificateRow[]>([]);
  const [catalogGroups, setCatalogGroups] = useState<CertificateGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({
    title: "",
    code: "",
    organization: "",
    machine: "",
    notes: "",
    holderIds: [] as string[],
  });
  const [holderQuery, setHolderQuery] = useState("");
  const [machineOptions, setMachineOptions] = useState<MachineSelectOption[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<CertificateTypeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CertificateTypeRow | null>(null);
  const [actionError, setActionError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [rows, groups] = await Promise.all([
        loadPersonnelCertificateRows(),
        fetchCertificateGroups().catch(() => [] as CertificateGroupOption[]),
      ]);
      setPersonnelRows(rows);
      setCatalogGroups(groups);
    } catch (error) {
      setPersonnelRows([]);
      setCatalogGroups([]);
      setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu chứng chỉ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let active = true;
    setMachinesLoading(true);
    loadMachineCatalog()
      .then(({ machines }) => {
        if (!active) return;
        const seen = new Set<string>();
        const opts: MachineSelectOption[] = [];
        for (const m of machines) {
          const code = m.code?.trim();
          if (!code || seen.has(code)) continue;
          seen.add(code);
          opts.push({ code, name: m.name?.trim() || undefined });
        }
        opts.sort((a, b) => a.code.localeCompare(b.code, "vi"));
        setMachineOptions(opts);
      })
      .catch(() => {
        if (active) setMachineOptions([]);
      })
      .finally(() => {
        if (active) setMachinesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  const welders = useMemo(() => personnelRows.filter(isWelderRow), [personnelRows]);

  const certificateTypes = useMemo((): CertificateTypeRow[] => {
    const map = new Map<string, CertificateTypeRow>();

    for (const group of catalogGroups) {
      const title = group.name.trim();
      if (!title) continue;
      const key = normalizeCertTitle(title);
      if (map.has(key)) continue;
      map.set(key, {
        key,
        createdAt: group.createdAt ?? "",
        title,
        holders: [],
        fromCatalog: true,
        group,
      });
    }

    for (const row of welders) {
      const certs = parseCertificateList(row.chung_chi);
      for (const titleRaw of certs) {
        const title = titleRaw.trim();
        if (!title) continue;
        const key = normalizeCertTitle(title);
        const holder: CertHolder = {
          id: row.employee_id,
          createdAt: row.created_at,
          name: row.ho_ten,
          code: row.ma_nhan_su?.trim() || "Chưa có mã",
          team: row.to_han?.trim() || "Chưa phân tổ",
          position: row.chuc_vu?.trim() || "Thợ hàn",
        };
        const existing = map.get(key);
        if (existing) {
          if (!existing.holders.some((h) => h.id === holder.id)) {
            existing.holders.push(holder);
          }
          if (!existing.fromCatalog && title.length > existing.title.length) {
            existing.title = title;
          }
        } else {
          map.set(key, {
            key,
            createdAt: row.created_at,
            title,
            holders: [holder],
            fromCatalog: false,
          });
        }
      }
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        holders: [...row.holders].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
        ),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.key.localeCompare(a.key));
  }, [catalogGroups, welders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    if (!q) return certificateTypes;
    return certificateTypes.filter((row) => {
      if (row.title.toLocaleLowerCase("vi").includes(q)) return true;
      return row.holders.some(
        (h) =>
          h.name.toLocaleLowerCase("vi").includes(q) ||
          h.code.toLocaleLowerCase("vi").includes(q),
      );
    });
  }, [certificateTypes, query]);

  const filteredWeldersForForm = useMemo(() => {
    const q = holderQuery.trim().toLocaleLowerCase("vi");
    const list = welders
      .map((row) => ({
        id: row.employee_id,
        name: row.ho_ten,
        code: row.ma_nhan_su?.trim() || "Chưa có mã",
        team: row.to_han?.trim() || "Chưa phân tổ",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    if (!q) return list;
    return list.filter(
      (w) =>
        w.name.toLocaleLowerCase("vi").includes(q) ||
        w.code.toLocaleLowerCase("vi").includes(q) ||
        w.team.toLocaleLowerCase("vi").includes(q),
    );
  }, [holderQuery, welders]);

  const totalTypes = certificateTypes.length;
  const typesWithHolders = certificateTypes.filter((row) => row.holders.length > 0).length;
  const totalAssignments = certificateTypes.reduce((sum, row) => sum + row.holders.length, 0);
  const weldersWithCert = useMemo(() => {
    return welders.filter((row) => parseCertificateList(row.chung_chi).length > 0).length;
  }, [welders]);

  function openAddModal() {
    setForm({
      title: "",
      code: "",
      organization: "",
      machine: "",
      notes: "",
      holderIds: [],
    });
    setHolderQuery("");
    setFormError("");
    setAddOpen(true);
  }

  function openEditModal(row: CertificateTypeRow) {
    if (!row.group) return;
    setEditTarget(row);
    setForm({
      title: row.title,
      code: row.group.code || "",
      organization: row.group.issuer || "",
      machine: row.group.machine || "",
      notes: "",
      holderIds: row.holders.map((holder) => holder.id),
    });
    setHolderQuery("");
    setActionError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget?.group) return;
    setSaving(true);
    setActionError("");
    try {
      await updateCertificateType({
        id: editTarget.group.id,
        title: form.title,
        code: form.code,
        organization: form.organization,
        machine: form.machine,
        notes: form.notes,
        employeeIds: form.holderIds,
      });
      setEditTarget(null);
      showToast("Đã cập nhật loại chứng chỉ.");
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không thể cập nhật loại chứng chỉ.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.group) return;
    setSaving(true);
    setActionError("");
    try {
      await deleteCertificateType(deleteTarget.group.id);
      const deletedTitle = deleteTarget.title;
      setDeleteTarget(null);
      showToast(`Đã xóa loại chứng chỉ “${deletedTitle}”.`);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không thể xóa loại chứng chỉ.");
    } finally {
      setSaving(false);
    }
  }

  function toggleHolder(id: string) {
    setForm((prev) => ({
      ...prev,
      holderIds: prev.holderIds.includes(id)
        ? prev.holderIds.filter((x) => x !== id)
        : [...prev.holderIds, id],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setFormError("Vui lòng nhập tên loại chứng chỉ.");
      return;
    }
    const exists = certificateTypes.some(
      (row) => normalizeCertTitle(row.title) === normalizeCertTitle(title),
    );
    if (exists) {
      setFormError(`Loại chứng chỉ "${title}" đã có trong danh mục.`);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await createCertificateType({
        title,
        code: form.code,
        organization: form.organization,
        machine: form.machine,
        notes: form.notes,
        employeeIds: form.holderIds,
      });
      setAddOpen(false);
      showToast(
        form.holderIds.length > 0
          ? `Đã thêm chứng chỉ và gán cho ${form.holderIds.length} thợ hàn.`
          : "Đã thêm loại chứng chỉ mới vào danh mục.",
      );
      await reload();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thêm được chứng chỉ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-[#0047AB]">
        Danh mục loại chứng chỉ · thống kê nhân sự từ{" "}
        <Link href="/ho-so-tho-han" className="font-bold underline underline-offset-2 hover:text-blue-800">
          Hồ sơ thợ hàn
        </Link>
        {" · "}không tạo ảnh mẫu
      </div>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Loại chứng chỉ</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-900">{totalTypes}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Có nhân sự sở hữu</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-[#0047AB]">{typesWithHolders}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Thợ hàn có chứng chỉ</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-emerald-700">
            {weldersWithCert}/{welders.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng lượt sở hữu</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-900">{totalAssignments}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm loại chứng chỉ hoặc tên / mã thợ hàn…"
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <Link
          href="/ho-so-tho-han"
          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Mở hồ sơ thợ hàn
        </Link>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-3.5 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer"
        >
          <Plus size={14} weight="bold" />
          Thêm chứng chỉ
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Đang tải loại chứng chỉ và nhân sự…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          Không tìm thấy loại chứng chỉ phù hợp.{" "}
          <button type="button" onClick={openAddModal} className="font-semibold text-[#0047AB] hover:underline cursor-pointer">
            Thêm chứng chỉ mới
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="w-12 px-3.5 py-3">#</th>
                  <th className="min-w-[320px] px-3.5 py-3">Loại chứng chỉ</th>
                  <th className="px-3.5 py-3 text-right">Số nhân sự</th>
                  <th className="min-w-[280px] px-3.5 py-3">Nhân sự sở hữu</th>
                  <th className="w-[110px] px-2 py-3 text-right">Thao tác</th>
                  <th className="w-12 px-2 py-3" aria-label="Mở rộng" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, index) => {
                  const open = Boolean(expanded[row.key]);
                  const preview = row.holders.slice(0, 3);
                  const more = Math.max(0, row.holders.length - preview.length);
                  return (
                    <Fragment key={row.key}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3 font-mono text-slate-400">{index + 1}</td>
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-slate-900 leading-snug">{row.title}</div>
                          {row.fromCatalog && row.holders.length === 0 ? (
                            <div className="mt-0.5 text-[11px] text-slate-400">Trong danh mục · chưa có thợ hàn</div>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0047AB]">
                            <Users size={12} weight="bold" />
                            {row.holders.length}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          {row.holders.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="text-slate-700">
                              {preview.map((h) => h.name).join(", ")}
                              {more > 0 ? <span className="text-slate-400"> +{more}</span> : null}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {row.group ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(row)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-[#0047AB] focus:outline-none focus:ring-2 focus:ring-[#0047AB]/30"
                                aria-label={`Sửa loại chứng chỉ ${row.title}`}
                                title="Sửa"
                              >
                                <PencilSimple size={16} weight="bold" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setDeleteTarget(row); setActionError(""); }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                aria-label={`Xóa loại chứng chỉ ${row.title}`}
                                title="Xóa"
                              >
                                <TrashSimple size={16} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Dữ liệu cũ</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {row.holders.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                              }
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                              aria-label={open ? "Thu gọn" : "Xem nhân sự"}
                            >
                              <CaretDown
                                size={16}
                                weight="bold"
                                className={`transition-transform ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={6} className="px-3.5 py-3">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {row.holders.map((holder) => (
                                <Link
                                  key={holder.id}
                                  href={`/ho-so-tho-han?employeeId=${encodeURIComponent(holder.id)}`}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-[#0047AB]/40 hover:bg-blue-50/40 transition-colors"
                                >
                                  <div className="font-semibold text-slate-900">{holder.name}</div>
                                  <div className="mt-0.5 font-mono text-[11px] text-[#0047AB]">{holder.code}</div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    {holder.position} · {holder.team}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(addOpen || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => !saving && (editTarget ? setEditTarget(null) : setAddOpen(false))}
            aria-label="Đóng"
          />
          <form
            onSubmit={(e) => void (editTarget ? handleEdit(e) : handleCreate(e))}
            className="relative z-10 flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">
                  Danh mục chứng chỉ
                </div>
                <h2 className="text-base font-bold text-slate-900">{editTarget ? "Sửa loại chứng chỉ" : "Thêm chứng chỉ mới"}</h2>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => editTarget ? setEditTarget(null) : setAddOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Tên loại chứng chỉ *
                </label>
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Chứng chỉ thợ hàn ray hạng 1 – UIC60"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Mã</label>
                  <input
                    className={fieldClass}
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="VD: CC-UIC60"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Đơn vị cấp
                  </label>
                  <input
                    className={fieldClass}
                    value={form.organization}
                    onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                    placeholder="VD: Sở GTVT"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Máy áp dụng
                </label>
                <MachineSelect
                  value={form.machine}
                  onChange={(machine) => setForm((f) => ({ ...f, machine }))}
                  options={
                    form.machine && !machineOptions.some((m) => m.code === form.machine)
                      ? [...machineOptions, { code: form.machine }]
                      : machineOptions
                  }
                  loading={machinesLoading}
                  placeholder="Chọn 1 máy áp dụng (VD: KCM-007)"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Ghi chú</label>
                <input
                  className={fieldClass}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Tùy chọn"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Gán thợ hàn (tuỳ chọn)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Đã chọn {form.holderIds.length}
                  </span>
                </div>
                <input
                  className={`${fieldClass} mb-1.5`}
                  value={holderQuery}
                  onChange={(e) => setHolderQuery(e.target.value)}
                  placeholder="Tìm thợ hàn…"
                />
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {filteredWeldersForForm.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-400">Không có thợ hàn phù hợp.</div>
                  ) : (
                    filteredWeldersForForm.map((welder) => {
                      const checked = form.holderIds.includes(welder.id);
                      return (
                        <label
                          key={welder.id}
                          className={`flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-slate-50 ${
                            checked ? "bg-blue-50/70" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleHolder(welder.id)}
                            className="h-4 w-4 rounded accent-[#0047AB]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs sm:text-sm font-semibold text-slate-900">
                              {welder.name}
                            </span>
                            <span className="block text-[11px] text-slate-500 font-mono">
                              {welder.code} · {welder.team}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Có thể chỉ thêm loại chứng chỉ vào danh mục, hoặc chọn thợ hàn để gán ngay.
                </p>
              </div>

              {(editTarget ? actionError : formError) && <div className="text-xs font-semibold text-rose-600">{editTarget ? actionError : formError}</div>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => editTarget ? setEditTarget(null) : setAddOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : editTarget ? "Lưu thay đổi" : "Thêm chứng chỉ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5" role="alertdialog" aria-modal="true" aria-labelledby="delete-certificate-title">
          <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => !saving && setDeleteTarget(null)} aria-label="Đóng" />
          <div className="relative z-10 w-full max-w-[460px] rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <div className="px-5 py-4"><h2 id="delete-certificate-title" className="text-base font-bold text-slate-900">Xóa loại chứng chỉ?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Thao tác này sẽ xóa loại <strong>{deleteTarget.title}</strong> và toàn bộ hồ sơ chứng chỉ thuộc loại này. Không thể khôi phục.</p>{actionError && <div className="mt-3 text-xs font-semibold text-rose-600">{actionError}</div>}</div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5"><button type="button" disabled={saving} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button><button type="button" disabled={saving} onClick={() => void handleDelete()} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">{saving ? "Đang xóa…" : "Xóa chứng chỉ"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
