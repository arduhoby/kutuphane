from sqlalchemy import Column, Integer, Text, ForeignKey, func, DateTime
from app.database import Base


class BookChunk(Base):
    __tablename__ = "book_chunks"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    copy_id = Column(Integer, ForeignKey("digital_copies.id", ondelete="CASCADE"), nullable=True, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
