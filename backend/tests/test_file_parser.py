import io
import pytest
from unittest.mock import patch, MagicMock

from app.utils.file_parser import find_header_row, parse_file_data, parse_file_preview


class TestFindHeaderRow:
    def test_finds_chinese_header(self):
        rows = [
            ["微信支付账单明细"],
            ["微信昵称：测试"],
            ["起始时间：2024-01-01"],
            [],
            ["交易时间", "交易类型", "交易对方", "金额(元)", "支付方式"],
            ["2024-01-01", "支出", "商户A", "100.00", "零钱"],
        ]
        idx = find_header_row(rows)
        assert idx == 4

    def test_finds_english_header(self):
        rows = [
            ["Report"],
            ["Generated: 2024"],
            [],
            ["Date", "Amount", "Description", "Type"],
            ["2024-01-01", "100", "Shopping", "expense"],
        ]
        idx = find_header_row(rows)
        assert idx == 3

    def test_first_row_when_no_keywords(self):
        rows = [
            ["A", "B", "C"],
            ["1", "2", "3"],
        ]
        idx = find_header_row(rows)
        assert idx == 0

    def test_empty_rows(self):
        assert find_header_row([]) == 0


class TestParseFileData:
    def test_csv_from_header(self):
        content = "交易时间,金额,描述\n2024-01-01,100,购物\n2024-01-02,200,餐饮".encode("utf-8")
        headers, data = parse_file_data("test.csv", content, header_row_index=0)
        assert headers == ["交易时间", "金额", "描述"]
        assert len(data) == 2
        assert data[0] == ["2024-01-01", "100", "购物"]

    def test_csv_skip_metadata_rows(self):
        content = (
            "微信支付账单明细\n"
            "昵称：test\n"
            "\n"
            "交易时间,金额,描述\n"
            "2024-01-01,100,购物"
        ).encode("utf-8")
        headers, data = parse_file_data("test.csv", content, header_row_index=3)
        assert headers == ["交易时间", "金额", "描述"]
        assert len(data) == 1

    def test_row_limit(self):
        content = "a,b\n1,2\n3,4\n5,6\n7,8".encode("utf-8")
        headers, data = parse_file_data("test.csv", content, header_row_index=0, row_limit=2)
        assert len(data) == 2

    def test_empty_file(self):
        headers, data = parse_file_data("test.csv", b"", header_row_index=0)
        assert headers == []
        assert data == []

    @patch("app.utils.file_parser.load_workbook")
    def test_excel_from_header(self, mock_load):
        mock_wb = MagicMock()
        mock_ws = MagicMock()
        mock_ws.iter_rows.return_value = [
            ("交易时间", "金额"),
            ("2024-01-01", "100"),
        ]
        mock_wb.active = mock_ws
        mock_load.return_value = mock_wb

        headers, data = parse_file_data("test.xlsx", b"fake", header_row_index=0)
        assert headers == ["交易时间", "金额"]
        assert len(data) == 1


class TestParseFilePreview:
    def test_returns_dict_with_headers_and_sample_rows(self):
        content = "交易时间,金额,描述\n2024-01-01,100,购物\n2024-01-02,200,餐饮".encode("utf-8")
        result = parse_file_preview("test.csv", content, header_row_index=0, preview_rows=5)
        assert "headers" in result
        assert "sample_rows" in result
        assert "header_row_index" in result
        assert "total_rows" in result
        assert result["headers"] == ["交易时间", "金额", "描述"]
        assert result["header_row_index"] == 0
        assert result["total_rows"] == 2

    def test_auto_detect_header(self):
        content = (
            "微信支付账单明细\n"
            "昵称：test\n"
            "\n"
            "交易时间,金额\n"
            "2024-01-01,100\n"
            "2024-01-02,200"
        ).encode("utf-8")
        result = parse_file_preview("test.csv", content, header_row_index=None)
        assert result["header_row_index"] == 3
        assert result["headers"] == ["交易时间", "金额"]

    def test_csv_extension(self):
        content = "a,b\n1,2".encode("utf-8")
        result = parse_file_preview("test.csv", content, header_row_index=0)
        assert result["headers"] == ["a", "b"]

    def test_no_extension(self):
        content = "a,b\n1,2".encode("utf-8")
        result = parse_file_preview("testfile", content, header_row_index=0)
        assert result["headers"] == ["a", "b"]
