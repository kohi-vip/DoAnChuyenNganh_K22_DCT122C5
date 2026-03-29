from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    from_wallet_id: str
    to_wallet_id: str
    amount: Decimal = Field(gt=0)
    note: str | None = None


class TransferResponse(BaseModel):
    id: str
    from_wallet_id: str
    to_wallet_id: str
    amount: Decimal
    note: str | None
    transferred_at: datetime

    model_config = {"from_attributes": True}
