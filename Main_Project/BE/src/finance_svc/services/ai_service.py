import json
import statistics
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from groq import Groq
import httpx
from fastapi import HTTPException
from finance_svc.core.config import get_settings
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.category import Category
from finance_svc.schemas.ai import (
    ParsedTransaction, NLQueryResponse, InsightResponse,
    AnomalyItem, AnomalyResponse, ChatMessage, ChatResponse,
    JellyChatRequest, JellyChatResponse,
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


def _build_user_financial_context(db: Session, user_id: str) -> dict:
    """
    Lấy toàn bộ context tài chính của user (tháng này + tháng trước)
    để inject vào system prompt cho AI trả lời chi tiết theo từng danh mục.
    """
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    now = datetime.now()

    def _get_month_summary(month: int, year: int) -> dict:
        q_base = db.query(Transaction).filter(
            Transaction.wallet_id.in_(wallet_ids),
            Transaction.is_reviewed == True,
            extract("month", Transaction.transacted_at) == month,
            extract("year", Transaction.transacted_at) == year,
        )
        income = float(q_base.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or 0)
        expense = float(q_base.filter(Transaction.type == "expense").with_entities(func.sum(Transaction.amount)).scalar() or 0)

        # Tất cả danh mục chi tiêu tháng đó
        expense_by_cat = (
            db.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(
                Transaction.wallet_id.in_(wallet_ids),
                Transaction.is_reviewed == True,
                Transaction.type == "expense",
                extract("month", Transaction.transacted_at) == month,
                extract("year", Transaction.transacted_at) == year,
            )
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        expense_cats_str = "\n".join([
            f"    • {r.name}: {float(r.total):,.0f}đ" for r in expense_by_cat
        ]) or "    (chưa có)"

        # Tất cả danh mục thu nhập
        income_by_cat = (
            db.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(
                Transaction.wallet_id.in_(wallet_ids),
                Transaction.is_reviewed == True,
                Transaction.type == "income",
                extract("month", Transaction.transacted_at) == month,
                extract("year", Transaction.transacted_at) == year,
            )
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        income_cats_str = "\n".join([
            f"    • {r.name}: {float(r.total):,.0f}đ" for r in income_by_cat
        ]) or "    (chưa có)"

        return {
            "income": income,
            "expense": expense,
            "balance": income - expense,
            "expense_cats_str": expense_cats_str,
            "income_cats_str": income_cats_str,
        }

    this_month = _get_month_summary(now.month, now.year)
    prev_month_date = (now.replace(day=1) - __import__("datetime").timedelta(days=1))
    prev_month = _get_month_summary(prev_month_date.month, prev_month_date.year)

    # 10 giao dịch gần nhất
    recent_txns = (
        db.query(Transaction, Category.name.label("cat_name"))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True)
        .order_by(Transaction.transacted_at.desc())
        .limit(10)
        .all()
    )
    recent_str = "\n".join([
        f"    • {t.transacted_at.strftime('%d/%m') if t.transacted_at else '??'} "
        f"{'Thu' if t.type == 'income' else 'Chi'} {float(t.amount):,.0f}đ "
        f"— {cat or '?'} ({t.note or 'không ghi chú'})"
        for t, cat in recent_txns
    ]) or "    (chưa có giao dịch)"

    return {
        "now": now,
        "prev_month_date": prev_month_date,
        "this_month": this_month,
        "prev_month": prev_month,
        "recent_str": recent_str,
    }


def chat(db: Session, user_id: str, message: str, session_id: str | None) -> ChatResponse:
    if not session_id:
        session_id = str(uuid.uuid4())

    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = []

    ctx = _build_user_financial_context(db, user_id)
    now = ctx["now"]
    tm = ctx["this_month"]
    pm = ctx["prev_month"]
    pmd = ctx["prev_month_date"]

    system_prompt = f"""Bạn là Jelly — chuyên viên tư vấn tài chính cá nhân của ứng dụng CaiSoCai.

═══ DỮ LIỆU TÀI CHÍNH CÁ NHÂN CỦA NGƯỜI DÙNG ═══

▌ THÁNG NÀY ({now.month}/{now.year}):
  Tổng thu: {tm['income']:,.0f} VND
  Tổng chi: {tm['expense']:,.0f} VND
  Số dư: {tm['balance']:,.0f} VND
  Chi tiêu theo danh mục:
{tm['expense_cats_str']}
  Thu nhập theo danh mục:
{tm['income_cats_str']}

▌ THÁNG TRƯỚC ({pmd.month}/{pmd.year}):
  Tổng thu: {pm['income']:,.0f} VND
  Tổng chi: {pm['expense']:,.0f} VND
  Số dư: {pm['balance']:,.0f} VND
  Chi tiêu theo danh mục:
{pm['expense_cats_str']}

▌ 10 GIAO DỊCH GẦN NHẤT:
{ctx['recent_str']}

═══════════════════════════════════════════════════

PHẠM VI: Chỉ tư vấn về quản lý thu chi cá nhân, tiết kiệm, lập ngân sách. Từ chối lịch sự nếu hỏi ngoài phạm vi.

QUY TẮC TRẢ LỜI:
1. Luôn dùng tiếng Việt tự nhiên, ngắn gọn, dễ hiểu
2. Câu hỏi về số tiền theo danh mục → tra cứu từ dữ liệu ở trên và trích dẫn chính xác
3. So sánh tháng này vs tháng trước khi có liên quan
4. Phân tích chi tiêu → nêu: tổng / nhóm chính / điểm bất thường / gợi ý tiết kiệm cụ thể
5. Độ dài: 2-4 câu cho câu thường, tối đa 8 câu cho phân tích sâu
6. Không tư vấn đầu tư rủi ro cao khi chưa đủ dữ liệu"""

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


async def jelly_chat(
    db: Session,
    user_id: str,
    message: str,
    session_id: str | None,
    image_base64: str | None = None,
    image_name: str | None = None,
    image_mime_type: str | None = None,
) -> JellyChatResponse:
    """
    Proxy sang n8n Jelly chatbot.
    - Inject toàn bộ context tài chính của user (tháng này + tháng trước) vào message
    - Forward sang n8n webhook với image nếu có
    - Parse SSE streaming response hoặc JSON thường từ n8n
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    n8n_url = settings.n8n_webhook_url
    if not n8n_url:
        raise HTTPException(
            status_code=503,
            detail="n8n AI service chưa cấu hình. Vui lòng set N8N_WEBHOOK_URL trong .env",
        )

    # Build context tài chính để bơm vào message gửi n8n
    ctx = _build_user_financial_context(db, user_id)
    now = ctx["now"]
    tm = ctx["this_month"]
    pm = ctx["prev_month"]
    pmd = ctx["prev_month_date"]

    context_block = (
        f"[DỮ LIỆU TÀI CHÍNH NGƯỜI DÙNG]\n"
        f"Tháng {now.month}/{now.year}: Thu {tm['income']:,.0f}đ | Chi {tm['expense']:,.0f}đ | Dư {tm['balance']:,.0f}đ\n"
        f"Chi theo danh mục tháng này:\n{tm['expense_cats_str']}\n"
        f"Tháng {pmd.month}/{pmd.year}: Thu {pm['income']:,.0f}đ | Chi {pm['expense']:,.0f}đ | Dư {pm['balance']:,.0f}đ\n"
        f"Chi theo danh mục tháng trước:\n{pm['expense_cats_str']}\n"
        f"10 giao dịch gần nhất:\n{ctx['recent_str']}\n"
        f"\n[CÂU HỎI CỦA NGƯỜI DÙNG]\n{message}"
    )

    payload: dict = {
        "action": "sendMessage",
        "sessionId": session_id,
        "chatInput": context_block,
    }
    if image_base64:
        payload["image"] = {
            "name": image_name or "receipt.jpg",
            "mimeType": image_mime_type or "image/jpeg",
            "data": image_base64,
        }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(n8n_url, json=payload)
            response.raise_for_status()

            body = response.text.strip()
            reply = ""

            lines = [l.strip() for l in body.splitlines() if l.strip()]
            has_sse_prefix = any(l.startswith("data:") for l in lines)

            if has_sse_prefix:
                # SSE format: data: {"text":"..."} / data: {"done":true}
                for line in lines:
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if not data_str or data_str == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(data_str)
                        if "text" in chunk:
                            reply += chunk["text"]
                        elif "output" in chunk:
                            reply = chunk["output"]
                            break
                        elif chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        if data_str not in ("[DONE]", ""):
                            reply += data_str
            else:
                # NDJSON — n8n streaming gửi nhiều dòng JSON với field "type"
                # Các event types: "begin"(metadata), "token"/"chunk"/"text"(nội dung), "end"(kết thúc)
                text_chunks: list[str] = []
                final_output: str | None = None

                for line in lines:
                    try:
                        chunk = json.loads(line)
                        event_type = chunk.get("type", "")

                        if event_type == "begin":
                            # Metadata event — bỏ qua
                            continue

                        if event_type == "end":
                            # n8n có thể nhét output vào end event
                            for key in ("output", "text", "response", "message"):
                                val = chunk.get(key)
                                if isinstance(val, str) and val.strip():
                                    final_output = final_output or val
                                    break
                                elif isinstance(val, dict):
                                    for k in ("text", "output", "content", "message"):
                                        if val.get(k):
                                            final_output = final_output or str(val[k])
                                            break
                            continue

                        # n8n Agent streaming: type="item" với content từng chunk
                        if event_type == "item" and isinstance(chunk.get("content"), str):
                            text_chunks.append(chunk["content"])
                        # Các format khác (dự phòng)
                        elif isinstance(chunk.get("text"), str) and chunk["text"]:
                            text_chunks.append(chunk["text"])
                        elif isinstance(chunk.get("token"), str) and chunk["token"]:
                            text_chunks.append(chunk["token"])
                        elif isinstance(chunk.get("output"), str) and chunk["output"]:
                            final_output = chunk["output"]
                        elif isinstance(chunk.get("message"), str) and chunk["message"]:
                            final_output = final_output or chunk["message"]
                        elif isinstance(chunk.get("response"), str) and chunk["response"]:
                            final_output = final_output or chunk["response"]

                    except json.JSONDecodeError:
                        pass

                if text_chunks:
                    reply = "".join(text_chunks)
                elif final_output:
                    reply = final_output
                else:
                    # Không parse được — trả body thô để debug (tối đa 500 ký tự)
                    reply = f"[DEBUG] n8n response không parse được: {body[:500]}"

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="n8n AI service timeout — thử lại sau.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"n8n trả về lỗi HTTP {e.response.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không kết nối được n8n: {str(e)}")

    return JellyChatResponse(session_id=session_id, reply=reply.strip() or "Jelly chưa trả lời được. Thử lại nhé!")
