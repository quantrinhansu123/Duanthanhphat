/** Điện thoại / máy tính bảng cảm ứng: window.print() không ra bản in A4 đúng → xuất PDF trực tiếp. */
export const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Chụp từng phần tử (mỗi phần tử bắt đầu một trang A4) thành PDF rồi cho người dùng lưu.
 * iOS Safari mở PDF ngay trong tab khi save()/<a download> → ưu tiên bảng chia sẻ ("Lưu vào Tệp"), không được thì <a download>.
 * `cloneStyle`: style inline gán cho bản sao khi chụp (vd. padding lề). Ô sửa trực tiếp được ẩn viền như khi in.
 */
export async function exportPagesPdf(pages: HTMLElement[], filename: string, cloneStyle = "") {
  if (!pages.length) return;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
  host.innerHTML = "<style>.ed-field{border-bottom:0!important;background:none!important}.sig-empty{display:none!important}</style>";
  const clones = pages.map((p) => {
    const c = p.cloneNode(true) as HTMLElement;
    c.style.cssText += `;margin:0;${cloneStyle}`;
    host.appendChild(c);
    return c;
  });
  document.body.appendChild(host);
  const hidden = printHiddenSelectors();
  for (const c of clones) for (const sel of hidden) { try { c.querySelectorAll<HTMLElement>(sel).forEach((n) => { n.style.display = "none"; }); } catch { /* selector không hợp lệ */ } }
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    let first = true;
    for (const el of clones) {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#fff" });
      const pageH = Math.floor((canvas.width * 297) / 210); // chiều cao 1 trang A4 theo px canvas
      for (let y = 0; y < canvas.height; y += pageH) {
        const h = Math.min(pageH, canvas.height - y);
        const part = document.createElement("canvas");
        part.width = canvas.width; part.height = h;
        part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, (h * 210) / canvas.width);
      }
    }
    const name = `${filename.replace(/[\\/:*?"<>|]/g, "-")}.pdf`;
    const blob = pdf.output("blob");
    const file = new File([blob], name, { type: "application/pdf" });
    let shared = false;
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); shared = true; }
      catch (e) { if (e instanceof DOMException && e.name === "AbortError") shared = true; /* người dùng đóng bảng chia sẻ */ }
    }
    if (!shared) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    }
  } finally { host.remove(); }
}

/** In trên máy tính; trên điện thoại xuất PDF từ các trang `.acceptance-page` đang hiển thị. */
export async function printOrPdfAcceptance(filename: string) {
  if (!isTouchDevice()) { window.print(); return; }
  await exportPagesPdf([...document.querySelectorAll<HTMLElement>(".acceptance-print-root .acceptance-page")], filename);
}

/** Các selector bị `display:none` trong @media print (nút In, thanh công cụ, `print:hidden`…) → ẩn khi chụp, giống bản in. */
function printHiddenSelectors(): string[] {
  const out: string[] = [];
  const walk = (rules: CSSRuleList, inPrint: boolean) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSMediaRule) walk(r.cssRules, inPrint || /print/.test(r.media.mediaText));
      else if (r instanceof CSSStyleRule) { if (inPrint && r.style.display === "none") out.push(r.selectorText); }
      else if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules, inPrint); // @layer, @supports…
    }
  };
  for (const sheet of Array.from(document.styleSheets)) { try { walk(sheet.cssRules, false); } catch { /* stylesheet khác nguồn */ } }
  return out;
}

/** Lớp phủ toàn màn hình (hộp thoại xem trước in) đang hiển thị — phần tử trên cùng. */
function findPrintOverlay(): HTMLElement | null {
  const all = Array.from(document.body.querySelectorAll<HTMLElement>("div,main,section,dialog"));
  let best: HTMLElement | null = null;
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) continue;
    if (el.textContent?.trim().length === 0) continue;
    best = el; // phần tử sau trong DOM nằm trên
  }
  return best;
}

/**
 * Điện thoại: thay window.print() cho MỌI phiếu in — chụp hộp thoại xem trước đang mở thành PDF.
 * Phiếu đã có bộ xuất riêng (RFI, BBNT) không đi qua đây. Máy tính giữ nguyên window.print().
 */
export function installTouchPrint() {
  if (!isTouchDevice() || (window as unknown as { __touchPrint?: boolean }).__touchPrint) return;
  (window as unknown as { __touchPrint?: boolean }).__touchPrint = true;
  const original = window.print.bind(window);
  window.print = () => {
    const overlay = findPrintOverlay();
    if (!overlay) { original(); return; }
    const name = (document.title.trim() || overlay.getAttribute("aria-label") || "Phieu-in").slice(0, 80);
    void exportPagesPdf([overlay], overlay.getAttribute("aria-label") || name,
      "position:static;inset:auto;height:auto;max-height:none;overflow:visible;width:794px;padding:0;background:#fff")
      .catch(() => original())
      .finally(() => window.dispatchEvent(new Event("afterprint"))); // trả lại document.title đã đổi trước khi in
  };
}
