"""Extract the source workbook for the read-only TB 10015 tab (requires openpyxl)."""

import json
import sys
from pathlib import Path

from openpyxl import load_workbook


APP = Path(__file__).resolve().parents[1]
SOURCE = APP.parent / "TB 10015-2012 - Bảng tính thiết kế kiểm toán CWR.xlsx"
TARGET = APP / "src/features/lwr/data/tb10015.json"


def extract(source):
    workbook = load_workbook(source)
    cache = load_workbook(source, data_only=True)
    sheets = []
    for sheet in workbook:
        rows = []
        formula_count = 0
        for row in sheet.iter_rows():
            cells = {}
            for cell in row:
                if cell.value is None:
                    continue
                value = cell.value
                if cell.data_type == "f":
                    value = {"formula": value, "result": cache[sheet.title][cell.coordinate].value}
                    formula_count += 1
                cells[cell.column_letter] = value
            if not cells:
                continue
            record = {"number": row[0].row, "cells": cells}
            # Styles 6 and 7 mark the column headers and section titles in this workbook.
            if row[0].style_id == 6:
                record["kind"] = "header"
            elif row[0].style_id == 7:
                record["kind"] = "section"
            rows.append(record)
        sheets.append({"name": sheet.title, "formulaCount": formula_count, "rows": rows})
    return {"source": source.name, "sheets": sheets}


if __name__ == "__main__":
    data = extract(Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE)
    TARGET.parent.mkdir(exist_ok=True)
    # One worksheet row per line makes future changes to the workbook reviewable.
    def encode(value):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)

    sections = []
    for sheet in data["sheets"]:
        rows = ",\n".join(encode(row) for row in sheet["rows"])
        sections.append('{"name":' + encode(sheet["name"]) + ',"formulaCount":' +
                        str(sheet["formulaCount"]) + ',"rows":[\n' + rows + '\n]}')
    TARGET.write_text('{"source":' + encode(data["source"]) + ',"sheets":[\n' +
                      ",\n".join(sections) + '\n]}\n', encoding="utf-8", newline="\n")
    print(f'{len(sections)} sheets, {sum(s["formulaCount"] for s in data["sheets"])} formulas')
