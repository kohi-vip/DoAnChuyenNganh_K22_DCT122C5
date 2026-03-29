from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    wallet_id: str
    category_id: str | None = None
    type: str  # 'income' | 'expense'
    amount: Decimal = Field(gt=0)
    currency: str = "VND"
    note: str | None = None
    transacted_at: datetime
    receipt_url: str | None = None


class TransactionUpdate(BaseModel):
    category_id: str | None = None
    type: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    note: str | None = None
    transacted_at: datetime | None = None
    receipt_url: str | None = None
    is_reviewed: bool | None = None


class TransactionResponse(BaseModel):
    id: str
    wallet_id: str
    category_id: str | None
    recurring_id: str | None
    type: str
    amount: Decimal
    currency: str
    note: str | None
    source: str
    is_reviewed: bool
    receipt_url: str | None
    transacted_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
