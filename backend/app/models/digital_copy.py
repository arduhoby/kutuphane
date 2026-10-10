from sqlalchemy import Boolean, Column, Integer, String, Text, BigInteger, DateTime, ForeignKey, func
from app.database import Base


class DigitalCopy(Base):
    __tablename__ = "digital_copies"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # pdf, epub, article, other
    file_path = Column(Text, nullable=False)
    original_filename = Column(String(255))
    file_size = Column(BigInteger)
    mime_type = Column(String(100))
    is_public = Column(Boolean, default=False)
    is_primary = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    description = Column(Text)
    rag_status = Column(String(255), default="skipped")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
