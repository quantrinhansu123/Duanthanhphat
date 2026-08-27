"use client";

import { useEffect, useMemo, useState } from "react";
import { getProjectPersonnel, type ProjectPersonnel } from "@/data/projectPersonnel";
import { getProjectWelds, type ProjectWeld, type ProjectWeldStatus } from "@/data/projectWelds";
import { projects as seedProjects, type Project } from "@/data/projects";

const statusStyle: Record<Project["status"], string> = {
  "Đang triển khai": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Hoàn thành": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Tạm dừng": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const weldStatusStyle: Record<ProjectWeldStatus, string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  Lỗi: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Chờ kiểm tra": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const statusOptions: Project["status"][] = ["Đang triển khai", "Hoàn thành", "Tạm dừng"];

type DetailTab = "info" | "personnel" | "work";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProjectInfoFields({
  form,
  setForm,
  readOnly,
}: {
  form: Project;
  setForm: (p: Project) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-3.5">
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Tên dự án
        <input
          readOnly={readOnly}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Người phụ trách
        <input
          readOnly={readOnly}
          value={form.manager}
          onChange={(e) => setForm({ ...form, manager: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Nhà máy
        <input
          readOnly={readOnly}
          value={form.plant}
          onChange={(e) => setForm({ ...form, plant: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Số nhân sự
          <input
            readOnly={readOnly}
            type="number"
            min={0}
            value={form.staffCount}
            onChange={(e) => setForm({ ...form, staffCount: Number(e.target.value) })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Số máy
          <input
            readOnly={readOnly}
            type="number"
            min={0}
            value={form.machineCount}
            onChange={(e) => setForm({ ...form, machineCount: Number(e.target.value) })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
      </div>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Trạng thái
        {readOnly ? (
          <div className="mt-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[form.status]}`}>
              {form.status}
            </span>
          </div>
        ) : (
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </label>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Ngày bắt đầu
        <input
          readOnly={readOnly}
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
        />
      </label>
    </div>
  );
}

function ProjectPersonnelTab({ projectId }: { projectId: string }) {
  const rows = useMemo(() => getProjectPersonnel(projectId), [projectId]);
  const onDuty = rows.filter((p) => p.onDuty).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{rows.length}</strong> nhân sự
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{onDuty}</strong> đang trực
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3.5 py-2.5">Họ tên</th>
              <th className="px-3.5 py-2.5">Vị trí</th>
              <th className="px-3.5 py-2.5">Vai trò</th>
              <th className="px-3.5 py-2.5">Trạng thái</th>
              <th className="px-3.5 py-2.5 text-right">Mối hôm nay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <PersonnelRow key={p.id} row={p} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có nhân sự được gán cho dự án này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonnelRow({ row }: { row: ProjectPersonnel }) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors duration-150">
      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{row.name}</td>
      <td className="px-3.5 py-2.5 text-slate-700">{row.position}</td>
      <td className="px-3.5 py-2.5 text-slate-700">{row.role}</td>
      <td className="px-3.5 py-2.5">
        {row.onDuty ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Đang trực
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            Nghỉ
          </span>
        )}
      </td>
      <td className="px-3.5 py-2.5 text-right font-semibold font-mono tabular-nums text-slate-900">{row.weldsToday}</td>
    </tr>
  );
}

function ProjectWorkTab({ projectId }: { projectId: string }) {
  const rows = useMemo(() => getProjectWelds(projectId), [projectId]);
  const passed = rows.filter((w) => w.status === "Đạt").length;
  const failed = rows.filter((w) => w.status === "Lỗi").length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{rows.length}</strong> mối hàn
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{passed}</strong> đạt ·{" "}
          <strong className="font-semibold text-rose-700 font-mono tabular-nums">{failed}</strong> lỗi
        </span>
      </div>
      <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3.5 py-2.5">ID mối hàn</th>
              <th className="px-3.5 py-2.5">Thời gian</th>
              <th className="px-3.5 py-2.5">PP hàn</th>
              <th className="px-3.5 py-2.5">Máy</th>
              <th className="px-3.5 py-2.5">Thợ hàn</th>
              <th className="px-3.5 py-2.5">Trạng thái</th>
              <th className="px-3.5 py-2.5">Lỗi gặp phải</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((w) => (
              <WeldRow key={w.id} row={w} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có mối hàn nào trong dự án này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeldRow({ row }: { row: ProjectWeld }) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors duration-150">
      <td className="px-3.5 py-2.5 font-mono font-bold text-[#0047AB]">{row.weldId}</td>
      <td className="px-3.5 py-2.5 text-slate-700 font-mono whitespace-nowrap">{formatDateTime(row.performedAt)}</td>
      <td className="px-3.5 py-2.5">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB] border border-blue-200 shadow-2xs">
          {row.method}
        </span>
      </td>
      <td className="px-3.5 py-2.5 text-slate-700 font-mono">{row.machine}</td>
      <td className="px-3.5 py-2.5 text-slate-900 font-medium">{row.welderName}</td>
      <td className="px-3.5 py-2.5">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${weldStatusStyle[row.status]}`}>
          {row.status}
        </span>
      </td>
      <td className="px-3.5 py-2.5 text-slate-700">
        {row.errorReason || <span className="text-slate-400">—</span>}
      </td>
    </tr>
  );
}

function ProjectModal({
  project,
  mode,
  onClose,
  onSave,
}: {
  project: Project;
  mode: "view" | "edit";
  onClose: () => void;
  onSave?: (updated: Project) => void;
}) {
  const [form, setForm] = useState(project);
  const [tab, setTab] = useState<DetailTab>("info");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTab("info");
    setForm(project);
  }, [project]);

  const readOnly = mode === "view";
  const personnelCount = getProjectPersonnel(project.id).length;
  const weldCount = getProjectWelds(project.id).length;

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: "info", label: "Thông tin" },
    { id: "personnel", label: "Nhân sự", count: personnelCount },
    { id: "work", label: "Công việc", count: weldCount },
  ];

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
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              {mode === "view" ? "Chi tiết dự án" : "Sửa dự án"}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">{project.name}</h2>
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

        <div className="border-b border-slate-200 px-5 sm:px-6 bg-white">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                  tab === t.id
                    ? "border-[#0047AB] text-[#0047AB]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1.5 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold font-mono tabular-nums text-slate-600">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {tab === "info" && <ProjectInfoFields form={form} setForm={setForm} readOnly={readOnly} />}
          {tab === "personnel" && <ProjectPersonnelTab projectId={project.id} />}
          {tab === "work" && <ProjectWorkTab projectId={project.id} />}
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            {readOnly ? "Đóng" : "Hủy"}
          </button>
          {!readOnly && onSave && tab === "info" && (
            <button
              type="button"
              onClick={() => onSave(form)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              Lưu thay đổi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectManagement() {
  const [list, setList] = useState(seedProjects);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<{ project: Project; mode: "view" | "edit" } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.manager.toLowerCase().includes(q) ||
        p.plant.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || p.status === status;
      return matchQ && matchStatus;
    });
  }, [list, query, status]);

  const activeCount = list.filter((p) => p.status === "Đang triển khai").length;

  function handleDelete(project: Project) {
    if (!window.confirm(`Xóa dự án "${project.name}"?`)) return;
    setList((prev) => prev.filter((p) => p.id !== project.id));
    setMenuOpen(null);
  }

  function handleSave(updated: Project) {
    setList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setModal(null);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{list.length}</strong> dự án
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{activeCount}</strong> đang triển khai
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên dự án, người phụ trách, nhà máy..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          <option>Tất cả trạng thái</option>
          <option>Đang triển khai</option>
          <option>Hoàn thành</option>
          <option>Tạm dừng</option>
        </select>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm dự án
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Tên dự án</th>
                <th className="px-3.5 py-3">Người phụ trách</th>
                <th className="px-3.5 py-3">Nhà máy</th>
                <th className="px-3.5 py-3">Nhân sự</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3">Ngày bắt đầu</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-3.5 py-3 text-slate-700">{p.manager}</td>
                  <td className="px-3.5 py-3 text-slate-700">{p.plant}</td>
                  <td className="px-3.5 py-3 font-medium font-mono tabular-nums text-slate-900">{p.staffCount}</td>
                  <td className="px-3.5 py-3 font-medium font-mono tabular-nums text-slate-900">{p.machineCount}</td>
                  <td className="px-3.5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono whitespace-nowrap">
                    {new Date(p.startDate + "T00:00:00").toLocaleDateString("vi-VN")}
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === p.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ project: p, mode: "view" });
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ project: p, mode: "edit" });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          onClick={() => handleDelete(p)}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy dự án phù hợp</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ProjectModal
          project={modal.project}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={modal.mode === "edit" ? handleSave : undefined}
        />
      )}
    </main>
  );
}
