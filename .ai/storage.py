"""Persist analysis results as JSON."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _slug(name: str) -> str:
    base = Path(name).stem
    cleaned = re.sub(r"[^\w\-]+", "_", base, flags=re.UNICODE).strip("_")
    return cleaned[:80] or "file"


def default_output_dir() -> Path:
    return Path(__file__).resolve().parent / "output"


def save_result(
    result: dict[str, Any],
    *,
    source: Path,
    out_dir: Path | None = None,
) -> Path:
    out = out_dir or default_output_dir()
    out.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{_slug(source.name)}_{stamp}.json"
    target = out / filename

    payload = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "path": str(source.resolve()),
            "name": source.name,
            "suffix": source.suffix.lower(),
            "size_bytes": source.stat().st_size if source.exists() else None,
        },
        "result": result,
    }

    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    _update_manifest(out, payload, target)
    return target


def _update_manifest(out_dir: Path, payload: dict[str, Any], json_path: Path) -> None:
    manifest_path = out_dir / "manifest.json"
    entries: list[dict[str, Any]] = []
    if manifest_path.exists():
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                entries = data
            elif isinstance(data, dict) and isinstance(data.get("files"), list):
                entries = data["files"]
        except json.JSONDecodeError:
            entries = []

    entries.append(
        {
            "saved_at": payload["saved_at"],
            "source": payload["source"]["path"],
            "name": payload["source"]["name"],
            "format": payload["result"].get("format"),
            "output": str(json_path.resolve()),
            "stats": payload["result"].get("stats"),
        }
    )

    manifest_path.write_text(
        json.dumps(
            {
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "count": len(entries),
                "files": entries,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
