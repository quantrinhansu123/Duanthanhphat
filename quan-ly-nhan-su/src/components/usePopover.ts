"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

type Coords = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
};

/**
 * Định vị menu sổ ra bằng position: fixed (render qua portal) để KHÔNG bị
 * cắt bởi modal `overflow-hidden` và luôn nằm trong viewport trên mobile.
 * `minWidth`: bề rộng tối thiểu của menu (mặc định bằng bề rộng ô).
 */
export function usePopover(anchorRef: RefObject<HTMLElement | null>, open: boolean, minWidth = 0) {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 4;
      const margin = 8;
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const dropUp = spaceBelow < 260 && spaceAbove > spaceBelow;
      const width = Math.min(Math.max(r.width, minWidth), window.innerWidth - margin * 2);
      let left = r.left;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
      if (left < margin) left = margin;
      setCoords({
        left,
        top: dropUp ? r.top - gap : r.bottom + gap,
        width,
        maxHeight: Math.max(180, (dropUp ? spaceAbove : spaceBelow) - gap),
        placement: dropUp ? "top" : "bottom",
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open, minWidth]);

  const style: CSSProperties = coords
    ? {
        position: "fixed",
        left: coords.left,
        top: coords.top,
        width: coords.width,
        maxHeight: coords.maxHeight,
        transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
      }
    : { position: "fixed", left: 0, top: 0, visibility: "hidden" };

  return { style, ready: coords != null };
}
