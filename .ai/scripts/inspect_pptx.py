from pathlib import Path
import json

p = next(Path(r".ai/output/thanhphat").glob("*Part_I*.json"))
data = json.loads(p.read_text(encoding="utf-8"))
for slide in data["result"]["slides"]:
    print("=" * 50)
    print(f"SLIDE {slide['slide']}")
    for t in slide["texts"]:
        print(t)
        print("---")
