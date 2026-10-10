from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base

class KnowledgeMessage(Base):
    __tablename__ = "knowledge_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("knowledge_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    sources_json = Column(Text, nullable=True) # JSON string of sources used if assistant
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
