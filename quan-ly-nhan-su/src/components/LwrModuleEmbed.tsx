"use client";

import { useMemo, useState } from "react";
import { WarningCircle } from "@/components/icons";
import { lwrModuleUrl, type LwrModulePath } from "@/lib/lwrApp";

type LwrModuleEmbedProps = {
  path: LwrModulePath;
  title: string;
};

/** Nhúng đúng bản full UI của `thanhphatquanlyhanray` (sidebar + header + nội dung gốc). */
export default function LwrModuleEmbed({ path, title }: LwrModuleEmbedProps) {
  const src = useMemo(() => lwrModuleUrl(path), [path]);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#f4f6fa]">
      {failed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <WarningCircle size={36} className="text-amber-500" weight="fill" aria-hidden />
          <div className="max-w-md text-sm font-medium text-slate-700">
            Không tải được giao diện LWR. Chạy app{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">thanhphatquanlyhanray</code>
            {" "}ở cổng 3000 rồi tải lại trang.
          </div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A]"
          >
            Mở {title} (full)
          </a>
        </div>
      ) : (
        <iframe
          key={src}
          title={title}
          src={src}
          className="h-full min-h-[calc(100dvh-3.75rem)] w-full flex-1 border-0 bg-[#f4f6fa]"
          allow="fullscreen"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
