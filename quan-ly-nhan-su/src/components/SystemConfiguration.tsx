"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import AccountCreateModal, { CredentialsModal, PasswordField, accountEmail, generatePassword, roleOptions } from "@/components/AccountCreateModal";
import { navigation } from "@/data/navigation";
import { Check, DotsThree } from "@/components/icons";
import {
  catalogGroups,
  defaultPermissions,
  defaultSystemSettings,
  permissionActions,
  permissionRoles,
  type PermissionAction,
  type RolePermissions,
  initialAccounts as seedAccounts,
  sharedCatalogs as seedCatalogs,
  type CatalogGroup,
  type CatalogItem,
  type InitialAccount,
  type SystemSettings,
} from "@/data/systemConfig";
import {
  loadSystemConfiguration,
  saveSystemConfiguration,
} from "@/lib/systemConfigurationClient";

type ConfigTab = "catalogs" | "settings" | "accounts" | "permissions";

const actionLabels: Record<PermissionAction, string> = { view: "Xem", edit: "Sửa", delete: "Xóa" };

function PermissionsPanel({
  permissions,
  setPermissions,
}: {
  permissions: RolePermissions;
  setPermissions: (next: RolePermissions) => void;
}) {
  const [role, setRole] = useState<string>(permissionRoles[0]);

  function toggle(tabId: string, action: PermissionAction) {
    const current = permissions[role]?.[tabId] ?? { view: false, edit: false, delete: false };
    const next = {
      ...permissions,
      [role]: { ...permissions[role], [tabId]: { ...current, [action]: !current[action] } },
    };
    setPermissions(next);
  }

  const tabIds = navigation.flatMap((g) => g.children.map((c) => c.id));

  function toggleAll(action: PermissionAction, value: boolean) {
    setPermissions({
      ...permissions,
      [role]: Object.fromEntries(
        tabIds.map((id) => [
          id,
          { ...(permissions[role]?.[id] ?? { view: false, edit: false, delete: false }), [action]: value },
        ]),
      ),
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        {permissionRoles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              role === r
                ? "bg-[#0047AB] text-white shadow-xs"
                : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 shadow-2xs"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Chức năng — {role}</th>
              {permissionActions.map((a) => (
                <th key={a} className="w-28 px-4 py-3 text-center font-semibold">{actionLabels[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-blue-50/50">
              <td className="px-4 py-2.5 font-semibold text-[#0047AB]">Chọn tất cả</td>
              {permissionActions.map((a) => (
                <td key={a} className="px-4 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={tabIds.every((id) => permissions[role]?.[id]?.[a])}
                    onChange={(e) => toggleAll(a, e.target.checked)}
                    aria-label={`Chọn tất cả - ${actionLabels[a]}`}
                    className="h-4 w-4 cursor-pointer rounded accent-[#0047AB]"
                  />
                </td>
              ))}
            </tr>
            {navigation.map((group) => (
              <Fragment key={group.id}>
                <tr className="bg-slate-100/70">
                  <td colSpan={4} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {group.label}
                  </td>
                </tr>
                {group.children.map((fn) => (
                  <tr key={fn.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 pl-8 font-medium text-slate-800">{fn.label}</td>
                    {permissionActions.map((a) => (
                      <td key={a} className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(permissions[role]?.[fn.id]?.[a])}
                          onChange={() => toggle(fn.id, a)}
                          aria-label={`${role} - ${fn.label} - ${actionLabels[a]}`}
                          className="h-4 w-4 cursor-pointer rounded accent-[#0047AB]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Menu "⋯" của dòng: đóng khi bấm ra ngoài hoặc nhấn Esc. */
function useRowMenu() {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest("[data-row-menu]")) setOpen(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return [open, setOpen] as const;
}

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
  onPersist,
}: {
  catalogs: CatalogItem[];
  setCatalogs: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
  onPersist?: (nextCatalogs: CatalogItem[]) => Promise<void> | void;
}) {
  const [group, setGroup] = useState<CatalogGroup>("Loại ray");
  const [menuOpen, setMenuOpen] = useRowMenu();
  const [modal, setModal] = useState<{ item: CatalogItem; mode: "create" | "edit" } | null>(null);

  const filtered = useMemo(() => catalogs.filter((c) => c.group === group), [catalogs, group]);

  function handleSave(item: CatalogItem) {
    let next: CatalogItem[];
    if (modal?.mode === "create") {
      next = [...catalogs, { ...item, id: item.id || `catalog-${Date.now()}` }];
    } else {
      next = catalogs.map((c) => (c.id === item.id ? item : c));
    }
    setCatalogs(next);
    setModal(null);
    if (onPersist) void onPersist(next);
  }

  function handleDelete(item: CatalogItem) {
    if (!window.confirm(`Xóa danh mục "${item.name}"?`)) return;
    const next = catalogs.filter((c) => c.id !== item.id);
    setCatalogs(next);
    setMenuOpen(null);
    if (onPersist) void onPersist(next);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        {catalogGroups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm leading-10 font-semibold transition-all duration-150 cursor-pointer ${
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
                  <td data-row-menu className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
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
  onPersist,
  saving,
}: {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  onPersist?: (nextSettings: SystemSettings) => Promise<void> | void;
  saving?: boolean;
}) {
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (onPersist) {
      await onPersist(settings);
    }
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
          disabled={saving}
          onClick={handleSave}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] disabled:opacity-60 px-5 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-700 animate-in fade-in duration-200"><Check size={14} weight="bold" aria-hidden /> Đã lưu thay đổi thành công</span>}
      </div>
    </div>
  );
}

const inputCls =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

function AccountModal({
  account,
  onClose,
  onSave,
  onGrant,
}: {
  account: InitialAccount;
  onClose: () => void;
  onSave: (account: InitialAccount) => void;
  onGrant: (account: InitialAccount, password: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(account);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (password && password.length < 6) {
      setError("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    if (password) {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/system-configuration/accounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không đổi được mật khẩu");
        setBusy(false);
        return;
      }
    }
    onSave(form);
  }
  async function grant() {
    const email = accountEmail(account);
    const pw = generatePassword();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/system-configuration/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const payload = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
      onGrant({ ...account, email, id: payload.id ?? account.id }, pw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cấp được tài khoản");
      setBusy(false);
    }
  }
  const rows: [string, string][] = [
    ["Họ tên", account.fullName],
    ["Ngày sinh", account.birthDate ? new Date(account.birthDate + "T00:00:00").toLocaleDateString("vi-VN") : "—"],
    ["Email", account.email || "—"],
    ["Vai trò", account.role],
    ["Trạng thái", account.status],
    ["Ngày tạo", new Date(account.createdAt + "T00:00:00").toLocaleDateString("vi-VN")],
    ["Ghi chú", account.note || "—"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          {editing ? "Chỉnh sửa nhân viên" : "Chi tiết nhân viên"}
        </h3>
        {editing ? (
          <div className="mt-4 space-y-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Họ tên
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Email
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Vai trò
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                  {roleOptions(form.role).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Trạng thái
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InitialAccount["status"] })} className={inputCls}>
                  <option>Hoạt động</option>
                  <option>Khóa</option>
                </select>
              </label>
            </div>
            <PasswordField label="Mật khẩu mới" value={password} onChange={setPassword} placeholder="Để trống nếu không đổi" />
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ghi chú
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} className={`${inputCls} h-auto py-2`} />
            </label>
          </div>
        ) : (
          <dl className="mt-4 divide-y divide-slate-100 text-xs sm:text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 py-2.5">
                <dt className="w-32 shrink-0 font-semibold text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={editing ? () => { setForm(account); setPassword(""); setError(null); setEditing(false); } : onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            {editing ? "Hủy" : "Đóng"}
          </button>
          {!editing && !account.email && account.birthDate && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void grant()}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#0047AB] bg-white px-4 text-xs sm:text-sm font-semibold text-[#0047AB] hover:bg-blue-50 disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Đang cấp…" : "Cấp tài khoản"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={editing ? () => void save() : () => setEditing(true)}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer"
          >
            {editing ? "Lưu" : "Chỉnh sửa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountsPanel({
  accounts,
  setAccounts,
  onPersist,
}: {
  accounts: InitialAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<InitialAccount[]>>;
  onPersist?: (nextAccounts: InitialAccount[]) => Promise<void> | void;
}) {
  const [menuOpen, setMenuOpen] = useRowMenu();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  function handleSaveAccount(updated: InitialAccount) {
    const nextAccounts = accounts.map((a) => (a.id === updated.id ? updated : a));
    setAccounts(nextAccounts);
    setSelectedId(null);
    if (onPersist) void onPersist(nextAccounts);
  }

  const filtered = useMemo(
    () =>
      [...accounts].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
    [accounts],
  );

  function toggleStatus(account: InitialAccount) {
    const next: InitialAccount["status"] = account.status === "Hoạt động" ? "Khóa" : "Hoạt động";
    const nextAccounts = accounts.map((a) => (a.id === account.id ? { ...a, status: next } : a));
    setAccounts(nextAccounts);
    setMenuOpen(null);
    if (onPersist) void onPersist(nextAccounts);
  }

  function handleDelete(account: InitialAccount) {
    if (!window.confirm(`Xóa tài khoản "${account.fullName}"?`)) return;
    const nextAccounts = accounts.filter((a) => a.id !== account.id);
    setAccounts(nextAccounts);
    setMenuOpen(null);
    if (onPersist) void onPersist(nextAccounts);
  }

  function handleGranted(account: InitialAccount, password: string) {
    const nextAccounts = accounts.map((a) => (a.id === selectedId ? account : a));
    setAccounts(nextAccounts);
    setSelectedId(null);
    setCredentials({ email: account.email, password });
    if (onPersist) void onPersist(nextAccounts);
  }

  function handleCreated(account: InitialAccount) {
    const nextAccounts = [account, ...accounts];
    setAccounts(nextAccounts);
    setCreating(false);
    if (onPersist) void onPersist(nextAccounts);
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs sm:text-sm text-[#0047AB] shadow-2xs">
        Danh sách tài khoản khởi tạo khi triển khai hệ thống. Tài khoản <strong>Quản trị</strong> có
        toàn quyền cấu hình và quản lý dữ liệu.
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <button
          type="button"
          onClick={() => setCreating(true)}
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
                <th className="px-4 py-3">Họ tên</th>
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
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="cursor-pointer hover:bg-slate-50/80 transition-colors duration-150"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{a.fullName}</td>
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
                  <td data-row-menu className="relative px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
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
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy tài khoản</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {creating && <AccountCreateModal onClose={() => setCreating(false)} onCreate={handleCreated} />}
      {selected && (
        <AccountModal key={selected.id} account={selected} onClose={() => setSelectedId(null)} onSave={handleSaveAccount} onGrant={handleGranted} />
      )}
      {credentials && <CredentialsModal {...credentials} onClose={() => setCredentials(null)} />}
    </>
  );
}

export default function SystemConfiguration() {
  const [tab, setTab] = useState<ConfigTab>("catalogs");
  const [catalogs, setCatalogs] = useState(seedCatalogs);
  const [settings, setSettings] = useState(defaultSystemSettings);
  const [accounts, setAccounts] = useState(seedAccounts);
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSystemConfiguration()
      .then((data) => {
        if (!active) return;
        setCatalogs(data.catalogs);
        setSettings(data.settings);
        setAccounts(data.accounts);
        if (data.permissions) setPermissions(data.permissions);
      })
      .catch((err) => {
        console.error("Lỗi tải cấu hình:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function persist(
    newCatalogs: CatalogItem[] = catalogs,
    newSettings: SystemSettings = settings,
    newAccounts: InitialAccount[] = accounts,
    newPermissions: RolePermissions = permissions,
  ) {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveSystemConfiguration({
        catalogs: newCatalogs,
        settings: newSettings,
        accounts: newAccounts,
        permissions: newPermissions,
      });
      if (result.syncWarning) setSaveError(result.syncWarning);
      else setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi lưu cấu hình hệ thống";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: ConfigTab; label: string; count?: number }[] = [
    { id: "catalogs", label: "Danh mục dùng chung", count: catalogs.length },
    { id: "settings", label: "Cấu hình hệ thống" },
    { id: "accounts", label: "Tài khoản khởi tạo", count: accounts.length },
    { id: "permissions", label: "Phân quyền" },
  ];

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 gap-1">
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

        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-xs text-slate-500">Đang tải cấu hình…</span>
          )}
          {saveError && (
            <span className="text-xs font-semibold text-rose-600">{saveError}</span>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 animate-in fade-in">
              <Check size={14} weight="bold" /> Đã lưu thay đổi
            </span>
          )}
          {tab === "permissions" && (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void persist()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-60 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all cursor-pointer"
            >
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          )}
        </div>
      </div>

      {tab === "catalogs" && (
        <CatalogsPanel
          catalogs={catalogs}
          setCatalogs={setCatalogs}
          onPersist={(next) => persist(next, settings, accounts)}
        />
      )}
      {tab === "settings" && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          saving={saving}
          onPersist={(next) => persist(catalogs, next, accounts)}
        />
      )}
      {tab === "accounts" && (
        <AccountsPanel
          accounts={accounts}
          setAccounts={setAccounts}
          onPersist={(next) => persist(catalogs, settings, next)}
        />
      )}
      {tab === "permissions" && (
        <PermissionsPanel
          permissions={permissions}
          setPermissions={setPermissions}
        />
      )}
    </main>
  );
}
