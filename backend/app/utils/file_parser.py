import csv
import io
from openpyxl import load_workbook


def parse_csv_preview(content: bytes, row_limit: int = 5) -> list[list[str]]:
    """Parse first N rows from CSV file."""
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = []
    for i, row in enumerate(reader):
        if i >= row_limit:
            break
        rows.append(row)
    return rows


def parse_excel_preview(content: bytes, row_limit: int = 5) -> list[list[str]]:
    """Parse first N rows from Excel file (first sheet)."""
    wb = load_workbook(filename=io.BytesIO(content), read_only=True)
    ws = wb.active
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i >= row_limit:
            break
        rows.append([str(cell) if cell is not None else "" for cell in row])
    wb.close()
    return rows


def parse_file_preview(filename: str, content: bytes, row_limit: int = 5) -> list[list[str]]:
    """Parse first N rows from file, auto-detecting CSV or Excel."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xlsx", "xls"):
        return parse_excel_preview(content, row_limit)
    else:
        return parse_csv_preview(content, row_limit)
