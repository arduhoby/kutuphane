from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from app.database import Base


class PurchasePlan(Base):
    __tablename__ = "purchase_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    author = Column(String(100))
    isbn = Column(String(20))
    cover_url = Column(Text)
    source = Column(String(100))
    source_url = Column(Text)
    price = Column(String(50))
    notes = Column(Text)
    status = Column(String(20), default="plan")  # plan, bought, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
