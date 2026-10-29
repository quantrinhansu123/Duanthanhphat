"use client";

import { useEffect, useRef, type ReactNode } from "react";

const DELETE_LABEL = /^(xóa|xoá|delete)(\s|$)/i;
const NOT_DELETE = /(lọc|tìm kiếm|filter|search)/i;

function hideDeleteControls(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("button, [role=menuitem]").forEach((el) => {
    if (el.closest("[data-keep-visible]")) return;
    const labels = [el.textContent, el.getAttribute("aria-label"), el.title].map((l) => l?.trim() ?? "");
    if (labels.some((l) => DELETE_LABEL.test(l) && !NOT_DELETE.test(l))) el.style.display = "none";
  });
}

/**
 * Ẩn mọi nút "Xóa…" bên trong khi người dùng không có quyền Xóa. Chỉ để giao diện gọn —
 * quyền thật được ép ở máy chủ và database (RLS). Nút xóa bộ lọc/ô nhập cần giữ thì gắn `data-keep-visible`.
 */
export default function DeleteGuard({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => hideDeleteControls(root));
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [active]);

  return <div ref={ref} className="contents">{children}</div>;
}
