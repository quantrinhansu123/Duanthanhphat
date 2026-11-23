"""Audit Excel Tra cứu completeness vs our 8 catalog seeds."""
from pathlib import Path
import json

p = next(Path(r".ai/output/thanhphat").glob("TB_*.json"))
data = json.loads(p.read_text(encoding="utf-8"))
sheets = {s["name"]: s for s in data["result"]["sheets"]}
tra = sheets["Tra cứu"]["data"]

# Print section headers and row counts between markers
markers = []
for i, row in enumerate(tra):
    joined = " | ".join(str(c) if c is not None else "" for c in row)
    if joined.startswith("Bảng") or "Phụ lục" in joined or "Điều 3.2" in joined:
        markers.append((i, joined[:120]))

print("SECTIONS")
for m in markers:
    print(f"  {m[0]}: {m[1]}")

print("\nTotal tra cứu rows", len(tra))
