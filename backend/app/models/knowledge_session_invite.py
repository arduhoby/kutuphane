from sqlalchemy import Column, Integer, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base

class KnowledgeSessionInvite(Base):
    __tablename__ = "knowledge_session_invites"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("knowledge_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="viewer", nullable=False) # 'viewer', 'editor'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
