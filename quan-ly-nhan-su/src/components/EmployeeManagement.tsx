"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { employees as seedEmployees, type Employee } from "@/data/employees";
import EmployeeFormModal, { type EmployeeFormValues } from "@/components/EmployeeFormModal";

export default function EmployeeManagement() {
  const [list, setList] = useState<Employee[]>(seedEmployees);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("Tất cả phòng");
  const [position, setPosition] = useState("Tất cả chức vụ");
  const [role, setRole] = useState("Tất cả vai trò");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [selected, setSelected] = useState<string[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const departments = useMemo(
    () => ["Tất cả phòng", ...Array.from(new Set(list.map((e) => e.department).filter(Boolean)))],
    [list],
  );
  const positions = useMemo(
    () => ["Tất cả chức vụ", ...Array.from(new Set(list.map((e) => e.position).filter(Boolean)))],
    [list],
  );
  const roles = useMemo(
    () => ["Tất cả vai trò", ...Array.from(new Set(list.map((e) => e.role).filter(Boolean)))],
    [list],
  );
  const statuses = ["Tất cả trạng thái", "Hoạt động", "Khóa"];

  const roleSuggestions = useMemo(
    () => Array.from(new Set(["Nhân viên", "Quản trị", ...list.map((e) => e.role).filter(Boolean)])),
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      const matchQ =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q);
      const matchDept = department === "Tất cả phòng" || e.department === department;
      const matchPos = position === "Tất cả chức vụ" || e.position === position;
      const matchRole = role === "Tất cả vai trò" || e.role === role;
      const matchStatus = status === "Tất cả trạng thái" || e.status === status;
      return matchQ && matchDept && matchPos && matchRole && matchStatus;
    });
  }, [list, query, department, position, role, status]);

  const activeCount = list.filter((e) => e.status === "Hoạt động").length;
  const lockedCount = list.filter((e) => e.status === "Khóa").length;
  const adminCount = list.filter((e) => e.role === "Quản trị").length;
  const staffCount = list.filter((e) => e.role !== "Quản trị").length;

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.includes(e.id));

  function toggleAll() {
    if (allSelected) setSelected((prev) => prev.filter((id) => !filtered.some((e) => e.id === id)));
    else setSelected((prev) => Array.from(new Set([...prev, ...filtered.map((e) => e.id)])));
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function handleAdd(values: EmployeeFormValues) {
    const duplicated = list.some(
      (e) =>
        e.code.toLowerCase() === values.code.toLowerCase() ||
        e.username.toLowerCase() === values.username.toLowerCase() ||
        e.email.toLowerCase() === values.email.toLowerCase(),
    );
    if (duplicated) {
      showToast("Mã NV / email / tên đăng nhập đã tồn tại.");
      return;
    }

    const next: Employee = {
      id: `local-${Date.now()}`,
      code: values.code,
      name: values.name,
      email: values.email,
      username: values.username,
      department: values.department,
      position: values.position,
      role: values.role,
      status: values.status,
      photo: values.photo,
    };
    setList((prev) => [next, ...prev]);
    setOpenAdd(false);
    showToast(`Đã thêm ${values.name}`);
  }

  function nextCode() {
    const nums = list
      .map((e) => Number((e.code.match(/\d+/) || [])[0]))
      .filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : list.length;
    return `NV${String(max + 1).padStart(3, "0")}`;
  }

  function handleDelete(employee: Employee) {
    if (!window.confirm(`Xóa nhân viên "${employee.name}"?`)) return;
    setList((prev) => prev.filter((x) => x.id !== employee.id));
    setSelected((prev) => prev.filter((id) => id !== employee.id));
    setMenuOpen(null);
    showToast(`Đã xóa ${employee.name}`);
  }

  function handleToggleLock(employee: Employee) {
    const nextStatus = employee.status === "Hoạt động" ? "Khóa" : "Hoạt động";
    setList((prev) =>
      prev.map((x) => (x.id === employee.id ? { ...x, status: nextStatus } : x)),
    );
    setMenuOpen(null);
    showToast(nextStatus === "Khóa" ? `Đã khóa ${employee.name}` : `Đã mở khóa ${employee.name}`);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{list.length}</strong> nhân viên
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{activeCount}</strong> hoạt động · <span className="text-rose-700 font-medium font-mono tabular-nums">{lockedCount}</span> khóa
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-[#0047AB] font-mono tabular-nums">{adminCount}</strong> quản trị · {staffCount} nhân viên
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
            placeholder="Tìm theo tên, mã NV, email..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {positions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer" />
                </th>
                <th className="px-3.5 py-3">Mã NV</th>
                <th className="px-3.5 py-3">Nhân viên</th>
                <th className="px-3.5 py-3">Tên đăng nhập</th>
                <th className="px-3.5 py-3">Phòng ban</th>
                <th className="px-3.5 py-3">Chức vụ</th>
                <th className="px-3.5 py-3">Vai trò</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="w-12 px-2 py-3 text-center" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e: Employee) => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={() => toggleOne(e.id)}
                      aria-label={`Chọn ${e.name}`}
                      className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3.5 py-3 font-mono font-semibold text-[#0047AB] text-xs sm:text-sm">{e.code}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 shadow-2xs">
                        <Image
                          src={e.photo}
                          alt={e.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                          unoptimized={e.photo.startsWith("blob:")}
                        />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="truncate font-semibold text-slate-900 text-xs sm:text-sm">{e.name}</div>
                        <div className="truncate text-xs text-slate-500">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 font-mono text-xs sm:text-sm text-slate-700">{e.username}</td>
                  <td className="px-3.5 py-3 text-slate-700">{e.department}</td>
                  <td className="px-3.5 py-3 text-slate-700">{e.position}</td>
                  <td className="px-3.5 py-3">
                    {e.role === "Quản trị" ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB] shadow-2xs">
                        {e.role}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-2xs">
                        {e.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    {e.status === "Hoạt động" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {e.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {e.status}
                      </span>
                    )}
                  </td>
                  <td className="relative px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === e.id ? null : e.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="19" cy="12" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === e.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            showToast(`${e.name} · ${e.code} · ${e.department}`);
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            showToast(`Sửa thông tin ${e.name}`);
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => handleToggleLock(e)}
                        >
                          {e.status === "Hoạt động" ? "Khóa" : "Mở khóa"}
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          onClick={() => handleDelete(e)}
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
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy nhân viên phù hợp</div>
                    <div className="mt-1 text-xs text-slate-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeFormModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={handleAdd}
        departments={departments}
        positions={positions}
        roles={roleSuggestions}
        initial={{ code: nextCode() }}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </main>
  );
}
