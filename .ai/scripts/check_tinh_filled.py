import re
from pathlib import Path

t = Path(r"quan-ly-nhan-su/src/lib/tb15ClimateSeed.generated.ts").read_text(encoding="utf-8")
empty = len(re.findall(r'tinh: ""', t))
filled = len(re.findall(r'tinh: "[^"]+"', t))
print("filled", filled, "empty", empty)
for name in ["Mường Tè", "Lai Châu", "Hà Nội", "Hàm Tân", "Bắc Kạn"]:
    m = re.search(rf'ten_tram: "{re.escape(name)}", tinh: "([^"]*)"', t)
    print(name, "=>", m.group(1) if m else "MISSING")
