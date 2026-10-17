"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildStressChartData, stressChartMeta } from "@lwr/lib/stress-chart";
import type { StressInput } from "@lwr/lib/stress-release";

const RED = "#dc2626";
const BLUE = "#1d4ed8";
const RED_FILL = "rgba(220,38,38,0.08)";
const BLUE_FILL = "rgba(29,78,216,0.10)";

const format = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const formatTick = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  if (abs >= 100) return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
};

function niceDomain(max: number, min = 0): [number, number] {
  const lo = Math.min(min, max, 0);
  const hi = Math.max(min, max, 0);
  if (lo === 0 && hi === 0) return [-1, 1];
  const span = hi - lo || 1;
  const pad = span * 0.12;
  return [lo - (lo === 0 ? 0 : pad), hi + pad];
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: number | string;
}) {
  if (!active || !payload?.length) return null;
  const p = Number(payload.find((d) => d.dataKey === "p")?.value ?? 0);
  const e = Number(payload.find((d) => d.dataKey === "extension")?.value ?? 0);
  return (
    <div className="min-w-[168px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-semibold tabular-nums text-slate-900">
        x = {format(Number(label))} m
      </p>
      <div className="mt-1.5 space-y-1">
        <p className="flex items-center justify-between gap-3 tabular-nums">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: RED }} />
            Lực kéo P
          </span>
          <span className="font-semibold" style={{ color: RED }}>
            {format(p)} kN
          </span>
        </p>
        <p className="flex items-center justify-between gap-3 tabular-nums">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: BLUE }} />
            Giãn dài ΔL
          </span>
          <span className="font-semibold" style={{ color: BLUE }}>
            {format(e)} mm
          </span>
        </p>
      </div>
    </div>
  );
}

export function StressChart({ input }: { input: StressInput }) {
  const points = useMemo(() => buildStressChartData(input), [input]);
  const meta = useMemo(() => stressChartMeta(input), [input]);
  const last = points[points.length - 1];
  const midX = last.x / 2;

  const forceDomain = useMemo(
    () => niceDomain(Math.max(...points.map((d) => d.p))),
    [points],
  );
  const extDomain = useMemo(
    () => niceDomain(Math.max(...points.map((d) => d.extension))),
    [points],
  );

  const ticks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => (last.x * i) / n);
  }, [last.x]);

  return (
    <figure
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
      data-testid="stress-chart"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          <h4 className="text-[13.5px] font-bold tracking-tight text-slate-900">
            Biểu đồ lực kéo &amp; giãn dài tự do
          </h4>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            P theo K40 · ΔL(x) tích lũy theo K43 · Vùng thở 2 đầu (phóng đại minh họa)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-red-700">
            <span className="h-[3px] w-4 rounded-full bg-red-600" />
            P giữa = {format(meta.force)} kN
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-800">
            <span className="h-[3px] w-4 rounded-full bg-blue-700" />
            ΔL = {format(last.extension)} mm
          </span>
        </div>
      </div>

      {/* Chart */}
      <div
        role="img"
        aria-label={`Biểu đồ từ 0 đến ${format(last.x)} m; lực kéo giữa ${format(meta.force)} kN; giãn dài cuối đoạn ${format(last.extension)} mm`}
        className="relative h-[280px] min-w-0 px-1 pt-2"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={points}
            margin={{ top: 18, right: 12, bottom: 6, left: 4 }}
          >
            <defs>
              <linearGradient id="stressForceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.16} />
                <stop offset="100%" stopColor={RED} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="stressExtFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BLUE} stopOpacity={0.18} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="#eef2f7"
              strokeDasharray="0"
              vertical={false}
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, last.x]}
              ticks={ticks}
              tickFormatter={formatTick}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              yAxisId="force"
              domain={forceDomain}
              tickFormatter={formatTick}
              tick={{ fontSize: 11, fill: RED }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <YAxis
              yAxisId="extension"
              orientation="right"
              domain={extDomain}
              tickFormatter={formatTick}
              tick={{ fontSize: 11, fill: BLUE }}
              tickLine={false}
              axisLine={false}
              width={58}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: "#94a3b8",
                strokeDasharray: "4 4",
                strokeWidth: 1,
              }}
            />
            <ReferenceLine
              yAxisId="force"
              y={0}
              stroke="#cbd5e1"
              strokeWidth={1}
            />

            {/* Breathing zones — shaded, force ramps here */}
            <ReferenceArea
              yAxisId="force"
              x1={0}
              x2={meta.breathLeft}
              fill="#fef3c7"
              fillOpacity={0.55}
            />
            <ReferenceArea
              yAxisId="force"
              x1={last.x - meta.breathRight}
              x2={last.x}
              fill="#fef3c7"
              fillOpacity={0.55}
            />
            <ReferenceLine
              yAxisId="force"
              x={meta.breathLeft}
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={1}
              label={{
                value: "hết vùng thở",
                position: "insideTopLeft",
                fontSize: 10,
                fill: "#b45309",
              }}
            />
            <ReferenceLine
              yAxisId="force"
              x={last.x - meta.breathRight}
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={1}
            />

            <Area
              yAxisId="extension"
              type="monotone"
              dataKey="extension"
              name="Giãn dài tích lũy"
              stroke="none"
              fill="url(#stressExtFill)"
              isAnimationActive={false}
            />
            <Area
              yAxisId="force"
              type="monotone"
              dataKey="p"
              name="Lực kéo P"
              stroke="none"
              fill="url(#stressForceFill)"
              isAnimationActive={false}
            />
            <Line
              yAxisId="force"
              type="monotone"
              dataKey="p"
              name="Lực kéo P"
              stroke={RED}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="extension"
              type="monotone"
              dataKey="extension"
              name="Giãn dài tích lũy"
              stroke={BLUE}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              isAnimationActive={false}
            />

            {/* Centre plateau + end markers */}
            <ReferenceDot
              yAxisId="force"
              x={midX}
              y={meta.force}
              r={3.5}
              fill={RED}
              stroke="#fff"
              strokeWidth={2}
            />
            <ReferenceDot
              yAxisId="extension"
              x={last.x}
              y={last.extension}
              r={4}
              fill={BLUE}
              stroke="#fff"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* X label */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-1 text-center text-[11px] font-medium text-slate-500">
          Chiều dài x (m)
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-red-600">trục trái P (kN)</span>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="font-semibold text-blue-700">trục phải ΔL (mm)</span>
        </div>
      </div>

      {/* Footer */}
      <figcaption className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs leading-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold tabular-nums text-slate-800">
          <span>L = {format(last.x)} m</span>
          <span className="font-normal text-slate-300">|</span>
          <span className="text-red-700">P giữa = {format(meta.force)} kN</span>
          <span className="font-normal text-slate-300">|</span>
          <span className="text-blue-800">ΔL(L) = {format(last.extension)} mm</span>
          <span className="font-normal text-slate-300">|</span>
          <span className="font-medium text-amber-700">Vùng thở ≈ {format(meta.breathLeft)} m mỗi đầu</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-5 text-slate-500">
          P giữ phẳng ở vùng khóa chặt, vuốt cong về 0 tại 2 mối hàn theo lực
          cản dọc r; ΔL(x) = ∫P/EA cong parabol ở 2 đầu, thẳng ở giữa, chốt đúng
          K43. Vùng thở phóng đại để nhìn rõ — thở thực (P−Pj)/r ={" "}
          {format(meta.rawBreath)} m.
        </p>
      </figcaption>
    </figure>
  );
}
