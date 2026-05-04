import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Enum, Index, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class TransactionType(str, enum.Enum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"
    REFUND = "refund"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(UUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)

    original_currency: Mapped[str] = mapped_column(String(10), default="CNY")
    original_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    base_currency: Mapped[str] = mapped_column(String(10), default="CNY")
    base_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    account_id: Mapped[str] = mapped_column(UUID, ForeignKey("accounts.id"), nullable=False)
    transfer_account_id: Mapped[str | None] = mapped_column(UUID, ForeignKey("accounts.id"), nullable=True)

    parent_id: Mapped[str | None] = mapped_column(UUID, ForeignKey("transactions.id"), nullable=True)

    merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    remark: Mapped[str | None] = mapped_column(String(500), nullable=True)

    external_tx_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    external_source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    transaction_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_user_date", "user_id", "transaction_date"),
        Index("idx_user_external_tx", "user_id", "external_tx_id"),
        Index("idx_user_account", "user_id", "account_id"),
        Index("idx_parent", "parent_id"),
    )

    user = relationship("User", back_populates="transactions")
    account = relationship(
        "Account",
        back_populates="transactions",
        foreign_keys=[account_id],
    )
    transfer_account = relationship("Account", foreign_keys=[transfer_account_id])
    parent = relationship("Transaction", remote_side=[id], backref="refunds")
    tags = relationship("TransactionTag", back_populates="transaction", lazy="dynamic")
