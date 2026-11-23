#!/usr/bin/env python3
"""CLI: đọc DOCX / XLSX / PDF, phân tích và lưu JSON vào .ai/output."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

AI_DIR = Path(__file__).resolve().parent
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from readers import READERS  # noqa: E402
from storage import default_output_dir, save_result  # noqa: E402

SUPPORTED = {".docx", ".xlsx", ".xlsm", ".pdf", ".pptx"}


def analyze_file(path: Path) -> dict:
    suffix = path.suffix.lower()
    reader = READERS.get(suffix)
    if reader is None:
        raise ValueError(f"Unsupported type: {suffix} ({path.name})")
    return reader(path)


def collect_paths(target: Path, types: set[str]) -> list[Path]:
    if target.is_file():
        return [target] if target.suffix.lower() in types else []
    return [
        p
        for p in sorted(target.rglob("*"))
        if p.is_file() and p.suffix.lower() in types
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Phân tích file DOCX / XLSX / PDF và lưu dữ liệu JSON."
    )
    parser.add_argument("path", type=Path, help="File hoặc thư mục cần đọc")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Thư mục output (mặc định: .ai/output)",
    )
    parser.add_argument(
        "--types",
        default="docx,xlsx,xlsm,pdf,pptx",
        help="Các đuôi file cần lấy, cách nhau bởi dấu phẩy",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chỉ in danh sách file, không phân tích",
    )
    args = parser.parse_args(argv)

    target: Path = args.path
    if not target.exists():
        print(f"Không tìm thấy: {target}", file=sys.stderr)
        return 1

    types = {
        ("." + t.strip().lstrip(".")).lower()
        for t in args.types.split(",")
        if t.strip()
    }
    types &= SUPPORTED
    if not types:
        print("Không có loại file hợp lệ.", file=sys.stderr)
        return 1

    paths = collect_paths(target, types)
    if not paths:
        print("Không có file phù hợp.")
        return 0

    out_dir = args.out or default_output_dir()
    print(f"Tìm thấy {len(paths)} file → output: {out_dir}")

    if args.dry_run:
        for p in paths:
            print(f"  - {p}")
        return 0

    ok = 0
    failed = 0
    for path in paths:
        try:
            result = analyze_file(path)
            saved = save_result(result, source=path, out_dir=out_dir)
            stats = result.get("stats", {})
            print(f"[OK] {path.name} → {saved.name}  stats={stats}")
            ok += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[FAIL] {path}: {exc}", file=sys.stderr)

    print(f"Xong: {ok} thành công, {failed} lỗi.")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
