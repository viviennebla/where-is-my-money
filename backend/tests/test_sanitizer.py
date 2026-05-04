from app.utils.sanitizer import sanitize_for_ai, _mask_if_numeric


class TestMaskIfNumeric:
    def test_plain_integer(self):
        assert _mask_if_numeric("123") == "[AMOUNT]"

    def test_decimal(self):
        assert _mask_if_numeric("12.34") == "[AMOUNT]"

    def test_negative_number(self):
        assert _mask_if_numeric("-56.78") == "[AMOUNT]"

    def test_number_with_comma(self):
        assert _mask_if_numeric("1,234.56") == "[AMOUNT]"

    def test_yen_symbol(self):
        assert _mask_if_numeric("¥100.00") == "[AMOUNT]"

    def test_dollar_symbol(self):
        assert _mask_if_numeric("$50.00") == "[AMOUNT]"

    def test_non_numeric_string(self):
        assert _mask_if_numeric("超市购物") == "超市购物"

    def test_alphanumeric(self):
        assert _mask_if_numeric("A123") == "A123"

    def test_empty_string(self):
        assert _mask_if_numeric("") == ""


class TestSanitizeForAI:
    def test_empty_list(self):
        assert sanitize_for_ai([]) == []

    def test_header_only(self):
        rows = [["日期", "金额", "描述"]]
        assert sanitize_for_ai(rows) == [["日期", "金额", "描述"]]

    def test_header_and_data(self):
        rows = [
            ["日期", "金额", "描述", "账户"],
            ["2024-01-01", "100.50", "超市购物", "622202***1234"],
            ["2024-01-02", "¥200.00", "餐饮", "支付宝"],
        ]
        result = sanitize_for_ai(rows)
        assert result[0] == ["日期", "金额", "描述", "账户"]
        assert result[1] == ["2024-01-01", "[AMOUNT]", "超市购物", "622202***1234"]
        assert result[2] == ["2024-01-02", "[AMOUNT]", "餐饮", "支付宝"]

    def test_all_amounts_masked(self):
        rows = [
            ["交易", "收入", "支出"],
            ["工资", "5000.00", "0"],
            ["购物", "0", "-299.00"],
        ]
        result = sanitize_for_ai(rows)
        # Row 1: both numbers
        assert result[1][1] == "[AMOUNT]"
        assert result[1][2] == "[AMOUNT]"
        # Row 2: second and third
        assert result[2][1] == "[AMOUNT]"
        assert result[2][2] == "[AMOUNT]"
