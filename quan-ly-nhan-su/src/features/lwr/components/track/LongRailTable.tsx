"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  formatChainage,
  getPlacementSpan,
  railRowKey,
  type LongRail,
  type TrackLayout,
} from "@lwr/lib/track-editor";

export function LongRailTable({
  layout,
  selectedId,
  onSelect,
  onEdit,
  onRemove,
}: {
  layout: TrackLayout;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (longRail: LongRail) => void;
  onRemove: (id: string) => void;
}) {
  const rows = layout.longRails.map((longRail) => {
    const span = getPlacementSpan(layout.rows, longRail);
    const rail = layout.rows.find((item) => railRowKey(item) === longRail.rowKey);
    return { longRail, span, rail };
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-bold">Bảng quản lý thông số thanh dài</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Bấm một hàng để xem lại toàn bộ thông số đã lưu. {layout.longRails.length} thanh dài.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          Chưa có thanh dài. Nhập lý trình đầu/cuối và loại ray ở form phía trên để thêm.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Mã</th>
                <th className="px-3 py-2 font-semibold">Tên</th>
                <th className="px-3 py-2 font-semibold">Dải ray</th>
                <th className="px-3 py-2 font-semibold">Loại ray</th>
                <th className="px-3 py-2 font-semibold">Lý trình</th>
                <th className="px-3 py-2 font-semibold">Chiều dài</th>
                <th className="px-3 py-2 font-semibold">Tn</th>
                <th className="px-3 py-2 font-semibold">Ngày thi công / trạng thái</th>
                <th className="px-3 py-2 font-semibold"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ longRail, span, rail }) => {
                const selected = longRail.id === selectedId;
                const length = span ? span.endMetres - span.startMetres : null;
                return (
                  <tr
                    key={longRail.id}
                    className={`border-t cursor-pointer ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    onClick={() => onSelect(longRail.id)}
                  >
                    <td className="px-3 py-2 font-semibold text-blue-800">{longRail.code}</td>
                    <td className="px-3 py-2">{longRail.label || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {rail ? `${rail.line} · ${rail.rail}` : longRail.rowKey}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{longRail.params.railType || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {span
                        ? `Km ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{length !== null ? `${length} m` : "—"}</td>
                    <td className="px-3 py-2">{longRail.params.neutralTemp} °C</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <span className="block font-medium">{longRail.releaseDate ?? "Chưa có ngày"} · {longRail.completedAt ? "Đã giải toả" : "Chưa hoàn thành"}</span>
                      {new Date(longRail.updatedAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={`Sửa phạm vi ${longRail.code}`}
                          onClick={() => onEdit(longRail)}
                          className="rounded p-1.5 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa ${longRail.code}`}
                          onClick={() => onRemove(longRail.id)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
