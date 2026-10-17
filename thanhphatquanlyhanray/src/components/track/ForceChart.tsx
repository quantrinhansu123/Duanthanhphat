"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { buildForceData } from "@/lib/track-data";
import type { ForcePoint } from "@/types/track";

interface TooltipEntry {
  value?: number | string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number | string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload.find((d) => d.dataKey === "p")?.value;
  const u = payload.find((d) => d.dataKey === "u")?.value;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md">
      <div className="font-semibold text-slate-800">x = {label} m</div>
      <div className="text-red-600">P = {p} kN</div>
      <div className="text-blue-700">u = {u} mm</div>
    </div>
  );
}

interface ForceChartProps {
  /** Override the synthetic default curve (e.g. with measured data). */
  data?: ForcePoint[];
  height?: number;
}

/** Dual-axis longitudinal force / displacement chart.
 *  Client-only: Recharts measures its container in the browser. */
export function ForceChart({ data, height = 210 }: ForceChartProps) {
  const points = useMemo(() => data ?? buildForceData(), [data]);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 18, right: 34, bottom: 22, left: 6 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 500]}
            ticks={[0, 100, 200, 300, 400, 500]}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={{ stroke: "#94a3b8" }}
            tickLine={false}
            label={{ value: "Vị trí dọc theo thanh ray x (m)", position: "insideBottom", offset: -14, fontSize: 11, fill: "#334155" }}
          />
          <YAxis
            yAxisId="p"
            domain={[-200, 200]}
            ticks={[-200, -100, 0, 50, 100, 200]}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={34}
            label={{ value: "P (kN)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#334155" }}
          />
          <YAxis
            yAxisId="u"
            orientation="right"
            domain={[-2, 2]}
            ticks={[-2, -1, 0, 1, 2]}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={30}
            label={{ value: "u (mm)", angle: 90, position: "insideRight", fontSize: 11, fill: "#334155" }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line yAxisId="p" type="monotone" dataKey="p" stroke="#d92d20" strokeWidth={1.8} dot={false} name="P" />
          <Line yAxisId="u" type="monotone" dataKey="u" stroke="#1d4ed8" strokeWidth={1.8} dot={false} name="u" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
