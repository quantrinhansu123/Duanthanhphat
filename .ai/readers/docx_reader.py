"""Extract structured content from Word (.docx) files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from docx import Document


def _cell_text(cell) -> str:
    return "\n".join(p.text.strip() for p in cell.paragraphs if p.text and p.text.strip())


def _table_to_rows(table) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table.rows:
        rows.append([_cell_text(c) for c in row.cells])
    return rows


def read_docx(path: Path) -> dict[str, Any]:
    doc = Document(str(path))

    paragraphs: list[dict[str, Any]] = []
    for i, para in enumerate(doc.paragraphs):
        text = (para.text or "").strip()
        if not text:
            continue
        style = para.style.name if para.style is not None else None
        paragraphs.append({"index": i, "style": style, "text": text})

    tables: list[dict[str, Any]] = []
    for i, table in enumerate(doc.tables):
        rows = _table_to_rows(table)
        tables.append(
            {
                "index": i,
                "rows": len(rows),
                "cols": max((len(r) for r in rows), default=0),
                "data": rows,
            }
        )

    core = doc.core_properties
    metadata = {
        "author": core.author or None,
        "title": core.title or None,
        "subject": core.subject or None,
        "created": core.created.isoformat() if core.created else None,
        "modified": core.modified.isoformat() if core.modified else None,
        "last_modified_by": core.last_modified_by or None,
        "revision": core.revision,
    }

    # Detect heading outline for quick structure view
    headings = [
        p for p in paragraphs if p.get("style") and str(p["style"]).startswith("Heading")
    ]

    full_text = "\n".join(p["text"] for p in paragraphs)

    return {
        "format": "docx",
        "metadata": metadata,
        "stats": {
            "paragraph_count": len(paragraphs),
            "heading_count": len(headings),
            "table_count": len(tables),
            "char_count": len(full_text),
            "word_count": len(full_text.split()) if full_text else 0,
        },
        "headings": headings,
        "paragraphs": paragraphs,
        "tables": tables,
        "text": full_text,
    }
