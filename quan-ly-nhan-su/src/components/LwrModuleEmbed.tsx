"use client";

import dynamic from "next/dynamic";

const TrackDashboard = dynamic(
  () =>
    import("@lwr/components/track/TrackDashboard").then((m) => m.TrackDashboard),
  { ssr: false },
);
const StressReleaseCalculator = dynamic(
  () =>
    import("@lwr/components/track/StressReleaseCalculator").then(
      (m) => m.StressReleaseCalculator,
    ),
  { ssr: false },
);
const StructureManager = dynamic(
  () =>
    import("@lwr/components/structure/StructureManager").then(
      (m) => m.StructureManager,
    ),
  { ssr: false },
);

export type LwrModulePath = "/" | "/giai-toa-ung-suat" | "/cong-trinh";

type LwrModuleEmbedProps = {
  path: LwrModulePath;
  title: string;
};

/** Render module LWR trong cùng app quan-ly-nhan-su (không iframe / không app riêng). */
export default function LwrModuleEmbed({ path, title }: LwrModuleEmbedProps) {
  return (
    <div
      className="h-full min-h-0 w-full flex-1 bg-[#f4f6fa] px-3 py-3 sm:px-4 sm:py-4"
      data-lwr-module={path}
      aria-label={title}
    >
      {path === "/" ? <TrackDashboard /> : null}
      {path === "/giai-toa-ung-suat" ? <StressReleaseCalculator /> : null}
      {path === "/cong-trinh" ? <StructureManager /> : null}
    </div>
  );
}
