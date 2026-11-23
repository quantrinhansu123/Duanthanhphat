# `.ai` — Document analyzers

Python tools to extract and analyze content from `.docx`, `.xlsx`, and `.pdf`, then save structured JSON.

## Setup

```bash
python -m pip install -r .ai/requirements.txt
```

## Usage

```bash
# Analyze one file
python .ai/analyze.py path/to/file.docx

# Analyze a folder (recursive)
python .ai/analyze.py path/to/folder --out .ai/output

# Only specific types
python .ai/analyze.py path/to/folder --types docx,xlsx,pdf
```

Results are written under `.ai/output/` as JSON (one file per source + a `manifest.json` index).
