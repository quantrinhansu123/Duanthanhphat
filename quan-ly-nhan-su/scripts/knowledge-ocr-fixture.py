"""Generate synthetic Vietnamese OCR fixtures, never copy business documents."""
import argparse
import json
import os
from pathlib import Path
import fitz

parser = argparse.ArgumentParser()
parser.add_argument("directory")
args = parser.parse_args()
directory = Path(args.directory)
directory.mkdir(parents=True, exist_ok=True)
fonts = [os.getenv("KNOWLEDGE_TEST_FONT", ""), "C:/Windows/Fonts/arial.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"]
font = next((path for path in fonts if path and Path(path).is_file()), None)
if font is None:
    raise SystemExit("DK_TEST_FONT_REQUIRED")
source = fitz.open()
page = source.new_page(width=595, height=842)
page.insert_font(fontname="vi", fontfile=font)
lines = ["HỒ SƠ THỬ NGHIỆM - KHÔNG PHẢI TÀI LIỆU THẬT",
         "Người kiểm tra: Nguyễn Doãn Huy", "Hợp đồng: HD-TEST-01",
         "Ngày nghiệm thu: 01/11/2026", "Giá trị nghiệm thu lũy kế: 17.250.605.000 đồng."]
for i, line in enumerate(lines):
    page.insert_text((35, 70 + i * 45), line, fontname="vi", fontsize=15)
for i, (label, amount) in enumerate([("Hợp đồng", "20.000.000.000"), ("Đề nghị thanh toán", "1.036.850.000")]):
    y = 340 + i * 50
    page.insert_text((40, y), label, fontname="vi", fontsize=16)
    page.insert_text((310, y), amount, fontname="vi", fontsize=16)
    page.draw_line((35, y + 10), (555, y + 10))
pix = page.get_pixmap(dpi=180, alpha=False)
pix.save(directory / "vietnamese.png")
mixed = fitz.open()
native = mixed.new_page(width=595, height=842)
native.insert_font(fontname="vi", fontfile=font)
native.insert_text((35, 80), "Đây là trang có lớp chữ, không cần gọi OCR. " * 2, fontname="vi", fontsize=12)
scan = mixed.new_page(width=595, height=842)
scan.insert_image(scan.rect, pixmap=pix)
header = mixed.new_page(width=595, height=842)
header.insert_text((20, 20), "Selectable header only. Full financial details remain in the scan image below.")
header.insert_image(fitz.Rect(0, 35, 595, 842), pixmap=pix)
mixed.new_page(width=595, height=842)
mixed.save(directory / "mixed.pdf")
(directory / "manifest.json").write_text(json.dumps({"must_contain": ["Nguyễn Doãn Huy", "17.250.605.000", "1.036.850.000", "01/11/2026", "HD-TEST-01"], "synthetic": True}, ensure_ascii=False), encoding="utf-8")
