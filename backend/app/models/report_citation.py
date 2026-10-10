from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base

class ReportCitation(Base):
    __tablename__ = "report_citations"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("knowledge_reports.id", ondelete="CASCADE"), nullable=False)
    chunk_id = Column(Integer, ForeignKey("book_chunks.id", ondelete="CASCADE"), nullable=False)
    citation_index = Column(Integer, nullable=False) # e.g. 1, 2, 3 for [1], [2], [3]
    exact_quote = Column(Text, nullable=True) # The exact text from the chunk that was cited
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
