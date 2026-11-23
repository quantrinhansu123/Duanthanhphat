"""Tạo file mẫu docx/xlsx/pdf để kiểm tra analyzer."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from openpyxl import Workbook

SAMPLES = Path(__file__).resolve().parent


def make_docx() -> Path:
    path = SAMPLES / "mau_hop_dong.docx"
    doc = Document()
    doc.add_heading("Hợp đồng mẫu", level=1)
    doc.add_paragraph("Bên A: Công ty Thanh Phát")
    doc.add_paragraph("Bên B: Nhà thầu ABC")
    table = doc.add_table(rows=3, cols=2)
    table.rows[0].cells[0].text = "Hạng mục"
    table.rows[0].cells[1].text = "Giá trị"
    table.rows[1].cells[0].text = "Giá trị hợp đồng"
    table.rows[1].cells[1].text = "1.000.000.000"
    table.rows[2].cells[0].text = "Thời gian"
    table.rows[2].cells[1].text = "12 tháng"
    doc.save(path)
    return path


def make_xlsx() -> Path:
    path = SAMPLES / "mau_bang_tinh.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "Chi phí"
    ws.append(["STT", "Hạng mục", "Số lượng", "Đơn giá"])
    ws.append([1, "Thép ray", 100, 2500000])
    ws.append([2, "Bu lông", 500, 15000])
    ws2 = wb.create_sheet("Ghi chú")
    ws2.append(["Ghi chú", "Dữ liệu mẫu để test analyzer"])
    wb.save(path)
    return path


def make_pdf() -> Path:
    """Minimal one-page PDF with extractable Helvetica text (no reportlab)."""
    path = SAMPLES / "mau_bao_cao.pdf"
    # PDF objects: catalog → pages → page → contents + font
    stream = b"BT /F1 24 Tf 72 720 Td (Bao cao mau - Thanh Phat) Tj ET"
    objects = [
        b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        (
            b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
        ),
        (
            f"4 0 obj<< /Length {len(stream)} >>stream\n".encode("ascii")
            + stream
            + b"\nendstream\nendobj\n"
        ),
        b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n"
        ).encode("ascii")
    )
    path.write_bytes(bytes(pdf))
    return path


def main() -> None:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    for p in (make_docx(), make_xlsx(), make_pdf()):
        print(f"Created {p}")


if __name__ == "__main__":
    main()
