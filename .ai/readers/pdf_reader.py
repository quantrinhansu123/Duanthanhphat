"""Extract structured content from PDF files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pdfplumber
from pypdf import PdfReader


def read_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    info = reader.metadata

    def _meta(key: str) -> str | None:
        if info is None:
            return None
        value = getattr(info, key, None)
        if value:
            return str(value)
        return None

    metadata = {
        "title": _meta("title"),
        "author": _meta("author"),
        "subject": _meta("subject"),
        "creator": _meta("creator"),
        "producer": _meta("producer"),
        "page_count_pypdf": len(reader.pages),
    }

    pages: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    full_parts: list[str] = []

    with pdfplumber.open(str(path)) as pdf:
        metadata["page_count"] = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = (page.extract_text() or "").strip()
            page_tables = page.extract_tables() or []
            parsed_tables: list[list[list[str | None]]] = []
            for t_idx, table in enumerate(page_tables):
                cleaned = [
                    [(cell.strip() if isinstance(cell, str) else cell) for cell in row]
                    for row in table
                ]
                parsed_tables.append(cleaned)
                tables.append(
                    {
                        "page": i + 1,
                        "index": t_idx,
                        "rows": len(cleaned),
                        "cols": max((len(r) for r in cleaned), default=0),
                        "data": cleaned,
                    }
                )

            pages.append(
                {
                    "page": i + 1,
                    "width": float(page.width) if page.width else None,
                    "height": float(page.height) if page.height else None,
                    "char_count": len(text),
                    "table_count": len(parsed_tables),
                    "text": text,
                    "tables": parsed_tables,
                }
            )
            if text:
                full_parts.append(text)

    full_text = "\n\n".join(full_parts)

    return {
        "format": "pdf",
        "metadata": metadata,
        "stats": {
            "page_count": metadata.get("page_count") or len(pages),
            "table_count": len(tables),
            "char_count": len(full_text),
            "word_count": len(full_text.split()) if full_text else 0,
            "pages_with_text": sum(1 for p in pages if p["text"]),
        },
        "pages": pages,
        "tables": tables,
        "text": full_text,
    }
