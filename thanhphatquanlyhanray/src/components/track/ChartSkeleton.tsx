/** Loading placeholder shown while the chart bundle loads on the client. */
export function ChartSkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-[210px] w-full animate-pulse items-center justify-center rounded-md bg-slate-100"
    >
      <span className="text-[11px] text-slate-400">Đang tải biểu đồ…</span>
    </div>
  );
}
