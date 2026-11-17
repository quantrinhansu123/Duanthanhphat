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
