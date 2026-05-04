import uuid
from sqlalchemy import ForeignKey, UniqueConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TransactionTag(Base):
    __tablename__ = "transaction_tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(String(36), ForeignKey("transactions.id"), nullable=False)
    tag_id: Mapped[str] = mapped_column(String(36), ForeignKey("tags.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("transaction_id", "tag_id", name="uq_tx_tag"),
    )

    transaction = relationship("Transaction", back_populates="tags")
    tag = relationship("Tag", back_populates="transactions")
