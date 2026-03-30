import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from finance_svc.models.base import Base


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_wallet_id: Mapped[str] = mapped_column(String(36), ForeignKey("wallets.id"), nullable=False)
    to_wallet_id: Mapped[str] = mapped_column(String(36), ForeignKey("wallets.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    transferred_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    from_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[from_wallet_id], back_populates="transfers_out")
    to_wallet: Mapped["Wallet"] = relationship("Wallet", foreign_keys=[to_wallet_id], back_populates="transfers_in")
