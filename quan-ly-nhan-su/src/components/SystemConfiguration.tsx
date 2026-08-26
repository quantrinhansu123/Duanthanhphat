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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-[16px] font-bold text-[#0f172a]">
          {mode === "create" ? "Thêm danh mục" : "Sửa danh mục"}
        </h3>
        <p className="mt-1 text-[12px] text-[#64748b]">Nhóm: {group}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-medium text-[#64748b]">
            Mã
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#64748b]">
            Tên hiển thị
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#334155]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-[#0047AB]"
            />
            Đang sử dụng
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-[#d9e2f1] px-4 text-[13px] font-medium text-[#334155]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...form, group })}
            className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white"
          >
            Lưu
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
      <div className="mb-4 flex flex-wrap gap-2">
        {catalogGroups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
              group === g ? "bg-[#0047AB] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e8eef8]"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm mã, tên danh mục..."
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none focus:border-[#0047AB]"
        />
        <button
          type="button"
          onClick={() =>
            setModal({
              mode: "create",
              item: { id: "", code: "", name: "", group, active: true },
            })
          }
          className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          + Thêm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              <th className="px-4 py-3">Mã</th>
              <th className="px-3 py-3">Tên hiển thị</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="w-12 px-2 py-3" aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-[#f2f4f7] hover:bg-[#f8fafc]">
                <td className="px-4 py-3 font-semibold text-[#0047AB]">{c.code}</td>
                <td className="px-3 py-3 text-[#334155]">{c.name}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      c.active ? "bg-[#e7f7ed] text-[#15803d]" : "bg-[#f1f5f9] text-[#64748b]"
                    }`}
                  >
                    {c.active ? "Đang dùng" : "Ngừng"}
                  </span>
                </td>
                <td className="relative px-2 py-3">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                    className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
                    aria-label="Tùy chọn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {menuOpen === c.id && (
                    <div className="absolute right-2 top-10 z-20 w-32 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                        onClick={() => {
                          setModal({ mode: "edit", item: c });
                          setMenuOpen(null);
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"
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
                <td colSpan={4} className="px-4 py-8 text-center text-[#64748b]">
                  Không có danh mục trong nhóm này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    <div className="max-w-[640px] rounded-xl border border-[#d9e2f1] bg-white p-5">
      <div className="mb-4 text-[14px] font-semibold text-[#0f172a]">Thông số vận hành</div>
      <div className="space-y-4">
        <label className="block text-[12px] font-medium text-[#64748b]">
          Tên công ty
          <input
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
          />
        </label>
        <label className="block text-[12px] font-medium text-[#64748b]">
          Email hệ thống
          <input
            type="email"
            value={settings.systemEmail}
            onChange={(e) => setSettings({ ...settings, systemEmail: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-[#64748b]">
            Cảnh báo chứng chỉ (ngày)
            <input
              type="number"
              min={1}
              value={settings.certWarningDays}
              onChange={(e) => setSettings({ ...settings, certWarningDays: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#64748b]">
            Mục tiêu sản lượng mặc định
            <input
              type="number"
              min={0}
              value={settings.defaultProductionTarget}
              onChange={(e) => setSettings({ ...settings, defaultProductionTarget: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-[#64748b]">
            Múi giờ
            <input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#64748b]">
            Timeout phiên (phút)
            <input
              type="number"
              min={30}
              value={settings.sessionTimeoutMinutes}
              onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          Lưu cấu hình
        </button>
        {saved && <span className="text-[13px] font-medium text-[#15803d]">Đã lưu thay đổi</span>}
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
      <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        Danh sách tài khoản khởi tạo khi triển khai hệ thống. Tài khoản <strong>Quản trị</strong> có
        toàn quyền cấu hình và quản lý dữ liệu.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm tên đăng nhập, họ tên, email..."
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none focus:border-[#0047AB]"
        />
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
          className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          + Thêm tài khoản
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              <th className="px-4 py-3">Tên đăng nhập</th>
              <th className="px-3 py-3">Họ tên</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Vai trò</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3">Ngày tạo</th>
              <th className="px-3 py-3">Ghi chú</th>
              <th className="w-12 px-2 py-3" aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-[#f2f4f7] hover:bg-[#f8fafc]">
                <td className="px-4 py-3 font-semibold text-[#0047AB]">{a.username}</td>
                <td className="px-3 py-3 font-medium text-[#0f172a]">{a.fullName}</td>
                <td className="px-3 py-3 text-[#334155]">{a.email || "—"}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      a.role === "Quản trị" ? "bg-[#0047AB] text-white" : "bg-[#e8eef8] text-[#475569]"
                    }`}
                  >
                    {a.role}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      a.status === "Hoạt động" ? "bg-[#e7f7ed] text-[#15803d]" : "bg-[#f1f5f9] text-[#64748b]"
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-[#334155]">
                  {new Date(a.createdAt + "T00:00:00").toLocaleDateString("vi-VN")}
                </td>
                <td className="max-w-[180px] px-3 py-3 text-[12px] text-[#64748b]">{a.note}</td>
                <td className="relative px-2 py-3">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                    className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
                    aria-label="Tùy chọn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {menuOpen === a.id && (
                    <div className="absolute right-2 top-10 z-20 w-36 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                        onClick={() => toggleStatus(a)}
                      >
                        {a.status === "Hoạt động" ? "Khóa" : "Mở khóa"}
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"
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
                <td colSpan={8} className="px-4 py-8 text-center text-[#64748b]">
                  Không tìm thấy tài khoản.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 inline-flex rounded-lg border border-[#d9e2f1] bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 text-[13px] font-semibold transition ${
              tab === t.id ? "bg-[#0047AB] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                  tab === t.id ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#64748b]"
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
