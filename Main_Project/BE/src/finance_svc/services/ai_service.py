import json
import statistics
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from groq import Groq
from finance_svc.core.config import get_settings
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.category import Category
from finance_svc.schemas.ai import (
    ParsedTransaction, NLQueryResponse, InsightResponse,
    AnomalyItem, AnomalyResponse, ChatMessage, ChatResponse,
)

settings = get_settings()

# In-memory chat sessions: session_id -> list of messages
_chat_sessions: dict[str, list[dict]] = {}

MAX_TURNS = 10


def _get_groq_client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


def _get_user_categories(db: Session, user_id: str) -> list[str]:
    cats = db.query(Category).filter(Category.user_id == user_id, Category.is_active == True).all()
    return [c.name for c in cats]


def parse_natural_language(db: Session, user_id: str, text: str) -> ParsedTransaction:
    categories = _get_user_categories(db, user_id)
    category_list = ", ".join(categories)

    system_prompt = f"""Bạn là trợ lý tài chính. Người dùng nhập câu mô tả giao dịch bằng tiếng Việt.
Trích xuất thông tin và trả về JSON (KHÔNG có text thêm):
{{
  "amount": <số tiền VND, "50k"=50000, "1tr"=1000000>,
  "type": <"income" hoặc "expense">,
  "category": <tên từ danh sách: [{category_list}]>,
  "note": <mô tả ngắn>,
  "transacted_at": <ISO8601 nếu có, null nếu không>
}}"""

    client = _get_groq_client()
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0,
        max_tokens=200,
    )

    raw = response.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return ParsedTransaction(note=text, confidence=0.0)

    try:
        data = json.loads(raw[start:end])
        transacted_at = None
        if data.get("transacted_at"):
            try:
                transacted_at = datetime.fromisoformat(data["transacted_at"])
            except Exception:
                pass
        return ParsedTransaction(
            amount=Decimal(str(data.get("amount", 0))) if data.get("amount") else None,
            type=data.get("type"),
            category=data.get("category"),
            note=data.get("note"),
            transacted_at=transacted_at,
        )
    except (json.JSONDecodeError, Exception):
        return ParsedTransaction(note=text, confidence=0.0)


def natural_language_query(db: Session, user_id: str, question: str) -> NLQueryResponse:
    categories = _get_user_categories(db, user_id)
    category_list = ", ".join(categories)

    extract_prompt = f"""Người dùng hỏi về tài chính cá nhân. Trích xuất tham số truy vấn và trả về JSON:
{{
  "category_keyword": <từ khóa danh mục hoặc null>,
  "month": <tháng 1-12 hoặc null>,
  "year": <năm hoặc null>,
  "query_type": <"sum_expense"|"sum_income"|"count"|"top_categories"|"general">,
  "type": <"income"|"expense"|null>
}}
Danh mục có sẵn: [{category_list}]
Câu hỏi: {question}"""

    client = _get_groq_client()
    r1 = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": extract_prompt}],
        temperature=0,
        max_tokens=150,
    )
    raw1 = r1.choices[0].message.content.strip()
    start = raw1.find("{")
    end = raw1.rfind("}") + 1
    params = {}
    if start != -1 and end > 0:
        try:
            params = json.loads(raw1[start:end])
        except Exception:
            params = {}

    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    q = db.query(Transaction).filter(
        Transaction.wallet_id.in_(wallet_ids),
        Transaction.is_reviewed == True,
    )
    if params.get("month"):
        q = q.filter(extract("month", Transaction.transacted_at) == params["month"])
    if params.get("year"):
        q = q.filter(extract("year", Transaction.transacted_at) == params["year"])
    if params.get("type"):
        q = q.filter(Transaction.type == params["type"])

    db_data = {}
    query_type = params.get("query_type", "general")

    if query_type in ("sum_expense", "sum_income"):
        total = q.with_entities(func.sum(Transaction.amount)).scalar() or 0
        db_data = {"total": float(total), "month": params.get("month"), "year": params.get("year")}
    elif query_type == "top_categories":
        rows = (
            db.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True)
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(5)
            .all()
        )
        db_data = {"top_categories": [{"name": r.name, "total": float(r.total)} for r in rows]}
    else:
        total = q.with_entities(func.sum(Transaction.amount)).scalar() or 0
        db_data = {"total": float(total)}

    answer_prompt = f"""Người dùng hỏi: "{question}"
Dữ liệu thực từ DB: {json.dumps(db_data, ensure_ascii=False)}
Viết câu trả lời ngắn gọn, tự nhiên bằng tiếng Việt, đơn vị tiền tệ là VND."""

    r2 = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": answer_prompt}],
        temperature=0.3,
        max_tokens=300,
    )
    answer = r2.choices[0].message.content.strip()
    return NLQueryResponse(question=question, answer=answer, data=db_data)


def get_insights(db: Session, user_id: str) -> InsightResponse:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    rows = (
        db.query(
            extract("year", Transaction.transacted_at).label("year"),
            extract("month", Transaction.transacted_at).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True)
        .group_by("year", "month", Transaction.type)
        .order_by("year", "month")
        .limit(6)
        .all()
    )

    summary = {}
    for r in rows:
        key = f"{int(r.year)}-{int(r.month):02d}"
        if key not in summary:
            summary[key] = {"income": 0.0, "expense": 0.0}
        summary[key][r.type] += float(r.total)

    data_str = json.dumps(summary, ensure_ascii=False)
    prompt = f"""Dữ liệu thu chi 3 tháng gần nhất của người dùng (VND): {data_str}
Phân tích xu hướng và đưa ra gợi ý tiết kiệm cụ thể. Trả về JSON:
{{
  "analysis": "<nhận xét tổng quan>",
  "suggestions": ["<gợi ý 1>", "<gợi ý 2>", "<gợi ý 3>"]
}}"""

    client = _get_groq_client()
    r = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=500,
    )
    raw = r.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    period = ", ".join(list(summary.keys())[-3:])
    try:
        data = json.loads(raw[start:end])
        return InsightResponse(
            analysis=data.get("analysis", ""),
            suggestions=data.get("suggestions", []),
            period=period,
        )
    except Exception:
        return InsightResponse(analysis=raw, suggestions=[], period=period)


def detect_anomalies(db: Session, user_id: str) -> AnomalyResponse:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    rows = (
        db.query(Category.name, Transaction.amount)
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True, Transaction.type == "expense")
        .all()
    )

    by_cat: dict[str, list[float]] = {}
    for r in rows:
        by_cat.setdefault(r.name, []).append(float(r.amount))

    raw_anomalies = []
    for category, amounts in by_cat.items():
        if len(amounts) < 3:
            continue
        mean = statistics.mean(amounts)
        stdev = statistics.stdev(amounts)
        if stdev == 0:
            continue
        for amount in amounts:
            z = (amount - mean) / stdev
            if z > 2.0:
                raw_anomalies.append({"category": category, "amount": amount, "mean": round(mean), "z_score": round(z, 2)})

    if not raw_anomalies:
        return AnomalyResponse(anomalies=[], total_found=0)

    client = _get_groq_client()
    anomaly_items = []
    for a in raw_anomalies:
        prompt = f"""Chi tiêu bất thường: danh mục "{a['category']}", số tiền {a['amount']:,.0f} VND (trung bình {a['mean']:,.0f} VND, z-score {a['z_score']}).
Viết 1 câu thông báo ngắn gọn bằng tiếng Việt."""
        r = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=80,
        )
        desc = r.choices[0].message.content.strip()
        anomaly_items.append(AnomalyItem(
            category=a["category"],
            amount=Decimal(str(a["amount"])),
            mean=Decimal(str(a["mean"])),
            z_score=a["z_score"],
            description=desc,
        ))

    return AnomalyResponse(anomalies=anomaly_items, total_found=len(anomaly_items))


def chat(db: Session, user_id: str, message: str, session_id: str | None) -> ChatResponse:
    if not session_id:
        session_id = str(uuid.uuid4())

    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = []

    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    now = datetime.now()
    q = db.query(Transaction).filter(
        Transaction.wallet_id.in_(wallet_ids),
        Transaction.is_reviewed == True,
        extract("month", Transaction.transacted_at) == now.month,
        extract("year", Transaction.transacted_at) == now.year,
    )
    monthly_income = q.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or 0
    monthly_expense = q.filter(Transaction.type == "expense").with_entities(func.sum(Transaction.amount)).scalar() or 0

    system_prompt = f"""Bạn là trợ lý tài chính thông minh, hỗ trợ người dùng bằng tiếng Việt.
Thông tin tài chính tháng {now.month}/{now.year}:
- Thu nhập: {float(monthly_income):,.0f} VND
- Chi tiêu: {float(monthly_expense):,.0f} VND
- Số dư: {float(monthly_income - monthly_expense):,.0f} VND
Hãy trả lời ngắn gọn, thực tế và hữu ích."""

    history = _chat_sessions[session_id]
    history.append({"role": "user", "content": message})

    if len(history) > MAX_TURNS * 2:
        history = history[-MAX_TURNS * 2:]
        _chat_sessions[session_id] = history

    client = _get_groq_client()
    messages = [{"role": "system", "content": system_prompt}] + history
    r = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.5,
        max_tokens=400,
    )
    reply = r.choices[0].message.content.strip()
    history.append({"role": "assistant", "content": reply})

    return ChatResponse(
        session_id=session_id,
        reply=reply,
        history=[ChatMessage(role=m["role"], content=m["content"]) for m in history],
    )
