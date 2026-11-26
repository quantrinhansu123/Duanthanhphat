import { cantBeta } from "../lib/tb15-ground";
import { draftForGauge, type GaugeDraft, type GaugeMm } from "../lib/tb15-gauge";

function fmt(n: number, digits = 4) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

const field = "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-sm";

/** Bảng chọn khổ 1.000 / 1.435, chiều cao trọng tâm và khoảng cách tim ray. */
export function Tb15GaugeTable({
  en = false,
  draft,
  onChange,
  deltaH,
}: {
  en?: boolean;
  draft: GaugeDraft;
  onChange: (next: GaugeDraft) => void;
  deltaH: number;
}) {
  const H = Number(draft.vehicle === "dau_may" ? draft.cgLocomotiveMm : draft.cgWagonMm);
  const S = Number(draft.railCenterMm);
  const ready = Number.isFinite(H) && H > 0 && Number.isFinite(S) && S > 0 && Number.isFinite(deltaH);
  const beta = ready ? cantBeta(deltaH, H, S) : null;

  function patch(partial: Partial<GaugeDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2">{en ? "Use" : "Chọn"}</th>
              <th className="px-3 py-2">{en ? "Gauge (mm)" : "Khổ ray (mm)"}</th>
              <th className="px-3 py-2">{en ? "Rail spacing S (mm)" : "Khoảng cách tim ray S (mm)"}</th>
              <th className="px-3 py-2">{en ? "Locomotive CG H (mm)" : "H trọng tâm đầu máy (mm)"}</th>
              <th className="px-3 py-2">{en ? "Wagon CG H (mm)" : "H trọng tâm toa xe (mm)"}</th>
            </tr>
          </thead>
          <tbody>
            {([1435, 1000] as GaugeMm[]).map((gauge) => {
              const selected = draft.gauge === gauge;
              const row = selected ? draft : draftForGauge(gauge, draft);
              const rowLocked = gauge === 1435;
              return (
                <tr key={gauge} className={selected ? "bg-blue-50" : "hover:bg-slate-50"}>
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name="tb15-gauge"
                      checked={selected}
                      onChange={() => onChange(draftForGauge(gauge, draft))}
                      aria-label={en ? `Gauge ${gauge}` : `Khổ ${gauge}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold">{gauge}</td>
                  <td className="px-3 py-2">
                    {rowLocked ? (
                      <span className="font-mono">1.500</span>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={!selected}
                        value={selected ? draft.railCenterMm : ""}
                        placeholder={en ? "Enter S" : "Nhập S"}
                        onChange={(e) => patch({ railCenterMm: e.target.value })}
                        className={field}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={!selected}
                      value={selected ? draft.cgLocomotiveMm : row.cgLocomotiveMm}
                      onChange={(e) => patch({ cgLocomotiveMm: e.target.value })}
                      className={field}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={!selected}
                      value={selected ? draft.cgWagonMm : row.cgWagonMm}
                      onChange={(e) => patch({ cgWagonMm: e.target.value })}
                      className={field}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="text-xs font-semibold text-slate-700">
          {en ? "H used for β" : "H dùng để tính β"}
        </legend>
        {([
          ["dau_may", en ? "Locomotive" : "Đầu máy"],
          ["toa_xe", en ? "Wagon" : "Toa xe"],
        ] as const).map(([value, label]) => (
          <label key={value} className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="tb15-vehicle"
              checked={draft.vehicle === value}
              onChange={() => patch({ vehicle: value })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        {beta ? (
          <>
            <p className="font-mono text-base font-bold">
              β = {beta.standard ? "0,002·Δh" : "2·Δh·H/S²"} = {fmt(beta.beta)}
            </p>
            <p className="mt-1 text-xs">
              {beta.standard
                ? (en
                  ? "Standard pair H = 2,300 mm and S = 1,500 mm. The check uses β = 0.002·Δh, matching the workbook."
                  : "Cặp chuẩn H = 2.300 mm, S = 1.500 mm. Sheet kiểm toán dùng β = 0,002·Δh, khớp bảng tính Excel.")
                : (en
                  ? `Using H = ${fmt(H, 0)} mm and S = ${fmt(S, 0)} mm.`
                  : `Đang dùng H = ${fmt(H, 0)} mm và S = ${fmt(S, 0)} mm.`)}
            </p>
          </>
        ) : (
          <p>{en ? "Enter H and S for the 1,000 mm gauge. Δh is the unbalanced cant in mm." : "Nhập H và S cho khổ 1.000 mm. Δh là siêu cao không cân bằng, tính bằng mm."}</p>
        )}
      </div>
    </div>
  );
}
