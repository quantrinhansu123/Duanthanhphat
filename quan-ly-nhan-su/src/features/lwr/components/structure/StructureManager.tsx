"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { STRUCTURE_BUCKET, supabase } from "@lwr/lib/supabase";
import { STATUS_OPTIONS } from "@lwr/lib/structure-data";
import { loadStructureSymbols, STRUCTURE_LOCAL_KEY } from "@lwr/lib/structure-storage";
import type { StructureInput, StructureSymbol } from "@lwr/types/structure";
import { safeImageUrl, validateImage } from "@lwr/lib/safe-url";
import { StructureForm } from "./StructureForm";

const TABLE = "structure_symbols";
const LOCAL_KEY = STRUCTURE_LOCAL_KEY;
const MIGRATION_HINT =
  "supabase/migration_20261017_structure_symbols.sql (hoặc thanhphatquanlyhanray/supabase/schemas/structure_symbols.sql)";

function isMissingTableError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return (
    text.includes("structure_symbols") ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find the table")
  );
}

const readLocalRows = (): StructureSymbol[] =>
  JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as StructureSymbol[];

function saveLocalRecord(
  data: StructureInput,
  image_url: string | null,
  editing: StructureSymbol | null,
): StructureSymbol[] {
  const record: StructureSymbol = {
    ...data,
    image_url,
    id: editing?.id ?? crypto.randomUUID(),
    created_at: editing?.created_at ?? new Date().toISOString(),
  };
  const current = readLocalRows();
  const next = editing
    ? current.map((row) => (row.id === editing.id ? record : row))
    : [record, ...current];
  localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  return next;
}

const readImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const bad = validateImage(file);
  if (bad) return reject(new Error(bad));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error("Không đọc được ảnh."));
  reader.readAsDataURL(file);
});

const uploadImage = async (file: File): Promise<string> => {
  if (!supabase) throw new Error("Chưa cấu hình kết nối dữ liệu.");
  const bad = validateImage(file);
  if (bad) throw new Error(bad);
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(STRUCTURE_BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from(STRUCTURE_BUCKET).getPublicUrl(path).data.publicUrl;
};

const pathFromUrl = (url: string) => url.split(`/${STRUCTURE_BUCKET}/`)[1];

/** Management dashboard: list, filter, create, edit, delete construction symbols. */
export function StructureManager() {
  const [rows, setRows] = useState<StructureSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StructureSymbol | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await loadStructureSymbols());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh mục ký hiệu.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q ||
          `${r.code} ${r.name} ${r.name_en ?? ""} `.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (r: StructureSymbol) => {
    setEditing(r);
    setFormOpen(true);
  };

  const save = async (data: StructureInput, image: File | null, removeImage: boolean) => {
    setSaving(true);
    try {
      if (!supabase) {
        const image_url = image ? await readImage(image) : removeImage ? null : data.image_url;
        try {
          setRows(saveLocalRecord(data, image_url, editing));
        } catch {
          throw new Error("Không lưu được trên trình duyệt. Bộ nhớ có thể đã đầy; hãy thử ảnh nhỏ hơn.");
        }
        setFormOpen(false);
        return;
      }
      let image_url = data.image_url;
      try {
        if (image) image_url = await uploadImage(image);
        else if (removeImage) image_url = null;
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        if (!isMissingTableError(msg) && !msg.toLowerCase().includes("bucket")) throw uploadErr;
        // Bucket/bảng chưa có → lưu local
        const localUrl = image ? await readImage(image) : removeImage ? null : data.image_url;
        setRows(saveLocalRecord(data, localUrl, editing));
        setFormOpen(false);
        alert(`Chưa có bảng/bucket trên Supabase — đã lưu local. Chạy ${MIGRATION_HINT}`);
        return;
      }

      const payload = { ...data, image_url };
      const res = editing
        ? await supabase
            .from(TABLE)
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", editing.id)
        : await supabase.from(TABLE).insert(payload);
      if (res.error) {
        if (isMissingTableError(res.error.message)) {
          const localUrl = image ? await readImage(image) : removeImage ? null : data.image_url;
          setRows(saveLocalRecord(data, localUrl, editing));
          setFormOpen(false);
          alert(`Chưa có bảng structure_symbols — đã lưu local. Chạy ${MIGRATION_HINT}`);
          return;
        }
        throw res.error;
      }

      const old = editing?.image_url;
      if (old && old !== image_url && pathFromUrl(old)) {
        await supabase.storage.from(STRUCTURE_BUCKET).remove([pathFromUrl(old)]);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      alert(`Lưu thất bại: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: StructureSymbol) => {
    if (!confirm(`Xóa "${r.code} – ${r.name}"? Không thể hoàn tác.`)) return;
    if (!supabase) {
      try {
        const next = readLocalRows().filter((row) => row.id !== r.id);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setRows(next);
      } catch {
        alert("Không xóa được dữ liệu lưu trên trình duyệt.");
      }
      return;
    }
    const { error: err } = await supabase.from(TABLE).delete().eq("id", r.id);
    if (err) {
      if (isMissingTableError(err.message)) {
        try {
          const next = readLocalRows().filter((row) => row.id !== r.id);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          setRows(next);
        } catch {
          alert("Không xóa được dữ liệu lưu trên trình duyệt.");
        }
        return;
      }
      alert(`Xóa thất bại: ${err.message}`);
      return;
    }
    if (r.image_url && pathFromUrl(r.image_url)) {
      await supabase.storage.from(STRUCTURE_BUCKET).remove([pathFromUrl(r.image_url)]);
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h1 className="text-lg font-semibold">Quản lý ký hiệu công trình</h1>
          <p className="text-xs text-slate-500">{rows.length} công trình</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã, tên, tên tiếng Anh…"
            className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {!supabase && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Chế độ local: dữ liệu được lưu trên trình duyệt này, chưa đồng bộ lên máy chủ. Xóa dữ liệu trình duyệt sẽ xóa các công trình đã lưu local.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Không tải được dữ liệu: {error}. Chạy migration{" "}
          <code className="rounded bg-red-100 px-1">{MIGRATION_HINT}</code> trong Supabase SQL Editor.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Ảnh</th>
              <th className="px-4 py-3">Mã / Tên</th>
              <th className="px-4 py-3">Tên tiếng Anh</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Ghi chú</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Đang tải…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const st = STATUS_OPTIONS.find((s) => s.value === r.status);
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2">
                      <div className="h-16 w-20 overflow-hidden rounded-md border border-slate-100 bg-white">
                        {safeImageUrl(r.image_url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={safeImageUrl(r.image_url) ?? ""} alt={r.name} className="h-full w-full object-contain" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.code}</div>
                      <div className="text-xs text-slate-500">{r.name}</div>
                    </td>
                    <td className="px-4 py-2">{r.name_en || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st?.tone}`}>
                        {st?.label}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-500">{r.note || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button
                        onClick={() => openEdit(r)}
                        className="mr-1 rounded p-1.5 text-slate-600 hover:bg-slate-100"
                        title="Sửa"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <StructureForm
          key={editing?.id ?? "new"}
          initial={editing}
          saving={saving}
          onCancel={() => setFormOpen(false)}
          onSubmit={save}
        />
      )}
    </div>
  );
}
