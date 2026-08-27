"use client";

import { useMemo, useState } from "react";
import {
  catalogGroups,
  defaultSystemSettings,
  initialAccounts as seedAccounts,
  sharedCatalogs as seedCatalogs,
  type CatalogGroup,
  type CatalogItem,
  type InitialAccount,
  type SystemSettings,
} from "@/data/systemConfig";

type ConfigTab = "catalogs" | "settings" | "accounts";

function CatalogModal({
  item,
  group,
  mode,
  onClose,
  onSave,
}: {
  item: CatalogItem;
  group: CatalogGroup;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (item: CatalogItem) => void;
}) {
  const [form, setForm] = useState(item);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-[#071633]/60 backdrop-blur-xs transition-opacity duration-200" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-[#d9e2f1] bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(7,22,51,0.24)] animate-in fade-in-50 zoom-in-95 duration-150">
        <h3 className="text-[16px] font-bold text-[#0f172a]">
          {mode === "create" ? "Thêm danh mục mới" : "Chỉnh sửa danh mục"}
        </h3>
        <p className="mt-1 text-[12.5px] text-[#64748b]">Nhóm: <span className="font-semibold text-[#0047AB]">{group}</span></p>
        <div className="mt-4 space-y-3.5">
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
            Mã danh mục
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150 font-mono"
            />
          </label>
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
            Tên hiển thị
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-[#334155] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded accent-[#0047AB] cursor-pointer"
            />
            Đang sử dụng
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...form, group })}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
          >
            Lưu danh mục
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogsPanel({
  catalogs,
  setCatalogs,
}: {
  catalogs: CatalogItem[];
  setCatalogs: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
}) {
  const [group, setGroup] = useState<CatalogGroup>("Loại ray");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<{ item: CatalogItem; mode: "create" | "edit" } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogs.filter((c) => {
      if (c.group !== group) return false;
      return !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [catalogs, group, query]);

  function handleSave(item: CatalogItem) {
    if (modal?.mode === "create") {
      setCatalogs((prev) => [...prev, { ...item, id: String(Date.now()) }]);
    } else {
      setCatalogs((prev) => prev.map((c) => (c.id === item.id ? item : c)));
    }
    setModal(null);
  }

  function handleDelete(item: CatalogItem) {
    if (!window.confirm(`Xóa danh mục "${item.name}"?`)) return;
    setCatalogs((prev) => prev.filter((c) => c.id !== item.id));
    setMenuOpen(null);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        {catalogGroups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-150 cursor-pointer ${
              group === g
                ? "bg-[#0047AB] text-white shadow-xs"
                : "bg-white border border-[#d9e2f1] text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1]"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
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
            placeholder="Tìm mã, tên danh mục..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setModal({
              mode: "create",
              item: { id: "", code: "", name: "", group, active: true },
            })
          }
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                <th className="px-4 py-3">Mã</th>
                <th className="px-3.5 py-3">Tên hiển thị</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-bold text-[#0047AB]">{c.code}</td>
                  <td className="px-3.5 py-3 font-semibold text-[#0f172a]">{c.name}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        c.active ? "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]" : "bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]"
                      }`}
                    >
                      {c.active ? "Đang dùng" : "Ngừng"}
                    </span>
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                      className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === c.id && (
                      <div className="absolute right-2 top-10 z-30 w-32 rounded-xl border border-[#e2e8f0] bg-white py-1.5 shadow-[0_10px_25px_rgba(7,22,51,0.12)] animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ mode: "edit", item: c });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#dc2626] hover:bg-[#fef2f2] cursor-pointer transition-colors"
                          onClick={() => handleDelete(c)}
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
                  <td colSpan={4} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không có danh mục trong nhóm này</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <CatalogModal
          item={modal.item}
          group={group}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function SettingsPanel({
  settings,
  setSettings,
}: {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
}) {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-[680px] rounded-2xl border border-[#d9e2f1] bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-[#0f172a]">Thông số vận hành hệ thống</h2>
        <p className="mt-0.5 text-[12.5px] text-[#64748b]">Cấu hình các tham số toàn cục áp dụng cho toàn bộ phân hệ</p>
      </div>
      <div className="space-y-4">
        <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
          Tên công ty
          <input
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </label>
        <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
          Email hệ thống
          <input
            type="email"
            value={settings.systemEmail}
            onChange={(e) => setSettings({ ...settings, systemEmail: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
            Cảnh báo chứng chỉ (ngày)
            <input
              type="number"
              min={1}
              value={settings.certWarningDays}
              onChange={(e) => setSettings({ ...settings, certWarningDays: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150 font-mono"
            />
          </label>
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
            Mục tiêu sản lượng mặc định
            <input
              type="number"
              min={0}
              value={settings.defaultProductionTarget}
              onChange={(e) => setSettings({ ...settings, defaultProductionTarget: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150 font-mono"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
            Múi giờ
            <input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
            />
          </label>
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
            Timeout phiên (phút)
            <input
              type="number"
              min={30}
              value={settings.sessionTimeoutMinutes}
              onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150 font-mono"
            />
          </label>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-[#e8eef8] pt-5">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-5 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
        >
          Lưu cấu hình
        </button>
        {saved && <span className="text-[13px] font-semibold text-[#15803d] animate-in fade-in duration-200">✓ Đã lưu thay đổi thành công</span>}
      </div>
    </div>
  );
}

function AccountsPanel({
  accounts,
  setAccounts,
}: {
  accounts: InitialAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<InitialAccount[]>>;
}) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.username.toLowerCase().includes(q) ||
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  function toggleStatus(account: InitialAccount) {
    const next = account.status === "Hoạt động" ? "Khóa" : "Hoạt động";
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, status: next } : a)));
    setMenuOpen(null);
  }

  function handleDelete(account: InitialAccount) {
    if (!window.confirm(`Xóa tài khoản "${account.username}"?`)) return;
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    setMenuOpen(null);
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        Danh sách tài khoản khởi tạo khi triển khai hệ thống. Tài khoản <strong>Quản trị</strong> có
        toàn quyền cấu hình và quản lý dữ liệu.
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
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
            placeholder="Tìm tên đăng nhập, họ tên, email..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setAccounts((prev) => [
              {
                id: String(Date.now()),
                username: `user${prev.length + 1}`,
                fullName: "Nhân viên mới",
                email: "",
                role: "Nhân viên",
                status: "Hoạt động",
                createdAt: new Date().toISOString().slice(0, 10),
                note: "Tài khoản thêm thủ công",
              },
              ...prev,
            ])
          }
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm tài khoản
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                <th className="px-4 py-3">Tên đăng nhập</th>
                <th className="px-3.5 py-3">Họ tên</th>
                <th className="px-3.5 py-3">Email</th>
                <th className="px-3.5 py-3">Vai trò</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3">Ngày tạo</th>
                <th className="px-3.5 py-3">Ghi chú</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-bold text-[#0047AB]">{a.username}</td>
                  <td className="px-3.5 py-3 font-semibold text-[#0f172a]">{a.fullName}</td>
                  <td className="px-3.5 py-3 text-[#334155]">{a.email || "—"}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        a.role === "Quản trị" ? "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]" : "bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]"
                      }`}
                    >
                      {a.role}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        a.status === "Hoạt động" ? "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]" : "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-[#334155] font-mono whitespace-nowrap">
                    {new Date(a.createdAt + "T00:00:00").toLocaleDateString("vi-VN")}
                  </td>
                  <td className="max-w-[180px] px-3.5 py-3 text-[12.5px] text-[#64748b]">{a.note}</td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                      className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === a.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-[#e2e8f0] bg-white py-1.5 shadow-[0_10px_25px_rgba(7,22,51,0.12)] animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => toggleStatus(a)}
                        >
                          {a.status === "Hoạt động" ? "Khóa tài khoản" : "Mở khóa"}
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#dc2626] hover:bg-[#fef2f2] cursor-pointer transition-colors"
                          onClick={() => handleDelete(a)}
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
                  <td colSpan={8} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy tài khoản</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function SystemConfiguration() {
  const [tab, setTab] = useState<ConfigTab>("catalogs");
  const [catalogs, setCatalogs] = useState(seedCatalogs);
  const [settings, setSettings] = useState(defaultSystemSettings);
  const [accounts, setAccounts] = useState(seedAccounts);

  const tabs: { id: ConfigTab; label: string; count?: number }[] = [
    { id: "catalogs", label: "Danh mục dùng chung", count: catalogs.length },
    { id: "settings", label: "Cấu hình hệ thống" },
    { id: "accounts", label: "Tài khoản khởi tạo", count: accounts.length },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 inline-flex rounded-xl border border-[#d9e2f1] bg-[#f1f5f9] p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-2 text-[12.5px] sm:text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              tab === t.id ? "bg-white text-[#0047AB] shadow-xs" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold font-mono ${
                  tab === t.id ? "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]" : "bg-white/80 text-[#64748b] border border-[#e2e8f0]"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "catalogs" && <CatalogsPanel catalogs={catalogs} setCatalogs={setCatalogs} />}
      {tab === "settings" && <SettingsPanel settings={settings} setSettings={setSettings} />}
      {tab === "accounts" && <AccountsPanel accounts={accounts} setAccounts={setAccounts} />}
    </main>
  );
}
