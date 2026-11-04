import type { CSSProperties, ReactNode } from "react";

/**
 * Bọc nội dung mẫu in. Dùng cùng `@page { margin: 0 }`: lề trang do bảng này tạo (lặp ở mọi trang),
 * nên trình duyệt không in dòng ngày giờ / tiêu đề đầu trang và địa chỉ / số trang cuối trang.
 * Trên màn hình không thêm lề (xem globals.css).
 */
export default function PrintFrame({ children, top = "15mm", bottom = "15mm", left = "20mm", right = "15mm" }: {
  children: ReactNode; top?: string; bottom?: string; left?: string; right?: string;
}) {
  const vars = { "--pf-top": top, "--pf-bottom": bottom, "--pf-left": left, "--pf-right": right } as CSSProperties;
  return (
    <table className="print-frame" style={vars}>
      <thead><tr><td><div className="print-frame-space top" /></td></tr></thead>
      <tbody><tr><td className="print-frame-body">{children}</td></tr></tbody>
      <tfoot><tr><td><div className="print-frame-space bottom" /></td></tr></tfoot>
    </table>
  );
}
