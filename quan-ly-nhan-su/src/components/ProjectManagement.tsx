"use client";

import { useEffect, useMemo, useState } from "react";
import { getProjectPersonnel, type ProjectPersonnel } from "@/data/projectPersonnel";
import { getProjectWelds, type ProjectWeld, type ProjectWeldStatus } from "@/data/projectWelds";
import { projects as seedProjects, type Project } from "@/data/projects";

const statusStyle: Record<Project["status"], string> = {
  "Đang triển khai": "bg-[#e7f7ed] text-[#15803d]",
  "Hoàn thành": "bg-[#e8eef8] text-[#0047AB]",
  "Tạm dừng": "bg-[#fff4dd] text-[#b26a00]",
};

const weldStatusStyle: Record<ProjectWeldStatus, string> = {
  Đạt: "bg-[#e7f7ed] text-[#15803d]",
  Lỗi: "bg-[#fdeaea] text-[#c62828]",
  "Chờ kiểm tra": "bg-[#fff4dd] text-[#b26a00]",
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
    <div className="space-y-3">
      <label className="block text-[12px] font-medium text-[#64748b]">
        Tên dự án
        <input
          readOnly={readOnly}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
        />
      </label>
      <label className="block text-[12px] font-medium text-[#64748b]">
        Người phụ trách
        <input
          readOnly={readOnly}
          value={form.manager}
          onChange={(e) => setForm({ ...form, manager: e.target.value })}
          className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
        />
      </label>
      <label className="block text-[12px] font-medium text-[#64748b]">
        Nhà máy
        <input
          readOnly={readOnly}
          value={form.plant}
          onChange={(e) => setForm({ ...form, plant: e.target.value })}
          className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[12px] font-medium text-[#64748b]">
          Số nhân sự
          <input
            readOnly={readOnly}
            type="number"
            min={0}
            value={form.staffCount}
            onChange={(e) => setForm({ ...form, staffCount: Number(e.target.value) })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
          />
        </label>
        <label className="block text-[12px] font-medium text-[#64748b]">
          Số máy
          <input
            readOnly={readOnly}
            type="number"
            min={0}
            value={form.machineCount}
            onChange={(e) => setForm({ ...form, machineCount: Number(e.target.value) })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
          />
        </label>
      </div>
      <label className="block text-[12px] font-medium text-[#64748b]">
        Trạng thái
        {readOnly ? (
          <div className="mt-2">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[form.status]}`}>
              {form.status}
            </span>
          </div>
        ) : (
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </label>
      <label className="block text-[12px] font-medium text-[#64748b]">
        Ngày bắt đầu
        <input
          readOnly={readOnly}
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
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
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#64748b]">
        <span>
          <strong className="text-[#0f172a]">{rows.length}</strong> nhân sự
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#15803d]">{onDuty}</strong> đang trực
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#e8eef8]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              <th className="px-3 py-2.5">Họ tên</th>
              <th className="px-3 py-2.5">Vị trí</th>
              <th className="px-3 py-2.5">Vai trò</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Mối hôm nay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <PersonnelRow key={p.id} row={p} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#64748b]">
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
    <tr className="border-b border-[#f2f4f7] hover:bg-[#f8fafc]">
      <td className="px-3 py-2.5 font-semibold text-[#0f172a]">{row.name}</td>
      <td className="px-3 py-2.5 text-[#334155]">{row.position}</td>
      <td className="px-3 py-2.5 text-[#334155]">{row.role}</td>
      <td className="px-3 py-2.5">
        {row.onDuty ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f7ed] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22a94f]" />
            Đang trực
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-semibold text-[#64748b]">
            Nghỉ
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-[#0f172a]">{row.weldsToday}</td>
    </tr>
  );
}

function ProjectWorkTab({ projectId }: { projectId: string }) {
  const rows = useMemo(() => getProjectWelds(projectId), [projectId]);
  const passed = rows.filter((w) => w.status === "Đạt").length;
  const failed = rows.filter((w) => w.status === "Lỗi").length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#64748b]">
        <span>
          <strong className="text-[#0f172a]">{rows.length}</strong> mối hàn
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#15803d]">{passed}</strong> đạt ·{" "}
          <strong className="text-[#dc2626]">{failed}</strong> lỗi
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#e8eef8]">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              <th className="px-3 py-2.5">ID mối hàn</th>
              <th className="px-3 py-2.5">Thời gian</th>
              <th className="px-3 py-2.5">PP hàn</th>
              <th className="px-3 py-2.5">Máy</th>
              <th className="px-3 py-2.5">Thợ hàn</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Lỗi gặp phải</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <WeldRow key={w.id} row={w} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#64748b]">
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
    <tr className="border-b border-[#f2f4f7] hover:bg-[#f8fafc]">
      <td className="px-3 py-2.5 font-semibold text-[#0f172a]">{row.weldId}</td>
      <td className="px-3 py-2.5 text-[#334155]">{formatDateTime(row.performedAt)}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex rounded bg-[#e8eef8] px-2 py-0.5 text-[11px] font-semibold text-[#0047AB]">
          {row.method}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[#334155]">{row.machine}</td>
      <td className="px-3 py-2.5 text-[#334155]">{row.welderName}</td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${weldStatusStyle[row.status]}`}>
          {row.status}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[#334155]">
        {row.errorReason || <span className="text-[#94a3b8]">—</span>}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8eef8] px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold text-[#0047AB]">
              {mode === "view" ? "Chi tiết dự án" : "Sửa dự án"}
            </div>
            <h2 className="mt-0.5 text-[18px] font-bold text-[#0f172a]">{project.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-[#e8eef8] px-5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-2 px-4 py-3 text-[13px] font-semibold transition ${
                  tab === t.id
                    ? "border-[#0047AB] text-[#0047AB]"
                    : "border-transparent text-[#64748b] hover:text-[#334155]"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1.5 rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-medium text-[#64748b]">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "info" && <ProjectInfoFields form={form} setForm={setForm} readOnly={readOnly} />}
          {tab === "personnel" && <ProjectPersonnelTab projectId={project.id} />}
          {tab === "work" && <ProjectWorkTab projectId={project.id} />}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e8eef8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            {readOnly ? "Đóng" : "Hủy"}
          </button>
          {!readOnly && onSave && tab === "info" && (
            <button
              type="button"
              onClick={() => onSave(form)}
              className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{list.length}</strong> dự án
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{activeCount}</strong> đang triển khai
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          <option>Tất cả trạng thái</option>
          <option>Đang triển khai</option>
          <option>Hoàn thành</option>
          <option>Tạm dừng</option>
        </select>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          + Thêm dự án
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
                <th className="px-4 py-3">Tên dự án</th>
                <th className="px-4 py-3">Người phụ trách</th>
                <th className="px-4 py-3">Nhà máy</th>
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3">Máy</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày bắt đầu</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[#f2f4f7] text-[#334155] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-semibold text-[#0f172a]">{p.name}</td>
                  <td className="px-4 py-3">{p.manager}</td>
                  <td className="px-4 py-3">{p.plant}</td>
                  <td className="px-4 py-3">{p.staffCount}</td>
                  <td className="px-4 py-3">{p.machineCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(p.startDate + "T00:00:00").toLocaleDateString("vi-VN")}
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                      className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === p.id && (
                      <div className="absolute right-2 top-10 z-20 w-36 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => {
                            setModal({ project: p, mode: "view" });
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => {
                            setModal({ project: p, mode: "edit" });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"
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
                  <td colSpan={8} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy dự án phù hợp.
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
