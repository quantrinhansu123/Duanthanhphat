import type { Tb15Wheel } from "@/lib/tb15Catalogs";

function fmt(n: number, digits = 1) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Chiều ngang ước lượng của một nhãn, để hai trục sát nhau vẫn mỗi trục một cột. */
function labelPx(text: string) {
  return Math.ceil(text.length * 7.2) + 18;
}

type PlacedAxle = {
  key: string;
  name: string;
  force: string;
  distance: string;
  x: number;
};

/**
 * Đặt trục theo cột. Khoảng cách thật giữ ở nhãn x.
 * Trục gần nhau (ví dụ cặp giá chuyển hướng 2,5 m) không còn bị co về cùng một điểm trên hình.
 * Khoảng cách lớn hơn 4 m được nới thêm một chút để các cụm trục vẫn tách nhau.
 */
function placeAxles(axles: Tb15Wheel[], en: boolean): { placed: PlacedAxle[]; width: number } {
  const origin = axles[0]?.x_m ?? 0;
  const labels = axles.map((wheel, index) => ({
    key: wheel.id ?? `${wheel.stt}-${wheel.x_m}`,
    name: en ? `Axle ${index + 1}` : `Trục ${index + 1}`,
    force: `${fmt(wheel.p_j_kn)} kN`,
    distance: `x${index + 1} = ${fmt(wheel.x_m - origin, 2)} m`,
  }));
  const slot = Math.max(
    108,
    ...labels.flatMap((label) => [labelPx(label.name), labelPx(label.force), labelPx(label.distance)]),
  );
  const pad = 8;
  let cursor = pad + slot / 2;
  const placed: PlacedAxle[] = labels.map((label, index) => {
    if (index > 0) {
      const gapM = axles[index].x_m - axles[index - 1].x_m;
      const breathe = Math.min(40, Math.max(0, gapM - 4) * 2.5);
      cursor += slot + breathe;
    }
    const at = cursor;
    return { ...label, x: at };
  });
  return { placed, width: Math.ceil(cursor + slot / 2 + pad) };
}

/** Đưa trục 1 về x = 0. Danh mục Excel đang để mốc 0 ở giữa đoàn xe. */
export function wheelsFromFirstAxle(wheels: Tb15Wheel[]): Tb15Wheel[] {
  const sorted = [...wheels].sort((a, b) => a.stt - b.stt || a.x_m - b.x_m);
  const origin = sorted[0]?.x_m ?? 0;
  if (origin === 0) return sorted;
  return sorted.map((wheel) => ({ ...wheel, x_m: wheel.x_m - origin }));
}

/** Sơ đồ trục Y1…Yn và khoảng cách x kể từ trục 1, cùng bảng số. */
export function Tb15AxleDiagram({ wheels, title, en = false }: { wheels: Tb15Wheel[]; title: string; en?: boolean }) {
  const axles = [...wheels].sort((a, b) => a.stt - b.stt || a.x_m - b.x_m);
  if (!axles.length) {
    return <p className="px-4 py-6 text-sm text-slate-500">{en ? "This scheme has no axles." : "Sơ đồ này chưa có trục."}</p>;
  }
  const { placed, width } = placeAxles(axles, en);
  const railY = 86;
  const height = 128;

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          style={{ minWidth: width }}
          role="img"
          aria-label={en ? "Axle load diagram" : "Sơ đồ tải trục"}
        >
          <line x1={12} y1={railY} x2={width - 12} y2={railY} stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
          {placed.map((axle) => (
            <g key={axle.key}>
              <text x={axle.x} y={20} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">
                {axle.name}
              </text>
              <text x={axle.x} y={40} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0047AB">
                {axle.force}
              </text>
              <line x1={axle.x} y1={48} x2={axle.x} y2={railY} stroke="#0047AB" strokeWidth="1.5" />
              <polygon points={`${axle.x},${railY} ${axle.x - 5},${railY - 8} ${axle.x + 5},${railY - 8}`} fill="#0047AB" />
              <text x={axle.x} y={railY + 22} textAnchor="middle" fontSize="11" fill="#334155">
                {axle.distance}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2">{en ? "Axle" : "Trục"}</th>
              <th className="px-3 py-2 text-right">{en ? "Y (kN)" : "Y (kN)"}</th>
              <th className="px-3 py-2 text-right">{en ? "x from axle 1 (m)" : "x kể từ trục 1 (m)"}</th>
              <th className="px-3 py-2 text-right">{en ? "Position (m)" : "Vị trí (m)"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {axles.map((wheel, index) => (
              <tr key={wheel.id ?? `${wheel.stt}-${wheel.x_m}`}>
                <td className="px-3 py-2 font-medium">{index + 1}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt(wheel.p_j_kn)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt(wheel.x_m - axles[0].x_m, 2)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt(wheel.x_m, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
