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

  return (    <main className="mx-auto max-w-[1400px] px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{list.length}</strong> nhân viên
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{activeCount}</strong> hoạt động · {lockedCount} khóa
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{adminCount}</strong> quản trị · {staffCount} nhân viên
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
            placeholder="Tìm theo tên, mã NV, email..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {positions.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="inline-flex h-10 items-center gap-1 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" />
                </th>
                <th className="px-3 py-3">Mã NV</th>
                <th className="px-3 py-3">Nhân viên</th>
                <th className="px-3 py-3">Tên đăng nhập</th>
                <th className="px-3 py-3">Phòng ban</th>
                <th className="px-3 py-3">Chức vụ</th>
                <th className="px-3 py-3">Vai trò</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: Employee) => (
                <tr key={e.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={() => toggleOne(e.id)}
                      aria-label={`Chọn ${e.name}`}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-[#0f172a]">{e.code}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-[#e2e8f0] ring-1 ring-[#dbe4f3]">
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
                        <div className="truncate font-semibold text-[#0f172a]">{e.name}</div>
                        <div className="truncate text-[12px] text-[#64748b]">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{e.username}</td>
                  <td className="px-3 py-3 text-[#334155]">{e.department}</td>
                  <td className="px-3 py-3 text-[#334155]">{e.position}</td>
                  <td className="px-3 py-3">
                    {e.role === "Quản trị" ? (
                      <span className="inline-flex rounded-full bg-[#0047AB] px-2.5 py-1 text-[11px] font-semibold text-white">
                        {e.role}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-[#e8eef8] px-2.5 py-1 text-[11px] font-semibold text-[#475569]">
                        {e.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${
                        e.status === "Hoạt động" ? "bg-[#0047AB]" : "bg-[#64748b]"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === e.id ? null : e.id)}
                      className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === e.id && (
                      <div className="absolute right-2 top-10 z-20 w-36 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => {
                            showToast(`${e.name} · ${e.code} · ${e.department}`);
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => {
                            showToast(`Sửa thông tin ${e.name}`);
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => handleToggleLock(e)}
                        >
                          {e.status === "Hoạt động" ? "Khóa" : "Mở khóa"}
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"
                          onClick={() => handleDelete(e)}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy nhân viên phù hợp.
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
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#071633] px-4 py-3 text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
