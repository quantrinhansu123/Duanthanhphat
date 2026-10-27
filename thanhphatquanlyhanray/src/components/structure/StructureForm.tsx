"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { STATUS_OPTIONS } from "@/lib/structure-data";
import { safeImageUrl, validateImage } from "@/lib/safe-url";
import type { StructureInput, StructureStatus, StructureSymbol } from "@/types/structure";

interface StructureFormProps {
  initial: StructureSymbol | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (data: StructureInput, image: File | null, removeImage: boolean) => void;
}

const EMPTY: StructureInput = {
  code: "",
  name: "",
  name_en: "",
  line: "",
  km_start: null,
  km_end: null,
  status: "active",
  managing_unit: "",
  note: "",
  image_url: null,
};

function toFormState(initial: StructureSymbol | null): StructureInput {
  if (!initial) return { ...EMPTY };
  return {
    code: initial.code,
    name: initial.name,
    name_en: initial.name_en ?? "",
    line: initial.line ?? "",
    km_start: initial.km_start,
    km_end: initial.km_end,
    status: initial.status,
    managing_unit: initial.managing_unit ?? "",
    note: initial.note ?? "",
    image_url: initial.image_url,
  };
}

function emptyToNull(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text || null;
}

const inputCls =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/** Add/edit modal. Avatar image is pasted (Ctrl+V) from the clipboard or picked from disk. */
export function StructureForm({ initial, saving, onCancel, onSubmit }: StructureFormProps) {
  const [form, setForm] = useState<StructureInput>(() => toFormState(initial));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(safeImageUrl(initial?.image_url));
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const set = <K extends keyof StructureInput>(k: K, v: StructureInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const takeImage = (f: File) => {
    const bad = validateImage(f);
    if (bad) {
      alert(bad);
      return;
    }
    setFile(f);
    setRemoved(false);
    setPreview(URL.createObjectURL(f));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const f = item?.getAsFile();
    if (f) {
      e.preventDefault();
      takeImage(f);
    }
  };

  const clearImage = () => {
    setFile(null);
    setPreview(null);
    setRemoved(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onPaste={onPaste}
    >
      <form
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const name = form.name.trim();
          if (!name) return;
          onSubmit(
            {
              ...form,
              name,
              name_en: emptyToNull(form.name_en),
              line: emptyToNull(form.line),
              managing_unit: emptyToNull(form.managing_unit),
              note: emptyToNull(form.note),
              code: initial?.code || crypto.randomUUID(),
            },
            file,
            removed,
          );
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? "Sửa ký hiệu công trình" : "Thêm ký hiệu công trình"}
          </h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <label className="mb-3 block text-xs text-slate-600">
          Tên ký hiệu *
          <input
            required
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>

        <label className="mb-3 block text-xs text-slate-600">
          Tên tiếng Anh
          <input
            className={inputCls}
            value={form.name_en ?? ""}
            onChange={(e) => set("name_en", e.target.value)}
            placeholder="English name"
          />
        </label>

        <label className="mb-3 block text-xs text-slate-600">
          Trạng thái
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => set("status", e.target.value as StructureStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block text-xs text-slate-600">
          Ghi chú
          <textarea
            className={`${inputCls} min-h-[72px] resize-y`}
            value={form.note ?? ""}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Ghi chú thêm (không bắt buộc)"
            rows={3}
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-xs text-slate-600">Ảnh</legend>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center text-[11px] text-slate-400">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Ảnh đại diện" className="h-full w-full object-cover" />
            ) : (
              <span className="px-2">
                <ImagePlus className="mx-auto mb-1" size={20} />
                Dán ảnh (Ctrl+V)
              </span>
            )}
          </div>
          <div className="space-y-2 text-xs text-slate-500">
            <p>
              Sao chép ảnh bên ngoài rồi nhấn <b>Ctrl+V</b> khi cửa sổ này đang mở.
            </p>
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50">
                Chọn file
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && takeImage(e.target.files[0])}
                />
              </label>
              {preview && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >
                  Xóa ảnh
                </button>
              )}
            </div>
          </div>
        </div>

        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
