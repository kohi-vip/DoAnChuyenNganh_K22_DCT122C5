from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class RecurringCreate(BaseModel):
    wallet_id: str
    category_id: str | None = None
    type: str  # 'income' | 'expense'
    amount: Decimal = Field(gt=0)
    note: str | None = None
    frequency: str  # 'daily' | 'weekly' | 'monthly' | 'yearly'
    next_due_date: date
    end_date: date | None = None


class RecurringUpdate(BaseModel):
    category_id: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    note: str | None = None
    frequency: str | None = None
    next_due_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class RecurringResponse(BaseModel):
    id: str
    wallet_id: str
    category_id: str | None
    type: str
    amount: Decimal
    note: str | None
    frequency: str
    next_due_date: date
    end_date: date | None
    is_active: bool

    model_config = {"from_attributes": True}
