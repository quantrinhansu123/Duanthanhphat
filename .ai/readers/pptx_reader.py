"""Extract text/tables from PowerPoint (.pptx)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE


def _shape_text(shape) -> str:
    if not getattr(shape, "has_text_frame", False):
        return ""
    parts = []
    for para in shape.text_frame.paragraphs:
        t = "".join(run.text for run in para.runs).strip()
        if not t and para.text:
            t = para.text.strip()
        if t:
            parts.append(t)
    return "\n".join(parts)


def _table_data(shape) -> list[list[str]]:
    table = shape.table
    rows: list[list[str]] = []
    for r in table.rows:
        rows.append([(cell.text or "").strip() for cell in r.cells])
    return rows


def read_pptx(path: Path) -> dict[str, Any]:
    prs = Presentation(str(path))
    slides: list[dict[str, Any]] = []
    all_tables: list[dict[str, Any]] = []
    full_parts: list[str] = []

    for i, slide in enumerate(prs.slides):
        texts: list[str] = []
        tables: list[list[list[str]]] = []
        for shape in slide.shapes:
            if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                continue
            if getattr(shape, "has_table", False):
                td = _table_data(shape)
                tables.append(td)
                all_tables.append({"slide": i + 1, "data": td})
            t = _shape_text(shape)
            if t:
                texts.append(t)
                full_parts.append(t)
        slides.append(
            {
                "slide": i + 1,
                "texts": texts,
                "table_count": len(tables),
                "tables": tables,
            }
        )

    full_text = "\n\n".join(full_parts)
    return {
        "format": "pptx",
        "metadata": {
            "slide_count": len(slides),
            "slide_width": int(prs.slide_width) if prs.slide_width else None,
            "slide_height": int(prs.slide_height) if prs.slide_height else None,
        },
        "stats": {
            "slide_count": len(slides),
            "table_count": len(all_tables),
            "char_count": len(full_text),
            "word_count": len(full_text.split()) if full_text else 0,
        },
        "slides": slides,
        "tables": all_tables,
        "text": full_text,
    }
