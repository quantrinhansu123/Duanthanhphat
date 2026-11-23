"""Extract climate/lookup tables relevant to strength & stability inputs."""
from pathlib import Path
import json

p = next(Path(r".ai/output/thanhphat").glob("TB_*.json"))
data = json.loads(p.read_text(encoding="utf-8"))
sheets = {s["name"]: s for s in data["result"]["sheets"]}

# Tra cứu — find bảng D / climate section
tra = sheets["Tra cứu"]
print("=== TRA CỨU: rows mentioning nhiệt / bảng D / khí hậu ===")
for i, row in enumerate(tra["data"]):
    joined = " | ".join(str(c) if c is not None else "" for c in row)
    low = joined.lower()
    if any(k in low for k in ["bảng d", "nhiệt độ", "địa danh", "khí hậu", "t_kk", "max", "min"]):
        if i < 5 or "bảng d" in low or "địa danh" in low or "nhiệt độ không khí" in low:
            print(f"{i}: {joined[:220]}")

print("\n=== Rows around climate lookup (scan for city names / numeric pairs) ===")
# Print from row that looks like bảng D header onwards
start = None
for i, row in enumerate(tra["data"]):
    joined = " | ".join(str(c) if c is not None else "" for c in row)
    if "Bảng D" in joined or "địa danh" in joined.lower() and "cao nhất" in joined.lower():
        start = i
        break
print("start", start)
if start is not None:
    for row in tra["data"][start : start + 15]:
        print(" | ".join(str(c) if c is not None else "" for c in row)[:220])
    print(f"... total climate-ish rows from start: {len(tra['data']) - start}")

# Sheet 1 and 2 input-ish structure summary
for name in ["1_Độ bền ray", "2_Ổn định"]:
    s = sheets.get(name) or next((x for x in data["result"]["sheets"] if name.split("_")[0] in x["name"]), None)
    if not s:
        print("missing", name)
        continue
    print("\n" + "=" * 40, s["name"])
    for row in s["data"][:55]:
        line = " | ".join(str(c) if c is not None else "" for c in row)
        if line.strip(" |"):
            print(line[:220])
