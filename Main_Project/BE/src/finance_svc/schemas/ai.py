from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class ParseTransactionRequest(BaseModel):
    text: str


class ParsedTransaction(BaseModel):
    amount: Decimal | None = None
    type: str | None = None  # 'income' | 'expense'
    category: str | None = None
    note: str | None = None
    transacted_at: datetime | None = None
    confidence: float = 1.0


class NLQueryRequest(BaseModel):
    question: str


class NLQueryResponse(BaseModel):
    question: str
    answer: str
    data: dict | None = None


class OCRReceiptResponse(BaseModel):
    amount: Decimal | None = None
    date: str | None = None
    vendor: str | None = None
    suggested_category: str | None = None
    line_items: list[dict] = []
    raw_data: dict = {}


class InsightResponse(BaseModel):
    analysis: str
    suggestions: list[str]
    period: str


class AnomalyItem(BaseModel):
    category: str
    amount: Decimal
    mean: Decimal
    z_score: float
    description: str


class AnomalyResponse(BaseModel):
    anomalies: list[AnomalyItem]
    total_found: int


class ChatMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    history: list[ChatMessage]
