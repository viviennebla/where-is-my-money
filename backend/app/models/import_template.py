import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, JSON, UniqueConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ImportTemplate(Base):
    __tablename__ = "import_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    platform_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_mapping: Mapped[dict] = mapped_column(JSON, nullable=False)
    file_format_hint: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "platform_name", name="uq_user_platform"),
    )

    user = relationship("User", back_populates="import_templates")
