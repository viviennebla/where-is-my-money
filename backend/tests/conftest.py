import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.get = AsyncMock()
    session.execute = AsyncMock()
    session.add = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session
