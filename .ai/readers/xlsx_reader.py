"""Extract structured content from Excel (.xlsx / .xlsm) files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


def _serialize_cell(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def read_xlsx(path: Path) -> dict[str, Any]:
    wb = load_workbook(str(path), data_only=True, read_only=True)

    sheets: list[dict[str, Any]] = []
    total_rows = 0
    total_cells_filled = 0

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows_data: list[list[Any]] = []
        headers: list[Any] = []
        max_col = 0

        for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
            values = [_serialize_cell(v) for v in row]
            # Trim trailing empty cells
            while values and values[-1] is None:
                values.pop()
            if not values or all(v is None or str(v).strip() == "" for v in values):
                continue
            max_col = max(max_col, len(values))
            total_cells_filled += sum(1 for v in values if v is not None and str(v).strip() != "")
            if row_idx == 0 and not headers:
                headers = values
            rows_data.append(values)

        # Prefer first non-empty row as header for analysis
        preview_headers = headers if headers else []
        col_letters = [get_column_letter(i + 1) for i in range(max_col)]

        sheets.append(
            {
                "name": sheet_name,
                "rows": len(rows_data),
                "cols": max_col,
                "headers": preview_headers,
                "columns": col_letters,
                "data": rows_data,
            }
        )
        total_rows += len(rows_data)

    props = wb.properties
    metadata = {
        "title": props.title or None,
        "creator": props.creator or None,
        "subject": props.subject or None,
        "created": props.created.isoformat() if props.created else None,
        "modified": props.modified.isoformat() if props.modified else None,
        "last_modified_by": props.lastModifiedBy or None,
        "sheet_names": list(wb.sheetnames),
    }

    wb.close()

    return {
        "format": "xlsx",
        "metadata": metadata,
        "stats": {
            "sheet_count": len(sheets),
            "total_rows": total_rows,
            "filled_cells": total_cells_filled,
        },
        "sheets": sheets,
    }
