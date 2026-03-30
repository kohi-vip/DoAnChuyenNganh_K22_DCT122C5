from decimal import Decimal
from pydantic import BaseModel, Field


class WalletCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    currency: str = "VND"
    icon: str | None = None
    color: str | None = None
    initial_balance: Decimal = Field(default=Decimal("0"), ge=0)


class WalletUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None


class WalletResponse(BaseModel):
    id: str
    name: str
    wallet_type: str
    balance: Decimal
    currency: str
    icon: str | None
    color: str | None
    is_active: bool

    model_config = {"from_attributes": True}
