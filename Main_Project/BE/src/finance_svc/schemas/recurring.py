from datetime import date, datetime, time
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator


class RecurringCreate(BaseModel):
    wallet_id: str
    category_id: str | None = None
    type: str  # 'income' | 'expense'
    amount: Decimal = Field(gt=0)
    note: str | None = None
    frequency: str  # 'daily' | 'weekly' | 'monthly' | 'yearly'
    start_date: date | None = None
    next_due_date: date | None = None
    execution_time: time = Field(default=time(8, 0))
    end_date: date | None = None
    notification_enabled: bool = True
    remind_before_minutes: int = Field(default=30, ge=0)

    @model_validator(mode="after")
    def normalize_dates(self):
        if self.start_date is None and self.next_due_date is None:
            raise ValueError("start_date hoặc next_due_date là bắt buộc")
        if self.start_date is None:
            self.start_date = self.next_due_date
        self.next_due_date = self.start_date
        return self


class RecurringUpdate(BaseModel):
    category_id: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    note: str | None = None
    frequency: str | None = None
    start_date: date | None = None
    next_due_date: date | None = None
    execution_time: time | None = None
    end_date: date | None = None
    notification_enabled: bool | None = None
    remind_before_minutes: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class RecurringResponse(BaseModel):
    id: str
    wallet_id: str
    category_id: str | None
    type: str
    amount: Decimal
    note: str | None
    frequency: str
    start_date: date
    next_due_date: date
    execution_time: time
    end_date: date | None
    notification_enabled: bool
    remind_before_minutes: int
    is_active: bool

    model_config = {"from_attributes": True}
