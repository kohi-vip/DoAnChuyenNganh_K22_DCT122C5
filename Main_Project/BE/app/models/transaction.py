import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Boolean, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id: Mapped[str] = mapped_column(String(36), ForeignKey("wallets.id"), nullable=False, index=True)
    category_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    recurring_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("recurring_transactions.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'income' | 'expense'
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="VND")
    note: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # 'manual' | 'auto_sync'
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=True)
    receipt_url: Mapped[str | None] = mapped_column(String(500))
    transacted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="transactions")
    category: Mapped["Category | None"] = relationship("Category", back_populates="transactions")
    recurring: Mapped["RecurringTransaction | None"] = relationship("RecurringTransaction", back_populates="generated_transactions")
