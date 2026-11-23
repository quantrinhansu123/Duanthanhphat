"""Map tỉnh/thành from QCVN A.1 tables into climate seed (A.5/A.6)."""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from pathlib import Path

import pdfplumber

PDF = Path(r"C:\Users\Admin\Desktop\ThanhPhat\Quy định điều kiện thời thiết vùng 02-bxd.pdf")
CLIMATE_JSON = Path(r".ai/output/thanhphat/qcvn_climate.json")
SEED_OUT = Path(r"quan-ly-nhan-su/src/lib/tb15ClimateSeed.generated.ts")
MAP_OUT = Path(r".ai/output/thanhphat/qcvn_a1_provinces.json")

# A.5/A.6 name → A.1 station name (after accent-fold)
ALIASES = {
    "bac kan": "bac can",
    "ham tan": "la gi",
    "ha noi": "lang",  # A.1 không có trạm trùng tên; gần nhất Láng (Hà Nội)
    "ayun pa": "ayunpa",
    "dak to": "dac to",
    "dak nong": "dac nong",
}


def clean(cell) -> str:
    if cell is None:
        return ""
    return re.sub(r"\s+", " ", str(cell).replace("\n", " ")).strip()


def norm(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "d")
    s = s.replace("’", "'").replace("ʻ", "'").replace("`", "'")
    s = unicodedata.normalize("NFD", s.casefold())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return ALIASES.get(s, s)


def parse_a1() -> list[dict]:
    rows: list[dict] = []
    current_tinh = ""
    with pdfplumber.open(str(PDF)) as pdf:
        for pi in range(111, 117):
            tables = pdf.pages[pi].extract_tables() or []
            if not tables:
                continue
            for raw in tables[0]:
                cells = [clean(c) for c in raw]
                while len(cells) < 6:
                    cells.append("")
                c0, c1, c2, c3, c4, c5 = cells[:6]
                joined = " | ".join(cells)
                if not c2 and not c3:
                    if "Khu vực" in c0:
                        continue
                    continue
                if "Trạm" in joined or "(1)" in joined or joined.startswith("Tỉnh"):
                    continue
                if not c3 or not re.match(r"^-?\d", c3.replace(",", ".")):
                    continue
                if c0:
                    current_tinh = re.sub(r"^\d+\.\s*", "", c0).strip()
                rows.append(
                    {
                        "tinh": current_tinh,
                        "huyen": c1,
                        "ten_tram": c2,
                        "kinh_do": c3.replace(",", "."),
                        "vi_do": c4.replace(",", "."),
                        "cao_do": c5.replace(",", "."),
                        "page": pi + 1,
                    }
                )
    return rows


def find_tinh(ten: str, by_tram: dict[str, dict]) -> str:
    key = norm(ten)
    if key in by_tram:
        return by_tram[key]["tinh"]
    for k, r in by_tram.items():
        if key == k or key in k or k in key:
            return r["tinh"]
        if set(key.split()) == set(k.split()):
            return r["tinh"]
    return ""


def main() -> None:
    a1 = parse_a1()
    by_tram = {norm(r["ten_tram"]): r for r in a1 if r["ten_tram"]}
    print(f"A.1 stations: {len(by_tram)}")

    climate = json.loads(CLIMATE_JSON.read_text(encoding="utf-8"))
    merged = climate["merged"]
    matched = 0
    for m in merged:
        tinh = find_tinh(m["ten_tram"], by_tram)
        m["tinh"] = tinh
        if tinh:
            matched += 1
    unmatched = [m["ten_tram"] for m in merged if not m.get("tinh")]
    print(f"matched {matched}/{len(merged)}")
    print("unmatched", unmatched)

    MAP_OUT.write_text(
        json.dumps({"a1": a1, "merged": merged, "unmatched": unmatched}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        'import type { Tb15Row } from "@/lib/tb15Catalogs";',
        "",
        "/** Auto-generated from QCVN A.5+A.6 + tỉnh (A.1). Do not edit by hand. */",
        "export const TB15_CLIMATE_SEED: Tb15Row[] = [",
    ]
    for m in merged:
        if m.get("t_kk_max") is None or m.get("t_kk_min") is None:
            continue
        rid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"qcvn-a5a6:{m['ten_tram'].casefold()}"))
        ten = m["ten_tram"].replace("\\", "\\\\").replace('"', '\\"')
        tinh = (m.get("tinh") or "").replace("\\", "\\\\").replace('"', '\\"')
        lines.append(
            "  {"
            f' id: "{rid}", ma_tram: "{m["stt"]}", ten_tram: "{ten}", tinh: "{tinh}",'
            f' t_kk_max: {m["t_kk_max"]}, t_kk_min: {m["t_kk_min"]},'
            f' nguon: "QCVN 02:2022/BXD", ghi_chu: ""'
            " },"
        )
    lines.append("];\n")
    SEED_OUT.write_text("\n".join(lines), encoding="utf-8")
    climate["merged"] = merged
    CLIMATE_JSON.write_text(json.dumps(climate, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {SEED_OUT}")


if __name__ == "__main__":
    main()
