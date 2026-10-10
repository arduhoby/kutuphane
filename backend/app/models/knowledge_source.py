from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum

class SourceType(str, enum.Enum):
    BOOK = "book"
    DOCUMENT = "document"
    IMAGE = "image"
    VIDEO = "video"

class SourceStatus(str, enum.Enum):
    PENDING = "pending"
    INDEXED = "indexed"
    ERROR = "error"

class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("knowledge_sessions.id", ondelete="CASCADE"), nullable=False)
    
    source_type = Column(Enum(SourceType), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=True)
    digital_copy_id = Column(Integer, ForeignKey("digital_copies.id", ondelete="CASCADE"), nullable=True)
    
    file_path = Column(String, nullable=True)
    original_name = Column(String, nullable=False)
    
    status = Column(Enum(SourceStatus), default=SourceStatus.PENDING)
    chunk_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
