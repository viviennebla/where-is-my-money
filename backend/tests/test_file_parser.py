import io
import pytest
from unittest.mock import patch, MagicMock

from app.utils.file_parser import parse_csv_preview, parse_excel_preview, parse_file_preview


class TestParseCsvPreview:
    def test_basic_csv(self):
        content = "日期,金额,描述\n2024-01-01,100,购物".encode("utf-8")
        rows = parse_csv_preview(content)
        assert len(rows) == 2
        assert rows[0] == ["日期", "金额", "描述"]
        assert rows[1] == ["2024-01-01", "100", "购物"]

    def test_utf8_bom(self):
        content = b'\xef\xbb\xbf\xe6\x97\xa5\xe6\x9c\x9f,\xe9\x87\x91\xe9\xa2\x9d\n2024-01-01,100'
        rows = parse_csv_preview(content)
        assert rows[0] == ["日期", "金额"]

    def test_row_limit(self):
        content = "a,b\n1,2\n3,4\n5,6\n7,8\n9,10\n11,12".encode("utf-8")
        rows = parse_csv_preview(content, row_limit=3)
        assert len(rows) == 3

    def test_default_row_limit(self):
        content = "\n".join(["a,b"] + [f"{i},{i*2}" for i in range(10)]).encode("utf-8")
        rows = parse_csv_preview(content)
        assert len(rows) == 5

    def test_empty_csv(self):
        rows = parse_csv_preview(b"")
        assert rows == []


class TestParseExcelPreview:
    @patch("app.utils.file_parser.load_workbook")
    def test_basic_excel(self, mock_load):
        mock_wb = MagicMock()
        mock_ws = MagicMock()
        mock_ws.iter_rows.return_value = [
            (1, "支出", 100.0),
            (2, "收入", 200.0),
        ]
        mock_wb.active = mock_ws
        mock_load.return_value = mock_wb

        rows = parse_excel_preview(b"fake-xlsx-content")
        assert len(rows) == 2
        assert rows[0] == ["1", "支出", "100.0"]

    @patch("app.utils.file_parser.load_workbook")
    def test_row_limit(self, mock_load):
        mock_wb = MagicMock()
        mock_ws = MagicMock()
        mock_ws.iter_rows.return_value = [(i,) for i in range(10)]
        mock_wb.active = mock_ws
        mock_load.return_value = mock_wb

        rows = parse_excel_preview(b"fake", row_limit=3)
        assert len(rows) == 3

    @patch("app.utils.file_parser.load_workbook")
    def test_none_cell_becomes_empty(self, mock_load):
        mock_wb = MagicMock()
        mock_ws = MagicMock()
        mock_ws.iter_rows.return_value = [("a", None, "c")]
        mock_wb.active = mock_ws
        mock_load.return_value = mock_wb

        rows = parse_excel_preview(b"fake")
        assert rows[0] == ["a", "", "c"]


class TestParseFilePreview:
    def test_xlsx_extension(self):
        with patch("app.utils.file_parser.parse_excel_preview") as mock_excel:
            mock_excel.return_value = [["a"]]
            result = parse_file_preview("test.xlsx", b"fake")
            mock_excel.assert_called_once()

    def test_xls_extension(self):
        with patch("app.utils.file_parser.parse_excel_preview") as mock_excel:
            mock_excel.return_value = [["a"]]
            result = parse_file_preview("test.xls", b"fake")
            mock_excel.assert_called_once()

    def test_csv_extension(self):
        with patch("app.utils.file_parser.parse_csv_preview") as mock_csv:
            mock_csv.return_value = [["a"]]
            result = parse_file_preview("test.csv", b"fake")
            mock_csv.assert_called_once()

    def test_no_extension_falls_to_csv(self):
        with patch("app.utils.file_parser.parse_csv_preview") as mock_csv:
            mock_csv.return_value = [["a"]]
            result = parse_file_preview("testfile", b"fake")
            mock_csv.assert_called_once()
