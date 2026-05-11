# Excel extraction (Python)

The app prefers **Python + openpyxl** for `.xlsx` files so each worksheet can be opened in turn, preamble/junk rows skipped, and a **header row detected** before reading tabular data.

## Setup

From the repository root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/python/requirements.txt
```

On Windows you can also install globally: `py -3 -m pip install -r backend/python/requirements.txt`.

## Point Next.js at Python

Set one of:

- **`PYTHON`** — full path to `python.exe` (recommended on Windows), or  
- rely on **`py -3`** / **`python3`** on `PATH`.

The API runs `backend/python/excel_extract.py` as a subprocess; if Python or openpyxl is missing, the app **falls back to SheetJS** (still reads all sheets in Node, with simpler header logic).

## What the script does

1. Loads the workbook with **openpyxl** (`data_only=True` so formulas become values).
2. Iterates **each sheet** (skips only `veryHidden` tabs).
3. Scans the top rows to find the best **header** row (keyword + text heuristics).
4. Emits one JSON object per data row, with `_sheet` and `_sourceRow` for traceability.

Legacy **`.xls`** is not handled here; the Node `xlsx` library still parses those.
