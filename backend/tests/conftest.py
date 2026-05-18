import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def mock_session():
    from unittest.mock import MagicMock

    session = AsyncMock()
    session.get = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()  # Synchronous in SQLAlchemy
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session
