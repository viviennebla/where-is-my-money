import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    emoji: Mapped[str | None] = mapped_column(String(10), nullable=True)
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tags.id"), nullable=True)
    is_system_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_tag_name"),
    )

    user = relationship("User", back_populates="tags")
    parent = relationship("Tag", remote_side=[id], backref="children")
    transactions = relationship("TransactionTag", back_populates="tag", lazy="selectin")
