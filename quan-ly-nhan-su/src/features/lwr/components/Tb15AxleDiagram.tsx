import type { Tb15Wheel } from "@/lib/tb15Catalogs";

function fmt(n: number, digits = 1) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Sơ đồ trục Y1…Yn và khoảng cách x kể từ trục 1, cùng bảng số. */
export function Tb15AxleDiagram({ wheels, title, en = false }: { wheels: Tb15Wheel[]; title: string; en?: boolean }) {
  const axles = [...wheels].sort((a, b) => a.stt - b.stt || a.x_m - b.x_m);
  if (!axles.length) {
    return <p className="px-4 py-6 text-sm text-slate-500">{en ? "This scheme has no axles." : "Sơ đồ này chưa có trục."}</p>;
  }
  const origin = axles[0].x_m;
  const xs = axles.map((w) => w.x_m);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const span = Math.max(max - min, 1);
  const width = Math.max(640, axles.length * 88);
  const pad = 36;
  const railY = 86;
  const xOf = (x: number) => pad + ((x - min) / span) * (width - pad * 2);

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
        <svg viewBox={`0 0 ${width} 168`} className="h-44 min-w-[40rem] w-full" role="img" aria-label={en ? "Axle load diagram" : "Sơ đồ tải trục"}>
          <line x1={pad} y1={railY} x2={width - pad} y2={railY} stroke="#64748b" strokeWidth="3" />
          {axles.map((wheel, index) => {
            const x = xOf(wheel.x_m);
            const fromFirst = wheel.x_m - origin;
            return (
              <g key={wheel.id ?? `${wheel.stt}-${wheel.x_m}`}>
                <line x1={x} y1={28} x2={x} y2={railY} stroke="#0047AB" strokeWidth="1.5" />
                <polygon points={`${x}, ${railY} ${x - 5}, ${railY - 8} ${x + 5}, ${railY - 8}`} fill="#0047AB" />
                <text x={x} y={16} textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="700">
                  {en ? `Axle ${index + 1}` : `Trục ${index + 1}`}
                </text>
                <text x={x} y={42} textAnchor="middle" fontSize="10" fill="#0047AB">{fmt(wheel.p_j_kn)} kN</text>
                <text x={x} y={railY + 28} textAnchor="middle" fontSize="10" fill="#334155">
                  x{index + 1} = {fmt(fromFirst, 2)} m
                </text>
              </g>
            );
          })}
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
                <td className="px-3 py-2 text-right font-mono">{fmt(wheel.x_m - origin, 2)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt(wheel.x_m, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
