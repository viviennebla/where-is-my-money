import base64

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


def _derive_fernet() -> Fernet:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"wimm-key-encryption",
        info=b"api-key",
    )
    key = base64.urlsafe_b64encode(hkdf.derive(settings.JWT_SECRET_KEY.encode()))
    return Fernet(key)


def encrypt_api_key(plaintext: str) -> bytes:
    return _derive_fernet().encrypt(plaintext.encode())


def decrypt_api_key(ciphertext: bytes) -> str | None:
    try:
        return _derive_fernet().decrypt(ciphertext).decode()
    except Exception:
        return None


async def get_user_api_key(db: AsyncSession, user_id: str) -> str | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user and user.api_key_encrypted:
        return decrypt_api_key(user.api_key_encrypted)
    return None
