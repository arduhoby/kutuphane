from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, func, Table
from sqlalchemy.orm import relationship
from app.database import Base

book_shelves = Table(
    "book_shelves",
    Base.metadata,
    Column("book_id", Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("shelf_id", Integer, ForeignKey("shelves.id", ondelete="CASCADE"), primary_key=True)
)


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    author = Column(String(100), index=True)
    publisher = Column(String(100))
    isbn = Column(String(13), unique=True, index=True)
    page_count = Column(Integer)
    language = Column(String(10))
    publication_year = Column(String(15))
    
    # Legacy fields (will be removed later after data migration)
    shelf = Column(String(15))
    shelf_id = Column(Integer, ForeignKey("shelves.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # New many-to-many relationship
    shelves = relationship("Shelf", secondary=book_shelves, lazy="selectin")
    
    tags = Column(Text)
    notes = Column(Text)
    is_read = Column(Boolean, default=False)
    is_ebook = Column(Boolean, default=False)
    cover_url = Column(Text)
    pdf_url = Column(Text)
    epub_url = Column(Text)
    has_rag = Column(Boolean, default=False)
    has_digital_copy = Column(Boolean, default=False)
    ai_summary = Column(Text)
    category = Column(String(50))
    added_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
