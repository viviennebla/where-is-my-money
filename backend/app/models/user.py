import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts = relationship("Account", back_populates="user", lazy="dynamic")
    transactions = relationship("Transaction", back_populates="user", lazy="dynamic")
    tags = relationship("Tag", back_populates="user", lazy="dynamic")
    import_templates = relationship("ImportTemplate", back_populates="user", lazy="dynamic")
