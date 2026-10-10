from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base

class KnowledgeReport(Base):
    __tablename__ = "knowledge_reports"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("knowledge_sessions.id", ondelete="CASCADE"), nullable=False)
    topic = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=True) # SHA-256 hash of the content and snapshot
    share_token = Column(String(36), unique=True, index=True, nullable=True) # UUID for external sharing
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
