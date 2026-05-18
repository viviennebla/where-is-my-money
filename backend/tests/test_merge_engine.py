import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from app.services.merge_engine import (
    upsert_transactions,
    _find_match,
    _merge,
    FUZZY_WINDOW_HOURS,
)
from app.models.transaction import Transaction, TransactionType


def _result_mock(return_value):
    """Helper: create a MagicMock whose scalar_one_or_none() returns the given value."""
    m = MagicMock()
    m.scalar_one_or_none.return_value = return_value
    return m


class TestFindMatch:
    @pytest.mark.asyncio
    async def test_strong_match_by_external_tx_id(self, mock_session):
        mock_session.execute.return_value = _result_mock("matched_tx")
        rec = {"external_tx_id": "ext-123"}
        result = await _find_match(mock_session, "user-1", rec)
        assert result == "matched_tx"

    @pytest.mark.asyncio
    async def test_no_match_by_external_tx_id_no_fallback(self, mock_session):
        mock_session.execute.return_value = _result_mock(None)
        rec = {"external_tx_id": "ext-nonexistent"}
        result = await _find_match(mock_session, "user-1", rec)
        assert result is None

    @pytest.mark.asyncio
    async def test_fuzzy_match_with_amount_type_date(self, mock_session):
        mock_session.execute.side_effect = [_result_mock(None), _result_mock("fuzzy_match")]
        rec = {
            "external_tx_id": "ext-unknown",
            "original_amount": Decimal("100.00"),
            "type": "expense",
            "transaction_date": datetime(2024, 6, 15, 12, 0, 0),
        }
        result = await _find_match(mock_session, "user-1", rec)
        assert result == "fuzzy_match"
        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_no_external_id_falls_to_fuzzy(self, mock_session):
        mock_session.execute.return_value = _result_mock("fuzzy_match")
        rec = {
            "original_amount": Decimal("50.00"),
            "type": "income",
            "transaction_date": datetime(2024, 6, 15),
        }
        result = await _find_match(mock_session, "user-1", rec)
        assert result == "fuzzy_match"

    @pytest.mark.asyncio
    async def test_uses_base_amount_as_fallback(self, mock_session):
        mock_session.execute.return_value = _result_mock("fuzzy_match")
        rec = {
            "base_amount": Decimal("75.00"),
            "type": "expense",
            "transaction_date": datetime(2024, 6, 15),
        }
        result = await _find_match(mock_session, "user-1", rec)
        assert result == "fuzzy_match"


class TestMerge:
    @pytest.mark.asyncio
    async def test_merge_enriches_with_richer_description(self):
        existing = MagicMock(spec=Transaction)
        existing.id = "tx-1"
        existing.merchant_name = "Old"
        existing.description = "Short"
        existing.remark = None
        existing.external_tx_id = "ext-1"
        existing.external_source = "wechat"

        rec = {
            "merchant_name": "New Name",
            "description": "A much longer description than before",
            "remark": None,
            "external_tx_id": "ext-1",
            "external_source": None,
        }

        diffs = await _merge(mock_session := AsyncMock(), existing, rec)
        # Old values had content, new values are richer → should be recorded as diffs, NOT applied
        assert existing.merchant_name == "Old"
        assert existing.description == "Short"
        assert existing.updated_at is not None
        assert len(diffs) == 2
        assert diffs[0] == {"transaction_id": "tx-1", "field": "merchant_name", "old": "Old", "new": "New Name"}
        assert diffs[1] == {"transaction_id": "tx-1", "field": "description", "old": "Short", "new": "A much longer description than before"}

    @pytest.mark.asyncio
    async def test_merge_fills_null_fields(self):
        existing = MagicMock(spec=Transaction)
        existing.id = "tx-2"
        existing.merchant_name = None
        existing.description = "Hello"
        existing.remark = None
        existing.external_tx_id = None
        existing.external_source = None

        rec = {
            "merchant_name": "New Merchant",
            "description": None,
            "remark": "New remark",
            "external_tx_id": "new-ext",
            "external_source": "alipay",
        }

        diffs = await _merge(mock_session := AsyncMock(), existing, rec)
        # Blanks should be filled
        assert existing.merchant_name == "New Merchant"
        assert existing.description == "Hello"
        assert existing.remark == "New remark"
        assert existing.external_tx_id == "new-ext"
        assert existing.external_source == "alipay"
        # No diffs since old was None for enriched fields (no overwrite conflict)
        assert diffs == []


class TestUpsertTransactions:
    @pytest.mark.asyncio
    async def test_all_new_records(self, mock_session):
        with patch("app.services.merge_engine._find_match", new_callable=AsyncMock) as mock_find:
            mock_find.return_value = None
            records = [
                {"type": "expense", "original_amount": Decimal("10.00"), "base_amount": Decimal("10.00"),
                 "account_id": str(uuid.uuid4()), "transaction_date": datetime.now()},
                {"type": "income", "original_amount": Decimal("20.00"), "base_amount": Decimal("20.00"),
                 "account_id": str(uuid.uuid4()), "transaction_date": datetime.now()},
            ]
            result = await upsert_transactions(mock_session, "user-1", records)
            assert result["created"] == 2
            assert result["updated"] == 0
            assert mock_session.add.call_count == 2
            mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_all_existing_records(self, mock_session):
        with patch("app.services.merge_engine._find_match", new_callable=AsyncMock) as mock_find, \
             patch("app.services.merge_engine._merge", new_callable=AsyncMock) as mock_merge:
            mock_find.return_value = MagicMock(spec=Transaction)
            mock_merge.return_value = []
            records = [
                {"type": "expense", "original_amount": Decimal("10.00"), "base_amount": Decimal("10.00"),
                 "account_id": str(uuid.uuid4()), "transaction_date": datetime.now()},
                {"type": "income", "original_amount": Decimal("20.00"), "base_amount": Decimal("20.00"),
                 "account_id": str(uuid.uuid4()), "transaction_date": datetime.now()},
            ]
            result = await upsert_transactions(mock_session, "user-1", records)
            assert result["created"] == 0
            assert result["updated"] == 2
            assert result["diffs"] == []
            mock_session.add.assert_not_called()
