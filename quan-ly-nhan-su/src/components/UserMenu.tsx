"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PasswordField } from "@/components/AccountCreateModal";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block text-xs sm:text-[13px] font-semibold text-slate-700";
const ghostBtn =
  "inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs";
const primaryBtn =
  "inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-60 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Portal ra body: header có backdrop-blur nên `fixed` bên trong bị kẹt trong header.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Footer({ error, busy, onClose, submitLabel }: { error: string | null; busy: boolean; onClose: () => void; submitLabel: string }) {
  return (
    <>
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className={ghostBtn}>Hủy</button>
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Đang lưu…" : submitLabel}</button>
      </div>
    </>
  );
}

function EditProfileModal({ name, email, birthDate, onClose }: { name: string; email: string; birthDate: string; onClose: () => void }) {
  const [fullName, setFullName] = useState(name);
  const [birth, setBirth] = useState(birthDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return setError("Nhập họ tên.");
    setBusy(true);
    setError(null);
    const { error: failure } = await createClient().auth.updateUser({ data: { full_name: fullName.trim(), birth_date: birth } });
    if (failure) {
      setError(failure.message);
      setBusy(false);
      return;
    }
    try {
      sessionStorage.removeItem("tp-access-v1");
    } catch {
      // sessionStorage bị chặn → bỏ qua
    }
    window.dispatchEvent(new Event("system-configuration-updated")); // useAccess tải lại tên hiển thị
    onClose();
  }

  return (
    <Modal title="Sửa thông tin" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)}>
        <div className="mt-4 space-y-3.5">
          <label className={labelCls}>
            Họ tên
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Ngày sinh
            <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Email
            <input value={email} disabled className={inputCls} />
          </label>
        </div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="Lưu" />
      </form>
    </Modal>
  );
}

function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return setError("Mật khẩu mới tối thiểu 6 ký tự.");
    if (next !== confirm) return setError("Mật khẩu nhập lại không khớp.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: bad } = await supabase.auth.signInWithPassword({ email, password: current });
    if (bad) {
      setError("Mật khẩu hiện tại không đúng.");
      setBusy(false);
      return;
    }
    const { error: failure } = await supabase.auth.updateUser({ password: next });
    if (failure) {
      setError(failure.message);
      setBusy(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Modal title="Đổi mật khẩu" onClose={onClose}>
        <p className="mt-3 text-sm text-emerald-700 font-semibold">Đã đổi mật khẩu thành công.</p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={primaryBtn}>Đóng</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Đổi mật khẩu" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)}>
        <div className="mt-4 space-y-3.5">
          <PasswordField label="Mật khẩu hiện tại" value={current} onChange={setCurrent} />
          <PasswordField label="Mật khẩu mới" value={next} onChange={setNext} />
          <PasswordField label="Nhập lại mật khẩu mới" value={confirm} onChange={setConfirm} />
        </div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="Đổi mật khẩu" />
      </form>
    </Modal>
  );
}

/** Khối tên người dùng trên header: bấm để mở menu Sửa thông tin / Đổi mật khẩu (mỗi mục một popup). */
export default function UserMenu({ name, email, birthDate, children }: { name: string; email: string; birthDate: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"profile" | "password" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = "block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors";

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2.5 cursor-pointer">
        {children}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); setModal("profile"); }}>Sửa thông tin</button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); setModal("password"); }}>Đổi mật khẩu</button>
        </div>
      )}
      {modal === "profile" && <EditProfileModal name={name} email={email} birthDate={birthDate} onClose={() => setModal(null)} />}
      {modal === "password" && <ChangePasswordModal email={email} onClose={() => setModal(null)} />}
    </div>
  );
}
