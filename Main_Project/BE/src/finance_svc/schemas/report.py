from decimal import Decimal
from pydantic import BaseModel


class SummaryResponse(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    balance: Decimal
    saving_rate: float | None


class CategoryBreakdown(BaseModel):
    category_id: str
    category_name: str
    amount: Decimal
    percentage: float


class CategoryReportResponse(BaseModel):
    period: str
    items: list[CategoryBreakdown]


class TrendPoint(BaseModel):
    period: str  # "YYYY-MM"
    income: Decimal
    expense: Decimal
    balance: Decimal


class TrendResponse(BaseModel):
    points: list[TrendPoint]


class CompareResponse(BaseModel):
    period1: str
    period2: str
    income1: Decimal
    income2: Decimal
    expense1: Decimal
    expense2: Decimal
    balance1: Decimal
    balance2: Decimal
