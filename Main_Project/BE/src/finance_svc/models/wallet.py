import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Boolean, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from finance_svc.models.base import Base


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    wallet_type: Mapped[str] = mapped_column(String(20), nullable=False, default="basic")
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(10), default="VND")
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="wallets")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="wallet", cascade="all, delete-orphan")
    transfers_out: Mapped[list["Transfer"]] = relationship("Transfer", foreign_keys="Transfer.from_wallet_id", back_populates="from_wallet")
    transfers_in: Mapped[list["Transfer"]] = relationship("Transfer", foreign_keys="Transfer.to_wallet_id", back_populates="to_wallet")
    recurring_transactions: Mapped[list["RecurringTransaction"]] = relationship("RecurringTransaction", back_populates="wallet")
