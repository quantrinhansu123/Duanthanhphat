import { useEffect } from "react";

const OPEN = '[role="dialog"][aria-modal="true"], dialog[open]';
const CLOSE_LABEL = /^(đóng|thoát|hủy|huỷ|bỏ qua|close|cancel)$/i;

/**
 * Dùng chung cho mọi màn hình: khi có hộp thoại/lớp phủ đang mở, nút Back (điện thoại, trình duyệt
 * hoặc nút Back trên app) chỉ đóng lớp đó, không lùi khỏi trang. Hết lớp mới lùi trang như thường.
 * ponytail: nhận lớp phủ qua role="dialog" aria-modal / <dialog open>; lớp phủ không khai báo vậy thì không bắt được.
 */
export function useOverlayBack() {
  useEffect(() => {
    let pushed = false, skipPop = false, raf = 0;
    const dialogs = () => [...document.querySelectorAll<HTMLElement>(OPEN)];
    const closeTop = () => {
      const el = dialogs().pop();
      if (!el) return false;
      const btn = [...el.querySelectorAll("button")].find((b) => CLOSE_LABEL.test(b.textContent?.trim() ?? "") || /đóng|close/i.test(b.getAttribute("aria-label") ?? ""));
      if (btn) btn.click(); else el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return true;
    };
    const sync = () => {
      const open = dialogs().length > 0;
      if (open && !pushed) {
        window.history.pushState({ ...(window.history.state ?? {}), overlayBack: true }, "");
        pushed = true;
      } else if (!open && pushed) {
        pushed = false;
        // Lớp tự đóng (bấm nút): bỏ entry đã đẩy, nếu entry hiện tại đúng là của mình.
        if (window.history.state?.overlayBack) { skipPop = true; window.history.back(); }
      }
    };
    const onPop = () => {
      if (skipPop) { skipPop = false; return; }
      if (!pushed) return;
      pushed = false;
      closeTop();
      setTimeout(sync, 60); // còn lớp khác chồng lên thì đẩy lại entry
    };
    const onAppBack = (e: Event) => { if (closeTop()) e.preventDefault(); };
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    window.addEventListener("popstate", onPop);
    window.addEventListener("app-back", onAppBack);
    return () => { mo.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("popstate", onPop); window.removeEventListener("app-back", onAppBack); };
  }, []);
}
