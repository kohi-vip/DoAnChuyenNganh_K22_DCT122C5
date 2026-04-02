import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import String, Date, Numeric, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from finance_svc.models.base import Base


class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id: Mapped[str] = mapped_column(String(36), ForeignKey("wallets.id"), nullable=False)
    category_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'income' | 'expense'
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)  # 'daily'|'weekly'|'monthly'|'yearly'
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="recurring_transactions")
    category: Mapped["Category | None"] = relationship("Category", back_populates="recurring_transactions")
    generated_transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="recurring")
