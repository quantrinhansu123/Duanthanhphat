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
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          {mode === "create" ? "Thêm danh mục mới" : "Chỉnh sửa danh mục"}
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">Nhóm: <span className="font-semibold text-[#0047AB]">{group}</span></p>
        <div className="mt-4 space-y-3.5">
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Mã danh mục
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
            />
          </label>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Tên hiển thị
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
            />
          </label>
          <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer pt-1">
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
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...form, group })}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
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
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              group === g
                ? "bg-[#0047AB] text-white shadow-xs"
                : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 shadow-2xs"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
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
            placeholder="Tìm mã, tên danh mục..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
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
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Mã</th>
                <th className="px-3.5 py-3">Tên hiển thị</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-bold text-[#0047AB] text-xs sm:text-sm">{c.code}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs" : "bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs"
                      }`}
                    >
                      {c.active ? "Đang dùng" : "Ngừng"}
                    </span>
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="19" cy="12" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === c.id && (
                      <div className="absolute right-2 top-10 z-30 w-32 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ mode: "edit", item: c });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
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
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không có danh mục trong nhóm này</div>
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
    <div className="max-w-[680px] rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">Thông số vận hành hệ thống</h2>
        <p className="mt-0.5 text-xs text-slate-500">Cấu hình các tham số toàn cục áp dụng cho toàn bộ phân hệ</p>
      </div>
      <div className="space-y-4">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Tên công ty
          <input
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Email hệ thống
          <input
            type="email"
            value={settings.systemEmail}
            onChange={(e) => setSettings({ ...settings, systemEmail: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Cảnh báo chứng chỉ (ngày)
            <input
              type="number"
              min={1}
              value={settings.certWarningDays}
              onChange={(e) => setSettings({ ...settings, certWarningDays: Number(e.target.value) })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
            />
          </label>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Mục tiêu sản lượng mặc định
            <input
              type="number"
              min={0}
              value={settings.defaultProductionTarget}
              onChange={(e) => setSettings({ ...settings, defaultProductionTarget: Number(e.target.value) })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Múi giờ
            <input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
            />
          </label>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Timeout phiên (phút)
            <input
              type="number"
              min={30}
              value={settings.sessionTimeoutMinutes}
              onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
            />
          </label>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-5 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          Lưu cấu hình
        </button>
        {saved && <span className="text-xs sm:text-sm font-semibold text-emerald-700 animate-in fade-in duration-200">✓ Đã lưu thay đổi thành công</span>}
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
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs sm:text-sm text-[#0047AB] shadow-2xs">
        Danh sách tài khoản khởi tạo khi triển khai hệ thống. Tài khoản <strong>Quản trị</strong> có
        toàn quyền cấu hình và quản lý dữ liệu.
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
            placeholder="Tìm tên đăng nhập, họ tên, email..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
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
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm tài khoản
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
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
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-bold text-[#0047AB] text-xs sm:text-sm">{a.username}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{a.fullName}</td>
                  <td className="px-3.5 py-3 text-slate-700">{a.email || "—"}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        a.role === "Quản trị" ? "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs" : "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                      }`}
                    >
                      {a.role}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        a.status === "Hoạt động" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs" : "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono whitespace-nowrap">
                    {new Date(a.createdAt + "T00:00:00").toLocaleDateString("vi-VN")}
                  </td>
                  <td className="max-w-[180px] px-3.5 py-3 text-xs text-slate-500">{a.note}</td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="19" cy="12" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === a.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => toggleStatus(a)}
                        >
                          {a.status === "Hoạt động" ? "Khóa tài khoản" : "Mở khóa"}
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
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
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy tài khoản</div>
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
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              tab === t.id ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-bold font-mono tabular-nums ${
                  tab === t.id ? "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs" : "bg-white/80 text-slate-600 border border-slate-200 shadow-2xs"
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
