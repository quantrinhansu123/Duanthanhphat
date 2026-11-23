from pathlib import Path
import json
import sys

p = next(Path(r".ai/output/thanhphat").glob("TB_*.json"))
data = json.loads(p.read_text(encoding="utf-8"))
sheets = data["result"]["sheets"]
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 40
for s in sheets:
    print("=" * 60)
    print(f"SHEET: {s['name']} | rows={s['rows']} cols={s['cols']}")
    for row in s["data"][:limit]:
        cells = [str(c) if c is not None else "" for c in row]
        line = " | ".join(cells)
        if line.strip(" |"):
            print(line[:220])
