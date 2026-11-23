import pdfplumber

pdf = pdfplumber.open(r"C:\Users\Admin\Desktop\ThanhPhat\Quy định điều kiện thời thiết vùng 02-bxd.pdf")
# TOC around pages 6-15
for i in range(5, 20):
    t = pdf.pages[i].extract_text() or ""
    for line in t.splitlines():
        if "A." in line and ("trạm" in line.lower() or "Trạm" in line):
            print(f"TOC p{i+1}: {line.strip()[:140]}")

print("--- scan appendix for station list ---")
for i, page in enumerate(pdf.pages):
    if i < 100:
        continue
    t = page.extract_text() or ""
    if "Bảng A.1" in t or "danh mục trạm" in t.lower() or ("Tên trạm" in t and "Tỉnh" in t):
        print(f"==== page {i+1} ====")
        print("\n".join(t.splitlines()[:25]))
        print()
        if i > 125:
            break
