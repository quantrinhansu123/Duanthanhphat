"""Extract QCVN 02:2022/BXD A.5 (max) and A.6 (min) annual values by station."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import pdfplumber

PDF = Path(r"C:\Users\Admin\Desktop\ThanhPhat\Quy định điều kiện thời thiết vùng 02-bxd.pdf")
OUT = Path(r".ai/output/thanhphat/qcvn_climate.json")
SEED_OUT = Path(r"quan-ly-nhan-su/src/lib/tb15ClimateSeed.generated.ts")


def parse_num(token: str) -> float:
    token = token.replace("–", "-").replace("−", "-").replace(",", ".")
    return float(token)


def parse_station_line(line: str) -> dict | None:
    line = re.sub(r"\s+", " ", line.strip())
    # Allow missing space after "129.Name"
    m = re.match(r"^(\d+)\.\s*(.+)$", line)
    if not m:
        return None
    stt = int(m.group(1))
    rest = m.group(2).strip()
    # Split trailing number tokens (support en-dash negatives)
    tokens = rest.split(" ")
    nums: list[float] = []
    name_parts: list[str] = []
    for tok in reversed(tokens):
        cleaned = tok.replace("–", "-").replace("−", "-")
        if re.fullmatch(r"-?\d+(?:[.,]\d+)?", cleaned):
            nums.append(parse_num(cleaned))
        else:
            # nums collected from the end; name is the leading tokens in original order
            name_parts = tokens[: len(tokens) - len(nums)]
            break
    else:
        name_parts = []
    nums = list(reversed(nums))
    if len(nums) < 13:
        return None
    name = " ".join(name_parts).strip(" -–")
    if not name:
        return None
    # 12 tháng + 1 cột Năm ở cuối
    return {
        "stt": stt,
        "ten_tram": name,
        "thang": nums[-13:-1],
        "nam": nums[-1],
        "n_vals": len(nums),
    }


def extract_range(start: int, end_exclusive: int) -> list[dict]:
    """Extract pages start .. end_exclusive-1 (1-based, end exclusive)."""
    by_key: dict[str, dict] = {}
    with pdfplumber.open(str(PDF)) as pdf:
        for i in range(start - 1, min(end_exclusive - 1, len(pdf.pages))):
            t = pdf.pages[i].extract_text() or ""
            n = 0
            for line in t.splitlines():
                row = parse_station_line(line)
                if not row:
                    continue
                n += 1
                by_key[row["ten_tram"].casefold()] = row
            print(f"page {i + 1}: {n} stations, unique={len(by_key)}")
    return sorted(by_key.values(), key=lambda r: r["stt"])


def find_data_pages() -> tuple[int, int, int, int]:
    a5: list[int] = []
    a6: list[int] = []
    a7: int | None = None
    with pdfplumber.open(str(PDF)) as pdf:
        for i, page in enumerate(pdf.pages):
            if i + 1 < 120:
                continue
            t = page.extract_text() or ""
            if "Bảng A.5" in t:
                a5.append(i + 1)
            if "Bảng A.6" in t:
                a6.append(i + 1)
            if "Bảng A.7" in t:
                a7 = i + 1
                break
    a5_start = a5[0]
    a6_start = a6[0]
    a5_end = a6_start
    a6_end = a7 or (a6_start + 8)
    return a5_start, a5_end, a6_start, a6_end


def main() -> None:
    a5_start, a5_end, a6_start, a6_end = find_data_pages()
    print(f"A.5 pages {a5_start}..{a5_end - 1}, A.6 pages {a6_start}..{a6_end - 1}")

    a5 = extract_range(a5_start, a5_end)
    a6 = extract_range(a6_start, a6_end)

    max_map = {r["ten_tram"].casefold(): r for r in a5}
    min_map = {r["ten_tram"].casefold(): r for r in a6}
    keys = sorted(set(max_map) | set(min_map), key=lambda k: (max_map.get(k) or min_map[k])["stt"])

    merged = []
    for key in keys:
        mx = max_map.get(key)
        mn = min_map.get(key)
        name = (mx or mn)["ten_tram"]
        merged.append(
            {
                "ten_tram": name,
                "stt": (mx or mn)["stt"],
                "t_kk_max": mx["nam"] if mx else None,
                "t_kk_min": mn["nam"] if mn else None,
                "t_max_thang": mx["thang"] if mx else None,
                "t_min_thang": mn["thang"] if mn else None,
            }
        )

    complete = [m for m in merged if m["t_kk_max"] is not None and m["t_kk_min"] is not None]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "a5_count": len(a5),
                "a6_count": len(a6),
                "merged_count": len(merged),
                "complete_count": len(complete),
                "missing_max": [m["ten_tram"] for m in merged if m["t_kk_max"] is None],
                "missing_min": [m["ten_tram"] for m in merged if m["t_kk_min"] is None],
                "merged": merged,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"complete={len(complete)} merged={len(merged)} a5={len(a5)} a6={len(a6)}")

    lines = [
        'import type { Tb15Row } from "@/lib/tb15Catalogs";',
        "",
        "/** Auto-generated from QCVN 02:2022/BXD bảng A.5 + A.6 (cột Năm). Do not edit by hand. */",
        "export const TB15_CLIMATE_SEED: Tb15Row[] = [",
    ]
    for m in complete:
        rid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"qcvn-a5a6:{m['ten_tram'].casefold()}"))
        ten = m["ten_tram"].replace("\\", "\\\\").replace('"', '\\"')
        tmax = ", ".join(str(v) for v in m["t_max_thang"])
        tmin = ", ".join(str(v) for v in m["t_min_thang"])
        lines.append(
            "  {"
            f' id: "{rid}", ma_tram: "{m["stt"]}", ten_tram: "{ten}", tinh: "",'
            f' t_kk_max: {m["t_kk_max"]}, t_kk_min: {m["t_kk_min"]},'
            f" t_max_thang: [{tmax}], t_min_thang: [{tmin}],"
            f' nguon: "QCVN 02:2022/BXD", ghi_chu: ""'
            " },"
        )
    lines.append("];")
    lines.append("")
    SEED_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {SEED_OUT} ({len(complete)} rows)")


if __name__ == "__main__":
    main()
